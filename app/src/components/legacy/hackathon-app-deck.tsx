"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import {
  heroCaseStudy,
  memoContext,
  orgDetails,
  scenarioResults,
  screenerRows,
  screens,
} from "@/lib/mock-data";
import {
  formatBenchmarkValue,
  formatCompactCurrency,
  formatSignedPercent,
} from "@/lib/format-display";
import type { OrgDetail, ScreenKey, ScreenerRow } from "@/lib/types";

function barWidth(value: number, max = 100) {
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

function buildMemoParagraphs(
  row: ScreenerRow,
  detail: OrgDetail,
  scenario: (typeof scenarioResults)[keyof typeof scenarioResults],
) {
  return [
    `${detail.organizationName} should be framed as the ${row.riskBand.toLowerCase()} case in the portfolio because ${detail.topSignals[0].replace(/\.$/, "")}.`,
    `The operating defense is concrete: ${formatSignedPercent(row.growthRate)} growth on ${formatCompactCurrency(row.revenue)} of revenue, ${row.reserveMonths.toFixed(1)} months of reserves, and a peer story that stays legible under scrutiny.`,
    `Recommended move: ${scenario.recommendation} If the team ${scenario.assumption.charAt(0).toLowerCase()}${scenario.assumption.slice(1)}, the file projects to ${scenario.riskShift.toLowerCase()}.`,
  ];
}

/** Original three-screen editorial deck — kept as backup; primary UI is the mosaic dashboard at `/`. */
export function HackathonAppDeck() {
  const [screen, setScreen] = useState<ScreenKey>("screener");
  const [selectedOrgId, setSelectedOrgId] = useState(screenerRows[0].id);

  const selectedRow = screenerRows.find((row) => row.id === selectedOrgId) ?? screenerRows[0];
  const detail = orgDetails[selectedRow.id] ?? orgDetails["ocean-bridge"];
  const scenario = scenarioResults[selectedRow.id] ?? scenarioResults["ocean-bridge"];
  const activeScreen = screens.find((item) => item.key === screen) ?? screens[0];
  const memoParagraphs = buildMemoParagraphs(selectedRow, detail, scenario);

  function navigate(nextScreen: ScreenKey) {
    startTransition(() => setScreen(nextScreen));
  }

  function openOrganization(row: ScreenerRow, nextScreen: ScreenKey = "detail") {
    startTransition(() => {
      setSelectedOrgId(row.id);
      setScreen(nextScreen);
    });
  }

  return (
    <main className="deck">
      <aside className="rail">
        <div className="rail-block rail-brand">
          <p className="section-label">Aggies Data Hackathon 2026</p>
          <h1>Tipping Point</h1>
          <p className="rail-copy">
            Nonprofit resilience triage for funders, advisors, and a five-minute judge walkthrough.
          </p>
          <p className="rail-copy" style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: "var(--accent)", fontWeight: 600 }}>
              ← Main dashboard (mosaic UI)
            </Link>
          </p>
        </div>

        <div className="rail-block rail-current">
          <span className="section-label">Selected organization</span>
          <div className="rail-scoreline">
            <div>
              <p className="selected-name">{selectedRow.organizationName}</p>
              <p className="selected-meta">
                {selectedRow.missionArea} / {selectedRow.city}, {selectedRow.state}
              </p>
            </div>
            <div className="score-mark">{selectedRow.screenScore}</div>
          </div>
          <dl className="mini-stats">
            <div>
              <dt>Revenue</dt>
              <dd>{formatCompactCurrency(selectedRow.revenue)}</dd>
            </div>
            <div>
              <dt>Growth</dt>
              <dd>{formatSignedPercent(selectedRow.growthRate)}</dd>
            </div>
            <div>
              <dt>Reserve</dt>
              <dd>{selectedRow.reserveMonths.toFixed(1)} months</dd>
            </div>
          </dl>
        </div>

        <nav className="rail-block rail-nav" aria-label="Hackathon demo flow">
          {screens.map((item, index) => {
            const active = screen === item.key;

            return (
              <button
                key={item.key}
                className="rail-step"
                data-active={active}
                onClick={() => navigate(item.key)}
              >
                <span className="rail-step-index">0{index + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.blurb}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="rail-block rail-note">
          <span className="section-label">Demo anchor</span>
          <p>{heroCaseStudy.headline}</p>
          <small>{heroCaseStudy.outcome}</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-head">
          <div>
            <p className="section-label">Active screen</p>
            <h2>{activeScreen.label}</h2>
            <p className="workspace-copy">{activeScreen.blurb}</p>
          </div>
          <div className="workspace-status" aria-label="App status">
            <span>Mocked fixtures</span>
            <span>Typed contracts</span>
            <span>Recorded-demo ready</span>
          </div>
        </header>

        <div key={screen} className="workspace-stage">
          {screen === "screener" ? (
            <PortfolioScreen
              rows={screenerRows}
              selectedRow={selectedRow}
              detail={detail}
              onSelect={openOrganization}
              onAdvance={() => navigate("detail")}
            />
          ) : null}

          {screen === "detail" ? (
            <OrgDetailScreen
              row={selectedRow}
              detail={detail}
              onBack={() => navigate("screener")}
              onAdvance={() => navigate("scenario")}
            />
          ) : null}

          {screen === "scenario" ? (
            <ScenarioMemoScreen
              row={selectedRow}
              detail={detail}
              scenario={scenario}
              memoParagraphs={memoParagraphs}
              onBack={() => navigate("detail")}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function PortfolioScreen({
  rows,
  selectedRow,
  detail,
  onSelect,
  onAdvance,
}: {
  rows: ScreenerRow[];
  selectedRow: ScreenerRow;
  detail: OrgDetail;
  onSelect: (row: ScreenerRow, nextScreen?: ScreenKey) => void;
  onAdvance: () => void;
}) {
  return (
    <section className="stage-grid stage-screener">
      <div className="section-sheet">
        <div className="section-head">
          <div>
            <p className="section-label">Portfolio scan</p>
            <h3>Sort for stability, then choose the file worth defending live.</h3>
          </div>
          <button className="action action-primary" onClick={onAdvance}>
            Open selected file
          </button>
        </div>

        <div className="org-list">
          {rows.map((row) => {
            const active = row.id === selectedRow.id;

            return (
              <button
                key={row.id}
                className="org-row"
                data-active={active}
                onClick={() => onSelect(row)}
              >
                <div className="org-row-main">
                  <p className="org-row-name">{row.organizationName}</p>
                  <p className="org-row-meta">
                    {row.missionArea} / {row.city}, {row.state}
                  </p>
                </div>
                <dl className="org-row-metrics">
                  <div>
                    <dt>Revenue</dt>
                    <dd>{formatCompactCurrency(row.revenue)}</dd>
                  </div>
                  <div>
                    <dt>Growth</dt>
                    <dd>{formatSignedPercent(row.growthRate)}</dd>
                  </div>
                  <div>
                    <dt>Reserve</dt>
                    <dd>{row.reserveMonths.toFixed(1)} mo</dd>
                  </div>
                </dl>
                <div className="org-row-score">
                  <span>{row.riskBand}</span>
                  <strong>{row.screenScore}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="focus-sheet">
        <p className="section-label">Selection</p>
        <h4>{selectedRow.organizationName}</h4>
        <p className="focus-copy">{detail.summary}</p>

        <div className="focus-scoreband">
          <span>{selectedRow.riskBand}</span>
          <strong>{selectedRow.screenScore}</strong>
        </div>

        <div className="focus-footer">
          <p className="section-label">Next move</p>
          <p>Open the detail surface, defend the peer frame, then move straight into the scenario memo.</p>
        </div>
      </aside>
    </section>
  );
}

function OrgDetailScreen({
  row,
  detail,
  onBack,
  onAdvance,
}: {
  row: ScreenerRow;
  detail: OrgDetail;
  onBack: () => void;
  onAdvance: () => void;
}) {
  return (
    <section className="stage-grid stage-detail">
      <div className="section-sheet detail-sheet">
        <div className="section-head">
          <div>
            <p className="section-label">Operating review</p>
            <h3>{detail.organizationName}</h3>
            <p className="section-copy">{detail.summary}</p>
          </div>
          <div className="button-row">
            <button className="action action-secondary" onClick={onBack}>
              Back to screener
            </button>
            <button className="action action-primary" onClick={onAdvance}>
              Build scenario
            </button>
          </div>
        </div>

        <div className="detail-hero">
          <div>
            <p className="detail-kicker">{detail.geography}</p>
            <p className="detail-narrative">{detail.narrative}</p>
          </div>
          <div className="detail-aside">
            <span className="section-label">Current stance</span>
            <strong>{row.riskBand}</strong>
            <p>{detail.website}</p>
          </div>
        </div>

        <section className="metric-strip">
          <MetricStat label="Current revenue" value={formatCompactCurrency(detail.currentYearRevenue)} />
          <MetricStat
            label="YoY growth"
            value={formatSignedPercent(
              ((detail.currentYearRevenue - detail.priorYearRevenue) / detail.priorYearRevenue) * 100,
            )}
          />
          <MetricStat label="Reserve coverage" value={`${row.reserveMonths.toFixed(1)} months`} />
          <MetricStat label="Staff count" value={row.staffCount.toString()} />
        </section>

        <div className="detail-columns">
          <section className="detail-section">
            <div className="subsection-head">
              <span className="section-label">Revenue mix</span>
              <p>Use composition to explain durability, not just size.</p>
            </div>
            <div className="bars">
              {detail.revenueMix.map((bucket) => (
                <div key={bucket.label} className="bar-row">
                  <div className="bar-copy">
                    <label>{bucket.label}</label>
                    <strong>{bucket.value}%</strong>
                  </div>
                  <div className="bar-track">
                    <div className={`bar ${bucket.tone}`} style={{ width: barWidth(bucket.value) }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <div className="subsection-head">
              <span className="section-label">Peer frame</span>
              <p>Every talking point should survive a side-by-side comparison.</p>
            </div>
            <div className="peer-list">
              {detail.peerBenchmarks.map((item) => (
                <div key={item.label} className="peer-item">
                  <div>
                    <label>{item.label}</label>
                    <p>
                      Org {formatBenchmarkValue(item.label, item.orgValue)} / Peer{" "}
                      {formatBenchmarkValue(item.label, item.peerMedian)}
                    </p>
                  </div>
                  <strong>{item.orgValue >= item.peerMedian ? "Ahead" : "Below"}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="signal-columns">
          <section className="detail-section">
            <div className="subsection-head">
              <span className="section-label">What stands out</span>
            </div>
            <ul className="narrative-list">
              {detail.topSignals.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section detail-section-alert">
            <div className="subsection-head">
              <span className="section-label">Watchouts</span>
            </div>
            <ul className="narrative-list">
              {detail.watchouts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}

function ScenarioMemoScreen({
  row,
  detail,
  scenario,
  memoParagraphs,
  onBack,
}: {
  row: ScreenerRow;
  detail: OrgDetail;
  scenario: (typeof scenarioResults)[keyof typeof scenarioResults];
  memoParagraphs: string[];
  onBack: () => void;
}) {
  return (
    <section className="stage-grid stage-scenario">
      <div className="scenario-pane">
        <div>
          <p className="section-label">Scenario review</p>
          <h3>{scenario.title}</h3>
          <p className="section-copy">{scenario.assumption}</p>
        </div>

        <button className="action action-secondary" onClick={onBack}>
          Back to detail
        </button>

        <div className="scenario-metrics">
          <MetricStat label="Projected reserve" value={`${scenario.projectedReserveMonths.toFixed(1)} months`} inverted />
          <MetricStat label="Projected growth" value={formatSignedPercent(scenario.projectedGrowth)} inverted />
          <MetricStat label="Risk shift" value={scenario.riskShift} inverted />
        </div>

        <div className="scenario-recommendation">
          <span className="section-label">Recommendation</span>
          <strong>{scenario.recommendation}</strong>
        </div>

        <div className="evidence-box">
          <span className="section-label">Evidence anchors</span>
          <ul className="evidence-list">
            {scenario.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="memo-sheet">
        <div className="section-head">
          <div>
            <p className="section-label">Advisor memo</p>
            <h3>{row.organizationName}</h3>
            <p className="section-copy">{memoContext.ask}</p>
          </div>
          <button className="action action-tertiary" onClick={onBack}>
            Back to detail
          </button>
        </div>

        <div className="memo-meta">
          <div>
            <dt>Audience</dt>
            <dd>{memoContext.audience}</dd>
          </div>
          <div>
            <dt>Horizon</dt>
            <dd>{memoContext.timeHorizon}</dd>
          </div>
          <div>
            <dt>Mission</dt>
            <dd>{detail.missionArea}</dd>
          </div>
        </div>

        <div className="memo-body">
          {memoParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="memo-support">
          <div>
            <span className="section-label">Constraints</span>
            <ul className="narrative-list compact">
              {memoContext.constraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="section-label">Talk track</span>
            <ol className="narrative-list compact ordered">
              {memoContext.talkTrack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricStat({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: string;
  inverted?: boolean;
}) {
  return (
    <div className="metric-stat" data-inverted={inverted}>
      <span className="section-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
