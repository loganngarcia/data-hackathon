import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";
import { NONPROFIT_SEARCH_SYSTEM_INSTRUCTION } from "@/lib/gemini-nonprofit-tools";
import { SEARCH_NONPROFITS_OPENAI_TOOL } from "@/lib/search-nonprofits-openai-tool";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";
import {
  irs990SearchRowsToChatCards,
  mergeNonprofitSearchCards,
  type NonprofitSearchCard,
} from "@/lib/nonprofit-chat-cards";

export type NonprofitToolStep = {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
};

export type RunNonprofitAgentOk = {
  ok: true;
  text: string;
  steps: NonprofitToolStep[];
  turns: number;
  warning?: string;
  /** TEOS search rows rendered as portfolio-style links in chat (streaming + JSON API). */
  nonprofitSearchCards?: NonprofitSearchCard[];
};

export type RunNonprofitAgentErr = {
  ok: false;
  error: string;
  details?: unknown;
};

export type RunNonprofitAgentResult = RunNonprofitAgentOk | RunNonprofitAgentErr;

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    const p = JSON.parse(s) as unknown;
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

function summarizeSearchResult(payload: unknown): string {
  if (!payload || typeof payload !== "object") return String(payload).slice(0, 200);
  const o = payload as { rows?: unknown[]; hasMore?: boolean; limit?: number; offset?: number };
  const n = Array.isArray(o.rows) ? o.rows.length : 0;
  return `rows=${n}, hasMore=${Boolean(o.hasMore)}, limit=${o.limit ?? "?"}, offset=${o.offset ?? "?"}`;
}

type ToolCallAcc = { id: string; name: string; arguments: string };

function geminiSseLine(text: string): string {
  return `data: ${JSON.stringify({
    candidates: [{ content: { parts: [{ text }] } }],
  })}\n\n`;
}

function toolSlot(map: Map<number, ToolCallAcc>, index: number): ToolCallAcc {
  let s = map.get(index);
  if (!s) {
    s = { id: "", name: "", arguments: "" };
    map.set(index, s);
  }
  return s;
}

function applyToolCallDeltas(
  map: Map<number, ToolCallAcc>,
  deltas: NonNullable<ChatCompletionChunk["choices"][0]["delta"]["tool_calls"]> | undefined,
): void {
  if (!deltas?.length) return;
  for (const d of deltas) {
    const slot = toolSlot(map, d.index);
    if (d.id) slot.id = d.id;
    if (d.function?.name) slot.name = d.function.name;
    if (d.function?.arguments) slot.arguments += d.function.arguments;
  }
}

function toolCallsFromAcc(map: Map<number, ToolCallAcc>): ChatCompletionMessageToolCall[] {
  const indices = [...map.keys()].sort((a, b) => a - b);
  return indices.map((i) => {
    const tc = map.get(i)!;
    return {
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments },
    };
  });
}

function assistantMessageFromStreamAccumulation(
  contentAcc: string,
  toolAcc: Map<number, ToolCallAcc>,
): ChatCompletionAssistantMessageParam {
  const tool_calls = toolCallsFromAcc(toolAcc);
  if (tool_calls.length === 0) {
    return { role: "assistant", content: contentAcc };
  }
  return {
    role: "assistant",
    content: contentAcc.length ? contentAcc : null,
    tool_calls,
  };
}

async function runSearchTool(baseUrl: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/irs990-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { error: `Worker HTTP ${res.status}`, raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    return { error: `Worker HTTP ${res.status}`, details: data };
  }
  return data;
}

/**
 * Multi-turn OpenAI Chat Completions + `search_nonprofits` (D1 via Worker).
 * Used by `POST /api/gemini` when tools are enabled.
 */
export async function runOpenAINonprofitToolAgent(options: {
  model: string;
  /** Text-only or multimodal (text + images + file parts). */
  userContent: ChatCompletionUserMessageParam["content"];
  maxTurns?: number;
  workerBaseUrl?: string;
  /** Defaults to `NONPROFIT_SEARCH_SYSTEM_INSTRUCTION` (TEOS tools + UI hints). */
  systemInstruction?: string;
}): Promise<RunNonprofitAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "Missing OPENAI_API_KEY." };
  }

  const openai = new OpenAI({ apiKey });
  const maxTurns = Math.min(12, Math.max(1, options.maxTurns ?? 8));
  const baseUrl = (options.workerBaseUrl ?? getNonprofitWorkerBaseUrl()).replace(/\/$/, "");
  const systemInstruction =
    typeof options.systemInstruction === "string" && options.systemInstruction.trim()
      ? options.systemInstruction.trim()
      : NONPROFIT_SEARCH_SYSTEM_INSTRUCTION;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstruction },
    { role: "user", content: options.userContent },
  ];

  const steps: NonprofitToolStep[] = [];
  let searchCards: NonprofitSearchCard[] = [];
  let lastText = "";
  let turn = 0;

  while (turn < maxTurns) {
    turn += 1;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: options.model,
        messages,
        tools: [SEARCH_NONPROFITS_OPENAI_TOOL],
        tool_choice: "auto",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg, details: e };
    }

    const choice = completion.choices[0];
    const msg = choice?.message;
    if (!msg) {
      return { ok: false, error: "Empty completion from OpenAI", details: completion };
    }

    messages.push(msg);

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const text = msg.content?.trim() ?? "";
      lastText = text;
      return {
        ok: true,
        text: lastText || text,
        steps,
        turns: turn,
        ...(searchCards.length ? { nonprofitSearchCards: searchCards } : {}),
      };
    }

    for (const tc of toolCalls) {
      if (tc.type !== "function") continue;
      const fn = tc.function;
      const name = fn.name ?? "";
      const args = safeJsonParse(fn.arguments ?? "{}");
      if (name !== "search_nonprofits") {
        const err = { error: `Unknown tool ${name}` };
        steps.push({ name, args, resultSummary: "unknown tool" });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(err),
        });
        continue;
      }
      const result = await runSearchTool(baseUrl, args);
      steps.push({ name, args, resultSummary: summarizeSearchResult(result) });
      const rows = (result as { rows?: unknown[] }).rows;
      const batch = irs990SearchRowsToChatCards(Array.isArray(rows) ? rows : undefined);
      searchCards = mergeNonprofitSearchCards(searchCards, batch);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    ok: true,
    text: lastText,
    steps,
    turns: turn,
    warning: "Max tool-calling turns exceeded",
    ...(searchCards.length ? { nonprofitSearchCards: searchCards } : {}),
  };
}

