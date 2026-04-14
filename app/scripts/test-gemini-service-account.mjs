#!/usr/bin/env node
/**
 * Verify a GCP service account can call the Gemini **Developer API**
 * (`generativelanguage.googleapis.com`) with OAuth (same as production when using
 * `GEMINI_SERVICE_ACCOUNT_JSON`).
 *
 * Usage: node scripts/test-gemini-service-account.mjs /path/to/service-account.json
 */
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/test-gemini-service-account.mjs <path-to-service-account.json>");
  process.exit(1);
}

const creds = JSON.parse(readFileSync(path, "utf8"));
if (creds.type !== "service_account" || !creds.project_id || !creds.private_key) {
  console.error("Invalid service account JSON (expected type service_account, project_id, private_key).");
  process.exit(1);
}

const scopes = [
  "https://www.googleapis.com/auth/generative-language",
  "https://www.googleapis.com/auth/cloud-platform",
];

const auth = new GoogleAuth({ credentials: creds, scopes });
const client = await auth.getClient();
const { token } = await client.getAccessToken();
if (!token) {
  console.error("FAILED: could not obtain OAuth access token.");
  process.exit(1);
}

console.log("OK: OAuth access token obtained (generative-language + cloud-platform scopes).\n");

const model = process.env.GEMINI_TEST_MODEL?.trim() || "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Reply with exactly the word: pong" }] }],
  }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`FAILED: ${model} HTTP ${res.status}`);
  console.error(text.slice(0, 800));
  process.exit(1);
}

let out = text;
try {
  const j = JSON.parse(text);
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  out = parts.map((p) => p.text ?? "").join("");
} catch {
  /* keep raw */
}
console.log(`SUCCESS: model=${model} (set GEMINI_TEST_MODEL to try another)`);
console.log("Response:", out.slice(0, 300));
