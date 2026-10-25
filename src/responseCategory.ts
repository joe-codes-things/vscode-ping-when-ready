import { createReadStream } from "node:fs";
import * as readline from "node:readline";

export const questionMarker = "<!-- ping-when-ready:question -->";

export async function finalAssistantResponseHasQuestionMarker(transcriptPath: string): Promise<boolean> {
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

  return lastAssistantMessage?.trimEnd().endsWith(questionMarker) ?? false;
}
