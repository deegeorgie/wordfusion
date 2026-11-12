import type { CrosswordCell, CrosswordPuzzleData, WordPlacement } from './types';

export type LetterMatrix = (string | null | undefined)[][];

export interface CellPosition {
  row: number;
  col: number;
}

export interface PuzzleEvaluation {
  totalCells: number;
  filledCells: number;
  correctCells: CellPosition[];
  incorrectCells: CellPosition[];
  completionPercent: number;
  allCorrect: boolean;
}

export function normalizeLetter(value: string | null | undefined): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    : '';
}

export function parseRevealedCells(raw: string | null | undefined): Set<string> {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

/** Reject oversized or malformed matrices before doing any per-cell work. */
export function isValidLetterMatrix(value: unknown, rows: number, cols: number): value is LetterMatrix {
  if (!Array.isArray(value) || value.length > rows) return false;
  for (const row of value) {
    if (!Array.isArray(row) || row.length > cols) return false;
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      if (typeof cell !== 'string' || cell.length > 1) return false;
    }
  }
  return true;
}

/**
 * Strip every answer from a puzzle before sending it to a player.
 * Only cells the server has already revealed keep their letter, and the
 * per-word answer strings are removed (placements stay for highlighting).
 */
export function toPlayerPuzzle(
  puzzle: CrosswordPuzzleData,
  revealedKeys: ReadonlySet<string>,
): CrosswordPuzzleData {
  return {
    ...puzzle,
    grid: puzzle.grid.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (cell.isBlack) return cell;
        return {
          ...cell,
          letter: revealedKeys.has(`${rowIndex},${colIndex}`) ? cell.letter : '',
        };
      }),
    ),
    words: puzzle.words.map((word) => ({ ...word, word: '' })),
    magicWords: undefined,
  };
}

export function evaluateInputs(grid: CrosswordCell[][], userInputs: LetterMatrix): PuzzleEvaluation {
  const correctCells: CellPosition[] = [];
  const incorrectCells: CellPosition[] = [];
  let totalCells = 0;
  let filledCells = 0;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (cell.isBlack) continue;

      totalCells++;
      const input = normalizeLetter(userInputs[row]?.[col]);
      if (!input) continue;

      filledCells++;
      const expected = normalizeLetter(cell.letter);
      if (input === expected) {
        correctCells.push({ row, col });
      } else {
        incorrectCells.push({ row, col });
      }
    }
  }

  return {
    totalCells,
    filledCells,
    correctCells,
    incorrectCells,
    completionPercent: totalCells > 0 ? Math.round((correctCells.length / totalCells) * 100) : 0,
    allCorrect: totalCells > 0 && incorrectCells.length === 0 && filledCells === totalCells,
  };
}

export function completedClueKeys(
  words: WordPlacement[],
  grid: CrosswordCell[][],
  userInputs: LetterMatrix,
): { number: number; direction: 'across' | 'down' }[] {
  return words
    .filter((word) => {
      for (let index = 0; index < word.length; index++) {
        const row = word.direction === 'across' ? word.row : word.row + index;
        const col = word.direction === 'across' ? word.col + index : word.col;
        const expected = normalizeLetter(grid[row]?.[col]?.letter);
        if (!expected) return false;
        if (normalizeLetter(userInputs[row]?.[col]) !== expected) return false;
      }
      return true;
    })
    .map((word) => ({ number: word.clueNumber, direction: word.direction }));
}
