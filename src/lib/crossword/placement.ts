// ════════════════════════════════════════════════════════════════════════
// Crossword Placement Algorithm
// Places words into a bounded grid using deterministic multi-start search.
// Every returned layout is guaranteed to fit `rows × cols`, to intersect
// every word, and to contain no unclued letter runs (see validatePlacement).
// ════════════════════════════════════════════════════════════════════════

import { hashString, mulberry32 } from './random';

export interface RawWord {
  word: string;  // answer text; sanitized to A-Z by placeWords
  clue: string;
}

export interface PlacedWord {
  word: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  clue: string;
}

export interface PlacementOptions {
  rows: number;
  cols: number;
  /** Deterministic search budget. Defaults to a word-count-scaled value (max 64). */
  maxAttempts?: number;
  /** Overrides the layout seed derived from the word list. */
  seed?: number;
}

export interface PlacementResult {
  success: boolean;
  words: PlacedWord[];
  rows: number;
  cols: number;
  placedCount: number;
  totalWords: number;
  uniqueWords: number;
  attempts: number;
}

interface CellEntry {
  letter: string;
  wordIndices: number[];
}

interface Extent {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

interface Candidate {
  direction: 'across' | 'down';
  row: number;
  col: number;
  area: number;
  crossings: number;
}

function failResult(totalWords: number, uniqueWords: number, attempts: number): PlacementResult {
  return {
    success: false,
    words: [],
    rows: 0,
    cols: 0,
    placedCount: 0,
    totalWords,
    uniqueWords,
    attempts,
  };
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function hasLetter(grid: Map<string, CellEntry>, row: number, col: number): boolean {
  return Boolean(grid.get(cellKey(row, col))?.letter);
}

function sanitizeWord(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function hashSeed(words: RawWord[]): number {
  return hashString(words.map((word) => word.word).join('|'));
}

/**
 * Validate a placement independently of the algorithm that produced it.
 * Returns human-readable issues; an empty array means the layout is sound.
 */
export function validatePlacement(layout: { words: PlacedWord[]; rows: number; cols: number }): string[] {
  const issues: string[] = [];
  const { words, rows, cols } = layout;

  if (words.length === 0) return ['empty layout'];
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
    issues.push(`invalid dimensions ${rows}×${cols}`);
  }

  const grid = new Map<string, string>();
  const cellWords = new Map<string, Set<number>>();
  const seenAnswers = new Set<string>();

  words.forEach((placedWord, index) => {
    if (!/^[A-Z]{2,}$/.test(placedWord.word)) {
      issues.push(`${placedWord.word}: invalid letters`);
    }
    if (seenAnswers.has(placedWord.word)) {
      issues.push(`${placedWord.word}: duplicate answer`);
    }
    seenAnswers.add(placedWord.word);
    if (!placedWord.clue.trim()) {
      issues.push(`${placedWord.word}: missing clue`);
    }

    for (let i = 0; i < placedWord.word.length; i += 1) {
      const row = placedWord.direction === 'across' ? placedWord.row : placedWord.row + i;
      const col = placedWord.direction === 'across' ? placedWord.col + i : placedWord.col;
      if (row < 0 || col < 0 || row >= rows || col >= cols) {
        issues.push(`${placedWord.word}: out of bounds at ${row},${col}`);
        return;
      }
      const key = cellKey(row, col);
      const letter = placedWord.word[i];
      const existing = grid.get(key);
      if (existing && existing !== letter) {
        issues.push(`${placedWord.word}: letter conflict at ${row},${col}`);
      } else {
        grid.set(key, letter);
      }
      const owners = cellWords.get(key) ?? new Set<number>();
      owners.add(index);
      cellWords.set(key, owners);
    }
  });

  const spans = new Set(words.map((word) => `${word.direction}:${word.row}:${word.col}:${word.word.length}`));

  const checkRun = (direction: 'across' | 'down', fixed: number, start: number, length: number) => {
    // A single-cell run is normal: it is covered by a perpendicular word.
    if (length < 2) return;
    const row = direction === 'across' ? fixed : start;
    const col = direction === 'across' ? start : fixed;
    if (!spans.has(`${direction}:${row}:${col}:${length}`)) {
      issues.push(`unclued ${direction} run at ${row},${col} (length ${length})`);
    }
  };

  for (let row = 0; row < rows; row += 1) {
    let col = 0;
    while (col < cols) {
      if (!grid.has(cellKey(row, col))) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < cols && grid.has(cellKey(row, col))) col += 1;
      checkRun('across', row, start, col - start);
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let row = 0;
    while (row < rows) {
      if (!grid.has(cellKey(row, col))) {
        row += 1;
        continue;
      }
      const start = row;
      while (row < rows && grid.has(cellKey(row, col))) row += 1;
      checkRun('down', col, start, row - start);
    }
  }

  if (words.length > 1) {
    words.forEach((placedWord) => {
      let crossings = 0;
      for (let i = 0; i < placedWord.word.length; i += 1) {
        const row = placedWord.direction === 'across' ? placedWord.row : placedWord.row + i;
        const col = placedWord.direction === 'across' ? placedWord.col + i : placedWord.col;
        if ((cellWords.get(cellKey(row, col))?.size ?? 0) > 1) crossings += 1;
      }
      if (crossings === 0) issues.push(`${placedWord.word}: no crossings`);
    });
  }

  return issues;
}

function evaluatePlacement(
  word: string,
  direction: 'across' | 'down',
  startR: number,
  startC: number,
  grid: Map<string, CellEntry>,
  placed: PlacedWord[],
  extent: Extent,
  rows: number,
  cols: number,
): { area: number; crossings: number } | null {
  const endR = direction === 'down' ? startR + word.length - 1 : startR;
  const endC = direction === 'across' ? startC + word.length - 1 : startC;

  const minR = Math.min(extent.minR, startR);
  const maxR = Math.max(extent.maxR, endR);
  const minC = Math.min(extent.minC, startC);
  const maxC = Math.max(extent.maxC, endC);
  if (maxR - minR + 1 > rows || maxC - minC + 1 > cols) return null;

  const beforeR = direction === 'across' ? startR : startR - 1;
  const beforeC = direction === 'across' ? startC - 1 : startC;
  const afterR = direction === 'across' ? endR : endR + 1;
  const afterC = direction === 'across' ? endC + 1 : endC;
  if (hasLetter(grid, beforeR, beforeC) || hasLetter(grid, afterR, afterC)) return null;

  let crossings = 0;
  for (let i = 0; i < word.length; i += 1) {
    const row = direction === 'across' ? startR : startR + i;
    const col = direction === 'across' ? startC + i : startC;
    const cell = grid.get(cellKey(row, col));

    if (cell?.letter) {
      if (cell.letter !== word[i]) return null;
      if (cell.wordIndices.length === 0) return null;
      // Crossing words must all run perpendicular to this one.
      if (!cell.wordIndices.every((index) => placed[index].direction !== direction)) return null;
      crossings += 1;
      continue;
    }

    // Empty cell: a perpendicular neighbour would form an unclued two-letter run.
    const side1R = direction === 'across' ? row - 1 : row;
    const side1C = direction === 'across' ? col : col - 1;
    const side2R = direction === 'across' ? row + 1 : row;
    const side2C = direction === 'across' ? col : col + 1;
    if (hasLetter(grid, side1R, side1C) || hasLetter(grid, side2R, side2C)) return null;
  }

  if (crossings === 0) return null;
  return { area: (maxR - minR + 1) * (maxC - minC + 1), crossings };
}

function collectCandidates(
  word: string,
  placed: PlacedWord[],
  grid: Map<string, CellEntry>,
  extent: Extent,
  rows: number,
  cols: number,
): Candidate[] {
  const byPosition = new Map<string, Candidate>();

  for (let wordIndex = 0; wordIndex < placed.length; wordIndex += 1) {
    const placedWord = placed[wordIndex];
    const direction: 'across' | 'down' = placedWord.direction === 'across' ? 'down' : 'across';

    for (let i = 0; i < placedWord.word.length; i += 1) {
      const cellR = placedWord.direction === 'across' ? placedWord.row : placedWord.row + i;
      const cellC = placedWord.direction === 'across' ? placedWord.col + i : placedWord.col;
      const letter = placedWord.word[i];

      for (let j = 0; j < word.length; j += 1) {
        if (word[j] !== letter) continue;

        const startR = direction === 'down' ? cellR - j : cellR;
        const startC = direction === 'across' ? cellC - j : cellC;
        const evaluation = evaluatePlacement(word, direction, startR, startC, grid, placed, extent, rows, cols);
        if (!evaluation) continue;

        const key = `${direction}:${startR}:${startC}`;
        const existing = byPosition.get(key);
        if (
          !existing ||
          evaluation.area < existing.area ||
          (evaluation.area === existing.area && evaluation.crossings > existing.crossings)
        ) {
          byPosition.set(key, {
            direction,
            row: startR,
            col: startC,
            area: evaluation.area,
            crossings: evaluation.crossings,
          });
        }
      }
    }
  }

  return [...byPosition.values()].sort(
    (a, b) =>
      a.area - b.area ||
      b.crossings - a.crossings ||
      a.row - b.row ||
      a.col - b.col ||
      (a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1),
  );
}

function pickCandidate<T>(candidates: T[], rand: (() => number) | null): T {
  if (!rand || candidates.length === 1) return candidates[0];
  const roll = rand();
  if (roll < 0.6) return candidates[0];
  if (roll < 0.9) return candidates[Math.min(1, candidates.length - 1)];
  return candidates[Math.min(2, candidates.length - 1)];
}

function addWord(
  placed: PlacedWord[],
  grid: Map<string, CellEntry>,
  extent: Extent,
  word: RawWord,
  direction: 'across' | 'down',
  row: number,
  col: number,
): void {
  const index = placed.length;
  placed.push({ word: word.word, direction, row, col, clue: word.clue });

  for (let i = 0; i < word.word.length; i += 1) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const key = cellKey(r, c);
    let cell = grid.get(key);
    if (!cell) {
      cell = { letter: word.word[i], wordIndices: [] };
      grid.set(key, cell);
    }
    cell.letter = word.word[i];
    if (!cell.wordIndices.includes(index)) cell.wordIndices.push(index);
    if (r < extent.minR) extent.minR = r;
    if (r > extent.maxR) extent.maxR = r;
    if (c < extent.minC) extent.minC = c;
    if (c > extent.maxC) extent.maxC = c;
  }
}

interface Option {
  word: RawWord;
  candidate: Candidate;
}

/**
 * At every step, consider every remaining word and place the most
 * connectable option rather than committing to a fixed word order.
 * A fixed order lets one early word block several longer ones.
 */
function runAttempt(
  words: RawWord[],
  seedIndex: number,
  rows: number,
  cols: number,
  rand: (() => number) | null,
  seedDirection: 'across' | 'down',
): PlacedWord[] {
  const seed = words[seedIndex];
  if (seed.word.length > (seedDirection === 'across' ? cols : rows)) return [];

  const grid = new Map<string, CellEntry>();
  const placed: PlacedWord[] = [];
  const extent: Extent = { minR: 0, maxR: 0, minC: 0, maxC: 0 };

  addWord(placed, grid, extent, seed, seedDirection, 0, 0);

  let remaining = words.filter((_, index) => index !== seedIndex);

  while (remaining.length > 0) {
    const options: Option[] = [];

    for (const word of remaining) {
      for (const candidate of collectCandidates(word.word, placed, grid, extent, rows, cols)) {
        options.push({ word, candidate });
      }
    }

    if (options.length === 0) break;

    const tieBreak = new Map<RawWord, number>();
    for (const word of remaining) tieBreak.set(word, rand ? rand() : 0.5);

    options.sort(
      (a, b) =>
        b.candidate.crossings - a.candidate.crossings ||
        a.candidate.area - b.candidate.area ||
        b.word.word.length - a.word.word.length ||
        (tieBreak.get(a.word) ?? 0.5) - (tieBreak.get(b.word) ?? 0.5),
    );

    const choice = pickCandidate(options, rand);
    addWord(placed, grid, extent, choice.word, choice.candidate.direction, choice.candidate.row, choice.candidate.col);
    remaining = remaining.filter((word) => word !== choice.word);
  }

  return placed;
}

/** Shift to 0-based coordinates and crop to the occupied bounding box. */
function normalizeLayout(placed: PlacedWord[]): { words: PlacedWord[]; rows: number; cols: number } {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;

  for (const word of placed) {
    for (let i = 0; i < word.word.length; i += 1) {
      const row = word.direction === 'across' ? word.row : word.row + i;
      const col = word.direction === 'across' ? word.col + i : word.col;
      minR = Math.min(minR, row);
      minC = Math.min(minC, col);
      maxR = Math.max(maxR, row);
      maxC = Math.max(maxC, col);
    }
  }

  const words = placed.map((word) => ({
    ...word,
    row: word.row - minR,
    col: word.col - minC,
  }));

  return { words, rows: maxR - minR + 1, cols: maxC - minC + 1 };
}

function isBetter(candidate: { words: PlacedWord[]; rows: number; cols: number }, best: typeof candidate | null): boolean {
  if (!best) return true;
  if (candidate.words.length !== best.words.length) return candidate.words.length > best.words.length;
  const candidateArea = candidate.rows * candidate.cols;
  const bestArea = best.rows * best.cols;
  if (candidateArea !== bestArea) return candidateArea < bestArea;
  return Math.max(candidate.rows, candidate.cols) < Math.max(best.rows, best.cols);
}

export function placeWords(rawWords: RawWord[], options: PlacementOptions): PlacementResult {
  const totalWords = rawWords.length;
  const rows = Math.floor(options.rows);
  const cols = Math.floor(options.cols);

  const normalized = rawWords
    .map((word) => ({ word: sanitizeWord(word.word ?? ''), clue: (word.clue ?? '').trim() }))
    .filter((word) => word.word.length >= 3)
    .sort((a, b) => b.word.length - a.word.length);

  const seen = new Set<string>();
  const unique: RawWord[] = [];
  for (const word of normalized) {
    if (seen.has(word.word)) continue;
    seen.add(word.word);
    unique.push(word);
  }

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 3 || cols < 3) {
    return failResult(totalWords, unique.length, 0);
  }

