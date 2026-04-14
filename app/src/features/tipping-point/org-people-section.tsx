"use client";

import { useEffect, useState } from "react";
import { toOrganizationTitleCase } from "@/lib/org-name-format";
import type { OrgOutreachPersonDraft } from "@/lib/org-outreach-types";
import type { OrgPerson990 } from "@/lib/types";
import { buildFallbackOutreachDraft, normalizeOutreachEmailBody } from "@/lib/org-outreach-fallback";
import {
  buildOutreachInputFingerprint,
  loadOutreachDraftsFromStorage,
  saveOutreachDraftsToStorage,
} from "./org-ai-local-storage";

function formatPersonName(raw: string): string {
  const t = toOrganizationTitleCase(raw);
  return t || raw.trim();
}

/** Title lines are often ALL CAPS from IRS; short acronyms (CEO) stay uppercase. */
function formatRoleTitle(raw: string | null): string | null {
  if (raw == null || !raw.trim()) return null;
  const t = raw.trim();
  if (t.length <= 6 && /^[A-Z]+$/.test(t)) return t;
  return toOrganizationTitleCase(t);
}

/** Myna UI Icons (MIT) — telephone + envelope from mynaui icon set */
const ICON_SIZE = 22;

function PhoneIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
        d="M15.6 14.522c-2.395 2.52-8.504-3.534-6.1-6.064c1.468-1.545-.19-3.31-1.108-4.609c-1.723-2.435-5.504.927-5.39 3.066c.363 6.746 7.66 14.74 14.726 14.042c2.21-.218 4.75-4.21 2.215-5.669c-1.268-.73-3.009-2.17-4.343-.767"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
        d="m2.357 7.714l6.98 4.654c.963.641 1.444.962 1.964 1.087c.46.11.939.11 1.398 0c.52-.125 1.001-.446 1.964-1.087l6.98-4.654M7.157 19.5h9.686c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.31-1.311c.328-.642.328-1.482.328-3.162V9.3c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311c-.642-.327-1.482-.327-3.162-.327H7.157c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.31 1.311c-.328.642-.328 1.482-.328 3.162v5.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311c.642.327 1.482.327 3.162.327"
      />
    </svg>
  );
}

type OrgPeopleSectionProps = {
  ein: string;
  organizationName: string;
  city: string;
  state: string;
  /** Main org line — used for ready `tel:` links before AI draft loads when available */
  orgPhone?: string | null;
  /** Main org inbox — used for ready `mailto:` before AI draft loads when available */
  orgEmail?: string | null;
  /** Mission paragraph; may be em dash until TEOS loads — API fills from Worker if thin. */
  missionSummary: string;
  /**
   * When provided (including `[]`), skips the client fetch — data came from portfolio prefetch.
   * When `undefined`, fetches `/api/org-people` (e.g. deep link before prefetch fills).
   */
  prefetchedPeople?: OrgPerson990[];
};

