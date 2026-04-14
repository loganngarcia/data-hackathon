"use client";

import { useEffect, useState } from "react";
import { toOrganizationTitleCase } from "@/lib/org-name-format";
import type { OrgPerson990 } from "@/lib/types";

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

export function OrgPeopleSection({ ein }: { ein: string }) {
  const [people, setPeople] = useState<OrgPerson990[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(ein);
    setPeople(null);
    fetch(`/api/org-people?ein=${q}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { people?: OrgPerson990[] };
        if (!res.ok) return [];
        return Array.isArray(body.people) ? body.people : [];
      })
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ein]);

  if (people === null || people.length === 0) {
    return null;
  }

  return (
    <section className="hp-sec" aria-label="People">
      <h2 className="hp-sec-title">People</h2>
      <div className="hp-map-grid">
        {people.map((p, i) => {
          const title = formatRoleTitle(p.title);
          const name = formatPersonName(p.name);
          return (
            <article key={`${ein}-person-${i}-${name}`} className="tp-people-card">
              {/* Avatar slot hidden via CSS until we add imagery; keep for later. */}
              <div className="tp-people-avatar" aria-hidden />
              <div className="tp-people-text">
                <p className="tp-people-name">{name}</p>
                {title ? <p className="tp-people-role">{title}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
