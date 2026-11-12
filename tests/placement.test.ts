import { describe, expect, it } from 'vitest';
import {
  placeWords,
  validatePlacement,
  type PlacementResult,
  type PlacedWord,
  type RawWord,
} from '../src/lib/crossword/placement';

function makeWords(list: string[]): RawWord[] {
  return list.map((word) => ({ word, clue: `Indice pour ${word.toLowerCase()}` }));
}

// Word lists shaped like real LLM output: mostly 4-7 letters, common letters.
const THEME_10 = makeWords([
  'MAISON', 'JARDIN', 'ARBRE', 'FLEUR', 'ROSE', 'TULIPE',
  'SOLEIL', 'NUAGE', 'PLUIE', 'TERRE', 'ROCHE',
]);

const THEME_13 = makeWords([
  'MONTAGNE', 'RIVIERE', 'FORET', 'VALLEE', 'SENTIER', 'SOMMET',
  'GLACIER', 'CASCADE', 'PRAIRIE', 'ROCHER', 'SOURCE', 'CHEMIN',
  'OISEAU', 'RENARD', 'SAPIN',
]);

const THEME_5 = makeWords(['LUNE', 'OURS', 'MARS', 'ROC', 'EAU']);

function wordCells(word: PlacedWord): { row: number; col: number }[] {
  return Array.from({ length: word.word.length }, (_, i) => ({
    row: word.direction === 'across' ? word.row : word.row + i,
    col: word.direction === 'across' ? word.col + i : word.col,
  }));
}

function expectInsideBounds(layout: { words: PlacedWord[]; rows: number; cols: number }, rows: number, cols: number) {
  expect(layout.rows).toBeGreaterThan(0);
  expect(layout.cols).toBeGreaterThan(0);
  expect(layout.rows).toBeLessThanOrEqual(rows);
  expect(layout.cols).toBeLessThanOrEqual(cols);
  for (const word of layout.words) {
    for (const cell of wordCells(word)) {
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(layout.rows);
      expect(cell.col).toBeLessThan(layout.cols);
    }
  }
}

function requiredWords(result: PlacementResult): number {
  return Math.max(3, Math.ceil(result.uniqueWords * 0.8));
}

describe('placeWords', () => {
  it('fills at least 80% of a realistic 11-word theme in 10×10', () => {
    const result = placeWords(THEME_10, { rows: 10, cols: 10 });

    expect(result.success).toBe(true);
    expect(result.placedCount).toBeGreaterThanOrEqual(requiredWords(result));
    expect(result.uniqueWords).toBe(THEME_10.length);
    expect(result.totalWords).toBe(THEME_10.length);
    expectInsideBounds(result, 10, 10);
    expect(validatePlacement(result)).toEqual([]);
  });

  it('fills at least 80% of a realistic 15-word theme in 13×13', () => {
    const result = placeWords(THEME_13, { rows: 13, cols: 13 });

    expect(result.success).toBe(true);
    expect(result.placedCount).toBeGreaterThanOrEqual(requiredWords(result));
    expectInsideBounds(result, 13, 13);
    expect(validatePlacement(result)).toEqual([]);
  });

  it('handles the 5×5 preset', () => {
    const result = placeWords(THEME_5, { rows: 5, cols: 5 });

    expect(result.success).toBe(true);
    expect(result.placedCount).toBeGreaterThanOrEqual(4);
    expectInsideBounds(result, 5, 5);
    expect(validatePlacement(result)).toEqual([]);
  });

  it('is deterministic for identical input', () => {
    const first = placeWords(THEME_10, { rows: 10, cols: 10 });
    const second = placeWords(THEME_10, { rows: 10, cols: 10 });

    expect(second).toEqual(first);
  });

  it('honours an explicit seed', () => {
    const a = placeWords(THEME_13, { rows: 13, cols: 13, seed: 1234 });
    const b = placeWords(THEME_13, { rows: 13, cols: 13, seed: 1234 });

    expect(b).toEqual(a);
  });

  it('never exceeds the requested bounds even with oversized words', () => {
    const result = placeWords(
      makeWords(['CAFE', 'ETE', 'THE', 'EAU', 'EXTRAORDINAIRE']),
      { rows: 8, cols: 8 },
    );

    expect(result.success).toBe(true);
    expect(result.uniqueWords).toBe(4);
    expectInsideBounds(result, 8, 8);
    for (const word of result.words) {
      expect(word.word.length).toBeLessThanOrEqual(8);
    }
    expect(result.words.every((word) => word.word !== 'EXTRAORDINAIRE')).toBe(true);
  });

  it('normalizes accents and strips non-letter characters', () => {
    const result = placeWords(
      [
        { word: 'Café', clue: 'Boisson chaude' },
        { word: 'ÉTÉ', clue: 'Saison chaude' },
        { word: "THÉ", clue: 'Infusion' },
        { word: "L'EAU", clue: 'Liquide vital' },
      ],
      { rows: 8, cols: 8 },
    );

    for (const word of result.words) {
      expect(word.word).toMatch(/^[A-Z]+$/);
    }
    expect(result.words.map((word) => word.word)).toContain('CAFE');
    expect(result.words.map((word) => word.word)).toContain('ETE');
  });

  it('rejects grids that are too small to be valid', () => {
    const result = placeWords(THEME_5, { rows: 2, cols: 2 });
    expect(result.success).toBe(false);
    expect(result.words).toEqual([]);
  });

  it('fails cleanly when fewer than three usable words remain', () => {
    const result = placeWords(makeWords(['CALENDRIER', 'BIBLIOTHEQUE']), { rows: 10, cols: 10 });
    expect(result.success).toBe(false);
    expect(result.words).toEqual([]);
    expect(result.uniqueWords).toBe(1);
  });

  it('collapses duplicate answers before measuring the fill ratio', () => {
    const result = placeWords(makeWords(['CHAT', 'CHAT', 'OURS', 'MARS']), { rows: 8, cols: 8 });

    expect(result.uniqueWords).toBe(3);
    expect(new Set(result.words.map((word) => word.word)).size).toBe(result.words.length);
  });
});

