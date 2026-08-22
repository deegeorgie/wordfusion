// Badge / Achievement System — Mots Croisés

// ---------- types ----------

export interface StreakCompletion {
  date: string;       // ISO date "2025-07-08"
  puzzleId: string;
  time: number;       // seconds to solve
  difficulty: number; // 1-3
  title: string;
  language: string;   // 'fr' or 'en'
}

export type BadgeCategory = 'progression' | 'speed' | 'streak' | 'mastery' | 'special';

export interface BadgeDefinition {
  id: string;
  icon: string;           // emoji
  name: string;           // French name
  description: string;    // French description
  category: BadgeCategory;
}

export interface EarnedBadge extends BadgeDefinition {
  earnedAt: string;  // ISO date when earned
}

// ---------- all badge definitions ----------

export const ALL_BADGES: BadgeDefinition[] = [
  // Progression (4)
  {
    id: 'premier-pas',
    icon: '🎯',
    name: 'Premier Pas',
    description: 'Résoudre votre premier puzzle',
    category: 'progression',
  },
  {
    id: 'cinq-etoiles',
    icon: '⭐',
    name: 'Cinq Étoiles',
    description: 'Résoudre 5 puzzles',
    category: 'progression',
  },
  {
    id: 'champion',
    icon: '🏆',
    name: 'Champion',
    description: 'Résoudre 15 puzzles',
    category: 'progression',
  },
  {
    id: 'diamant',
    icon: '💎',
    name: 'Diamant',
    description: 'Résoudre 30 puzzles',
    category: 'progression',
  },

  // Vitesse (2)
  {
    id: 'eclair',
    icon: '⚡',
    name: 'Éclair',
    description: 'Résoudre un puzzle en moins de 2 minutes',
    category: 'speed',
  },
  {
    id: 'fusee',
    icon: '🚀',
    name: 'Fusée',
    description: 'Résoudre un puzzle en moins de 60 secondes',
    category: 'speed',
  },

  // Séries (3)
  {
    id: 'en-feu',
    icon: '🔥',
    name: 'En Feu',
    description: 'Série de 3 jours consécutifs',
    category: 'streak',
  },
  {
    id: 'regulier',
    icon: '📅',
    name: 'Régulier',
    description: 'Série de 7 jours consécutifs',
    category: 'streak',
  },
  {
    id: 'ascension',
    icon: '🏔️',
    name: 'Ascension',
    description: 'Série de 30 jours consécutifs',
    category: 'streak',
  },

  // Maîtrise (1)
  {
    id: 'sans-indice',
    icon: '🧠',
    name: 'Sans Indice',
    description: 'Résoudre 3 puzzles sans utiliser d\'indice',
    category: 'mastery',
  },

  // Spécial (2)
  {
    id: 'polyglotte',
    icon: '🌍',
    name: 'Polyglotte',
    description: 'Résoudre des puzzles en français et en anglais',
    category: 'special',
  },
  {
    id: 'exploreur',
    icon: '🎨',
    name: 'Exploreur',
    description: 'Résoudre des puzzles de 3 difficultés différentes',
    category: 'special',
  },
];

// ---------- helpers ----------

