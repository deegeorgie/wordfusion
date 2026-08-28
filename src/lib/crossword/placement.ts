// ════════════════════════════════════════════════════════════════════════
// Crossword Placement Algorithm
// Takes a list of words + clues and arranges them into a crossword grid.
// ════════════════════════════════════════════════════════════════════════

export interface RawWord {
  word: string;  // uppercase A-Z only, no accents
  clue: string;
}

export interface PlacedWord {
  word: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  clue: string;
}

export interface PlacementResult {
  success: boolean;
  words: PlacedWord[];
  rows: number;
  cols: number;
  placedCount: number;
  totalWords: number;
}

// Internal representation during construction
interface CellEntry {
  letter: string;
  wordIndices: number[]; // which placed words occupy this cell
}

function createCell(letter = ''): CellEntry {
  return { letter, wordIndices: [] };
}

/**
 * Find all positions where `newWord` can be placed perpendicular to an
 * already-placed word, sharing exactly one common letter.
 */
function findIntersections(
  newWord: string,
  placed: PlacedWord[],
  grid: Map<string, CellEntry>,
  gridSize: { minR: number; minC: number; maxR: number; maxC: number },
  targetSize: number,
): { row: number; col: number; direction: 'across' | 'down'; intersectingWordIdx: number }[] {
  const candidates: { row: number; col: number; direction: 'across' | 'down'; intersectingWordIdx: number; bboxSize: number }[] = [];

  for (let pi = 0; pi < placed.length; pi++) {
    const pw = placed[pi];
    const perpDir: 'across' | 'down' = pw.direction === 'across' ? 'down' : 'across';

    // Walk along the placed word's cells
    for (let i = 0; i < pw.word.length; i++) {
      const cellR = pw.direction === 'across' ? pw.row : pw.row + i;
      const cellC = pw.direction === 'across' ? pw.col + i : pw.col;
      const placedLetter = pw.word[i];

      // Find matching letters in the new word
      for (let j = 0; j < newWord.length; j++) {
        if (newWord[j] !== placedLetter) continue;

        // Place newWord perpendicular through this cell
        let startR: number, startC: number;
        if (perpDir === 'across') {
          startR = cellR;
          startC = cellC - j;
        } else {
          startR = cellR - j;
          startC = cellC;
        }

        // Check if this placement is valid
        const valid = checkPlacement(
          newWord, perpDir, startR, startC, grid, placed, pi, j, targetSize
        );

        if (valid.ok) {
 candidates.push({
            row: startR,
            col: startC,
            direction: perpDir,
            intersectingWordIdx: pi,
            bboxSize: valid.bboxSize,
          });
        }
      }
    }
  }

  // Sort by bounding box size (prefer compact placements)
  candidates.sort((a, b) => a.bboxSize - b.bboxSize);
  return candidates.map(({ bboxSize: _, ...rest }) => rest);
}

interface CheckResult {
  ok: boolean;
  bboxSize: number;
}

/**
 * Check whether placing `word` at (startR, startC) in `direction` is valid.
 * `excludedWordIdx` is the word we're intersecting with (at intersection position `excludedPos`).
 */
function checkPlacement(
  word: string,
  direction: 'across' | 'down',
  startR: number,
  startC: number,
  grid: Map<string, CellEntry>,
  placed: PlacedWord[],
  excludedWordIdx: number,
  excludedPos: number,
  targetSize: number,
): CheckResult {
  let maxR = startR;
  let maxC = startC;
  let minR = startR;
  let minC = startC;
  let hasIntersection = false;

  for (let i = 0; i < word.length; i++) {
    const r = direction === 'across' ? startR : startR + i;
    const c = direction === 'across' ? startC + i : startC;

    const key = `${r},${c}`;
    const cell = grid.get(key);

    // Check bounds
    if (r < -50 || c < -50 || r > targetSize + 50 || c > targetSize + 50) {
      return { ok: false, bboxSize: Infinity };
    }

    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;

    if (cell && cell.letter) {
      // Cell is already occupied
      if (cell.letter !== word[i]) {
        // Letter conflict
        return { ok: false, bboxSize: Infinity };
      }
      // Same letter — this is an intersection
      if (i === excludedPos && cell.wordIndices.includes(excludedWordIdx)) {
        hasIntersection = true;
      } else if (cell.wordIndices.length > 0) {
        // Check: all words passing through this cell must be perpendicular
        const allPerp = cell.wordIndices.every((wi) => placed[wi].direction !== direction);
        if (!allPerp) {
          return { ok: false, bboxSize: Infinity };
        }
        hasIntersection = true;
      }
    } else {
      // Empty cell — check for parallel adjacency
      // The cell before the start of the word (in its direction) must be empty
      if (i === 0) {
        const beforeR = direction === 'across' ? r : r - 1;
        const beforeC = direction === 'across' ? c - 1 : c;
        const beforeKey = `${beforeR},${beforeC}`;
        const beforeCell = grid.get(beforeKey);
        if (beforeCell && beforeCell.letter) {
          return { ok: false, bboxSize: Infinity };
        }
      }
      // The cell after the end of the word must be empty
      if (i === word.length - 1) {
        const afterR = direction === 'across' ? r : r + 1;
        const afterC = direction === 'across' ? c + 1 : c;
        const afterKey = `${afterR},${afterC}`;
        const afterCell = grid.get(afterKey);
        if (afterCell && afterCell.letter) {
          return { ok: false, bboxSize: Infinity };
        }
      }

      // Check perpendicular adjacency: cells to the sides must not create
      // unintended word extensions
      if (i > 0 && i < word.length - 1) {
        // Check both perpendicular sides
        const side1R = direction === 'across' ? r - 1 : r;
        const side1C = direction === 'across' ? c : c - 1;
        const side2R = direction === 'across' ? r + 1 : r;
        const side2C = direction === 'across' ? c : c + 1;
        const side1 = grid.get(`${side1R},${side1C}`);
        const side2 = grid.get(`${side2R},${side2C}`);

        if (side1 && side1.letter) {
          // A letter adjacent perpendicular — make sure it's from a word
          // that also passes through this new cell (i.e., an intersection)
          // If not, it means we'd be creating an unintended adjacency
          return { ok: false, bboxSize: Infinity };
        }
        if (side2 && side2.letter) {
          return { ok: false, bboxSize: Infinity };
        }
      }
    }
  }

  if (!hasIntersection) {
    return { ok: false, bboxSize: Infinity };
  }

  const bboxSize = (maxR - minR + 1) * (maxC - minC + 1);
  return { ok: true, bboxSize };
}

