"use client";

import { useMemo } from "react";
import {
  REVENUE_BAND_IDS,
  REVENUE_BAND_LABELS,
  formatRevenueBandSelectionChip,
  toggleRevenueBandSelection,
  type RevenueBandId,
  type RevenueBandSelection,
} from "@/lib/revenue-band";
import { PortfolioToolbarMultiDropdown } from "./portfolio-toolbar-dropdown";

type Props = {
  value: RevenueBandSelection;
  onChange: (v: RevenueBandSelection) => void;
};

/** Latest-year revenue bands — multi-select with compact chip label. */
export function PortfolioRevenueFilter(props: Props) {
  const { value, onChange } = props;
  const options = useMemo(() => {
    const o: { id: RevenueBandId; label: string }[] = [{ id: "all", label: "All" }];
    for (const id of REVENUE_BAND_IDS) {
      if (id === "all") continue;
      o.push({ id, label: REVENUE_BAND_LABELS[id] });
    }
    return o;
  }, []);

  const triggerLabel = formatRevenueBandSelectionChip(value);
  const ariaDetail = value.length === 0 ? "all revenue ranges" : triggerLabel.replace(" revenue", "");

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-revenue-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleRevenueBandSelection(value, id as RevenueBandId))}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="Revenue filter"
      ariaFilterDetail={ariaDetail}
    />
  );
}
