
#!/usr/bin/env python3
"""
Migrate WordFusion V4 data from SQLite to PostgreSQL/Supabase.

Usage:
    python scripts/export-sqlite-to-postgres.py db/custom.db

The PostgreSQL connection is read from DATABASE_URL in .env.

IMPORTANT:
    - The PostgreSQL schema must already have been created with:
          npx prisma migrate deploy
    - This script does NOT delete existing PostgreSQL data.
    - It preserves the original IDs.
    - It stops on duplicate/conflicting records instead of silently
      ignoring them.
    - It verifies the row counts after migration.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

# ---------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------

TABLES = [
    "User",
    "Pack",
    "Category",
    "CrosswordPuzzle",
    "UserProgress",
    "PublishingSchedule",
]

BOOLEAN_COLUMNS = {
    "published",
    "completed",
    "isActive",
}

DATE_COLUMNS = {
    "createdAt",
    "updatedAt",
    "publishDate",
    "firstPublishedAt",
    "completedAt",
}


# ---------------------------------------------------------------------
# PostgreSQL driver
# ---------------------------------------------------------------------

def load_postgres_driver():
    """
    Prefer psycopg v3, but support psycopg2 as well.
    """
    try:
        import psycopg
        return "psycopg", psycopg
    except ImportError:
        pass

    try:
        import psycopg2
        return "psycopg2", psycopg2
    except ImportError:
        pass

    raise SystemExit(
        "\nPostgreSQL driver not installed.\n\n"
        "Install it with:\n\n"
        "    python -m pip install \"psycopg[binary]\"\n\n"
        "Then run this migration again.\n"
    )


# ---------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------

def load_database_url() -> str:
    """
    Read DATABASE_URL from the environment.

    If python-dotenv is installed, also load the project's .env file.
    """
    try:
        from dotenv import load_dotenv

        project_root = Path(__file__).resolve().parents[1]
        load_dotenv(project_root / ".env")
    except ImportError:
        pass

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise SystemExit(
            "\nDATABASE_URL was not found.\n\n"
            "Make sure your .env contains your Supabase PostgreSQL "
            "connection string, for example:\n\n"
            'DATABASE_URL="postgresql://..."\n'
        )

    if not database_url.startswith(("postgresql://", "postgres://")):
        raise SystemExit(
            "\nDATABASE_URL does not appear to be a PostgreSQL URL.\n"
            "For this migration it must point to your Supabase PostgreSQL "
            "database.\n"
        )

    return database_url


# ---------------------------------------------------------------------
# Data conversion
# ---------------------------------------------------------------------

def convert_datetime(value):
    """
    Convert common Prisma/SQLite DateTime representations into values
    PostgreSQL/psycopg can handle.

    Handles:
      - None
      - datetime
      - epoch milliseconds
      - epoch seconds
      - ISO strings
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value

    if isinstance(value, (int, float)):
        # Distinguish milliseconds from seconds.
        timestamp = value / 1000 if abs(value) > 10_000_000_000 else value
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(
            tzinfo=None
        )

    text = str(value).strip()

    if not text:
        return None

    # ISO format with Z
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError:
        # Leave unusual strings untouched. PostgreSQL may still accept them.
        return text


def convert_value(column, value):
    if value is None:
        return None

    if column in BOOLEAN_COLUMNS:
        return bool(value)

    if column in DATE_COLUMNS:
        return convert_datetime(value)

    return value


# ---------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------

def read_sqlite(sqlite_path: str):
    if not os.path.exists(sqlite_path):
        raise SystemExit(
            f"\nSQLite database not found:\n{sqlite_path}\n"
        )

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row

    print(f"\nReading SQLite database:")
    print(f"  {os.path.abspath(sqlite_path)}")

    data = {}

    try:
        for table in TABLES:
            rows = conn.execute(
                f'SELECT * FROM "{table}"'
            ).fetchall()

            columns = [description[0] for description in conn.execute(
                f'SELECT * FROM "{table}" LIMIT 1'
            ).description]

            data[table] = {
                "columns": columns,
                "rows": [dict(row) for row in rows],
            }

            print(f"  {table:<22} {len(rows):>6} rows")

    finally:
        conn.close()

    return data


# ---------------------------------------------------------------------
# PostgreSQL helpers
# ---------------------------------------------------------------------

def quote_identifier(name: str) -> str:
    """
    Safely quote a PostgreSQL identifier.
    """
    return '"' + name.replace('"', '""') + '"'


