#!/usr/bin/env python3
"""Export V4's SQLite database as PostgreSQL-compatible INSERT statements.

Usage:
    python scripts/export-sqlite-to-postgres.py db/custom.db > v4-data.sql

Run the generated SQL only AFTER `prisma migrate deploy` has created the
PostgreSQL schema. This script preserves the existing IDs and data.
"""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone

TABLES = [
    "User",
    "Pack",
    "Category",
    "CrosswordPuzzle",
    "UserProgress",
    "PublishingSchedule",
]


DATE_COLUMNS = {
    "createdAt",
    "updatedAt",
    "publishDate",
    "firstPublishedAt",
    "completedAt",
}
BOOLEAN_COLUMNS = {
    "published",
    "completed",
    "isActive",
}

def quote(value, column=None):
    if column in BOOLEAN_COLUMNS and value is not None:
        return "TRUE" if bool(value) else "FALSE"
    if column in DATE_COLUMNS and value is not None:
        # Prisma's SQLite DateTime values are commonly stored as epoch milliseconds.
        if isinstance(value, (int, float)):
            value = datetime.fromtimestamp(value / 1000, tz=timezone.utc).replace(tzinfo=None).isoformat(timespec="milliseconds")
    
    if value is None:
        return "NULL"
    if isinstance(value, bytes):
        return "'\\x" + value.hex() + "'"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return "'" + text + "'"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/export-sqlite-to-postgres.py db/custom.db")

    conn = sqlite3.connect(sys.argv[1])
    conn.row_factory = sqlite3.Row
    print("BEGIN;")

    # Disable FK checks during import ordering; all references are preserved.
    print("SET CONSTRAINTS ALL DEFERRED;")

    for table in TABLES:
        rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
        if not rows:
            continue
        columns = rows[0].keys()
        col_sql = ", ".join(f'"{c}"' for c in columns)
        for row in rows:
            values = ", ".join(quote(row[c], c) for c in columns)
            print(f'INSERT INTO "{table}" ({col_sql}) VALUES ({values}) ON CONFLICT DO NOTHING;')

    print("COMMIT;")
    conn.close()


if __name__ == "__main__":
    main()
