import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupWord } from "../src/lib/word-assistant/provider";
import { parseGeneratedClues } from "../src/lib/word-assistant/clues";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lookupWord", () => {
  it("normalizes dictionary definitions and English related words", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("dictionaryapi.dev")) {
        return jsonResponse([{
          meanings: [{
            partOfSpeech: "noun",
            definitions: [{ definition: "A red fruit", example: "I ate an apple." }],
          }],
        }]);
      }
      if (url.includes("datamuse.com")) {
        return jsonResponse([{ word: "orchard fruit" }, { word: "fruit" }]);
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord(" apple ", "en");

    expect(result.term).toBe("apple");
    expect(result.definitions).toEqual([{
      partOfSpeech: "noun",
      definition: "A red fruit",
      example: "I ate an apple.",
    }]);
    expect(result.synonyms).toEqual(["orchard fruit", "fruit"]);
    expect(result.source).toContain("Dictionary API");
  });

  it("uses the localized Wiktionary summary when the dictionary has no result", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("dictionaryapi.dev")) return jsonResponse({}, false);
      if (url.includes("wiktionary.org")) {
        return jsonResponse({ query: { pages: { "123": { extract: "Une definition de secours." } } } });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("mot-de-secours", "fr");

    expect(result.definitions).toEqual([{ definition: "Une definition de secours." }]);
    expect(result.source).toContain("Wiktionary");
  });

  it("uses Wiktionary directly for French definitions", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wiktionary.org")) {
        return jsonResponse({
          query: {
            pages: {
              "736": {
                extract: "\n== Français ==\n\n=== Nom commun ===\n\nBâtiment servant de logis, d'habitation, de demeure.\n",
              },
            },
          },
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("maison", "fr");

    expect(result.definitions[0]?.definition).toContain("Bâtiment servant de logis");
    expect(result.source).toContain("Wiktionary");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("dictionaryapi.dev"), expect.anything());
  });

  it("resolves uppercase French crossword answers through lowercase Wiktionary pages", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wiktionary.org") && url.includes("titles=maison")) {
        return jsonResponse({
          query: { pages: { "736": { extract: "\n=== Nom commun ===\n\nBâtiment servant de logis.\n" } } },
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("MAISON", "fr");

    expect(result.definitions[0]?.definition).toContain("Bâtiment servant de logis");
  });

  it("adds acronym context from Wikipedia", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return jsonResponse({ title: "NASA", extract: "US space agency." });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("NASA", "en", { includeAcronym: true });

    expect(result.acronym).toEqual({ title: "NASA", extract: "US space agency." });
  });

  it("uses Wikipedia context for proper names without dictionary definitions", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return jsonResponse({ title: "Casablanca", extract: "A city in Morocco." });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("casablanca", "en");

    expect(result.context).toEqual({ title: "Casablanca", extract: "A city in Morocco." });
    expect(result.acronym).toBeNull();
  });

  it("honors an explicit Wiktionary source", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wiktionary.org")) {
        return jsonResponse({ query: { pages: { "1": { extract: "Une définition explicite." } } } });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("maison", "fr", { source: "wiktionary" });

    expect(result.definitions).toEqual([{ definition: "Une définition explicite." }]);
    expect(result.source).toBe("Wiktionary");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("wikipedia.org"), expect.anything());
  });

  it("does not treat an uppercase crossword answer as an acronym", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("dictionaryapi.dev")) {
        return jsonResponse([{ meanings: [{ definitions: [{ definition: "A building for living in." }] }] }]);
      }
      if (url.includes("wikipedia.org")) {
        return jsonResponse({ title: "HOUSE", extract: "An unrelated encyclopedia result." });
      }
      return jsonResponse([], true);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("HOUSE", "en");

    expect(result.definitions).toHaveLength(1);
    expect(result.acronym).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("wikipedia.org"), expect.anything());
  });

  it("keeps related words when no definition provider has a result", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("datamuse.com")) return jsonResponse([{ word: "blur" }]);
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("smudge", "en");

    expect(result.definitions).toEqual([]);
    expect(result.synonyms).toEqual(["blur"]);
  });

  it("reuses a cached result for the same language and term", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("dictionaryapi.dev")) {
        return jsonResponse([{ meanings: [{ definitions: [{ definition: "Cached result" }] }] }]);
      }
      return jsonResponse([], true);
    });
    vi.stubGlobal("fetch", fetchMock);

    await lookupWord("cache-check", "fr");
    const callsAfterFirstLookup = fetchMock.mock.calls.length;
    await lookupWord(" CACHE-CHECK ", "fr");

    expect(callsAfterFirstLookup).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstLookup);
  });
});

describe("parseGeneratedClues", () => {
  it("accepts up to three JSON clues and removes answer leaks", () => {
    const clues = parseGeneratedClues(
      '["Space agency, briefly", "NASA headquarters", "US space organization"]',
      "NASA"
    );
    expect(clues).toEqual(["Space agency, briefly", "US space organization"]);
  });

  it("accepts fenced JSON and rejects malformed responses", () => {
    expect(parseGeneratedClues("```json\n[\"A short clue\"]\n```", "answer"))
      .toEqual(["A short clue"]);
    expect(() => parseGeneratedClues("not json", "answer")).toThrow();
  });
});