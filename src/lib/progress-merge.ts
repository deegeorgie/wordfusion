export interface ProgressSnapshot {
  completed: boolean;
  timeSpent: number;
  hintsUsed: number;
  progress: string;
  magicWordsClaimed: string;
  revealedCells: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type LetterMatrix = (string | null)[][];

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
}

function parseLetterMatrix(raw: string | null | undefined): LetterMatrix | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((row) =>
      Array.isArray(row)
        ? row.map((value) => (typeof value === 'string' && value ? value.slice(0, 1).toUpperCase() : null))
        : [],
    );
  } catch {
    return null;
  }
}

function mergeLetterMatrices(account: LetterMatrix | null, anonymous: LetterMatrix | null): string {
  if (!account && !anonymous) return JSON.stringify({});

  const rowCount = Math.max(account?.length ?? 0, anonymous?.length ?? 0);
  const merged: LetterMatrix = [];

  for (let row = 0; row < rowCount; row += 1) {
    const colCount = Math.max(account?.[row]?.length ?? 0, anonymous?.[row]?.length ?? 0);
    const mergedRow: (string | null)[] = [];
    for (let col = 0; col < colCount; col += 1) {
      // The signed-in device wins on conflicts; anonymous letters only fill gaps.
      mergedRow.push(account?.[row]?.[col] ?? anonymous?.[row]?.[col] ?? null);
    }
    merged.push(mergedRow);
  }

  return JSON.stringify(merged);
}

function unionKeys(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].sort();
}

export function mergeProgress(
  account: ProgressSnapshot | null,
  anonymous: ProgressSnapshot,
): ProgressSnapshot {
  if (!account) {
    return {
      ...anonymous,
      progress: mergeLetterMatrices(null, parseLetterMatrix(anonymous.progress)),
      magicWordsClaimed: JSON.stringify(unionKeys([], parseStringArray(anonymous.magicWordsClaimed))),
      revealedCells: JSON.stringify(unionKeys([], parseStringArray(anonymous.revealedCells))),
    };
  }

  const completed = account.completed || anonymous.completed;
  const completionTimes: Date[] = [];
  if (account.completed) completionTimes.push(account.completedAt ?? account.updatedAt);
  if (anonymous.completed) completionTimes.push(anonymous.completedAt ?? anonymous.updatedAt);

  return {
    completed,
    completedAt: completionTimes.length
      ? new Date(Math.min(...completionTimes.map((date) => date.getTime())))
      : null,
    timeSpent: Math.max(account.timeSpent, anonymous.timeSpent),
    hintsUsed: Math.max(account.hintsUsed, anonymous.hintsUsed),
    progress: mergeLetterMatrices(
      parseLetterMatrix(account.progress),
      parseLetterMatrix(anonymous.progress),
    ),
    magicWordsClaimed: JSON.stringify(unionKeys(
      parseStringArray(account.magicWordsClaimed),
      parseStringArray(anonymous.magicWordsClaimed),
    )),
    revealedCells: JSON.stringify(unionKeys(
      parseStringArray(account.revealedCells),
      parseStringArray(anonymous.revealedCells),
    )),
    createdAt: new Date(Math.min(account.createdAt.getTime(), anonymous.createdAt.getTime())),
    updatedAt: new Date(Math.max(account.updatedAt.getTime(), anonymous.updatedAt.getTime())),
  };
}
