"use client";

import { useMemo } from "react";
import {
  BOARD_BAND_IDS,
  BOARD_BAND_MENU_LABELS,
  formatBoardBandSelectionChip,
  toggleBoardBandSelection,
  type BoardBandId,
  type BoardBandSelection,
} from "@/lib/board-band";
import {
  COUNT_BAND_IDS,
  COUNT_BAND_MENU_LABELS,
  formatCountBandSelectionChip,
  formatStateSelectionChip,
  toggleCountBandSelection,
  toggleStateAbbrevSelection,
  US_STATE_OPTIONS,
  type CountBandId,
  type CountBandSelection,
  type StateAbbrevSelection,
} from "@/lib/portfolio-toolbar-bands";
import { PortfolioToolbarMultiDropdown } from "./portfolio-toolbar-dropdown";

function countBandOptions(): { id: CountBandId; label: string }[] {
  const o: { id: CountBandId; label: string }[] = [{ id: "all", label: "All" }];
  for (const id of COUNT_BAND_IDS) {
    if (id === "all") continue;
    o.push({ id, label: COUNT_BAND_MENU_LABELS[id] });
  }
  return o;
}

type CountProps = {
  value: CountBandSelection;
  onChange: (v: CountBandSelection) => void;
  kind: "employees" | "volunteers";
};

function PortfolioCountBandFilter(props: CountProps) {
  const { value, onChange, kind } = props;
  const options = useMemo(() => countBandOptions(), []);
  const triggerDefault = kind === "employees" ? "Employees" : "Volunteers";
  const prefix = kind === "employees" ? "Employees filter" : "Volunteers filter";
  const triggerLabel = formatCountBandSelectionChip(value, kind);
  const ariaDetail = value.length === 0 ? "all ranges" : triggerLabel;

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-count-band-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleCountBandSelection(value, id as CountBandId))}
      triggerLabel={value.length === 0 ? triggerDefault : triggerLabel}
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
  /** Empty = all board sizes (no filter). */
  value: BoardBandSelection;
  onChange: (v: BoardBandSelection) => void;
};

/** Governing-body size from Form 990 (Worker: COALESCE of two Part VI counts). Multi-select; adding fills gaps along menu order. */
export function PortfolioBoardFilter(props: BoardProps) {
  const { value, onChange } = props;
  const options = useMemo(() => boardBandOptions(), []);
  const triggerLabel = formatBoardBandSelectionChip(value);
  const ariaDetail = value.length === 0 ? "all sizes" : triggerLabel;

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-board-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleBoardBandSelection(value, id as BoardBandId))}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="Board filter"
      ariaFilterDetail={ariaDetail}
    />
  );
}

type StateProps = {
  value: StateAbbrevSelection;
  onChange: (v: StateAbbrevSelection) => void;
};

/** Multi-select US states (OR). Empty = all states. */
export function PortfolioStateFilter(props: StateProps) {
  const { value, onChange } = props;
  const options = useMemo(() => {
    const o: { id: string; label: string }[] = [{ id: "all", label: "All states" }];
    for (const s of US_STATE_OPTIONS) {
      o.push({ id: s.abbrev, label: s.name });
    }
    return o;
  }, []);

  const triggerLabel = formatStateSelectionChip(value);
  const ariaDetail = value.length === 0 ? "all states" : `${value.length} state${value.length === 1 ? "" : "s"}`;

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-toolbar-select-wrap tp-portfolio-state-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleStateAbbrevSelection(value, id))}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="State filter"
      ariaFilterDetail={ariaDetail}
      menuMaxHeight="min(50vh, 320px)"
    />
  );
}
