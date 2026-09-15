import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupWord } from "../src/lib/word-assistant/provider";

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
        return jsonResponse({ extract: "Une definition de secours." });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWord("mot-de-secours", "fr");

    expect(result.definitions).toEqual([{ definition: "Une definition de secours." }]);
    expect(result.source).toContain("Wiktionary");
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

    const result = await lookupWord("NASA", "en");

    expect(result.acronym).toEqual({ title: "NASA", extract: "US space agency." });
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
    await lookupWord(" CACHE-CHECK ", "fr");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});