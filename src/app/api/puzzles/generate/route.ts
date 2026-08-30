import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPuzzle, puzzleToDbFormat } from '@/lib/crossword/utils';
import { placeWords, type RawWord } from '@/lib/crossword/placement';
import ZAI from 'z-ai-web-dev-sdk';
import { requireRole } from '@/lib/auth-guard';
import { createWithNextPuzzleNumber } from '@/lib/puzzle-number';

// ── Types ─────────────────────────────────────────────────────────────

interface GenerateRequest {
  theme?: string;
  language?: 'fr' | 'en';
  difficulty?: number;
  categoryId?: string | null;
  packId?: string | null;
  wordCount?: number;
  gridSize?: { rows: number; cols: number };
  /** @deprecated Use gridSize instead */
  size?: 'small' | 'medium' | 'large';
  autoPublish?: boolean;
}

// ── LLM word generation ────────────────────────────────────────────────

const sizeWordHints: Record<string, Record<number, string>> = {
  small: { 1: '3-5 lettres', 2: '4-6 lettres', 3: '4-6 lettres' },
  medium: { 1: '4-7 lettres', 2: '5-9 lettres', 3: '6-11 lettres' },
  large: { 1: '5-8 lettres', 2: '5-10 lettres', 3: '5-10 lettres' },
};

const sizeTargetSizes: Record<string, number> = {
  small: 12,
  medium: 20,
  large: 30,
};

function getWordLengthHint(gridSize: { rows: number; cols: number }, difficulty: number, language: 'fr' | 'en'): string {
  const maxDim = Math.max(gridSize.rows, gridSize.cols);
  if (language === 'en') {
    if (maxDim <= 5) return difficulty === 1 ? '3-4 letters' : difficulty === 2 ? '3-5 letters' : '3-5 letters';
    if (maxDim <= 8) return difficulty === 1 ? '3-5 letters' : difficulty === 2 ? '4-6 letters' : '4-7 letters';
    if (maxDim <= 10) return difficulty === 1 ? '4-7 letters' : difficulty === 2 ? '5-9 letters' : '6-11 letters';
    if (maxDim <= 13) return difficulty === 1 ? '5-8 letters' : difficulty === 2 ? '5-10 letters' : '6-12 letters';
    return difficulty === 1 ? '5-10 letters' : difficulty === 2 ? '6-11 letters' : '7-14 letters';
  }
  if (maxDim <= 5) return difficulty === 1 ? '3-4 lettres' : difficulty === 2 ? '3-5 lettres' : '3-5 lettres';
  if (maxDim <= 8) return difficulty === 1 ? '3-5 lettres' : difficulty === 2 ? '4-6 lettres' : '4-7 lettres';
  if (maxDim <= 10) return difficulty === 1 ? '4-7 lettres' : difficulty === 2 ? '5-9 lettres' : '6-11 lettres';
  if (maxDim <= 13) return difficulty === 1 ? '5-8 lettres' : difficulty === 2 ? '5-10 lettres' : '6-12 lettres';
  return difficulty === 1 ? '5-10 lettres' : difficulty === 2 ? '6-11 lettres' : '7-14 lettres';
}

function getTargetSizeFromGrid(gridSize: { rows: number; cols: number }): number {
  return Math.max(gridSize.rows, gridSize.cols);
}

