import { createReadStream } from "node:fs";
import * as readline from "node:readline";

export const questionMarker = "<!-- ping-when-ready:question -->";

const maximumSummaryLength = 120;

export async function finalAssistantResponse(transcriptPath: string): Promise<string | undefined> {
  const lines = readline.createInterface({
    input: createReadStream(transcriptPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let lastAssistantMessage: string | undefined;

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const entry: unknown = JSON.parse(line);
    if (
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      entry.type === "assistant.message" &&
      "data" in entry &&
      typeof entry.data === "object" &&
      entry.data !== null &&
      "content" in entry.data &&
      typeof entry.data.content === "string"
    ) {
      lastAssistantMessage = entry.data.content;
    }
  }

  return lastAssistantMessage;
}

export function responseHasQuestionMarker(content: string): boolean {
  return content.trimEnd().endsWith(questionMarker);
}

export function summarizeText(content: string): string | undefined {
  const firstParagraph = content
    .replace(questionMarker, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/, 1)[0]
    ?.replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!firstParagraph) {
    return undefined;
  }

  const firstSentence = firstParagraph.match(/^.{1,240}?[.!?](?=\s|$)/u)?.[0] ?? firstParagraph;
  const characters = Array.from(firstSentence);
  if (characters.length <= maximumSummaryLength) {
    return firstSentence;
  }

  const truncated = characters.slice(0, maximumSummaryLength - 1).join("");
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 80 ? lastSpace : undefined).trimEnd()}…`;
}

export function extractQuestionText(toolArgs: unknown): string | undefined {
  if (typeof toolArgs === "string") {
    try {
      return extractQuestionText(JSON.parse(toolArgs));
    } catch {
      return summarizeText(toolArgs);
    }
  }

  if (typeof toolArgs !== "object" || toolArgs === null || Array.isArray(toolArgs)) {
    return undefined;
  }

  const args = toolArgs as Record<string, unknown>;
  for (const key of ["question", "prompt", "message"]) {
    if (typeof args[key] === "string") {
      return summarizeText(args[key]);
    }
  }

  return undefined;
}
