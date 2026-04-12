"use client";

import { useMemo, useState } from "react";
import {
  heroCaseStudy,
  memoContext,
  orgDetails,
  scenarioResults,
  screenerRows,
  screens,
} from "@/lib/mock-data";
import type { OrgDetail, ScreenKey, ScreenerRow } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function barWidth(value: number, max = 100) {
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

export function HackathonApp() {
  const [screen, setScreen] = useState<ScreenKey>("screener");
  const [selectedOrgId, setSelectedOrgId] = useState(screenerRows[0].id);

  const selectedRow = useMemo(
    () => screenerRows.find((row) => row.id === selectedOrgId) ?? screenerRows[0],
    [selectedOrgId],
  );
  const detail = orgDetails[selectedRow.id] ?? orgDetails["ocean-bridge"];
  const scenario = scenarioResults[selectedRow.id] ?? scenarioResults["ocean-bridge"];

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Aggies Data Hackathon 2026 · Vercel + TypeScript</p>
          <h1>Portfolio triage, nonprofit depth, and a decision memo in one clean demo.</h1>
          <p className="lede">
            Next.js and TypeScript frontend, mocked data first: a presentation-friendly workflow
            that moves from a ranked portfolio into one org detail and ends with a scenario-backed
            memo. Ship to Vercel when you wire real data.
          </p>
        </div>
        <div className="hero-case">
          <span className="case-kicker">Hero case study</span>
          <strong>{heroCaseStudy.headline}</strong>
          <p>{heroCaseStudy.oneLiner}</p>
          <div className="case-stats">
            <div>
              <span>Outcome</span>
              <strong>{heroCaseStudy.outcome}</strong>
            </div>
            <div>
              <span>Why it matters</span>
              <strong>{heroCaseStudy.whyItMatters}</strong>
            </div>
          </div>
        </div>
      </section>

      <nav className="stepper" aria-label="Hackathon demo flow">
        {screens.map((item, index) => {
          const active = screen === item.key;
          return (
            <button
              key={item.key}
              className={`step ${active ? "active" : ""}`}
              onClick={() => setScreen(item.key)}
            >
              <span className="step-index">0{index + 1}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.blurb}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="workspace">
        {screen === "screener" ? (
          <PortfolioScreen
            rows={screenerRows}
            selectedOrgId={selectedOrgId}
            onSelect={(row) => {
              setSelectedOrgId(row.id);
              setScreen("detail");
            }}
            onAdvance={() => setScreen("detail")}
          />
        ) : null}

        {screen === "detail" ? (
          <OrgDetailScreen
            row={selectedRow}
            detail={detail}
            onBack={() => setScreen("screener")}
            onAdvance={() => setScreen("scenario")}
          />
        ) : null}

        {screen === "scenario" ? (
          <ScenarioMemoScreen
            row={selectedRow}
            detail={detail}
            scenario={scenario}
            onBack={() => setScreen("detail")}
          />
        ) : null}
      </section>

      <footer className="footer">
        <div>
          <span>Stack</span>
          <strong>Next.js, TypeScript, deploy on Vercel. Mock data in typed fixtures for now.</strong>
        </div>
        <div>
          <span>Integration assumption</span>
          <strong>Backend data will swap in behind the typed contract shapes later.</strong>
        </div>
      </footer>
    </main>
  );
}

function PortfolioScreen({
  rows,
  selectedOrgId,
  onSelect,
  onAdvance,
}: {
  rows: ScreenerRow[];
  selectedOrgId: string;
  onSelect: (row: ScreenerRow) => void;
  onAdvance: () => void;
}) {
  return (
    <div className="panel layout-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Screen 1</p>
          <h2>Portfolio Screener</h2>
        </div>
        <button className="primary" onClick={onAdvance}>
          Open selected org
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Mission</th>
              <th>Revenue</th>
              <th>Growth</th>
              <th>Reserve</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.id === selectedOrgId;
              return (
                <tr key={row.id} className={active ? "active-row" : ""} onClick={() => onSelect(row)}>
                  <td>
                    <strong>{row.organizationName}</strong>
                    <span>{row.city}, {row.state}</span>
                  </td>
                  <td>{row.missionArea}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td className={row.growthRate >= 0 ? "up" : "down"}>{formatSignedPercent(row.growthRate)}</td>
                  <td>{row.reserveMonths.toFixed(1)} mo</td>
                  <td>
                    <div className="score-pill">{row.screenScore}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="insight-row">
        <div className="insight-card">
          <span>Selection logic</span>
          <strong>Prioritize steady growth, reserve coverage, and diversified funding.</strong>
        </div>
        <div className="insight-card">
          <span>Demo cue</span>
          <strong>Click any row to jump straight into the detail view.</strong>
        </div>
      </div>
    </div>
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
    <div className="panel detail-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Screen 2</p>
          <h2>Organization Detail</h2>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={onBack}>
            Back to screener
          </button>
          <button className="primary" onClick={onAdvance}>
            Build scenario
          </button>
        </div>
      </div>

      <section className="detail-hero">
        <div>
          <p className="org-name">{row.organizationName}</p>
          <h3>{detail.summary}</h3>
          <p className="body-copy">{detail.narrative}</p>
        </div>
        <div className="detail-card">
          <span>Signal summary</span>
          <strong>{row.riskBand}</strong>
          <p>{row.flags.join(" | ")}</p>
        </div>
      </section>

      <section className="mini-grid">
        <MetricCard label="Current revenue" value={formatCurrency(detail.currentYearRevenue)} />
        <MetricCard
          label="YoY growth"
          value={formatSignedPercent(((detail.currentYearRevenue - detail.priorYearRevenue) / detail.priorYearRevenue) * 100)}
        />
        <MetricCard label="Website" value={detail.website} />
      </section>

      <section className="two-col">
        <div className="panel-subcard">
          <span>Revenue mix</span>
          <div className="bars">
            {detail.revenueMix.map((bucket) => (
              <div key={bucket.label} className="bar-row">
                <label>{bucket.label}</label>
                <div className="bar-track">
                  <div className={`bar ${bucket.tone}`} style={{ width: barWidth(bucket.value) }} />
                </div>
                <strong>{bucket.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-subcard">
          <span>Peer frame</span>
          <div className="peer-list">
            {detail.peerBenchmarks.map((item) => (
              <div key={item.label} className="peer-item">
                <label>{item.label}</label>
                <strong>
                  {item.orgValue}
                  <span> vs {item.peerMedian}</span>
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bullet-grid">
        <div className="bullet-card">
          <span>What stands out</span>
          <ul>
            {detail.topSignals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="bullet-card warn">
          <span>Watchouts</span>
          <ul>
            {detail.watchouts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ScenarioMemoScreen({
  row,
  detail,
  scenario,
  onBack,
}: {
  row: ScreenerRow;
  detail: OrgDetail;
  scenario: (typeof scenarioResults)[keyof typeof scenarioResults];
  onBack: () => void;
}) {
  return (
    <div className="panel scenario-grid">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Screen 3</p>
          <h2>Scenario + Memo</h2>
        </div>
        <button className="secondary" onClick={onBack}>
          Back to detail
        </button>
      </div>

      <section className="scenario-hero">
        <div className="detail-card">
          <span>Scenario</span>
          <strong>{scenario.title}</strong>
          <p>{scenario.assumption}</p>
        </div>
        <div className="detail-card highlight">
          <span>Recommendation</span>
          <strong>{scenario.recommendation}</strong>
          <p>{scenario.riskShift}</p>
        </div>
      </section>

      <section className="mini-grid">
        <MetricCard label="Projected reserve" value={`${scenario.projectedReserveMonths.toFixed(1)} months`} />
        <MetricCard label="Projected growth" value={formatSignedPercent(scenario.projectedGrowth)} />
        <MetricCard label="Memo audience" value={memoContext.audience} />
      </section>

      <section className="memo-layout">
        <div className="panel-subcard">
          <span>Memo context</span>
          <p className="body-copy">{memoContext.ask}</p>
          <div className="tag-row">
            <Tag label={`Horizon: ${memoContext.timeHorizon}`} />
            <Tag label={`Portfolio org: ${row.organizationName}`} />
            <Tag label={detail.missionArea} />
          </div>
          <ul className="compact-list">
            {memoContext.constraints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="panel-subcard">
          <span>Talk track</span>
          <ol className="compact-list ordered">
            {memoContext.talkTrack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="evidence-box">
            <span>Evidence anchors</span>
            <ul>
              {scenario.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="footer-note">
        <strong>{heroCaseStudy.headline}</strong>
        <p>{heroCaseStudy.whyItMatters}</p>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="tag">{label}</span>;
}
