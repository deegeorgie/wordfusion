export function isBiteSizedPuzzle(puzzle: { rows: number; cols: number }): boolean {
  return puzzle.rows === 5 && puzzle.cols === 5;
}

/**
 * A puzzle is playable once its scheduled publication date has passed.
 * No publish date means it has no schedule (legacy rows), so it stays visible.
 */
export function isPuzzleReleased(
  puzzle: { publishDate: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!puzzle.publishDate) return true;
  const releaseTime = new Date(puzzle.publishDate).getTime();
  if (Number.isNaN(releaseTime)) return true;
  return releaseTime <= now.getTime();
}