describe('validatePlacement', () => {
  it('accepts a hand-built crossing layout', () => {
    const layout = {
      rows: 4,
      cols: 4,
      words: [
        { word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' },
        { word: 'TIR', direction: 'down' as const, row: 0, col: 3, clue: 'Action de viser' },
      ],
    };

    expect(validatePlacement(layout)).toEqual([]);
  });

  it('flags words that leave the grid', () => {
    const layout = {
      rows: 3,
      cols: 3,
      words: [{ word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' }],
    };

    expect(validatePlacement(layout)).toContain('CHAT: out of bounds at 0,3');
  });

  it('flags conflicting letters at a shared cell', () => {
    const layout = {
      rows: 6,
      cols: 6,
      words: [
        { word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' },
        { word: 'ROI', direction: 'down' as const, row: 0, col: 2, clue: 'Souverain' },
      ],
    };

    expect(validatePlacement(layout)).toContain('ROI: letter conflict at 0,2');
  });

  it('flags words that never cross another word', () => {
    const layout = {
      rows: 6,
      cols: 6,
      words: [
        { word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' },
        { word: 'TIR', direction: 'down' as const, row: 2, col: 2, clue: 'Viser' },
      ],
    };

    const issues = validatePlacement(layout);
    expect(issues).toContain('CHAT: no crossings');
    expect(issues).toContain('TIR: no crossings');
  });

  it('flags unclued runs formed by touching words', () => {
    const layout = {
      rows: 6,
      cols: 10,
      words: [
        { word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' },
        { word: 'TIR', direction: 'down' as const, row: 0, col: 3, clue: 'Viser' },
        { word: 'ROC', direction: 'across' as const, row: 0, col: 4, clue: 'Minéral' },
      ],
    };

    expect(
      validatePlacement(layout).some((issue) => issue.includes('unclued across run at 0,0')),
    ).toBe(true);
  });

  it('flags duplicate answers and missing clues', () => {
    const layout = {
      rows: 6,
      cols: 6,
      words: [
        { word: 'CHAT', direction: 'across' as const, row: 0, col: 0, clue: 'Félin' },
        { word: 'CHAT', direction: 'down' as const, row: 0, col: 0, clue: '' },
      ],
    };

    const issues = validatePlacement(layout);
    expect(issues).toContain('CHAT: duplicate answer');
    expect(issues).toContain('CHAT: missing clue');
  });
});