def get_placeholder(driver_name: str) -> str:
    if driver_name == "psycopg":
        return "%s"
    return "%s"


def connect_postgres(driver_name: str, driver, database_url: str):
    print("\nConnecting to PostgreSQL...")

    if driver_name == "psycopg":
        conn = driver.connect(database_url)
    else:
        conn = driver.connect(database_url)

    print("  PostgreSQL connection successful.")
    return conn


def get_postgres_count(cursor, table: str) -> int:
    cursor.execute(
        f"SELECT COUNT(*) FROM {quote_identifier(table)}"
    )
    return cursor.fetchone()[0]


# ---------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------

def migrate(sqlite_data, pg_conn, driver_name):
    cursor = pg_conn.cursor()
    placeholder = get_placeholder(driver_name)

    print("\nChecking PostgreSQL database before migration...")

    before_counts = {}

    for table in TABLES:
        count = get_postgres_count(cursor, table)
        before_counts[table] = count
        print(f"  {table:<22} {count:>6} existing rows")

    print(
        "\nThe migration will INSERT the SQLite records into the existing "
        "PostgreSQL schema."
    )

    try:
        for table in TABLES:
            table_data = sqlite_data[table]
            rows = table_data["rows"]
            columns = table_data["columns"]

            if not rows:
                continue

            quoted_columns = ", ".join(
                quote_identifier(column)
                for column in columns
            )

            placeholders = ", ".join(
                [placeholder] * len(columns)
            )

            sql = (
                f'INSERT INTO {quote_identifier(table)} '
                f'({quoted_columns}) '
                f'VALUES ({placeholders})'
            )

            print(f"\nMigrating {table}: {len(rows)} rows...")

            for index, row in enumerate(rows, start=1):
                values = [
                    convert_value(column, row.get(column))
                    for column in columns
                ]

                try:
                    cursor.execute(sql, values)
                except Exception as exc:
                    raise RuntimeError(
                        f"\nMigration failed while inserting "
                        f"{table} row {index}.\n"
                        f"Original record: {row}\n"
                        f"PostgreSQL error: {exc}"
                    ) from exc

                if index % 100 == 0 or index == len(rows):
                    print(f"  {index}/{len(rows)}")

        print("\nCommitting migration...")
        pg_conn.commit()

    except Exception:
        print("\nERROR: Rolling back the PostgreSQL transaction...")
        pg_conn.rollback()
        raise

    # -----------------------------------------------------------------
    # Verify
    # -----------------------------------------------------------------

    print("\nVerifying migration...")

    after_counts = {}

    for table in TABLES:
        count = get_postgres_count(cursor, table)
        after_counts[table] = count

    print("\n")
    print("=" * 68)
    print("SQLite → PostgreSQL migration report")
    print("=" * 68)
    print(
        f"{'Table':<24}"
        f"{'SQLite':>10}"
        f"{'Before':>10}"
        f"{'After':>10}"
        f"{'Status':>12}"
    )
    print("-" * 68)

    all_ok = True

    for table in TABLES:
        sqlite_count = len(sqlite_data[table]["rows"])
        before = before_counts[table]
        after = after_counts[table]

        expected = before + sqlite_count
        ok = after == expected

        if not ok:
            all_ok = False

        status = "OK" if ok else "MISMATCH"

        print(
            f"{table:<24}"
            f"{sqlite_count:>10}"
            f"{before:>10}"
            f"{after:>10}"
            f"{status:>12}"
        )

    print("=" * 68)

    if not all_ok:
        raise RuntimeError(
            "\nMigration completed but verification detected a mismatch."
        )

    print("\nSUCCESS")
    print("All SQLite records were successfully inserted into PostgreSQL.")
    print("\nYour original db/custom.db has NOT been modified.")


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: python scripts/export-sqlite-to-postgres.py db/custom.db"
        )

    sqlite_path = sys.argv[1]

    driver_name, driver = load_postgres_driver()
    database_url = load_database_url()

    print("\nWordFusion V4 — SQLite → PostgreSQL migration")
    print("-" * 55)

    sqlite_data = read_sqlite(sqlite_path)

    pg_conn = None

    try:
        pg_conn = connect_postgres(
            driver_name,
            driver,
            database_url,
        )

        migrate(
            sqlite_data,
            pg_conn,
            driver_name,
        )

    finally:
        if pg_conn is not None:
            pg_conn.close()

    print("\nMigration finished.")


if __name__ == "__main__":
    main()

