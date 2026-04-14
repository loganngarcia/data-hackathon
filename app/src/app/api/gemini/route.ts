import OpenAI from "openai";
import { NextResponse } from "next/server";
import { DEFAULT_OPENAI_CHAT_MODEL } from "@/lib/openai-chat-model";
import {
  buildOpenAIMultimodalUserContent,
  type OpenAIFilePartInput,
  type OpenAIImagePartInput,
} from "@/lib/openai-multimodal-user-content";
import { NONPROFIT_SEARCH_SYSTEM_INSTRUCTION } from "@/lib/gemini-nonprofit-tools";
import {
  runOpenAINonprofitToolAgent,
  streamOpenAINonprofitToolAgentAsGeminiSSE,
} from "@/lib/run-openai-nonprofit-tools";
import { mergeNonprofitSystemWithUserProfile, parseUserProfilePayload } from "@/lib/user-profile-system";

/**
 * Chat API (OpenAI): `POST /api/gemini` — path kept for existing ChatBar / `streamGeminiReply`.
 *
 * **Default:** `useNonprofitSearchTools !== false` runs **nonprofit D1 search** via `search_nonprofits`
 * (Cloudflare Worker), then streams the assistant reply with **OpenAI token streaming** (`delta.content`)
 * over **Gemini-shaped SSE** so `streamGeminiReply` is unchanged. Tool rounds complete before the final
 * streamed answer. Set `{ "useNonprofitSearchTools": false }` for plain chat streaming without tools.
 *
 * **Multimodal:** optional `images` (url or base64) and `files` (`fileId` from OpenAI Files API, or
 * `fileDataBase64` + `filename`). At least one of `message`, `images`, or `files` is required.
 *
 * Env: `OPENAI_API_KEY` (required). Optional: `OPENAI_MODEL` (default
 * [gpt-5.4-nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano)).
 */
function augmentOpenAIErrorMessage(msg: string): string {
  if (!/invalid_api_key|incorrect api key|authentication/i.test(msg)) return msg;
  return `${msg}

Set OPENAI_API_KEY in Vercel → Environment Variables (or .env.local) and redeploy.`;
}

export async function POST(req: Request) {
  let body: {
    message?: string;
    images?: OpenAIImagePartInput[];
    files?: OpenAIFilePartInput[];
    model?: string;
    stream?: boolean;
    useNonprofitSearchTools?: boolean;
    maxTurns?: number;
    /** Optional "You" profile from localStorage — merged into system instructions when tools are on. */
    userProfile?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing OPENAI_API_KEY. Add it in Vercel → Settings → Environment Variables (then redeploy), or app/.env.local for local dev.",
      },
      { status: 503 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const userContent = buildOpenAIMultimodalUserContent({
    text: message || undefined,
    images: Array.isArray(body.images) ? body.images : undefined,
    files: Array.isArray(body.files) ? body.files : undefined,
  });
  if (userContent === null) {
    return NextResponse.json(
      {
        error:
          "Provide non-empty message text and/or images (url or base64), and/or files (fileId or fileDataBase64).",
      },
      { status: 400 },
    );
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_CHAT_MODEL;

  const stream = body.stream === true;
  const useTools = body.useNonprofitSearchTools !== false;

  const userProfile = parseUserProfilePayload(body.userProfile);
  const nonprofitSystemInstruction = mergeNonprofitSystemWithUserProfile(
    NONPROFIT_SEARCH_SYSTEM_INSTRUCTION,
    userProfile,
  );

  const openai = new OpenAI({ apiKey });

  if (useTools) {
    if (stream) {
      const sseBody = streamOpenAINonprofitToolAgentAsGeminiSSE({
        model,
        userContent,
        maxTurns: body.maxTurns,
        systemInstruction: nonprofitSystemInstruction,
      });
      return new NextResponse(sseBody, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const agent = await runOpenAINonprofitToolAgent({
      model,
      userContent,
      maxTurns: body.maxTurns,
      systemInstruction: nonprofitSystemInstruction,
    });

    if (!agent.ok) {
      const msg = augmentOpenAIErrorMessage(agent.error);
      return NextResponse.json({ error: msg, details: agent.details }, { status: 502 });
    }

    let outText = agent.text.trim() || " ";
    if (agent.warning) {
      outText += `\n\n_${agent.warning}_`;
    }

    return NextResponse.json({
      text: outText,
      model,
      steps: agent.steps,
      turns: agent.turns,
      ...(agent.nonprofitSearchCards?.length
        ? { nonprofitSearchCards: agent.nonprofitSearchCards }
        : {}),
    });
  }

  const plainChatSystemBase =
    "You are a helpful assistant for the Tipping Point nonprofit dashboard. Follow the user's instructions.";
  const plainSystemInstruction = mergeNonprofitSystemWithUserProfile(plainChatSystemBase, userProfile);

  if (stream) {
    let s;
    try {
      s = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: plainSystemInstruction },
          { role: "user", content: userContent },
        ],
        stream: true,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: augmentOpenAIErrorMessage(err), details: String(e) },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of s) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    candidates: [{ content: { parts: [{ text: delta }] } }],
                  })}\n\n`,
                ),
              );
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: plainSystemInstruction },
        { role: "user", content: userContent },
      ],
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: augmentOpenAIErrorMessage(err), details: String(e) },
      { status: 502 },
    );
  }

  const text = completion.choices[0]?.message?.content ?? "";
  return NextResponse.json({ text, model });
}
