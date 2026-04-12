# Agent-First Build Plan: Tipping Point, the Nonprofit Resilience Copilot

## Summary
- Build an agent-executed submission for funders/advisors that answers: `who is resilient`, `who is at tipping risk`, and `which intervention most improves the outlook`.
- Treat 990 XML normalization as the foundational workstream. No downstream modeling, benchmarking, or copilot output should begin from raw filings.
- Keep the winning core fixed: `clean canonical panel + Resilience Score + Tipping Risk + Scenario Simulator + Memo Copilot + polished visual demo`.
- Use concurrent agent workstreams with one leader agent coordinating, integrating, and running Ralph loops until the full system self-verifies and is ready for human final review and pitch.

## Public Interfaces And System Shape
- Frontend: `Next.js + TypeScript` web app with three pages only: `Portfolio Screener`, `Organization Detail`, and `Scenario + Memo`.
- Analytics: Python pipeline that produces versioned artifacts for `canonical org-year panel`, `scores`, `driver explanations`, `scenario outputs`, and `hero case studies`.
- Data contract: define typed JSON artifacts for `screener row`, `org detail`, `scenario result`, `memo context`, and `demo case study`.
- Copilot: Fireworks-hosted Qwen used only for constrained narrative generation over structured evidence; deterministic fallback templates are required for every copilot output.
- Scoring framework: fixed eight-signal model covering revenue growth, revenue volatility, operating stability, liquidity/reserves, concentration risk, net asset trend, employee stability, and shock recovery.

## Ordered Agent To-Do List
1. Leader agent initializes the task graph, repository skeleton, artifact contract, acceptance criteria, and worktree boundaries for all worker agents.
   - Lock the non-negotiable scope: no generic BI tool, no raw-filings explorer, no causal claims, no more than three app screens.
   - Create the shared definition of done for data quality, normalization quality, model quality, app quality, copilot quality, and submission quality.
   - Assign disjoint ownership: `990 normalization`, `feature engineering`, `modeling`, `scenario engine`, `frontend`, `copilot`, `QA/e2e`, and `story/submission`.

2. 990 normalization agent builds the canonical ingestion layer from the raw XML corpus.
   - Download or mount the Google Drive XML source into a reproducible raw-data location.
   - Catalog form variants, year coverage, schema drift, malformed filings, duplicate submissions, amended returns, and missing schedules.
   - Parse filings into a normalized intermediate representation with stable field names, source provenance, filing year, EIN/org identifier, and parse-confidence metadata.
   - Resolve inconsistent tag names, alternate line-item locations, namespace drift, year-specific field changes, and common XML corruption patterns.
   - Emit a normalization manifest documenting every mapped field, fallback rule, dropped field, unresolved anomaly class, and parse failure bucket.
   - Produce a canonical `org-year` base table plus a machine-readable data dictionary that all downstream agents must consume.

3. Feature-engineering agent builds the analytical panel only from normalized outputs.
   - Create lagged, rolling, ratio, and peer-relative features from the canonical base table.
   - Standardize missing-value policies by feature family and mark imputed vs observed values explicitly.
   - Produce a feature QA report covering null rates, distribution shifts, leakage checks, and cohort coverage.

4. Modeling agent builds the scoring and risk system on top of the canonical panel.
   - Define the `healthy`, `fragile`, and `tipping` labels using only fields actually present and stable enough after normalization.
   - Train a strong tabular baseline and then a stronger production candidate; keep both for comparison.
   - Output `Resilience Score`, `Tipping Risk`, peer benchmarking, and top driver explanations for every organization.
   - Reject any model that cannot explain why a nonprofit was ranked high or low.

5. Scenario-engine agent builds the intervention simulator in parallel with modeling.
   - Implement controlled scenario levers such as reserve grant, diversification improvement, margin improvement, and staffing stabilization.
   - Recompute projected score deltas from structured input changes only; every output must be labeled as a forecasted scenario, not causal truth.
   - Generate reusable scenario artifacts for both the app and the deck.

6. Frontend agent scaffolds and finishes the visual demo app in parallel with the analytics work.
   - Build the three fixed screens against mocked typed fixtures first.
   - Create a bold, presentation-friendly visual system that reads clearly in both live use and recorded video.
   - Swap mocks for real generated artifacts once the data contract stabilizes.
   - Ensure the app can run entirely from precomputed JSON so demo reliability does not depend on live analytics execution.

7. Copilot agent builds the constrained advisor-assistant layer.
   - Support only four intents: `why flagged`, `what changed over time`, `best intervention`, and `draft advisor memo`.
   - Force prompts to consume structured evidence objects, not arbitrary raw data.
   - Build deterministic fallback generation for every intent so the app stays fully functional without the external API.
   - Add explicit output checks for hallucinations, unsupported claims, and mismatch with structured evidence.

8. Story/submission agent prepares the narrative artifacts once early outputs exist.
   - Select three hero nonprofits: resilient leader, tipping-risk case, and intervention-worthy turnaround candidate.
   - Draft the round-one slide deck, five-minute script, README, architecture summary, and product one-liner.
   - Pull screenshots, charts, and app flows directly from generated artifacts so the story stays consistent with the product.
   - Prepare a final human-facing pitch brief with the exact demo sequence and likely judge questions.

