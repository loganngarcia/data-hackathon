"use client";

import { useMemo } from "react";
import {
  ASSETS_BAND_IDS,
  ASSETS_BAND_LABELS,
  formatAssetsBandSelectionChip,
  toggleAssetsBandSelection,
  type AssetsBandId,
  type AssetsBandSelection,
} from "@/lib/assets-band";
import { PortfolioToolbarMultiDropdown } from "./portfolio-toolbar-dropdown";

type Props = {
  value: AssetsBandSelection;
  onChange: (v: AssetsBandSelection) => void;
};

/** Net assets (EOY) bands — multi-select. */
export function PortfolioAssetsFilter(props: Props) {
  const { value, onChange } = props;
  const options = useMemo(() => {
    const o: { id: AssetsBandId; label: string }[] = [{ id: "all", label: "All" }];
    for (const id of ASSETS_BAND_IDS) {
      if (id === "all") continue;
      o.push({ id, label: ASSETS_BAND_LABELS[id] });
    }
    return o;
  }, []);

  const triggerLabel = formatAssetsBandSelectionChip(value);
  const ariaDetail = value.length === 0 ? "all net asset ranges" : triggerLabel.replace(" net assets", "").trim();

  return (
    <PortfolioToolbarMultiDropdown
      wrapClassName="tp-portfolio-revenue-select-wrap"
      options={options}
      selectedIds={value}
      onPick={(id) => onChange(toggleAssetsBandSelection(value, id as AssetsBandId))}
      triggerLabel={triggerLabel}
      ariaLabelPrefix="Net assets filter"
      ariaFilterDetail={ariaDetail}
    />
  );
}
