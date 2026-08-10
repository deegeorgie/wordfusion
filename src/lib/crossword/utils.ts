import { CrosswordPuzzleData, CrosswordCell, WordPlacement, Clue } from './types';

/**
 * Build a grid from word placements, assigning clue numbers automatically.
 */
function buildGridFromWords(
  rows: number,
  cols: number,
  words: Omit<WordPlacement, 'clueNumber'>[]
): { grid: CrosswordCell[][]; wordsWithNumbers: WordPlacement[] } {
  // Create empty grid
  const grid: CrosswordCell[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = {
        letter: '',
        number: null,
        isBlack: true,
        row: r,
        col: c,
      };
    }
  }

  // Place words on grid
  for (const w of words) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === 'across' ? w.row : w.row + i;
      const c = w.direction === 'across' ? w.col + i : w.col;
      if (r < rows && c < cols) {
        grid[r][c].letter = w.word[i];
        grid[r][c].isBlack = false;
      }
    }
  }

  // Assign clue numbers: scan left-to-right, top-to-bottom.
  // A cell gets a number if it starts an across or down word.
  let clueNum = 1;
  const numberMap = new Map<string, number>(); // "row,col" -> clueNumber

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isBlack) continue;

      const key = `${r},${c}`;
      let needsNumber = false;

      // Check if this starts an across word
      const startsAcross =
        (c === 0 || grid[r][c - 1].isBlack) &&
        c + 1 < cols &&
        !grid[r][c + 1].isBlack;

      // Check if this starts a down word
      const startsDown =
        (r === 0 || grid[r - 1][c].isBlack) &&
        r + 1 < rows &&
        !grid[r + 1][c].isBlack;

      if (startsAcross || startsDown) {
        needsNumber = true;
      }

      if (needsNumber) {
        numberMap.set(key, clueNum);
        grid[r][c].number = clueNum;
        clueNum++;
      }
    }
  }

  // Assign clue numbers to word placements
  const wordsWithNumbers: WordPlacement[] = words.map((w) => {
    const key = `${w.row},${w.col}`;
    return {
      ...w,
      clueNumber: numberMap.get(key) || 0,
      length: w.word.length,
    };
  });

  return { grid, wordsWithNumbers };
}

/**
 * Create a complete CrosswordPuzzleData from raw word/clue data.
 */
export function createPuzzle(
  title: string,
  difficulty: number,
  rows: number,
  cols: number,
  rawWords: { word: string; direction: 'across' | 'down'; row: number; col: number; clue: string }[],
  description?: string
): CrosswordPuzzleData {
  const wordsWithoutNumbers = rawWords.map(({ word, direction, row, col }) => ({
    word,
    direction,
    row,
    col,
  }));

  const { grid, wordsWithNumbers } = buildGridFromWords(rows, cols, wordsWithoutNumbers);

  // Build clues from words
  const acrossClues: Clue[] = wordsWithNumbers
    .filter((w) => w.direction === 'across')
    .map((w) => ({
      number: w.clueNumber,
      direction: 'across' as const,
      text: rawWords.find((rw) => rw.word === w.word && rw.direction === w.direction && rw.row === w.row && rw.col === w.col)?.clue || '',
    }))
    .sort((a, b) => a.number - b.number);

  const downClues: Clue[] = wordsWithNumbers
    .filter((w) => w.direction === 'down')
    .map((w) => ({
      number: w.clueNumber,
      direction: 'down' as const,
      text: rawWords.find((rw) => rw.word === w.word && rw.direction === w.direction && rw.row === w.row && rw.col === w.col)?.clue || '',
    }))
    .sort((a, b) => a.number - b.number);

  const clues = [...acrossClues, ...downClues];

  return {
    title,
    description,
    difficulty,
    rows,
    cols,
    grid,
    words: wordsWithNumbers,
    clues,
  };
}

/**
 * Convert puzzle data to storable JSON strings.
 */
export function puzzleToDbFormat(puzzle: CrosswordPuzzleData) {
  return {
    gridData: JSON.stringify(puzzle.grid),
    wordsData: JSON.stringify(puzzle.words),
    cluesData: JSON.stringify(puzzle.clues),
    rows: puzzle.rows,
    cols: puzzle.cols,
  };
}

/**
 * Parse puzzle data from DB JSON strings.
 */
export function puzzleFromDbFormat(
  title: string,
  description: string | null,
  difficulty: number,
  rows: number,
  cols: number,
  gridData: string,
  wordsData: string,
  cluesData: string
): CrosswordPuzzleData {
  return {
    title,
    description: description || undefined,
    difficulty,
    rows,
    cols,
    grid: JSON.parse(gridData),
    words: JSON.parse(wordsData),
    clues: JSON.parse(cluesData),
  };
}
