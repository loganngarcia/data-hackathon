"use client";

import { useMemo } from "react";
import {
  RESERVE_BAND_IDS,
  RESERVE_BAND_LABELS,
  formatReserveBandSelectionChip,
  toggleReserveBandSelection,
  type ReserveBandId,
  type ReserveBandSelection,
} from "@/lib/reserve-band";
import { PortfolioToolbarMultiDropdown } from "./portfolio-toolbar-dropdown";

type Props = {
  value: ReserveBandSelection;
  onChange: (v: ReserveBandSelection) => void;
};

/** Reserve coverage (months) — multi-select. */
export function PortfolioReserveFilter(props: Props) {
  const { value, onChange } = props;
  const options = useMemo(() => {
    const o: { id: ReserveBandId; label: string }[] = [{ id: "all", label: "All" }];
    for (const id of RESERVE_BAND_IDS) {
      if (id === "all") continue;
      o.push({ id, label: RESERVE_BAND_LABELS[id] });
    }
    return o;
  }, []);

  const triggerLabel = formatReserveBandSelectionChip(value);
  const ariaDetail = value.length === 0 ? "all reserve ranges" : triggerLabel.replace(" reserve", "").trim();

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-revenue-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleReserveBandSelection(value, id as ReserveBandId))}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="Reserve filter"
      ariaFilterDetail={ariaDetail}
    />
  );
}
