// Shared integrity gate for puzzles about to be saved or published.
// It validates the serialized puzzle (grid + words + clues) independently of
// the code path that produced it, so manual edits, the generator and the cron
// publisher all enforce the same rules.

export interface PuzzleValidationInput {
  rows: number;
  cols: number;
  grid: unknown;
  words: unknown;
  clues: unknown;
}

export interface PuzzleValidationOptions {
  /**
   * Publish-ready rules: full solution, non-empty clues, every word crossing
   * another, no orphan cells and no duplicate answers. Drafts are only checked
   * for structural corruption so autosave works mid-edit.
   */
  requirePublishable?: boolean;
}

export interface StoredPuzzleFields {
  rows: number;
  cols: number;
  gridData: string;
  wordsData: string;
  cluesData: string;
}

type Direction = 'across' | 'down';

interface CellOwner {
  index: number;
  direction: Direction;
}

interface PlacedWordInfo {
  index: number;
  answer: string;
  direction: Direction;
  cells: string[];
}

const MIN_DIMENSION = 2;
const MAX_DIMENSION = 25;
const MAX_WORDS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function directionLabel(direction: unknown): string {
  return direction === 'down' ? 'vertical' : 'horizontal';
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function formatPuzzleIssues(issues: readonly string[], limit = 5): string {
  const shown = issues.slice(0, limit).join(' ; ');
  if (issues.length <= limit) return shown;
  const remaining = issues.length - limit;
  return `${shown} (+${remaining} autre${remaining > 1 ? 's' : ''})`;
}

export function validateGeneratedPuzzle(
  input: PuzzleValidationInput,
  options: PuzzleValidationOptions = {},
): string[] {
  const { rows, cols } = input;
  const requirePublishable = options.requirePublishable === true;
  const issues: string[] = [];

  if (
    !Number.isInteger(rows) || rows < MIN_DIMENSION || rows > MAX_DIMENSION ||
    !Number.isInteger(cols) || cols < MIN_DIMENSION || cols > MAX_DIMENSION
  ) {
    return [`Dimensions invalides (${rows}×${cols})`];
  }

  if (!Array.isArray(input.grid) || input.grid.length !== rows) {
    return [`La grille doit contenir exactement ${rows} lignes`];
  }

  const black: boolean[][] = [];
  const letters: string[][] = [];
  let gridReadable = true;

  for (let r = 0; r < rows; r++) {
    const row: unknown = input.grid[r];
    black[r] = [];
    letters[r] = [];
    if (!Array.isArray(row) || row.length !== cols) {
      issues.push(`Ligne ${r + 1} invalide : ${cols} colonnes attendues`);
      gridReadable = false;
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const cell: unknown = row[c];
      if (!isRecord(cell) || typeof cell.isBlack !== 'boolean' || typeof cell.letter !== 'string') {
        issues.push(`Cellule (${r},${c}) invalide`);
        gridReadable = false;
        continue;
      }
      const letter = normalizeAnswer(cell.letter);
      black[r][c] = cell.isBlack;
      letters[r][c] = letter;
      if (cell.isBlack) {
        if (letter) issues.push(`Case noire (${r},${c}) contient une lettre`);
      } else if (letter && !/^[A-Z]$/.test(letter)) {
        issues.push(`Cellule (${r},${c}) : lettre invalide`);
      }
    }
  }

  if (!gridReadable) return issues;

  if (!Array.isArray(input.words)) {
    issues.push('Mots invalides');
    return issues;
  }
  if (input.words.length === 0) {
    // A brand-new draft may not have any word yet; publish rules still refuse it.
    if (requirePublishable) issues.push('Aucun mot dans la grille');
    return issues;
  }
  if (input.words.length > MAX_WORDS) {
    issues.push(`Trop de mots (${input.words.length}, maximum ${MAX_WORDS})`);
  }

  const cellOwners = new Map<string, CellOwner[]>();
  const placedWords: PlacedWordInfo[] = [];
  const answerCounts = new Map<string, number>();
  const expectedClues = new Set<string>();

  input.words.forEach((raw, index) => {
    if (!isRecord(raw)) {
      issues.push(`Mot ${index + 1} invalide`);
      return;
    }
    const { word, direction, row, col, clueNumber } = raw;
    if (
      typeof word !== 'string' ||
      (direction !== 'across' && direction !== 'down') ||
      !Number.isInteger(row) ||
      !Number.isInteger(col)
    ) {
      issues.push(`Mot ${index + 1} invalide`);
      return;
    }

    const answer = normalizeAnswer(word);
    if (!/^[A-Z]{2,}$/.test(answer)) {
      issues.push(`Mot « ${word} » invalide : lettres A-Z uniquement, 2 minimum`);
      return;
    }

    if (!Number.isInteger(clueNumber) || (clueNumber as number) < 1) {
      issues.push(`Numéro d'indice manquant pour « ${answer} »`);
    } else {
      expectedClues.add(`${clueNumber}:${direction}`);
    }

    const startRow = row as number;
    const startCol = col as number;
    const cells: string[] = [];
    let fits = true;
    for (let offset = 0; offset < answer.length; offset++) {
      const r = direction === 'across' ? startRow : startRow + offset;
      const c = direction === 'across' ? startCol + offset : startCol;
      if (r < 0 || r >= rows || c < 0 || c >= cols) {
        issues.push(`Le mot « ${answer} » dépasse la grille (${r},${c})`);
        fits = false;
        break;
      }
      cells.push(`${r},${c}`);
    }
    if (!fits) return;

    // The editor compacts typed letters, so when cells are still empty the
    // answer offsets do not line up with the grid: conflicts are only reliable
    // on a filled span. Drafts stay permissive; publishing requires both.
    const complete = cells.every((key) => {
      const [r, c] = key.split(',').map(Number);
      return !!letters[r][c];
    });

    for (let offset = 0; offset < answer.length; offset++) {
      const [r, c] = cells[offset].split(',').map(Number);
      if (black[r][c]) {
        issues.push(`Le mot « ${answer} » traverse une case noire (${r},${c})`);
        continue;
      }
      if (!letters[r][c]) {
        if (requirePublishable) issues.push(`Solution incomplète en (${r},${c}) pour « ${answer} »`);
        continue;
      }
      if ((complete || requirePublishable) && letters[r][c] !== answer[offset]) {
        issues.push(`Conflit de lettre en (${r},${c}) pour « ${answer} »`);
      }
    }

    for (const key of cells) {
      const owners = cellOwners.get(key);
      if (owners) owners.push({ index, direction });
      else cellOwners.set(key, [{ index, direction }]);
    }
    answerCounts.set(answer, (answerCounts.get(answer) ?? 0) + 1);
    placedWords.push({ index, answer, direction, cells });
  });

  if (requirePublishable) {
    for (const [answer, count] of answerCounts) {
      if (count > 1) issues.push(`Réponse en double : ${answer}`);
    }
  }

  if (!Array.isArray(input.clues)) {
    issues.push('Indices invalides');
  } else {
    const clueKeys = new Set<string>();
    for (const raw of input.clues) {
      if (
        !isRecord(raw) ||
        !Number.isInteger(raw.number) ||
        (raw.direction !== 'across' && raw.direction !== 'down') ||
        typeof raw.text !== 'string'
      ) {
        issues.push('Indice invalide');
        continue;
      }
      const key = `${raw.number}:${raw.direction}`;
      if (clueKeys.has(key)) {
        issues.push(`Indice en double : ${raw.number} ${directionLabel(raw.direction)}`);
      }
      clueKeys.add(key);
      if (requirePublishable && !raw.text.trim()) {
        issues.push(`Indice vide : ${raw.number} ${directionLabel(raw.direction)}`);
      }
    }
    for (const key of expectedClues) {
      if (!clueKeys.has(key)) {
        const [number, direction] = key.split(':');
        issues.push(`Indice manquant : ${number} ${directionLabel(direction)}`);
      }
    }
  }

  if (requirePublishable) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!black[r][c] && !cellOwners.has(`${r},${c}`)) {
          issues.push(`Case (${r},${c}) sans mot associé`);
        }
      }
    }

    if (placedWords.length > 1) {
      for (const placed of placedWords) {
        const crosses = placed.cells.some((key) =>
          (cellOwners.get(key) ?? []).some(
            (owner) => owner.index !== placed.index && owner.direction !== placed.direction,
          ),
        );
        if (!crosses) issues.push(`Le mot « ${placed.answer} » ne croise aucun autre mot`);
      }
    }
  }

  return issues;
}

type ParsedField =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function parseField(value: unknown, label: string): ParsedField {
  if (typeof value !== 'string') return { ok: false, error: `${label} illisibles` };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, error: `${label} illisibles (JSON invalide)` };
  }
}

/** Validate a Prisma puzzle row without parsing it in the caller. */
export function validatePuzzleRecord(
  record: StoredPuzzleFields,
  options: PuzzleValidationOptions = {},
): string[] {
  const grid = parseField(record.gridData, 'Grille');
  if (!grid.ok) return [grid.error];
  const words = parseField(record.wordsData, 'Mots');
  if (!words.ok) return [words.error];
  const clues = parseField(record.cluesData, 'Indices');
  if (!clues.ok) return [clues.error];

  return validateGeneratedPuzzle(
    { rows: record.rows, cols: record.cols, grid: grid.value, words: words.value, clues: clues.value },
    options,
  );
}
