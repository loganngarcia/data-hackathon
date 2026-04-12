import { describe, it, expect } from "vitest";
import {
  screenerRows,
  orgDetails,
  scenarioResults,
} from "@/lib/mock-data";

// ---------------------------------------------------------------------------
// 1. Organization names match between screenerRows and orgDetails
// ---------------------------------------------------------------------------
describe("Name consistency between screenerRows and orgDetails", () => {
  screenerRows.forEach((row) => {
    it(`"${row.id}" name matches in screenerRows and orgDetails`, () => {
      const detail = orgDetails[row.id];
      expect(detail).toBeDefined();
      expect(row.organizationName).toBe(detail.organizationName);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Revenue values are consistent
// ---------------------------------------------------------------------------
describe("Revenue consistency between screenerRows and orgDetails", () => {
  screenerRows.forEach((row) => {
    it(`"${row.id}" revenue matches currentYearRevenue in orgDetails`, () => {
      const detail = orgDetails[row.id];
      expect(detail).toBeDefined();
      expect(row.revenue).toBe(detail.currentYearRevenue);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Growth rates are mathematically consistent
// ---------------------------------------------------------------------------
describe("Growth rate consistency with revenue figures", () => {
  screenerRows.forEach((row) => {
    it(`"${row.id}" growthRate is consistent with currentYear/priorYear revenue`, () => {
      const detail = orgDetails[row.id];
      expect(detail).toBeDefined();

      const computedGrowth =
        ((detail.currentYearRevenue - detail.priorYearRevenue) /
          detail.priorYearRevenue) *
        100;

      // Allow rounding tolerance of 0.5 percentage points
      expect(row.growthRate).toBeCloseTo(computedGrowth, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Peer benchmarks have positive orgValue and peerMedian
// ---------------------------------------------------------------------------
describe("Peer benchmark values are valid", () => {
  Object.entries(orgDetails).forEach(([key, detail]) => {
    detail.peerBenchmarks.forEach((benchmark) => {
      it(`"${key}" benchmark "${benchmark.label}" has a finite orgValue`, () => {
        expect(Number.isFinite(benchmark.orgValue)).toBe(true);
      });

      it(`"${key}" benchmark "${benchmark.label}" has positive peerMedian`, () => {
        expect(benchmark.peerMedian).toBeGreaterThan(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Evidence arrays in scenarios are non-empty
// ---------------------------------------------------------------------------
describe("Scenario evidence arrays are non-empty", () => {
  Object.entries(scenarioResults).forEach(([key, scenario]) => {
    it(`"${key}" scenario has non-empty evidence`, () => {
      expect(scenario.evidence.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Flags arrays in screener rows are non-empty
// ---------------------------------------------------------------------------
describe("Screener row flags are non-empty", () => {
  screenerRows.forEach((row) => {
    it(`"${row.id}" has non-empty flags`, () => {
      expect(row.flags.length).toBeGreaterThan(0);
    });
  });
});