  // Words longer than both dimensions can never be placed; keeping them
  // would make the fill ratio unreachable for grids of this size.
  const feasible = unique.filter((word) => word.word.length <= Math.max(rows, cols));
  if (feasible.length < 3) {
    return failResult(totalWords, feasible.length, 0);
  }

  const fittingSeeds = feasible
    .map((word, index) => ({ word, index }))
    .slice(0, 8);

  // Restarts get expensive with many words, so scale the budget down as the
  // word list grows instead of always spending the maximum.
  const defaultAttempts = feasible.length <= 6 ? 32 : Math.max(16, Math.round(768 / feasible.length));
  const attempts = Math.max(1, Math.min(options.maxAttempts ?? defaultAttempts, 64));
  const stallLimit = Math.max(8, Math.ceil(attempts / 2));
  const rand = mulberry32((options.seed ?? hashSeed(feasible)) >>> 0);

  let best: { words: PlacedWord[]; rows: number; cols: number } | null = null;
  let bestCount = 0;
  let completedAttempts = 0;
  let stalledAttempts = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const deterministic = attempt === 0;
    const seedIndex = deterministic
      ? fittingSeeds[0].index
      : fittingSeeds[Math.floor(rand() * fittingSeeds.length)].index;
    const seedWord = feasible[seedIndex];

