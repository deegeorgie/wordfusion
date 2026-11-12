import { describe, expect, it } from 'vitest';
import { mergeProgress, type ProgressSnapshot } from '../src/lib/progress-merge';

function snapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    completed: false,
    timeSpent: 0,
    hintsUsed: 0,
    progress: JSON.stringify({}),
    magicWordsClaimed: JSON.stringify([]),
    revealedCells: JSON.stringify([]),
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('mergeProgress', () => {
  it('adopts anonymous progress when the account has none', () => {
    const anonymous = snapshot({
      completed: true,
      timeSpent: 120,
      hintsUsed: 2,
      progress: JSON.stringify([['C', null]]),
      magicWordsClaimed: JSON.stringify(['CHAT', '']),
      revealedCells: JSON.stringify(['0,1']),
      completedAt: new Date('2026-01-02T00:00:00Z'),
    });

    const merged = mergeProgress(null, anonymous);

    expect(merged.completed).toBe(true);
    expect(merged.timeSpent).toBe(120);
    expect(merged.hintsUsed).toBe(2);
    expect(JSON.parse(merged.progress)).toEqual([['C', null]]);
    expect(JSON.parse(merged.magicWordsClaimed)).toEqual(['CHAT']);
    expect(JSON.parse(merged.revealedCells)).toEqual(['0,1']);
    expect(merged.completedAt).toEqual(new Date('2026-01-02T00:00:00Z'));
  });

  it('keeps the account letters and fills gaps from the anonymous device', () => {
    const account = snapshot({
      progress: JSON.stringify([['A', null]]),
      revealedCells: JSON.stringify(['0,0']),
    });
    const anonymous = snapshot({
      progress: JSON.stringify([['B', 'C'], [null, 'D']]),
      revealedCells: JSON.stringify(['0,1']),
    });

    const merged = mergeProgress(account, anonymous);

    expect(JSON.parse(merged.progress)).toEqual([['A', 'C'], [null, 'D']]);
    expect(JSON.parse(merged.revealedCells)).toEqual(['0,0', '0,1']);
  });

  it('keeps the earliest completion and the largest counters', () => {
    const account = snapshot({
      completed: true,
      completedAt: null,
      updatedAt: new Date('2026-01-10T00:00:00Z'),
      timeSpent: 300,
      hintsUsed: 1,
    });
    const anonymous = snapshot({
      completed: true,
      completedAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-06T00:00:00Z'),
      timeSpent: 90,
      hintsUsed: 4,
    });

    const merged = mergeProgress(account, anonymous);

    expect(merged.completed).toBe(true);
    expect(merged.completedAt).toEqual(new Date('2026-01-05T00:00:00Z'));
    expect(merged.timeSpent).toBe(300);
    expect(merged.hintsUsed).toBe(4);
    expect(merged.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(merged.updatedAt).toEqual(new Date('2026-01-10T00:00:00Z'));
  });

  it('has no completion date when neither side completed the puzzle', () => {
    const merged = mergeProgress(snapshot(), snapshot({ progress: JSON.stringify([['A']]) }));
    expect(merged.completed).toBe(false);
    expect(merged.completedAt).toBeNull();
  });

  it('tolerates legacy and malformed JSON payloads', () => {
    const account = snapshot({ progress: '{}', magicWordsClaimed: 'not-json' });
    const anonymous = snapshot({
      progress: JSON.stringify([['a']]),
      magicWordsClaimed: JSON.stringify(['MOT']),
    });

    const merged = mergeProgress(account, anonymous);

    expect(JSON.parse(merged.progress)).toEqual([['A']]);
    expect(JSON.parse(merged.magicWordsClaimed)).toEqual(['MOT']);
  });
});
