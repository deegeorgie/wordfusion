import { describe, expect, it } from 'vitest';
import { isBiteSizedPuzzle, isPuzzleReleased } from '../src/lib/puzzle-rules';

const NOW = new Date('2026-11-11T12:00:00Z');

describe('isPuzzleReleased', () => {
  it('treats a missing publish date as released', () => {
    expect(isPuzzleReleased({ publishDate: null }, NOW)).toBe(true);
  });

  it('releases puzzles whose date has passed', () => {
    expect(isPuzzleReleased({ publishDate: new Date('2026-11-10T12:00:00Z') }, NOW)).toBe(true);
  });

  it('releases puzzles exactly at their publication time', () => {
    expect(isPuzzleReleased({ publishDate: NOW }, NOW)).toBe(true);
  });

  it('holds back future-dated puzzles', () => {
    expect(isPuzzleReleased({ publishDate: new Date('2026-11-12T12:00:00Z') }, NOW)).toBe(false);
  });

  it('accepts ISO strings from serialized puzzle data', () => {
    expect(isPuzzleReleased({ publishDate: '2026-11-12T00:00:00.000Z' }, NOW)).toBe(false);
  });

  it('does not hide puzzles behind malformed dates', () => {
    expect(isPuzzleReleased({ publishDate: 'not-a-date' }, NOW)).toBe(true);
  });
});

describe('isBiteSizedPuzzle', () => {
  it('matches 5x5 grids only', () => {
    expect(isBiteSizedPuzzle({ rows: 5, cols: 5 })).toBe(true);
    expect(isBiteSizedPuzzle({ rows: 5, cols: 6 })).toBe(false);
    expect(isBiteSizedPuzzle({ rows: 6, cols: 5 })).toBe(false);
  });
});
