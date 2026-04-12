import { describe, it, expect } from "vitest";
import {
  screenerRows,
  orgDetails,
  scenarioResults,
  memoContext,
  heroCaseStudy,
} from "@/lib/mock-data";
import { hackathonContracts } from "../../../../contracts/hackathon-contracts";
import type { RiskBand } from "@/lib/types";

// ---------------------------------------------------------------------------
// 1. ScreenerRow contract
// ---------------------------------------------------------------------------
describe("ScreenerRow contract", () => {
  const requiredFields = hackathonContracts.screenerRow.required;

  it("has at least one screener row", () => {
    expect(screenerRows.length).toBeGreaterThan(0);
  });

  screenerRows.forEach((row) => {
    describe(`row "${row.id}"`, () => {
      it("has all required fields", () => {
        for (const field of requiredFields) {
          expect(row).toHaveProperty(field);
          expect(
            (row as unknown as Record<string, unknown>)[field],
          ).not.toBeUndefined();
        }
      });

      it("screenScore is between 0 and 100", () => {
        expect(row.screenScore).toBeGreaterThanOrEqual(0);
        expect(row.screenScore).toBeLessThanOrEqual(100);
      });

      it("reserveMonths is positive", () => {
        expect(row.reserveMonths).toBeGreaterThan(0);
      });

      it("riskBand is a valid enum value", () => {
        const validBands: RiskBand[] = [
          "Foundation",
          "Steady",
          "Watch",
          "At Risk",
        ];
        expect(validBands).toContain(row.riskBand);
      });

      it("flags array is non-empty", () => {
        expect(row.flags.length).toBeGreaterThan(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 2. OrgDetail contract
// ---------------------------------------------------------------------------
describe("OrgDetail contract", () => {
  const requiredFields = hackathonContracts.orgDetail.required;

  it("has at least one org detail", () => {
    expect(Object.keys(orgDetails).length).toBeGreaterThan(0);
  });

  Object.entries(orgDetails).forEach(([key, detail]) => {
    describe(`orgDetail "${key}"`, () => {
      it("has all required fields", () => {
        for (const field of requiredFields) {
          expect(detail).toHaveProperty(field);
          expect(
            (detail as unknown as Record<string, unknown>)[field],
          ).not.toBeUndefined();
        }
      });

      it("revenueMix values sum to 100", () => {
        const sum = detail.revenueMix.reduce((acc, item) => acc + item.value, 0);
        expect(sum).toBe(100);
      });

      it("peer benchmarks have finite orgValue and positive peerMedian", () => {
        for (const benchmark of detail.peerBenchmarks) {
          expect(Number.isFinite(benchmark.orgValue)).toBe(true);
          expect(benchmark.peerMedian).toBeGreaterThan(0);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 3. ScenarioResult contract
// ---------------------------------------------------------------------------
describe("ScenarioResult contract", () => {
  const requiredFields = hackathonContracts.scenarioResult.required;

  it("has at least one scenario result", () => {
    expect(Object.keys(scenarioResults).length).toBeGreaterThan(0);
  });

  Object.entries(scenarioResults).forEach(([key, scenario]) => {
    describe(`scenarioResult "${key}"`, () => {
      it("has all required fields", () => {
        for (const field of requiredFields) {
          expect(scenario).toHaveProperty(field);
          expect(
            (scenario as unknown as Record<string, unknown>)[field],
          ).not.toBeUndefined();
        }
      });

      it("evidence array is non-empty", () => {
        expect(scenario.evidence.length).toBeGreaterThan(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 4. MemoContext contract
// ---------------------------------------------------------------------------
describe("MemoContext contract", () => {
  const requiredFields = hackathonContracts.memoContext.required;

  it("has all required fields", () => {
    for (const field of requiredFields) {
      expect(memoContext).toHaveProperty(field);
      expect(
        (memoContext as unknown as Record<string, unknown>)[field],
      ).not.toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. HeroCaseStudy contract
// ---------------------------------------------------------------------------
describe("HeroCaseStudy contract", () => {
  const requiredFields = hackathonContracts.heroCaseStudy.required;

  it("has all required fields", () => {
    for (const field of requiredFields) {
      expect(heroCaseStudy).toHaveProperty(field);
      expect(
        (heroCaseStudy as unknown as Record<string, unknown>)[field],
      ).not.toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-entity referential integrity
// ---------------------------------------------------------------------------
describe("Referential integrity", () => {
  it("every screenerRow.id has a matching orgDetail", () => {
    for (const row of screenerRows) {
      expect(orgDetails).toHaveProperty(row.id);
    }
  });

  it("every screenerRow.id has a matching scenarioResult", () => {
    for (const row of screenerRows) {
      expect(scenarioResults).toHaveProperty(row.id);
    }
  });
});
