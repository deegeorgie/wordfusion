import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { requireRole } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("CREATOR");
  if (authError) return authError;

  const body = await request.json().catch(() => null) as {
    term?: unknown;
    definition?: unknown;
    language?: unknown;
  } | null;
  const term = typeof body?.term === "string" ? body.term.trim() : "";
  const definition = typeof body?.definition === "string" ? body.definition.trim() : "";
  const language = body?.language === "en" ? "en" : "fr";

  if (!term || !definition || term.length > 80 || definition.length > 500) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  try {
    const zai = await ZAI.create();
    const prompt = language === "en"
      ? `Create one concise crossword clue for the answer "${term}" using this definition: "${definition}". Do not include the answer in the clue. Return only the clue, with no quotes or explanation.`
      : `Crée un indice de mots croisés concis pour la réponse « ${term} » à partir de cette définition : « ${definition} ». N'inclus pas la réponse dans l'indice. Réponds uniquement avec l'indice, sans guillemets ni explication.`;
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You write concise, fair crossword clues and return only the clue text." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const clue = completion.choices[0]?.message?.content?.trim().replace(/^['"«]|['"»]$/g, "");
    if (!clue) throw new Error("Empty clue response");
    return NextResponse.json({ clue });
  } catch {
    return NextResponse.json({ error: "Impossible de générer un indice" }, { status: 502 });
  }
}