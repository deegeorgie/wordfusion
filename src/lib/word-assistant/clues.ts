export function parseGeneratedClues(content: string, answer: string): string[] {
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlock?.[1]?.trim() ?? content.trim();
  const parsed = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Invalid clue response");

  const normalizedAnswer = answer.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^['"«]|['"»]$/g, ""))
    .filter((item) => {
      const normalizedClue = item.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
      return item.length >= 3 && item.length <= 160 && !normalizedClue.includes(normalizedAnswer);
    })
    .slice(0, 3);
}