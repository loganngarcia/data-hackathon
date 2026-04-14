/** Default chat / tool-calling model (Gemini 3.1 Flash Lite — preview id from AI Studio API). */
export const GEMINI_3_1_FLASH_LITE_MODEL = "gemini-3.1-flash-lite-preview";

function isRetryableGeminiFailure(status: number, parsed: unknown): boolean {
  if (status === 429 || status === 503) return true;
  if (!parsed || typeof parsed !== "object" || !("error" in parsed)) return false;
  const err = (parsed as { error?: { code?: number; status?: string; message?: string } }).error;
  if (!err) return false;
  if (err.status === "UNAVAILABLE" || err.status === "RESOURCE_EXHAUSTED") return true;
  if (err.code === 429 || err.code === 503) return true;
  const m = err.message ?? "";
  return /high demand|try again later|temporarily|overloaded|unavailable|resource exhausted/i.test(m);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type GeminiRetryOptions = {
  /** Default 5 — covers transient “high demand” bursts. */
  maxAttempts?: number;
  baseDelayMs?: number;
};

/**
 * `fetch` to `generativelanguage.googleapis.com` with retries on rate limits / overload.
 * Replays the same request (safe for POST JSON bodies).
 */
export async function fetchGenerativeLanguageWithRetries(
  url: string,
  init: RequestInit,
  options?: GeminiRetryOptions,
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  let lastFailure: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }

    lastFailure = new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });

    const retry = isRetryableGeminiFailure(res.status, parsed);
    if (!retry || attempt >= maxAttempts) {
      return lastFailure;
    }

    const backoff = Math.min(
      baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150),
      10_000,
    );
    await delay(backoff);
  }

  return lastFailure ?? new Response(JSON.stringify({ error: { message: "Gemini request failed" } }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}