9. QA/e2e agent builds comprehensive self-verification before integration is considered complete.
   - Add schema and contract tests for every artifact exchanged between Python and Next.js.
   - Add parser and normalization tests for malformed XML, namespace drift, year-specific fields, duplicate filings, amended returns, and partial records.
   - Add unit tests for feature generation, label logic, peer benchmarking, explanation output, and scenario math.
   - Add integration tests that regenerate artifacts from raw XML and confirm the app consumes them without manual edits.
   - Add browser E2E tests covering the primary demo path, fallback copilot behavior, and failure handling.
   - Add a submission packaging test that confirms the deck, video script, code, README, and demo assets are all present and internally consistent.

10. Leader agent performs the first Ralph loop on normalization quality.
   - Review parse coverage, unresolved anomaly classes, field mapping confidence, and canonical table completeness.
   - Reassign fixes to the normalization and feature agents until the raw XML corpus is converted into a trustworthy analytical base.
   - Freeze the canonical schema only after downstream agents confirm it is stable enough for modeling and app contracts.

11. Leader agent performs the second Ralph loop on analytics quality.
   - Review the data quality report, model comparison, explanation sanity, and scenario outputs.
   - Reassign fixes to the relevant agents until all analytics acceptance gates pass.
   - Freeze the feature set and label definition once the results are defensible and stable enough for storytelling.

12. Leader agent performs the third Ralph loop on product integration.
   - Review artifact contracts, frontend rendering, latency, copy quality, and copilot grounding.
   - Reassign fixes until the app is visually polished, demo-stable, and fully operable in fallback mode.
   - Freeze the app scope after the three-screen flow is clean end to end.

13. Leader agent performs the fourth Ralph loop on end-to-end submission readiness.
   - Run the full demo path exactly as judges will see it: screen portfolio, inspect nonprofit, run scenarios, generate memo, close with hero story.
   - Verify the story, charts, app output, README, and final package all tell the same truth.
   - Reassign final repairs until the system passes every automated and scripted acceptance check without human intervention.

14. Human handoff happens only after the leader agent certifies readiness.
   - Return one final package containing the runnable app, generated artifacts, normalization manifest, test results, deck draft, pitch script, README, and a short list of residual caveats.
   - Humans then do final spot-checking, record/present the pitch, and answer live questions.

## Ralph Loop Rules
- A Ralph loop means: `execute -> inspect outputs -> compare against acceptance criteria -> open targeted repair tasks -> rerun -> repeat until pass`.
- Use Ralph loops for normalization, data cleaning, model tuning, app integration, and submission packaging.
- The leader agent owns loop entry and exit criteria; worker agents only close tasks when they attach evidence that the relevant gate now passes.
- Do not exit a Ralph loop on “looks good.” Exit only on passing artifacts, passing tests, and a coherent demo narrative.

## End-To-End Test Plan
- Raw XML tests must verify file discovery, year coverage, namespace handling, schema drift handling, corrupted-file quarantine, duplicate detection, and provenance retention.
- Normalization tests must verify that canonical fields resolve correctly across form/year variants and that unmapped values are surfaced in the manifest instead of silently dropped.
- Data pipeline tests must verify schema validity, duplicate resolution, missingness thresholds, outlier handling, reproducibility from raw XML to canonical panel, and stability of identifier linkage across years.
- Model tests must verify baseline comparison, score range sanity, rank stability on reruns, explanation alignment with score direction, and no use of leakage fields.
- Scenario tests must verify each intervention changes only its intended variables and produces plausible directional movement.
- Copilot tests must verify prompt grounding, citation of structured evidence, fallback behavior when Fireworks is unavailable, and rejection of unsupported claims.
- Frontend tests must verify filter behavior, organization detail navigation, scenario recalculation, memo generation, empty/error states, and mobile-safe rendering for recorded demos.
- Full browser E2E tests must cover the exact five-minute demo storyline with both `API available` and `API unavailable` modes.
- Final acceptance requires:
  - all automated tests green,
  - one clean end-to-end local app run from raw XML through generated artifacts,
  - three validated hero case studies,
  - a deck and script consistent with live product behavior,
  - a final leader-agent verification report summarizing what passed and any residual risks.

## Assumptions And External Resources
- Humans will not spend meaningful time implementing features; they may provide dataset context, optional API credentials, final spot-checking, and live pitching.
- The core build uses only the released 990 dataset; outside data is optional and should not block completion.
- The product is for funders/advisors, not mass-market donors or nonprofit operators.
- The copilot is a value-add, not a dependency; the product must remain strong if all LLM calls are disabled.
- Needed for execution:
  - Access to the `Hackathon Student Files` Google Drive folder through the Codex Google Drive plugin so the raw 990 XML corpus can be inspected and pulled into the pipeline.
  - A Fireworks API key if you want the live copilot path enabled.
  - Any organizer-provided field dictionary, sample filing notes, or business problem document, if available.
- No other external APIs are required for the core system.

## Note
- The Codex Google Drive plugin now provides access to the `Hackathon Student Files` folder, so the normalization workstream can begin directly from that corpus instead of waiting for a synced local copy. The first execution step is to inventory the folder contents, confirm the raw XML structure, and start the reproducible ingest/normalization pipeline from there.
