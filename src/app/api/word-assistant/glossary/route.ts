import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";

function normalizeTerm(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireRole("CREATOR");
  if (authError) return authError;

  const language = request.nextUrl.searchParams.get("language");
  const entries = await db.glossaryEntry.findMany({
    where: {
      creatorId: session!.user.id,
      ...(language === "fr" || language === "en" ? { language } : {}),
    },
    orderBy: [{ term: "asc" }, { language: "asc" }],
  });
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("CREATOR");
  if (authError) return authError;

  const body = await request.json().catch(() => null) as {
    term?: unknown;
    language?: unknown;
    definition?: unknown;
    example?: unknown;
    clue?: unknown;
  } | null;
  const term = normalizeTerm(body?.term);
  const language = body?.language === "en" ? "en" : "fr";
  const definition = typeof body?.definition === "string" ? body.definition.trim() : "";
  const example = typeof body?.example === "string" ? body.example.trim() || null : null;
  const clue = typeof body?.clue === "string" ? body.clue.trim() || null : null;

  if (!term || term.length > 80 || !definition || definition.length > 500) {
    return NextResponse.json({ error: "Entrée de glossaire invalide" }, { status: 400 });
  }

  const entry = await db.glossaryEntry.upsert({
    where: { creatorId_term_language: { creatorId: session!.user.id, term, language } },
    create: { creatorId: session!.user.id, term, language, definition, example, clue },
    update: { definition, example, clue },
  });
  return NextResponse.json({ entry });
}

export async function DELETE(request: NextRequest) {
  const { error: authError, session } = await requireRole("CREATOR");
  if (authError) return authError;

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const deleted = await db.glossaryEntry.deleteMany({
    where: { id, creatorId: session!.user.id },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });
  return NextResponse.json({ success: true });
}