async function generateWordsWithLLM(
  theme: string,
  language: 'fr' | 'en',
  difficulty: number,
  wordCount: number,
  gridSize?: { rows: number; cols: number },
  size?: 'small' | 'medium' | 'large',
): Promise<{ word: string; clue: string }[]> {
  const zai = await ZAI.create();

  let sizeDesc: string;
  if (gridSize) {
    sizeDesc = getWordLengthHint(gridSize, difficulty, language);
  } else {
    const sizeKey = size || 'medium';
    const frSizeMap = sizeWordHints[sizeKey];
    const enSizeMap: Record<number, string> = {
      1: sizeKey === 'small' ? '3-5 letters' : sizeKey === 'large' ? '5-8 letters' : '4-7 letters',
      2: sizeKey === 'small' ? '4-6 letters' : sizeKey === 'large' ? '5-10 letters' : '5-9 letters',
      3: sizeKey === 'small' ? '4-6 letters' : sizeKey === 'large' ? '5-10 letters' : '6-12 letters',
    };
    sizeDesc = language === 'en' ? enSizeMap[difficulty] : frSizeMap[difficulty];
  }

  const instructions = language === 'fr'
    ? `Tu es un créateur expert de mots croisés français. Génère exactement ${wordCount} mots et leurs indices pour un puzzle de mots croisés sur le thème "${theme}".

Règles STRICTES :
- Les mots doivent contenir ${sizeDesc}
- Utilise UNIQUEMENT des lettres A-Z (pas d'accent, pas de tiret, pas d'apostrophe, pas de caractère spécial)
- Les mots doivent être en MAJUSCULES
- Chaque mot doit avoir un indice clair et concis (10-25 mots)
- Les indices ne doivent PAS contenir le mot réponse
- Les mots doivent être variés et intéressants
- AU MOINS 60% des mots doivent avoir entre 4 et 8 lettres pour permettre les intersections
- Inclue au moins 3 mots courts (4-5 lettres) pour créer des connexions
- Évite les mots trop similaires entre eux

Réponds UNIQUEMENT avec un JSON valide de cette forme, sans aucun autre texte :
[{"word": "MOT", "clue": "Indice ici"}]`
    : `You are an expert crossword puzzle creator. Generate exactly ${wordCount} words and their clues for a crossword puzzle on the theme "${theme}".

STRICT RULES:
- Words must contain ${sizeDesc}
- Use ONLY letters A-Z (no hyphens, apostrophes, or special characters)
- Words must be UPPERCASE
- Each word must have a clear, concise clue (5-15 words)
- Clues must NOT contain the answer word
- Words should be varied and interesting
- At least 60% of words must be 4-8 letters to allow intersections
- Include at least 3 short words (4-5 letters) for connections
- Avoid similar words

Respond ONLY with valid JSON in this format, no other text:
[{"word": "WORD", "clue": "Clue here"}]`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'You are a crossword puzzle generator. You respond only with valid JSON arrays.' },
      { role: 'user', content: instructions },
    ],
    thinking: { type: 'disabled' },
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty LLM response');

  // Parse JSON from the response (handle markdown code blocks)
  let jsonStr = content;
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let words: { word: string; clue: string }[];
  try {
    words = JSON.parse(jsonStr);
  } catch {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      words = JSON.parse(arrayMatch[0]);
    } else {
      throw new Error('Failed to parse LLM response as JSON');
    }
  }

  // Validate and sanitize
  const validWords = words
    .filter((w) => w.word && w.clue && typeof w.word === 'string' && typeof w.clue === 'string')
    .map((w) => ({
      word: w.word.toUpperCase().replace(/[^A-Z]/g, ''),
      clue: w.clue.trim(),
    }))
    .filter((w) => w.word.length >= 3);

  return validWords;
}

// ── POST: Generate a puzzle automatically ─────────────────────────────

