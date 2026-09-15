export type WordAssistantLanguage = "fr" | "en";

export interface WordAssistantDefinition {
  partOfSpeech?: string;
  definition: string;
  example?: string;
}

export interface WordAssistantResult {
  term: string;
  language: WordAssistantLanguage;
  definitions: WordAssistantDefinition[];
  synonyms: string[];
  acronym: { title: string; extract: string } | null;
  source: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 100;
const resultCache = new Map<string, { expiresAt: number; result: WordAssistantResult }>();

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function parseDefinitions(data: unknown): WordAssistantDefinition[] {
  if (!Array.isArray(data)) return [];

  return data
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.meanings)) return [];
      return entry.meanings.flatMap((meaning: unknown) => {
        if (!meaning || typeof meaning !== "object") return [];
        const typedMeaning = meaning as { partOfSpeech?: unknown; definitions?: unknown };
        if (!Array.isArray(typedMeaning.definitions)) return [];
        return typedMeaning.definitions.map((definition: unknown) => {
          if (!definition || typeof definition !== "object") return null;
          const typedDefinition = definition as { definition?: unknown; example?: unknown };
          const text = normalizeText(typedDefinition.definition);
          return text
            ? {
                partOfSpeech: normalizeText(typedMeaning.partOfSpeech) || undefined,
                definition: text,
                example: normalizeText(typedDefinition.example) || undefined,
              }
            : null;
        });
      });
    })
    .filter((definition): definition is WordAssistantDefinition => definition !== null)
    .slice(0, 8);
}

async function lookupSynonyms(term: string): Promise<string[]> {
  const data = await fetchJson(`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=8`);
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => (item && typeof item === "object" ? normalizeText((item as { word?: unknown }).word) : ""))
    .filter(Boolean);
}

async function lookupAcronym(
  term: string,
  language: WordAssistantLanguage
): Promise<WordAssistantResult["acronym"]> {
  if (!/^[A-Z0-9]{2,12}$/.test(term)) return null;

  const data = await fetchJson(
    `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
  );
  if (!data || typeof data !== "object") return null;

  const summary = data as { title?: unknown; extract?: unknown };
  const extract = normalizeText(summary.extract);
  return extract
    ? { title: normalizeText(summary.title) || term, extract }
    : null;
}

async function lookupWiktionaryFallback(
  term: string,
  language: WordAssistantLanguage
): Promise<WordAssistantDefinition[]> {
  const data = await fetchJson(
    `https://${language}.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
  );
  if (!data || typeof data !== "object") return [];

  const summary = data as { extract?: unknown };
  const extract = normalizeText(summary.extract);
  return extract ? [{ definition: extract }] : [];
}

export async function lookupWord(
  term: string,
  language: WordAssistantLanguage
): Promise<WordAssistantResult> {
  const normalizedTerm = term.trim();
  const cacheKey = `${language}:${normalizedTerm.toLowerCase()}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) resultCache.delete(cacheKey);

  const encodedTerm = encodeURIComponent(normalizedTerm.toLowerCase());
  const dictionaryData = await fetchJson(
    `https://api.dictionaryapi.dev/api/v2/entries/${language}/${encodedTerm}`
  );
  const definitions = parseDefinitions(dictionaryData);
  const fallbackDefinitions = definitions.length > 0
    ? definitions
    : await lookupWiktionaryFallback(normalizedTerm, language);
  const [synonyms, acronym] = await Promise.all([
    language === "en" ? lookupSynonyms(normalizedTerm) : Promise.resolve([]),
    lookupAcronym(normalizedTerm, language),
  ]);

  const result = {
    term: normalizedTerm,
    language,
    definitions: fallbackDefinitions,
    synonyms,
    acronym,
    source: definitions.length > 0
      ? "Dictionary API, Datamuse et Wikipedia"
      : "Wiktionary, Datamuse et Wikipedia",
  };
  resultCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  if (resultCache.size > CACHE_LIMIT) {
    const oldestKey = resultCache.keys().next().value;
    if (oldestKey) resultCache.delete(oldestKey);
  }
  return result;
}