import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { requireRole } from "@/lib/auth-guard";
import { parseGeneratedClues } from "@/lib/word-assistant/clues";

const clueRate = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("CREATOR");
  if (authError) return authError;

  const body = await request.json().catch(() => null) as {
    term?: unknown;
    definition?: unknown;
    language?: unknown;
    style?: unknown;
    difficulty?: unknown;
  } | null;
  const term = typeof body?.term === "string" ? body.term.trim() : "";
  const definition = typeof body?.definition === "string" ? body.definition.trim() : "";
  const language = body?.language === "en" ? "en" : "fr";
  const style = body?.style === "humorous" || body?.style === "cryptic" ? body.style : "standard";
  const difficulty = body?.difficulty === "hard" || body?.difficulty === "easy" ? body.difficulty : "medium";

  if (!term || !definition || term.length > 80 || definition.length > 500) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const now = Date.now();
  const recent = (clueRate.get(session!.user.id) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 10) {
    return NextResponse.json({ error: "Trop de générations. Réessayez dans une minute." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  recent.push(now);
  clueRate.set(session!.user.id, recent);

  try {
    const zai = await ZAI.create();
    const prompt = language === "en"
      ? `Create exactly three concise crossword clues for the answer "${term}" using this definition: "${definition}". Style: ${style}. Difficulty: ${difficulty}. Do not include the answer or a direct form of the answer in any clue. Return ONLY a valid JSON array of three strings, with no markdown or explanation.`
      : `Crée exactement trois indices de mots croisés concis pour la réponse « ${term} » à partir de cette définition : « ${definition} ». Style : ${style}. Difficulté : ${difficulty}. N'inclus pas la réponse ni une forme directe de la réponse. Réponds UNIQUEMENT avec un tableau JSON valide de trois chaînes, sans markdown ni explication.`;
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You write concise, fair crossword clues and return only a JSON array of clue strings." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty clue response");
    const clues = parseGeneratedClues(content, term);
    if (clues.length === 0) throw new Error("Invalid clue response");
    return NextResponse.json({ clue: clues[0], clues });
  } catch {
    return NextResponse.json({ error: "Impossible de générer un indice" }, { status: 502 });
  }
}