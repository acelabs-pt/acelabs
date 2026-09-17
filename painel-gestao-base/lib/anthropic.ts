import Anthropic from "@anthropic-ai/sdk";

// Usar sempre no servidor - a key nunca deve chegar ao browser.
export function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const EXTRACTION_MODEL = "claude-haiku-4-5";
