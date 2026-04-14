/**
 * When the user sends a chat while a nonprofit org profile is open (`?org=` + session snapshot),
 * attach structured context to the message (chip UI + AI transcript + local chip store).
 */

import type { ChatOrgContext } from "@/dashboard-ui/chat/types";
import { parseTeosOrgIdParam } from "@/lib/teos-org-id";
import {
  readTeosOrgSnapshotFromSession,
  type TeosOrgChatSnapshot,
} from "@/lib/teos-org-chat-snapshot";

const ORG_CHIP_STORE_KEY = "tipping-point-org-chip-store-v1";
const ORG_CHIP_STORE_MAX = 100;

export function teosSnapshotMatchesUrl(decoded: string, snapshot: TeosOrgChatSnapshot): boolean {
  if (snapshot.orgId === decoded) return true;
  const u = parseTeosOrgIdParam(decoded);
  const einDigits = snapshot.ein.replace(/\D/g, "").slice(0, 9);
  if (u.ein && einDigits.length === 9 && einDigits === u.ein) return true;
  if (u.returnPk && snapshot.orgId === `irs990-${u.returnPk}`) return true;
  return false;
}

function formatEinDigits(d: string): string {
  const x = d.replace(/\D/g, "").slice(0, 9);
  return x.length === 9 ? `${x.slice(0, 2)}-${x.slice(2)}` : d;
}

function snapshotToContext(s: TeosOrgChatSnapshot): ChatOrgContext {
  return {
    orgId: s.orgId,
    name: s.name,
    city: s.city,
    state: s.state,
    ein: s.ein,
    websiteDomain: s.websiteDomain ?? "",
    logoDomain: s.logoDomain,
    logoImageUrl: s.logoImageUrl,
  };
}

/** URL-only fallback when session snapshot is missing or mismatched. */
function minimalContextFromOrgParam(decoded: string): ChatOrgContext {
  const parsed = parseTeosOrgIdParam(decoded);
  const einPretty = parsed.ein ? formatEinDigits(parsed.ein) : "";
  const label =
    parsed.ein != null
      ? `EIN ${einPretty}`
      : parsed.returnPk != null
        ? `Nonprofit filing #${parsed.returnPk}`
        : "Nonprofit profile";
  return {
    orgId: decoded,
    name: label,
    city: "",
    state: "",
    ein: parsed.ein ? parsed.ein.replace(/\D/g, "").slice(0, 9) : "",
    websiteDomain: "",
  };
}

/**
 * Call in the browser when composing a user message. Returns `undefined` if no org is in focus.
 */
export function getOrgContextForOutgoingUserMessage(): ChatOrgContext | undefined {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);
  const orgRaw = params.get("org")?.trim();
  const snap = readTeosOrgSnapshotFromSession();

  let decodedUrl: string | null = null;
  if (orgRaw) {
    try {
      decodedUrl = decodeURIComponent(orgRaw);
    } catch {
      decodedUrl = orgRaw;
    }
  }

  if (decodedUrl) {
    if (snap && teosSnapshotMatchesUrl(decodedUrl, snap)) {
      const ctx = snapshotToContext(snap);
      writeOrgChipStore(ctx);
      return ctx;
    }
    const ctx = minimalContextFromOrgParam(decodedUrl);
    writeOrgChipStore(ctx);
    return ctx;
  }

  if (snap) {
    const ctx = snapshotToContext(snap);
    writeOrgChipStore(ctx);
    return ctx;
  }

  return undefined;
}

function writeOrgChipStore(ctx: ChatOrgContext): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ORG_CHIP_STORE_KEY);
    const store = (raw ? (JSON.parse(raw) as Record<string, ChatOrgContext>) : {}) ?? {};
    store[ctx.orgId] = ctx;
    const ids = Object.keys(store);
    if (ids.length > ORG_CHIP_STORE_MAX) {
      for (let i = 0; i < ids.length - ORG_CHIP_STORE_MAX; i++) {
        delete store[ids[i]!];
      }
    }
    window.localStorage.setItem(ORG_CHIP_STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}
