export function isBiteSizedPuzzle(puzzle: { rows: number; cols: number }): boolean {
  return puzzle.rows === 5 && puzzle.cols === 5;
}