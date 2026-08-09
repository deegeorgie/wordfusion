// Crossword Puzzle Type Definitions

export interface CrosswordCell {
  letter: string;       // The correct letter (empty string for black cells)
  number: number | null; // Clue number (null if no clue starts here)
  isBlack: boolean;      // Whether this cell is a black/empty cell
  row: number;
  col: number;
}

export interface WordPlacement {
  word: string;          // The actual word
  clueNumber: number;    // Reference to the clue number
  direction: 'across' | 'down';
  row: number;           // Starting row
  col: number;           // Starting column
  length: number;        // Length of the word
}

export interface Clue {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

export interface CrosswordPuzzleData {
  title: string;
  description?: string;
  difficulty: number;
  rows: number;
  cols: number;
  grid: CrosswordCell[][];
  words: WordPlacement[];
  clues: Clue[];
}

export interface GridState {
  cells: (string | null)[][];  // User's current input for each cell
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  activeClueNumber: number | null;
  activeClueDirection: 'across' | 'down';
}

export interface PuzzleSummary {
  id: string;
  title: string;
  difficulty: number;
  rows: number;
  cols: number;
  publishDate: string;
  completed: boolean;
  timeSpent: number;
}
