"use client";

import { useMemo } from "react";
import {
  BOARD_BAND_IDS,
  BOARD_BAND_MENU_LABELS,
  type BoardBandId,
} from "@/lib/board-band";
import {
  COUNT_BAND_IDS,
  COUNT_BAND_MENU_LABELS,
  type CountBandId,
  US_STATE_OPTIONS,
} from "@/lib/portfolio-toolbar-bands";
import { PortfolioToolbarDropdown } from "./portfolio-toolbar-dropdown";

function countBandOptions(): { id: CountBandId; label: string }[] {
  const o: { id: CountBandId; label: string }[] = [{ id: "all", label: "All" }];
  for (const id of COUNT_BAND_IDS) {
    if (id === "all") continue;
    o.push({ id, label: COUNT_BAND_MENU_LABELS[id] });
  }
  return o;
}

type CountProps = {
  value: CountBandId;
  onChange: (v: CountBandId) => void;
  kind: "employees" | "volunteers";
};

function PortfolioCountBandFilter(props: CountProps) {
  const { value, onChange, kind } = props;
  const options = useMemo(() => countBandOptions(), []);
  const triggerDefault = kind === "employees" ? "Employees" : "Volunteers";
  const noun = kind === "employees" ? "employees" : "volunteers";
  const prefix = kind === "employees" ? "Employees filter" : "Volunteers filter";
  const bandLabel =
    value === "all" ? null : COUNT_BAND_MENU_LABELS[value as Exclude<CountBandId, "all">];
  /** Chip preview: e.g. `100+ employees`, `0–1 volunteers`; unchanged when "all" (category name only). */
  const triggerLabel = value === "all" ? triggerDefault : `${bandLabel} ${noun}`;
  const ariaDetail = value === "all" ? "all ranges" : `${bandLabel} ${noun}`;

  return (
    <PortfolioToolbarDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-count-band-select-wrap"
      options={options}
      value={value}
      onChange={onChange}
      triggerLabel={triggerLabel}
      ariaLabelPrefix={prefix}
      ariaFilterDetail={ariaDetail}
    />
  );
}

export function PortfolioEmployeesFilter(props: Omit<CountProps, "kind">) {
  return <PortfolioCountBandFilter kind="employees" {...props} />;
}

export function PortfolioVolunteerFilter(props: Omit<CountProps, "kind">) {
  return <PortfolioCountBandFilter kind="volunteers" {...props} />;
}

function boardBandOptions(): { id: BoardBandId; label: string }[] {
  const o: { id: BoardBandId; label: string }[] = [{ id: "all", label: "All" }];
  for (const id of BOARD_BAND_IDS) {
    if (id === "all") continue;
    o.push({ id, label: BOARD_BAND_MENU_LABELS[id] });
  }
  return o;
}

type BoardProps = {
  value: BoardBandId;
  onChange: (v: BoardBandId) => void;
};

/** Governing-body size from Form 990 (Worker: COALESCE of two Part VI counts). */
export function PortfolioBoardFilter(props: BoardProps) {
  const { value, onChange } = props;
  const options = useMemo(() => boardBandOptions(), []);
  const triggerLabel =
    value === "all" ? "Board" : BOARD_BAND_MENU_LABELS[value as Exclude<BoardBandId, "all">];
  const ariaDetail =
    value === "all" ? "all sizes" : BOARD_BAND_MENU_LABELS[value as Exclude<BoardBandId, "all">];

  return (
    <PortfolioToolbarDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-board-select-wrap"
      options={options}
      value={value}
      onChange={onChange}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="Board filter"
      ariaFilterDetail={ariaDetail}
    />
  );
}

type StateProps = {
  value: string;
  onChange: (stateAbbrev: string) => void;
};

/** `value` is `"all"` or USPS code (`CA`, `NY`, …). */
export function PortfolioStateFilter(props: StateProps) {
  const { value, onChange } = props;
  const options = useMemo(() => {
    const o: { id: string; label: string }[] = [{ id: "all", label: "All states" }];
    for (const s of US_STATE_OPTIONS) {
      o.push({ id: s.abbrev, label: s.name });
    }
    return o;
  }, []);

  const triggerLabel =
    value === "all"
      ? "State"
      : US_STATE_OPTIONS.find((s) => s.abbrev === value)?.name ?? value;
  const ariaDetail =
    value === "all" ? "all states" : (US_STATE_OPTIONS.find((s) => s.abbrev === value)?.name ?? value);

  return (
    <PortfolioToolbarDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-state-select-wrap"
      options={options}
      value={value}
      onChange={onChange}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="State filter"
      ariaFilterDetail={ariaDetail}
      menuMaxHeight="min(50vh, 320px)"
    />
  );
}
