export type WordAssistantLanguage = "fr" | "en";
export type WordAssistantSource = "auto" | "dictionary" | "wiktionary" | "wikipedia" | "datamuse" | "glossary" | "all";

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
  context: { title: string; extract: string } | null;
  source: string;
}

export interface WordAssistantLookupOptions {
  includeAcronym?: boolean;
  source?: WordAssistantSource;
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
      headers: {
        Accept: "application/json",
        "User-Agent": "WordFusion/1.0 (word assistant)",
      },
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

  const summary = data as { title?: unknown; extract?: unknown; description?: unknown };
  const extract = normalizeText(summary.extract);
  return extract
    ? { title: normalizeText(summary.title) || term, extract: normalizeText(summary.description) || extract }
    : null;
}

async function lookupWikipediaContext(
  term: string,
  language: WordAssistantLanguage
): Promise<{ title: string; extract: string } | null> {
  const data = await fetchJson(
    `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
  );
  if (!data || typeof data !== "object") return null;

  const summary = data as { title?: unknown; extract?: unknown; description?: unknown };
  const extract = normalizeText(summary.extract);
  return extract
    ? { title: normalizeText(summary.title) || term, extract: normalizeText(summary.description) || extract }
    : null;
}

function cleanWiktionaryExtract(value: string): string {
  return value
    .replace(/^=+[^=\r\n]+=+\s*$/gm, "")
    .replace(/^\s*(Pronunciation|Etymology|Étymologie|Prononciation|References|Références|Translations|Traductions|Synonyms|Synonymes|Derived terms|Dérivés)\s*$/gim, "")
    .replace(/^\s*\([^\r\n]+\)\s*$/gm, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[*#:;]+\s*/, "").trim())
    .filter((line) => line.length >= 12 && !line.startsWith("IPA(key)") && !/^\(?[A-Z][A-Za-z -]+\)?\s*:\s*\/.*\/$/.test(line))
    .slice(0, 5)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function lookupWiktionaryFallback(
  term: string,
  language: WordAssistantLanguage
): Promise<WordAssistantDefinition[]> {
  const data = await fetchJson(
    `https://${language}.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(term)}`
  );
  if (!data || typeof data !== "object") return [];

  const query = (data as { query?: { pages?: Record<string, { extract?: unknown }> } }).query;
  const page = query?.pages ? Object.values(query.pages)[0] : undefined;
  const extract = cleanWiktionaryExtract(normalizeText(page?.extract));
  return extract ? [{ definition: extract }] : [];
}

export async function lookupWord(
  term: string,
  language: WordAssistantLanguage,
  options: WordAssistantLookupOptions = {}
): Promise<WordAssistantResult> {
  const normalizedTerm = term.trim();
  const source = options.source ?? "auto";
  const cacheKey = `${language}:${normalizedTerm.toLowerCase()}:${source}:${options.includeAcronym ? "acronym" : "standard"}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) resultCache.delete(cacheKey);

  const encodedTerm = encodeURIComponent(normalizedTerm.toLowerCase());
  const dictionaryData = language === "en" && (source === "auto" || source === "dictionary" || source === "all")
    ? await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodedTerm}`)
    : null;
  const definitions = parseDefinitions(dictionaryData);
  const fallbackDefinitions = definitions.length > 0
    ? definitions
    : (source === "auto" || source === "wiktionary" || source === "all")
      ? await lookupWiktionaryFallback(
        language === "fr" ? normalizedTerm.toLocaleLowerCase("fr-FR") : normalizedTerm,
        language
      )
      : [];
  const [synonyms, acronym] = await Promise.all([
    (language === "en" && (source === "auto" || source === "datamuse" || source === "all"))
      ? lookupSynonyms(normalizedTerm)
      : Promise.resolve([]),
    options.includeAcronym
      ? lookupAcronym(normalizedTerm, language)
      : Promise.resolve(null),
  ]);
  const context = (source === "wikipedia" || ((source === "auto" || source === "all") && fallbackDefinitions.length === 0 && !acronym))
    ? await lookupWikipediaContext(normalizedTerm, language)
    : null;

  const result = {
    term: normalizedTerm,
    language,
    definitions: fallbackDefinitions,
    synonyms,
    acronym,
    context,
    source: source === "dictionary"
      ? "Dictionary API"
      : source === "wiktionary"
        ? "Wiktionary"
        : source === "wikipedia"
          ? "Wikipedia"
          : source === "datamuse"
            ? "Datamuse"
            : definitions.length > 0
      ? "Dictionary API, Datamuse et Wikipedia"
      : context
        ? "Wikipedia, Wiktionary et Datamuse"
        : "Wiktionary, Datamuse et Wikipedia",
  };
  resultCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  if (resultCache.size > CACHE_LIMIT) {
    const oldestKey = resultCache.keys().next().value;
    if (oldestKey) resultCache.delete(oldestKey);
  }
  return result;
}