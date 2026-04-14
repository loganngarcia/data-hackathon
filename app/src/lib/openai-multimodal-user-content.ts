import type {
  ChatCompletionContentPart,
  ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";

export type OpenAIImagePartInput = {
  /** Public https URL to an image. */
  url?: string;
  /** Raw base64 (no data: prefix); paired with `mimeType`. */
  base64?: string;
  /** Defaults to `image/jpeg` when using `base64`. */
  mimeType?: string;
};

export type OpenAIFilePartInput = {
  /** From `POST /v1/files` — preferred for PDFs and documents. */
  fileId?: string;
  /** Raw base64 file bytes (e.g. PDF); use with `filename`. */
  fileDataBase64?: string;
  filename?: string;
};

/**
 * Builds `user.content` for Chat Completions (text + images + files).
 * [GPT-5.4 nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano) supports text + image input; files use `file` parts per OpenAI SDK.
 */
export function buildOpenAIMultimodalUserContent(input: {
  text?: string;
  images?: OpenAIImagePartInput[];
  files?: OpenAIFilePartInput[];
}): ChatCompletionUserMessageParam["content"] | null {
  const parts: ChatCompletionContentPart[] = [];
  const t = input.text?.trim() ?? "";
  if (t) {
    parts.push({ type: "text", text: t });
  }

  for (const img of input.images ?? []) {
    const u = img.url?.trim();
    if (u) {
      parts.push({ type: "image_url", image_url: { url: u } });
      continue;
    }
    const b64 = img.base64?.trim();
    if (b64) {
      const mime = img.mimeType?.trim() || "image/jpeg";
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}` },
      });
    }
  }

  for (const f of input.files ?? []) {
    const fid = f.fileId?.trim();
    if (fid) {
      parts.push({ type: "file", file: { file_id: fid } });
      continue;
    }
    const data = f.fileDataBase64?.trim();
    if (data) {
      parts.push({
        type: "file",
        file: {
          file_data: data,
          ...(f.filename?.trim() ? { filename: f.filename.trim() } : {}),
        },
      });
    }
  }

  if (parts.length === 0) return null;
  if (parts.length === 1 && parts[0].type === "text") {
    return (parts[0] as { type: "text"; text: string }).text;
  }
  return parts;
}
