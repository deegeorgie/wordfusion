import { describe, expect, it } from 'vitest';
import { createPuzzle, puzzleToDbFormat } from '../src/lib/crossword/utils';
import type { CrosswordPuzzleData } from '../src/lib/crossword/types';
import {
  formatPuzzleIssues,
  normalizeAnswer,
  validateGeneratedPuzzle,
  validatePuzzleRecord,
  type PuzzleValidationInput,
} from '../src/lib/crossword/validate-generated';

const clueFor = (word: string) => `Indice pour ${word}`;

/** Fully crossed 5×5 puzzle: CHAT (across) meets CHIEN and TAS (down). */
function makeValidPuzzle(): CrosswordPuzzleData {
  return createPuzzle('', 1, 5, 5, [
    { word: 'CHAT', direction: 'across', row: 0, col: 0, clue: clueFor('CHAT') },
    { word: 'CHIEN', direction: 'down', row: 0, col: 0, clue: clueFor('CHIEN') },
    { word: 'TAS', direction: 'down', row: 0, col: 3, clue: clueFor('TAS') },
  ]);
}

function toInput(puzzle: CrosswordPuzzleData): PuzzleValidationInput {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    grid: puzzle.grid,
    words: puzzle.words,
    clues: puzzle.clues,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('validateGeneratedPuzzle — structural rules', () => {
  it('accepts a complete crossing puzzle in both modes', () => {
    const input = toInput(makeValidPuzzle());
    expect(validateGeneratedPuzzle(input)).toEqual([]);
    expect(validateGeneratedPuzzle(input, { requirePublishable: true })).toEqual([]);
  });

  it('rejects out-of-range dimensions', () => {
    expect(validateGeneratedPuzzle({ rows: 1, cols: 5, grid: [], words: [], clues: [] }))
      .toEqual(['Dimensions invalides (1×5)']);
    expect(validateGeneratedPuzzle({ rows: 26, cols: 5, grid: [], words: [], clues: [] })[0])
      .toContain('Dimensions invalides');
  });

  it('rejects a grid whose rows do not match the declared size', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as unknown[][])[1] = (input.grid as unknown[][])[1].slice(0, 3);
    expect(validateGeneratedPuzzle(input)).toContain('Ligne 2 invalide : 5 colonnes attendues');
  });

  it('rejects malformed cells', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as unknown[][])[0][0] = { letter: 3 };
    expect(validateGeneratedPuzzle(input)).toContain('Cellule (0,0) invalide');
  });

  it('rejects words that overflow the grid', () => {
    const puzzle = createPuzzle('', 1, 5, 5, [
      { word: 'CHAT', direction: 'across', row: 0, col: 3, clue: clueFor('CHAT') },
    ]);
    expect(validateGeneratedPuzzle(toInput(puzzle)).join(' ')).toContain('dépasse la grille');
  });

  it('rejects a word crossing a black cell', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as { isBlack: boolean }[][])[2][3].isBlack = true;
    expect(validateGeneratedPuzzle(input)).toContain('Le mot « TAS » traverse une case noire (2,3)');
  });

  it('rejects a black cell that still carries a letter', () => {
    const input = toInput(makeValidPuzzle());
    const cell = (input.grid as { letter: string; isBlack: boolean }[][])[0][4];
    cell.isBlack = true;
    cell.letter = 'X';
    expect(validateGeneratedPuzzle(input)).toContain('Case noire (0,4) contient une lettre');
  });

  it('rejects letter conflicts inside a filled word', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as { letter: string }[][])[1][0].letter = 'Z';
    expect(validateGeneratedPuzzle(input)).toContain('Conflit de lettre en (1,0) pour « CHIEN »');
  });

  it('rejects answers with non A-Z characters or fewer than 2 letters', () => {
    const input = toInput(makeValidPuzzle());
    (input.words as { word: string }[])[0].word = 'CH4T';
    expect(validateGeneratedPuzzle(input).join(' ')).toContain('Mot « CH4T » invalide');
  });

  it('requires a clue number on every word', () => {
    const input = toInput(makeValidPuzzle());
    delete (input.words as { clueNumber?: number }[])[0].clueNumber;
    expect(validateGeneratedPuzzle(input).join(' ')).toContain("Numéro d'indice manquant");
  });

  it('reports missing and duplicate clues', () => {
    const missing = toInput(makeValidPuzzle());
    (missing.clues as unknown[]).pop();
    expect(validateGeneratedPuzzle(missing).join(' ')).toContain('Indice manquant');

    const duplicated = toInput(makeValidPuzzle());
    (duplicated.clues as unknown[]).push({ ...(duplicated.clues as object[])[0] });
    expect(validateGeneratedPuzzle(duplicated).join(' ')).toContain('Indice en double');
  });

  it('accepts an empty draft but refuses it at publish time', () => {
    const empty = createPuzzle('', 1, 4, 4, []);
    expect(validateGeneratedPuzzle(toInput(empty))).toEqual([]);
    expect(validateGeneratedPuzzle(toInput(empty), { requirePublishable: true })).toContain(
      'Aucun mot dans la grille',
    );
  });
});

