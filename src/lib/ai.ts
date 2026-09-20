import Anthropic from "@anthropic-ai/sdk";

// The one place the app talks to Claude (the AI reading of pasted protocol text
// and the Help assistant). Everything works without it: with no
// ANTHROPIC_API_KEY these features fall back to built-in rules / plain search.
//
// NEVER send patient data here. Callers pass only protocol text the user
// pasted and help questions; the Help screen tells people not to type patient
// details into a question.

/** Claude Opus 5 by default; set ANTHROPIC_MODEL to a cheaper model to lower the cost. */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AiResult = { ok: true; text: string } | { ok: false; reason: "not_configured" | "refused" | "failed" };

let client: Anthropic | null = null;

export async function askClaude(params: {
  system: string;
  user: string;
  maxTokens?: number;
  // Cache the system prompt (the Help assistant's knowledge base is long and identical every time).
  cacheSystem?: boolean;
}): Promise<AiResult> {
  if (!aiConfigured()) return { ok: false, reason: "not_configured" };
  client ??= new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: params.maxTokens ?? 8000,
      // If a safety classifier declines (clinical text can trip them), retry once on a fallback model.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      // These are simple extraction / lookup tasks: no need for deep reasoning.
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: params.system,
          ...(params.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
        },
      ],
      messages: [{ role: "user", content: params.user }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: "failed" };
  } catch (error) {
    // Logged for the developer; the user just gets the built-in fallback.
    console.error("[ai] request failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "failed" };
  }
}
