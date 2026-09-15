import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { lookupWord } from "@/lib/word-assistant/provider";
import { db } from "@/lib/db";

const RATE_WINDOW_MS = 60 * 1000;
const MAX_LOOKUPS_PER_WINDOW = 30;
const lookupRate = new Map<string, number[]>();

export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireRole("CREATOR");
  if (authError) return authError;

  const term = request.nextUrl.searchParams.get("term")?.trim() ?? "";
  const language = request.nextUrl.searchParams.get("language") === "en" ? "en" : "fr";
  const includeAcronym = request.nextUrl.searchParams.get("acronym") === "true";

  if (!term || term.length > 80) {
    return NextResponse.json({ error: "Terme invalide" }, { status: 400 });
  }

  const now = Date.now();
  const recentLookups = (lookupRate.get(session!.user.id) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (recentLookups.length >= MAX_LOOKUPS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Trop de recherches. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  recentLookups.push(now);
  lookupRate.set(session!.user.id, recentLookups);

  let glossaryEntry: Awaited<ReturnType<typeof db.glossaryEntry.findUnique>> = null;
  try {
    glossaryEntry = await db.glossaryEntry.findUnique({
      where: {
        creatorId_term_language: {
          creatorId: session!.user.id,
          term: term.toLowerCase(),
          language,
        },
      },
    });
  } catch {
    // Continue with public providers until the glossary migration is applied.
  }
  if (glossaryEntry) {
    return NextResponse.json({
      term,
      language,
      definitions: [{ definition: glossaryEntry.definition, example: glossaryEntry.example ?? undefined }],
      synonyms: [],
      acronym: null,
      context: null,
      source: "Glossaire personnel",
      glossaryEntryId: glossaryEntry.id,
      savedClue: glossaryEntry.clue,
    });
  }

  return NextResponse.json(await lookupWord(term, language, { includeAcronym }));
}