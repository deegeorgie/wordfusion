import { describe, expect, it } from 'vitest';
import {
  completedClueKeys,
  evaluateInputs,
  isValidLetterMatrix,
  normalizeLetter,
  parseRevealedCells,
  toPlayerPuzzle,
} from '../src/lib/crossword/server-puzzle';
import { buildPuzzlePdf } from '../src/lib/crossword/pdf-export';
import type { CrosswordCell, CrosswordPuzzleData } from '../src/lib/crossword/types';

function cell(letter: string, overrides: Partial<CrosswordCell> = {}): CrosswordCell {
  return { letter, number: null, isBlack: letter === '', row: 0, col: 0, ...overrides };
}

function puzzle(): CrosswordPuzzleData {
  return {
    title: 'Test',
    description: 'A test puzzle',
    difficulty: 1,
    rows: 2,
    cols: 3,
    grid: [
      [cell('C', { number: 1 }), cell('H'), cell('A')],
      [cell(''), cell('O'), cell('T')],
    ],
    words: [
      { word: 'CHAT', clueNumber: 1, direction: 'across', row: 0, col: 0, length: 3 },
    ],
    clues: [{ number: 1, direction: 'across', text: 'Un animal' }],
    magicWords: ['CHAT'],
  };
}

describe('normalizeLetter', () => {
  it('uppercases and strips accents', () => {
    expect(normalizeLetter('é')).toBe('E');
    expect(normalizeLetter('ç')).toBe('C');
    expect(normalizeLetter(null)).toBe('');
  });
});

describe('parseRevealedCells', () => {
  it('keeps valid string keys and ignores malformed payloads', () => {
    expect([...parseRevealedCells('["0,0","1,2"]')]).toEqual(['0,0', '1,2']);
    expect(parseRevealedCells('{"row":0}').size).toBe(0);
    expect(parseRevealedCells('not-json').size).toBe(0);
  });
});

describe('toPlayerPuzzle', () => {
  it('removes every answer except server-revealed cells', () => {
    const playerPuzzle = toPlayerPuzzle(puzzle(), new Set(['0,0']));

    expect(playerPuzzle.grid[0][0].letter).toBe('C');
    expect(playerPuzzle.grid[0][1].letter).toBe('');
    expect(playerPuzzle.grid[1][2].letter).toBe('');
    expect(playerPuzzle.words[0].word).toBe('');
    expect(playerPuzzle.magicWords).toBeUndefined();
    expect(playerPuzzle.words[0].row).toBe(0);
    expect(playerPuzzle.words[0].length).toBe(3);
  });
});

describe('evaluateInputs', () => {
  it('compares cells server-side with accent-insensitive matching', () => {
    const result = evaluateInputs(puzzle().grid, [
      ['c', 'h', 'x'],
      [null, 'O', null],
    ]);

    expect(result.totalCells).toBe(5);
    expect(result.filledCells).toBe(4);
    expect(result.correctCells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ]);
    expect(result.incorrectCells).toEqual([{ row: 0, col: 2 }]);
    expect(result.allCorrect).toBe(false);
  });

  it('marks a fully filled correct grid as complete', () => {
    const result = evaluateInputs(puzzle().grid, [
      ['C', 'H', 'A'],
      ['', 'O', 'T'],
    ]);

    expect(result.allCorrect).toBe(true);
    expect(result.completionPercent).toBe(100);
  });
});

describe('isValidLetterMatrix', () => {
  it('accepts a bounded letter matrix', () => {
    expect(isValidLetterMatrix([['A', null]], 2, 3)).toBe(true);
  });

  it('rejects oversized rows, columns, and non-letter values', () => {
    expect(isValidLetterMatrix([['A'], ['B'], ['C']], 2, 3)).toBe(false);
    expect(isValidLetterMatrix([['A', 'B', 'C', 'D']], 2, 3)).toBe(false);
    expect(isValidLetterMatrix([['AB']], 2, 3)).toBe(false);
    expect(isValidLetterMatrix({}, 2, 3)).toBe(false);
  });
});

describe('buildPuzzlePdf', () => {
  it('returns a valid PDF buffer on the server', () => {
    const bytes = new Uint8Array(buildPuzzlePdf(puzzle(), { withAnswers: false, language: 'fr' }));
    const header = new TextDecoder().decode(bytes.slice(0, 5));

    expect(header).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('can include the answer letters', () => {
    const without = buildPuzzlePdf(puzzle(), { withAnswers: false });
    const withAnswers = buildPuzzlePdf(puzzle(), { withAnswers: true });

    expect(withAnswers.byteLength).toBeGreaterThan(without.byteLength);
  });
});

describe('completedClueKeys', () => {
  it('reports words whose cells all match the solution', () => {
    expect(completedClueKeys(puzzle().words, puzzle().grid, [['C', 'H', 'A']])).toEqual([
      { number: 1, direction: 'across' },
    ]);
    expect(completedClueKeys(puzzle().words, puzzle().grid, [['C', 'H', 'X']])).toEqual([]);
  });
});
