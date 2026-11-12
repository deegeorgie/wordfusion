import { describe, expect, it } from 'vitest';
import {
  THEMES,
  getFallbackWords,
  matchTheme,
  type BankEntry,
} from '../src/lib/crossword/word-bank';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function answerFor(entry: BankEntry, language: 'fr' | 'en'): string {
  return language === 'en' ? entry.en ?? entry.word : entry.word;
}

describe('matchTheme', () => {
  const cases: [string, string][] = [
    ['Animaux de la savane', 'wildlife'],
    ['Animaux sauvages', 'wildlife'],
    ['Villes africaines', 'african-capitals'],
    ['Capitales africaines', 'african-capitals'],
    ['Capitales du monde', 'world-capitals'],
    ['World capitals', 'world-capitals'],
    ['Inventions célèbres', 'inventions'],
    ['Cuisine du monde', 'cuisine'],
    ['Sport olympique', 'sports'],
    ['Histoire de France', 'french-history'],
    ['Antiquité égyptienne', 'ancient-history'],
    ['Astronomie', 'astronomy'],
    ['Musique classique', 'classical-music'],
    ['Littérature', 'literature'],
    ['Général', 'generic'],
    ['GENERAL', 'generic'],
  ];

  it.each(cases)('maps "%s" to %s', (theme, expected) => {
    expect(matchTheme(theme)).toBe(expected);
  });

  it('returns null for unknown themes', () => {
    expect(matchTheme('Thème totalement inconnu')).toBeNull();
    expect(matchTheme('')).toBeNull();
  });

  it('matches whole words only', () => {
    expect(matchTheme('Transport')).toBeNull();
  });
});

describe('word bank data', () => {
  it('has at least 20 unique entries per theme', () => {
    for (const theme of THEMES) {
      expect(theme.entries.length).toBeGreaterThanOrEqual(20);
      const answers = theme.entries.map((entry) => entry.word.toUpperCase());
      expect(new Set(answers).size).toBe(answers.length);
    }
  });

  it('keeps every clue non-empty and free of its own answer', () => {
    for (const theme of THEMES) {
      for (const entry of theme.entries) {
        for (const language of ['fr', 'en'] as const) {
          const clue = language === 'en' ? entry.enClue : entry.frClue;
          expect(clue.trim().length).toBeGreaterThan(0);
          const answer = normalizeText(answerFor(entry, language));
          expect(normalizeText(clue)).not.toContain(answer);
        }
      }
    }
  });
});

describe('getFallbackWords', () => {
  it('returns the requested number of unique A-Z answers for every theme', () => {
    for (const theme of THEMES) {
      for (const language of ['fr', 'en'] as const) {
        const words = getFallbackWords({
          theme: theme.id,
          language,
          difficulty: 2,
          wordCount: 12,
        });
        expect(words).toHaveLength(12);
        expect(new Set(words.map((entry) => entry.word)).size).toBe(12);
        for (const entry of words) {
          expect(entry.word).toMatch(/^[A-Z]+$/);
          expect(entry.clue.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('is deterministic for identical options', () => {
    const options = {
      theme: 'Astronomie',
      language: 'fr' as const,
      difficulty: 2,
      wordCount: 10,
    };
    expect(getFallbackWords(options)).toEqual(getFallbackWords(options));
  });

  it('respects the grid maxLength', () => {
    const words = getFallbackWords({
      theme: 'Capitales du monde',
      language: 'fr',
      difficulty: 3,
      wordCount: 10,
      maxLength: 6,
    });
    expect(words).toHaveLength(10);
    for (const entry of words) {
      expect(entry.word.length).toBeLessThanOrEqual(6);
    }
  });

  it('relaxes the difficulty range before giving up on a theme', () => {
    const strict = getFallbackWords({
      theme: 'Antiquité égyptienne',
      language: 'fr',
      difficulty: 1,
      wordCount: 24,
    });
    expect(strict).toHaveLength(24);
    expect(Math.max(...strict.map((entry) => entry.word.length))).toBeGreaterThan(7);
  });

  it('tops up from the generic pool', () => {
    const words = getFallbackWords({
      theme: 'Astronomie',
      language: 'fr',
      difficulty: 3,
      wordCount: 30,
    });
    expect(words).toHaveLength(30);
    expect(new Set(words.map((entry) => entry.word)).size).toBe(30);
  });

  it('uses the English spelling when one exists', () => {
    const words = getFallbackWords({
      theme: 'Capitales africaines',
      language: 'en',
      difficulty: 2,
      wordCount: 30,
    });
    const answers = words.map((entry) => entry.word);
    expect(answers).toContain('CAIRO');
    expect(answers).not.toContain('CAIRE');
  });

  it('falls back to the generic pool for unknown themes', () => {
    const words = getFallbackWords({
      theme: 'Thème totalement inconnu',
      language: 'fr',
      difficulty: 2,
      wordCount: 15,
    });
    expect(words).toHaveLength(15);
  });
});
