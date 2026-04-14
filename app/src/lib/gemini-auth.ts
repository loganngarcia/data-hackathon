import { GoogleAuth } from "google-auth-library";

/** OAuth scopes required for `generativelanguage.googleapis.com` with a service account. */
const GEMINI_SA_SCOPES = [
  "https://www.googleapis.com/auth/generative-language",
  "https://www.googleapis.com/auth/cloud-platform",
];

function parseServiceAccountFromEnv(): Record<string, unknown> | null {
  const rawJson = process.env.GEMINI_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      return JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const b64 = process.env.GEMINI_SERVICE_ACCOUNT_JSON_B64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export type GeminiInferenceAuth =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Auth for Gemini HTTP calls (`generativelanguage.googleapis.com`):
 * - **Preferred:** `GEMINI_SERVICE_ACCOUNT_JSON` or `GEMINI_SERVICE_ACCOUNT_JSON_B64` (GCP service account) → `Authorization: Bearer <token>`.
 * - **Fallback:** `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `GOOGLE_API_KEY` → `x-goog-api-key`.
 */
export async function getGeminiInferenceHeaders(): Promise<GeminiInferenceAuth> {
  const sa = parseServiceAccountFromEnv();
  if (sa && sa.type === "service_account") {
    try {
      const auth = new GoogleAuth({
        credentials: sa,
        scopes: GEMINI_SA_SCOPES,
      });
      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      if (!token) {
        return { ok: false, error: "Service account credentials did not yield an access token." };
      }
      return { ok: true, headers: { Authorization: `Bearer ${token}` } };
    } catch (e) {
      return { ok: false, error: (e as Error).message ?? "Service account auth failed" };
    }
  }

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (apiKey) {
    return { ok: true, headers: { "x-goog-api-key": apiKey } };
  }

  return {
    ok: false,
    error:
      "Missing Gemini credentials. Set GEMINI_SERVICE_ACCOUNT_JSON (or _B64), or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY.",
  };
}