    let seedDirection: 'across' | 'down';
    if (seedWord.word.length > cols) {
      seedDirection = 'down';
    } else if (seedWord.word.length > rows) {
      seedDirection = 'across';
    } else {
      seedDirection = deterministic ? 'across' : rand() < 0.5 ? 'across' : 'down';
    }

    const placed = runAttempt(feasible, seedIndex, rows, cols, deterministic ? null : rand, seedDirection);
    if (placed.length === 0) {
      stalledAttempts += 1;
      if (stalledAttempts >= stallLimit) break;
      continue;
    }

    const layout = normalizeLayout(placed);
    if (isBetter(layout, best)) best = layout;
    completedAttempts += 1;

    if (layout.words.length > bestCount) {
      bestCount = layout.words.length;
      stalledAttempts = 0;
    } else {
      stalledAttempts += 1;
    }

    // Cannot do better than placing every usable word.
    if (best && best.words.length === feasible.length) break;
    if (stalledAttempts >= stallLimit) break;
  }

  if (!best) {
    return failResult(totalWords, feasible.length, completedAttempts);
  }

  return {
    success: best.words.length >= 3,
    words: best.words,
    rows: best.rows,
    cols: best.cols,
    placedCount: best.words.length,
    totalWords,
    uniqueWords: feasible.length,
    attempts: completedAttempts,
  };
}
