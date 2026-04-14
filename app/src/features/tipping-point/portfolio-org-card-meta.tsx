"use client";

import { Fragment } from "react";
import type { CountBandSelection, StateAbbrevSelection } from "@/lib/portfolio-toolbar-bands";
import type { ScreenerRow } from "@/lib/types";
import {
  formatNetAssetsMeta,
  formatReserveCoverageMeta,
} from "@/lib/format-display";

/** Subset of `ScreenerRow` used for the meta line (portfolio list + chat result cards). */
export type OrgCardMetaFields = Pick<ScreenerRow, "city" | "state" | "reserveMonths" | "netAssetsEoy"> & {
  boardMemberCount?: number;
  employeeCount?: number;
  volunteerCount?: number;
};

/** Toolbar state from the portfolio home — drives which extra segment appears after reserve & net assets. */
export type PortfolioCardMetaFilterContext = {
  stateAbbrevs: StateAbbrevSelection;
  volunteerBands: CountBandSelection;
  employeeBands: CountBandSelection;
};

const EMPTY_META_FILTERS: PortfolioCardMetaFilterContext = {
  stateAbbrevs: [],
  volunteerBands: [],
  employeeBands: [],
};

function boardPhraseFromRow(row: OrgCardMetaFields | ScreenerRow): string | null {
  const n = row.boardMemberCount;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n === 0) return null;
  return `${n} ${n === 1 ? "board member" : "board members"}`;
}

function volunteerPhraseFromRow(row: OrgCardMetaFields | ScreenerRow): string | null {
  const n = row.volunteerCount;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return `${n.toLocaleString("en-US")} ${n === 1 ? "volunteer" : "volunteers"}`;
}

function employeePhraseFromRow(row: OrgCardMetaFields | ScreenerRow): string | null {
  const n = row.employeeCount;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return `${n.toLocaleString("en-US")} ${n === 1 ? "employee" : "employees"}`;
}

function metaTitle(filters: PortfolioCardMetaFilterContext): string {
  const hasState = filters.stateAbbrevs.length > 0;
  const hasVol = filters.volunteerBands.length > 0;
  const hasEmp = filters.employeeBands.length > 0;
  if (hasState) {
    return "Location, reserve coverage, net assets (EOY). State filter active — headcounts hidden.";
  }
  if (hasVol) {
    return "Location, reserve coverage, net assets (EOY), volunteers (990 Part I) when available.";
  }
  if (hasEmp) {
    return "Location, reserve coverage, net assets (EOY), employees (990 Part I) when available.";
  }
  return "Location, reserve coverage, net assets (EOY), governing-body size (Form 990 Part VI) when available.";
}

/**
 * Secondary row on portfolio org cards — location • reserve • net assets • optional tail.
 * Reserve and net assets are always shown; the last segment follows toolbar filters (volunteers,
 * employees, board, or state-only which omits headcounts).
 */
export function PortfolioOrgCardMeta({
  row,
  filterContext,
}: {
  row: OrgCardMetaFields | ScreenerRow;
  /** Omit on chat result cards — behaves like the default portfolio browse (board tail when data exists). */
  filterContext?: PortfolioCardMetaFilterContext;
}) {
  const filters = filterContext ?? EMPTY_META_FILTERS;

  const location = `${row.city}, ${row.state}`;
  const reservePhrase = formatReserveCoverageMeta(row.reserveMonths);
  const assetsPhrase = formatNetAssetsMeta(row.netAssetsEoy);

  const boardPhrase = boardPhraseFromRow(row);
  const volunteerPhrase = volunteerPhraseFromRow(row);
  const employeePhrase = employeePhraseFromRow(row);

  let tailSegment: string | null = null;
  if (filters.stateAbbrevs.length > 0) {
    tailSegment = null;
  } else if (filters.volunteerBands.length > 0) {
    tailSegment = volunteerPhrase;
  } else if (filters.employeeBands.length > 0) {
    tailSegment = employeePhrase;
  } else {
    /* Default browse or board-band filter: reserve & net assets already shown; board is optional tail. */
    tailSegment = boardPhrase;
  }

  const segments: string[] = [location, reservePhrase, assetsPhrase];
  if (tailSegment) {
    segments.push(tailSegment);
  }

  const title = metaTitle(filters);

  return (
    <p className="tp-portfolio-card-meta tp-people-role" title={title}>
      {segments.map((text, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span className="tp-portfolio-card-meta-sep" aria-hidden>
              •
            </span>
          ) : null}
          <span>{text}</span>
        </Fragment>
      ))}
    </p>
  );
}