function dateKey(d: string): string {
  return d.slice(0, 10);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(key: string): string {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcCurrentStreak(dates: Set<string>): number {
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (!dates.has(today) && !dates.has(yesterday)) return 0;

  let streak = 0;
  let check = dates.has(today) ? today : yesterday;
  while (dates.has(check)) {
    streak++;
    check = prevDay(check);
  }
  return streak;
}

/** Returns the Nth completion sorted chronologically by date, 1-indexed. */
function getNthCompletion(completions: StreakCompletion[], n: number): StreakCompletion | null {
  const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[n - 1] ?? null;
}

/** Returns the earliest completion matching a predicate, sorted by date. */
function findEarliestMatch(
  completions: StreakCompletion[],
  predicate: (c: StreakCompletion) => boolean
): StreakCompletion | null {
  const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find(predicate) ?? null;
}

// ---------- evaluation ----------

export function evaluateBadges(completions: StreakCompletion[]): EarnedBadge[] {
  if (completions.length === 0) return [];

  const totalSolved = completions.length;
  const uniqueDates = new Set(completions.map((c) => dateKey(c.date)));
  const currentStreak = calcCurrentStreak(uniqueDates);
  const today = todayKey();

  const earned: EarnedBadge[] = [];

  // Helper: add earned badge with date source
  function earn(def: BadgeDefinition, date: string) {
    earned.push({ ...def, earnedAt: date });
  }

  // 1. Premier Pas — totalSolved >= 1
  const first = getNthCompletion(completions, 1);
  if (first) {
    earn(ALL_BADGES[0], first.date);
  }

  // 2. Cinq Étoiles — totalSolved >= 5
  const fifth = getNthCompletion(completions, 5);
  if (fifth) {
    earn(ALL_BADGES[1], fifth.date);
  }

  // 3. Champion — totalSolved >= 15
  const fifteenth = getNthCompletion(completions, 15);
  if (fifteenth) {
    earn(ALL_BADGES[2], fifteenth.date);
  }

  // 4. Diamant — totalSolved >= 30
  const thirtieth = getNthCompletion(completions, 30);
  if (thirtieth) {
    earn(ALL_BADGES[3], thirtieth.date);
  }

  // 5. Éclair — any completion with time < 120
  const under120 = findEarliestMatch(completions, (c) => c.time < 120);
  if (under120) {
    earn(ALL_BADGES[4], under120.date);
  }

  // 6. Fusée — any completion with time < 60
  const under60 = findEarliestMatch(completions, (c) => c.time < 60);
  if (under60) {
    earn(ALL_BADGES[5], under60.date);
  }

  // 7. En Feu — currentStreak >= 3
  if (currentStreak >= 3) {
    earn(ALL_BADGES[6], today);
  }

  // 8. Régulier — currentStreak >= 7
  if (currentStreak >= 7) {
    earn(ALL_BADGES[7], today);
  }

  // 9. Ascension — currentStreak >= 30
  if (currentStreak >= 30) {
    earn(ALL_BADGES[8], today);
  }

  // 10. Sans Indice — totalSolved >= 3 (placeholder until hintsUsed is tracked)
  const third = getNthCompletion(completions, 3);
  if (third) {
    earn(ALL_BADGES[9], third.date);
  }

  // 11. Polyglotte — completions in both 'fr' and 'en'
  const hasFr = completions.some((c) => c.language === 'fr');
  const hasEn = completions.some((c) => c.language === 'en');
  if (hasFr && hasEn) {
    // Find the completion that completed the second language
    const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date));
    const langs = new Set<string>();
    let triggerDate = sorted[0].date;
    for (const c of sorted) {
      langs.add(c.language);
      if (langs.has('fr') && langs.has('en')) {
        triggerDate = c.date;
        break;
      }
    }
    earn(ALL_BADGES[10], triggerDate);
  }

  // 12. Exploreur — completions at difficulty 1, 2, AND 3
  const hasDiff1 = completions.some((c) => c.difficulty === 1);
  const hasDiff2 = completions.some((c) => c.difficulty === 2);
  const hasDiff3 = completions.some((c) => c.difficulty === 3);
  if (hasDiff1 && hasDiff2 && hasDiff3) {
    const sorted = [...completions].sort((a, b) => a.date.localeCompare(b.date));
    const diffs = new Set<number>();
    let triggerDate = sorted[0].date;
    for (const c of sorted) {
      diffs.add(c.difficulty);
      if (diffs.has(1) && diffs.has(2) && diffs.has(3)) {
        triggerDate = c.date;
        break;
      }
    }
    earn(ALL_BADGES[11], triggerDate);
  }

  return earned;
}

// ---------- new badges helper ----------

/** Returns only badges that are newly earned (not in previouslyEarned). */
export function getNewBadges(
  completions: StreakCompletion[],
  previouslyEarned: string[]
): EarnedBadge[] {
  const allEarned = evaluateBadges(completions);
  const prevSet = new Set(previouslyEarned);
  return allEarned.filter((b) => !prevSet.has(b.id));
}