export function OrgPeopleSection({
  ein,
  organizationName,
  city,
  state,
  orgPhone,
  orgEmail,
  missionSummary,
  prefetchedPeople,
}: OrgPeopleSectionProps) {
  const [people, setPeople] = useState<OrgPerson990[] | null>(() =>
    prefetchedPeople !== undefined ? prefetchedPeople : null,
  );
  const [drafts, setDrafts] = useState<OrgOutreachPersonDraft[] | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (prefetchedPeople !== undefined) {
      setPeople(prefetchedPeople);
      return;
    }
    const ac = new AbortController();
    const q = encodeURIComponent(ein);
    setPeople(null);
    fetch(`/api/org-people?ein=${q}`, { signal: ac.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { people?: OrgPerson990[] };
        if (!res.ok) return [];
        return Array.isArray(body.people) ? body.people : [];
      })
      .then((rows) => {
        setPeople(rows);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPeople([]);
      });
    return () => ac.abort();
  }, [ein, prefetchedPeople]);

  useEffect(() => {
    if (!people?.length || !organizationName.trim()) return;
    const outreachFingerprint = buildOutreachInputFingerprint(
      ein,
      organizationName,
      city,
      state,
      missionSummary,
      people.map((p) => ({ name: p.name, title: p.title })),
    );
    const fromDisk = loadOutreachDraftsFromStorage(outreachFingerprint);
    if (fromDisk && fromDisk.length === people.length) {
      setDrafts(fromDisk);
      setDraftError(null);
      setDraftLoading(false);
      return;
    }

    const ac = new AbortController();
    setDraftLoading(true);
    setDraftError(null);
    setDrafts(null);

    fetch("/api/org-outreach-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        ein,
        organizationName,
        city,
        state,
        missionSummary,
        people: people.map((p) => ({ name: p.name, title: p.title })),
      }),
    })
      .then(async (res) => {
        const body = (await res.json()) as { people?: OrgOutreachPersonDraft[]; error?: string };
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
        }
        if (!Array.isArray(body.people) || body.people.length !== people.length) {
          throw new Error("Invalid outreach response");
        }
        saveOutreachDraftsToStorage(outreachFingerprint, body.people);
        setDrafts(body.people);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setDraftError(e instanceof Error ? e.message : "Could not load contact details");
        setDrafts(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setDraftLoading(false);
      });

    return () => ac.abort();
  }, [ein, people, organizationName, city, state, missionSummary]);

  if (people === null || people.length === 0) {
    return null;
  }

  const fallbackCtx = {
    organizationName,
    city,
    state,
    missionSummary,
    orgPhone,
    orgEmail,
  };

  return (
    <section className="hp-sec" aria-label="People">
      <h2 className="hp-sec-title">People</h2>
      {draftError ? (
        <p className="tp-body" role="status" style={{ marginTop: -4, marginBottom: 10 }}>
          Refined contact drafts unavailable — standard email template is used.
        </p>
      ) : null}
      <div className="hp-map-grid">
        {people.map((p, i) => {
          const title = formatRoleTitle(p.title);
          const name = formatPersonName(p.name);
          const rowDraft = drafts?.[i];
          const fallback = buildFallbackOutreachDraft({ displayName: name }, fallbackCtx);
          const d = rowDraft
            ? {
                ...rowDraft,
                emailBody: normalizeOutreachEmailBody(rowDraft.emailBody),
              }
            : fallback;
          const telHref = d.phoneTel.replace(/\s/g, "");
          const hasTel = telHref.length >= 8;
          const mailtoHref = `mailto:${encodeURIComponent(d.contactEmail)}?subject=${encodeURIComponent(d.emailSubject)}&body=${encodeURIComponent(d.emailBody)}`;

          return (
            <article key={`${ein}-person-${i}-${name}`} className="tp-people-card">
              <div className="tp-people-card-main">
                <div className="tp-people-avatar" aria-hidden />
                <div className="tp-people-text">
                  <p className="tp-people-name">{name}</p>
                  {title ? <p className="tp-people-role">{title}</p> : null}
                </div>
              </div>
              <div
                className="tp-people-card-tools"
                aria-busy={draftLoading && !rowDraft}
              >
                {hasTel ? (
                  <a
                    className="tp-people-icon-btn"
                    href={`tel:${telHref}`}
                    aria-label={`Call ${name}`}
                    title="Call"
                  >
                    <PhoneIcon />
                  </a>
                ) : (
                  <span
                    className="tp-people-icon-btn tp-people-icon-btn--inactive"
                    aria-label="No main phone on file for quick dial"
                    title="Add an organization phone to enable tap-to-call"
                  >
                    <PhoneIcon />
                  </span>
                )}
                <a
                  className="tp-people-icon-btn"
                  href={mailtoHref}
                  aria-label={`Email ${name}`}
                  title="Email"
                >
                  <MailIcon />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