describe('validateGeneratedPuzzle — draft vs publish rules', () => {
  it('allows empty clues in a draft and rejects them when publishing', () => {
    const input = toInput(makeValidPuzzle());
    (input.clues as { text: string }[])[0].text = '   ';
    expect(validateGeneratedPuzzle(input)).toEqual([]);
    expect(validateGeneratedPuzzle(input, { requirePublishable: true }).join(' ')).toContain(
      'Indice vide : 1 horizontal',
    );
  });

  it('allows an incomplete solution in a draft and rejects it when publishing', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as { letter: string }[][])[0][0].letter = '';
    expect(validateGeneratedPuzzle(input)).toEqual([]);
    const issues = validateGeneratedPuzzle(input, { requirePublishable: true });
    expect(issues.join(' ')).toContain('Solution incomplète en (0,0)');
  });

  it('ignores shifted letters caused by gaps in a draft', () => {
    // Cells are C, _, T, _ for the word "CT" — an in-progress manual edit.
    const input = toInput(makeValidPuzzle());
    const grid = input.grid as { letter: string }[][];
    grid[0][0].letter = 'C';
    grid[0][1].letter = '';
    grid[0][2].letter = 'T';
    grid[0][3].letter = '';
    const chat = (input.words as { word: string }[])[0];
    chat.word = 'CT';
    expect(validateGeneratedPuzzle(input)).toEqual([]);
  });

  it('rejects orphan white cells when publishing', () => {
    const input = toInput(makeValidPuzzle());
    (input.grid as { letter: string; isBlack: boolean }[][])[4][4] = {
      letter: '',
      isBlack: false,
    } as never;
    expect(validateGeneratedPuzzle(input)).toEqual([]);
    expect(validateGeneratedPuzzle(input, { requirePublishable: true })).toContain(
      'Case (4,4) sans mot associé',
    );
  });

  it('rejects words that cross nothing when publishing', () => {
    const puzzle = createPuzzle('', 1, 5, 5, [
      { word: 'CHAT', direction: 'across', row: 0, col: 0, clue: clueFor('CHAT') },
      { word: 'LUNE', direction: 'across', row: 2, col: 0, clue: clueFor('LUNE') },
    ]);
    expect(validateGeneratedPuzzle(toInput(puzzle))).toEqual([]);
    const issues = validateGeneratedPuzzle(toInput(puzzle), { requirePublishable: true });
    expect(issues).toContain('Le mot « CHAT » ne croise aucun autre mot');
    expect(issues).toContain('Le mot « LUNE » ne croise aucun autre mot');
  });

  it('rejects duplicate answers when publishing', () => {
    const puzzle = createPuzzle('', 1, 5, 5, [
      { word: 'CHAT', direction: 'across', row: 0, col: 0, clue: clueFor('CHAT') },
      { word: 'CHAT', direction: 'across', row: 2, col: 0, clue: 'Autre chat' },
    ]);
    expect(validateGeneratedPuzzle(toInput(puzzle))).toEqual([]);
    expect(validateGeneratedPuzzle(toInput(puzzle), { requirePublishable: true })).toContain(
      'Réponse en double : CHAT',
    );
  });
});

describe('normalizeAnswer', () => {
  it('strips accents and uppercases', () => {
    expect(normalizeAnswer('Été')).toBe('ETE');
    expect(normalizeAnswer('café')).toBe('CAFE');
  });

  it('accepts accented answers in a published puzzle', () => {
    const puzzle = createPuzzle('', 1, 3, 3, [
      { word: 'ÉTÉ', direction: 'across', row: 0, col: 0, clue: 'Une saison' },
    ]);
    expect(validateGeneratedPuzzle(toInput(puzzle), { requirePublishable: true })).toEqual([]);
  });
});

describe('validatePuzzleRecord', () => {
  it('validates a stored puzzle row', () => {
    const db = puzzleToDbFormat(makeValidPuzzle());
    expect(validatePuzzleRecord({ ...db }, { requirePublishable: true })).toEqual([]);
  });

  it('reports malformed JSON with the field label', () => {
    expect(
      validatePuzzleRecord({
        rows: 5,
        cols: 5,
        gridData: 'not json',
        wordsData: '[]',
        cluesData: '[]',
      }),
    ).toEqual(['Grille illisibles (JSON invalide)']);

    expect(
      validatePuzzleRecord({
        rows: 5,
        cols: 5,
        gridData: '[]',
        wordsData: 'not json',
        cluesData: '[]',
      }),
    ).toEqual(['Mots illisibles (JSON invalide)']);
  });
});

describe('formatPuzzleIssues', () => {
  it('joins all issues when under the limit', () => {
    expect(formatPuzzleIssues(['a', 'b'])).toBe('a ; b');
    expect(formatPuzzleIssues(['a', 'b', 'c', 'd', 'e'])).toBe('a ; b ; c ; d ; e');
  });

  it('truncates with a plural and singular count', () => {
    expect(formatPuzzleIssues(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe(
      'a ; b ; c ; d ; e (+2 autres)',
    );
    expect(formatPuzzleIssues(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(
      'a ; b ; c ; d ; e (+1 autre)',
    );
  });
});