const MAX_TURNS_WARNING = "Max tool-calling turns exceeded";

/**
 * Same agent as `runOpenAINonprofitToolAgent`, but forwards **OpenAI token/stream chunks**
 * (`delta.content`) to the client as Gemini-shaped SSE so `streamGeminiReply` parses unchanged.
 * Tool rounds do not emit user-visible text until the model streams the final answer.
 */
export function streamOpenAINonprofitToolAgentAsGeminiSSE(options: {
  model: string;
  userContent: ChatCompletionUserMessageParam["content"];
  maxTurns?: number;
  workerBaseUrl?: string;
  /** Defaults to `NONPROFIT_SEARCH_SYSTEM_INSTRUCTION`. */
  systemInstruction?: string;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        controller.error(new Error("Missing OPENAI_API_KEY."));
        return;
      }
      const openai = new OpenAI({ apiKey });
      const maxTurns = Math.min(12, Math.max(1, options.maxTurns ?? 8));
      const baseUrl = (options.workerBaseUrl ?? getNonprofitWorkerBaseUrl()).replace(/\/$/, "");
      const systemInstruction =
        typeof options.systemInstruction === "string" && options.systemInstruction.trim()
          ? options.systemInstruction.trim()
          : NONPROFIT_SEARCH_SYSTEM_INSTRUCTION;

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemInstruction },
        { role: "user", content: options.userContent },
      ];

      let turn = 0;
      try {
        while (turn < maxTurns) {
          turn += 1;

          let stream: AsyncIterable<ChatCompletionChunk>;
          try {
            stream = await openai.chat.completions.create({
              model: options.model,
              messages,
              tools: [SEARCH_NONPROFITS_OPENAI_TOOL],
              tool_choice: "auto",
              stream: true,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            controller.error(new Error(msg));
            return;
          }

          let contentAcc = "";
          const toolAcc = new Map<number, ToolCallAcc>();

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            const delta = choice.delta;
            if (delta?.content) {
              contentAcc += delta.content;
              controller.enqueue(encoder.encode(geminiSseLine(delta.content)));
            }
            applyToolCallDeltas(toolAcc, delta.tool_calls);
          }

          const assistantMsg = assistantMessageFromStreamAccumulation(contentAcc, toolAcc);
          messages.push(assistantMsg);

          const toolCalls = assistantMsg.tool_calls ?? [];
          if (toolCalls.length === 0) {
            controller.close();
            return;
          }

          for (const tc of toolCalls) {
            if (tc.type !== "function") continue;
            const fn = tc.function;
            const name = fn.name ?? "";
            const args = safeJsonParse(fn.arguments ?? "{}");
            if (name !== "search_nonprofits") {
              const err = { error: `Unknown tool ${name}` };
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(err),
              });
              continue;
            }
            const result = await runSearchTool(baseUrl, args);
            const rows = (result as { rows?: unknown[] }).rows;
            const batch = irs990SearchRowsToChatCards(Array.isArray(rows) ? rows : undefined);
            if (batch.length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ nonprofitSearchCards: batch })}\n\n`),
              );
            }
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }

        controller.enqueue(
          encoder.encode(geminiSseLine(`\n\n_${MAX_TURNS_WARNING}_`)),
        );
        controller.close();
      } catch (e) {
        controller.error(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });
}

/** Encode assistant text as Gemini-shaped SSE lines so `extractTextFromGeminiChunk` in the chat UI still works. */
export function sseStreamFromAssistantText(fullText: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = 72;
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += chunkSize) {
    chunks.push(fullText.slice(i, i + chunkSize));
  }
  if (chunks.length === 0) chunks.push("");

  return new ReadableStream({
    start(controller) {
      try {
        for (const c of chunks) {
          const line = `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: c }] } }],
          })}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