export async function POST(request: NextRequest) {
  const { error: authErr, session } = await requireRole('CREATOR');
  if (authErr) return authErr;

  try {
    const body: GenerateRequest = await request.json();
    const {
      theme = 'Général',
      language = 'fr',
      difficulty = 1,
      categoryId = null,
      packId = null,
      wordCount = 12,
      gridSize = undefined,
      size = 'medium',
      autoPublish = false,
    } = body;

    if (typeof theme !== 'string' || theme.trim().length === 0 || theme.length > 120) {
      return NextResponse.json({ error: 'Thème invalide' }, { status: 400 });
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
      return NextResponse.json({ error: 'Difficulté invalide (1-3)' }, { status: 400 });
    }
    if (!Number.isInteger(wordCount) || wordCount < 5 || wordCount > 30) {
      return NextResponse.json({ error: 'Nombre de mots invalide (5-30)' }, { status: 400 });
    }
    if (!['small', 'medium', 'large'].includes(size)) {
      return NextResponse.json({ error: 'Taille invalide' }, { status: 400 });
    }
    if (typeof autoPublish !== 'boolean') {
      return NextResponse.json({ error: 'Statut de publication invalide' }, { status: 400 });
    }
    if (autoPublish && session!.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut publier un puzzle' }, { status: 403 });
    }

    // Validate gridSize
    if (gridSize) {
      if (!Number.isInteger(gridSize.rows) || !Number.isInteger(gridSize.cols)) {
        return NextResponse.json({ error: 'Format de grille invalide' }, { status: 400 });
      }
      if (gridSize.rows < 3 || gridSize.rows > 25 || gridSize.cols < 3 || gridSize.cols > 25) {
        return NextResponse.json({ error: 'La grille doit être comprise entre 3 et 25 cases' }, { status: 400 });
      }
    }

    if (!['fr', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Langue invalide' }, { status: 400 });
    }

    // Validate categoryId
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
    }
    if (packId) {
      const pack = await db.pack.findUnique({ where: { id: packId } });
      if (!pack) return NextResponse.json({ error: 'Pack introuvable' }, { status: 400 });
    }

    // Step 1: Generate words with LLM (with retry)
    let rawWords: { word: string; clue: string }[] = [];
    let lastError = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        rawWords = await generateWordsWithLLM(theme, language, difficulty, wordCount, gridSize, size);
        if (rawWords.length >= 5) break;
        lastError = `Only ${rawWords.length} valid words generated`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'LLM generation failed';
      }
    }

    if (rawWords.length < 5) {
      return NextResponse.json(
        { error: `Génération échouée: ${lastError}. Réessayez.` },
        { status: 500 },
      );
    }

    // Step 2: Place words into crossword grid
    let targetSize: number;
    if (gridSize) {
      targetSize = getTargetSizeFromGrid(gridSize);
    } else {
      targetSize = sizeTargetSizes[size || 'medium'];
    }
    const placement = placeWords(rawWords as RawWord[], targetSize);

    if (!placement.success) {
      return NextResponse.json(
        { error: `Impossible de placer les mots en grille (${placement.placedCount}/${placement.totalWords} mots placés). Réessayez avec un autre thème.` },
        { status: 500 },
      );
    }

    // Step 3: Create the puzzle with auto-numbered title
    const puzzle = await createWithNextPuzzleNumber((tx, puzzleNumber) => {
      const autoTitle = `#${String(puzzleNumber).padStart(3, '0')}`;
      const rawWordsForPuzzle = placement.words.map((w) => ({
        word: w.word, direction: w.direction, row: w.row, col: w.col, clue: w.clue,
      }));
      const dbFormat = puzzleToDbFormat(createPuzzle(autoTitle, difficulty, placement.rows, placement.cols, rawWordsForPuzzle));
      const publishedAt = autoPublish ? new Date() : null;
      return tx.crosswordPuzzle.create({ data: {
        puzzleNumber,
        title: autoTitle,
        description: language === 'fr'
          ? `Puzzle généré automatiquement sur le thème « ${theme} »`
          : `Auto-generated puzzle on theme "${theme}"`,
        difficulty,
        language,
        categoryId: categoryId || null,
        packId: packId || null,
        creatorId: session!.user.id,
        rows: placement.rows,
        cols: placement.cols,
        gridData: dbFormat.gridData,
        wordsData: dbFormat.wordsData,
        cluesData: dbFormat.cluesData,
        published: autoPublish,
        publishDate: publishedAt,
        firstPublishedAt: publishedAt,
      }});
    });

    return NextResponse.json({
      success: true,
      puzzle: {
        id: puzzle.id,
        puzzleNumber: puzzle.puzzleNumber,
        title: puzzle.title,
        rows: placement.rows,
        cols: placement.cols,
        wordsPlaced: placement.placedCount,
        wordsTotal: rawWords.length,
      },
    });
  } catch (error) {
    console.error('Error generating puzzle:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Échec de la génération' },
      { status: 500 },
    );
  }
}