/**
 * Main function: place words into a crossword grid.
 */
export function placeWords(rawWords: RawWord[], targetSize = 20): PlacementResult {
  const totalWords = rawWords.length;

  if (totalWords === 0) {
    return { success: false, words: [], rows: 0, cols: 0, placedCount: 0, totalWords: 0 };
  }

  // Sort by length descending
  const sorted = [...rawWords].sort((a, b) => b.word.length - a.word.length);

  // Remove duplicates
  const seen = new Set<string>();
  const unique: RawWord[] = [];
  for (const w of sorted) {
    const key = w.word.toUpperCase();
    if (!seen.has(key) && key.length >= 2) {
      seen.add(key);
      unique.push({ ...w, word: key });
    }
  }

  if (unique.length < 3) {
    return { success: false, words: [], rows: 0, cols: 0, placedCount: 0, totalWords };
  }

  const grid = new Map<string, CellEntry>();
  const placed: PlacedWord[] = [];

  function addToGrid(pw: PlacedWord, wordIndex: number) {
    for (let i = 0; i < pw.word.length; i++) {
      const r = pw.direction === 'across' ? pw.row : pw.row + i;
      const c = pw.direction === 'across' ? pw.col + i : pw.col;
      const key = `${r},${c}`;
      let cell = grid.get(key);
      if (!cell) {
        cell = createCell(pw.word[i]);
        grid.set(key, cell);
      }
      cell.letter = pw.word[i];
      if (!cell.wordIndices.includes(wordIndex)) {
        cell.wordIndices.push(wordIndex);
      }
    }
  }

  // Place the first word horizontally at (0, 0)
  const first: PlacedWord = {
    word: unique[0].word,
    direction: 'across',
    row: 0,
    col: 0,
    clue: unique[0].clue,
  };
  placed.push(first);
  addToGrid(first, 0);

  // Try to place each remaining word
  for (let wi = 1; wi < unique.length; wi++) {
    const candidate = unique[wi];
    const intersections = findIntersections(candidate.word, placed, grid, { minR: 0, minC: 0, maxR: 0, maxC: 0 }, targetSize);

    if (intersections.length > 0) {
      const best = intersections[0];
      const pw: PlacedWord = {
        word: candidate.word,
        direction: best.direction,
        row: best.row,
        col: best.col,
        clue: candidate.clue,
      };
      placed.push(pw);
      addToGrid(pw, placed.length - 1);
    }
    // If no intersection found, skip this word
  }

  if (placed.length < 3) {
    return { success: false, words: [], rows: 0, cols: 0, placedCount: placed.length, totalWords };
  }

  // Normalize coordinates: shift so min row and min col become 1
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const pw of placed) {
    for (let i = 0; i < pw.word.length; i++) {
      const r = pw.direction === 'across' ? pw.row : pw.row + i;
      const c = pw.direction === 'across' ? pw.col + i : pw.col;
      if (r < minR) minR = r;
      if (c < minC) minC = c;
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }

  // Shift so there's 1 cell padding on all sides
  const shiftR = 1 - minR;
  const shiftC = 1 - minC;

  const normalized: PlacedWord[] = placed.map((pw) => ({
    ...pw,
    row: pw.row + shiftR,
    col: pw.col + shiftC,
  }));

  const rows = maxR + shiftR + 1;
  const cols = maxC + shiftC + 1;

  return {
    success: true,
    words: normalized,
    rows,
    cols,
    placedCount: normalized.length,
    totalWords,
  };
}
