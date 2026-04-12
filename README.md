# **Data** hackathon playbook

This README combines the official problem statement, Aggie Hacks slide deck, judging rubric, dataset brief, and kickoff guidance into one win focused checklist.

## **Goal** of the hackathon

Nonprofit leaders and funders make high stakes decisions with messy incentives and thin reserves. IRS Form 990 is public, but raw filings are hard to use. The point of this project is to turn years of 990 style data into simple, transparent, decision ready insight so people can see who is financially durable, who is fragile, where shocks hurt, which peers matter for comparison, and where more dollars would actually change outcomes (including smaller “hidden gem” charities). Sponsor Fairlight Advisors cares because they advise nonprofits on financial resilience; your work should speak to that world, not only to a grading rubric.

## **Fairlight** Advisors: what they actually do

Fairlight is a for-profit advisory firm that works with nonprofits on their finances: Maya Tussing (kickoff) described them as firms that advise and manage financial assets for nonprofits, not as a charity and not as a generic donor. Deborah Finestone is business development and marketing (slide deck), which fits a firm that takes on clients and grows relationships.

What they need from analytics (from sponsor Q&A, problem framing, and how the rubric is written):

- See financial reality clearly: durability, risk, reserves, revenue mix, trends over years. A single Form 990 year is not enough for them to decide whether to pursue an organization (Maya, kickoff).
- Compare like to like: peer and sector norms matter so conversations are grounded, not vibes.
- Prioritize effort: who looks like a plausible long-term advisory or asset-management relationship versus who is chronically thin or a bad fit for that kind of engagement. Maya also stressed which orgs might someday build invested reserves (many never get there).
- This is not “growth VC for charities only.” Growth and strength matter, but so does stability, shock risk, and where attention or capital has leverage (the broader prompt). Fairlight’s angle is advisory and asset management for nonprofits.

The 40% business insights block has four parts (peers, business problem, financial insight including usefulness to Fairlight, depth). Only the financial insights sub-part asks you to say explicitly how findings help Fairlight; the other parts are general business quality. One or two concrete sentences in the deck or memo usually covers it if your product already targets resilience, benchmarking, or risk.

## **How** you win (in one pass)

Winning is not “the fanciest model.” It is the team that scores highest on the official rubric: a clear business question and success criteria, a defensible definition of peers for benchmarking, insights tied to code judges can verify, methods you can justify from EDA, recommendations that help Fairlight’s context, a usable story with visuals and business impact up front, and honest depth (evaluation, non obvious insights). Slide deck plus video plus code must show you understand your own product. Extra awards cover storytelling, presentation, and mixed MSBA or MBA teams.

## **Winning** shape: peer “genres” and comparisons

Yes, that mental model is aligned with how you score. The rubric does not use the word genre, but it requires you to define who counts as a peer and to explain why orgs sit in the same bucket or in different buckets. In practice that usually means building segments (mission or industry type, size band, geography, sometimes cluster labels you can defend) and then comparing within and across those segments.

What that can look like in the deliverable:

- Tables or dashboards of nonprofits within each segment with a few financial metrics (liquidity, margin, revenue diversity, trend flags) and where each org sits vs the segment median or percentile (problem statement asks for peer benchmarking by sector, size, geography).
- Outliers: who beats peers and who trails, with a sentence on why that might matter for resilience or risk.
- Not genre alone: the same rubric asks for a business problem, depth, and Fairlight usefulness. So “we classified everyone” is weaker than “within each genre we rank risk or resilience and show who needs attention.”
- Machine learning clusters can be one way to define groups if you name and justify them so judges see business meaning, not only silhouette scores.

So: putting nonprofits in comparable buckets and scoring them **against those buckets** is a strong center of gravity for a winning project, as long as you tie it to outcomes (risk, durability, shock, or high-impact discovery) and document the peer logic clearly.

## **Insights** you are hunting (what “good” looks like)

You are trying to produce insight a nonprofit ED, a program officer, or Fairlight could act on. Form 990 and linked sources give money, time, and structure: revenues by type, expenses, balance sheet strength, filing history, sector or geography, and sometimes audit flags. “Insight” here means a repeatable readout, not a vibe.

Examples of insight types that match the four pillars:

- **Resilience:** Which organizations look stable on cash and revenue over 7 years versus which show shrinking unrestricted net assets, rising reliance on one revenue type, or volatility that predicts distress. Drivers might include concentration of government grants, program versus admin mix, or trends in reserves.
- **Peers:** For a given org or segment, what is “normal” for liquidity, growth, or cost structure versus same sector, size band, and region. Who is an outlier and in which direction (strong or weak).
- **Shocks:** If a major stream drops (for example grant cut scenario you define), which orgs cross a danger threshold first, and which paths (cost cuts, diversification) the data can partially support.
- **High impact / hidden gems:** Smaller or mid size charities where financials suggest efficient mission spend or room to scale with new dollars versus mature orgs where marginal gifts barely move outcomes (the prompt’s contrast between large national brands and smaller expanders).

Judges want findings that are **grounded but not obvious** (rubric language): not only “nonprofits need diversified revenue,” but which segments in **your** panel show measurable thresholds and **who** lands on each side.

## **Example** business questions you can actually scope

You must pick **one** coherent question, define **peers**, and state **success criteria** (rubric). The official example is narrowing to a slice such as California charities in a specific niche; the logic applies to any defensible slice.

Archetypes that fit the data:

1. **Risk score or early warning:** “Among [peer definition: e.g. human services, $2M to $10M revenue, Western states], which EINs show patterns over 7 years associated with later financial stress, and what three drivers matter most?” Success: calibrated alerts or ranks you can explain to a funder.
2. **Benchmark board pack:** “For each nonprofit, report percentile rank versus peers on liquidity, margin, and revenue diversity, flag top and bottom deciles.” Success: a clear comparison story Fairlight could use in a client review.
3. **Shock playbook:** “If federal or state grants fall by X% for [segment], how many orgs fall below a liquidity floor you define, and which counties are densest?” Success: scenario outputs tied to real line items in the data.
4. **Donor leverage:** “Where does an incremental dollar plausibly expand program scale (hidden gems) versus support steady state operations?” Success: explicit criteria (size, growth, efficiency proxies from 990 fields) and a short list or ranking.
5. **Foundation only (separate track):** “Among 990-PF filers only, what predicts sustained payout or asset growth?” Only if you isolate foundations and never mix them with public charities in the same benchmark.

Pick the arc that matches your cleaned features and your story. Weak projects jump across all four pillars with no single question; strong projects answer one question well and touch the other pillars only where they support that answer.

## **What** winning means here

Your solution should be simple, transparent, and decision ready for nonprofit leaders, funders, and capacity builders. Judges tie claims to your code: insights must match the models and features you ship, with business interpretable choices.

If you use AI to write code, know what it did (kickoff).

Round one expects your slide deck, a video, and code to judges so they can score depth, tool quality, and whether you understand your build (kickoff).

## **How** scores break down

Official rubric weights:

Business insights (40%), four blocks of 10 points each:

1. Peer benchmarking: You define who counts as a peer or baseline for resiliency. You may use all nonprofits or a subset, but you must explain why a group is treated the same or differently. Points come off if that logic is wrong or vague.
2. Business solution: Clear business problem, objectives, and success criteria. You may focus on a sub category (example in the rubric: California nonprofits in a narrow niche) if you still define thresholds and show how that answers the business question.
3. Financial insights: Show you understand stakeholders, context, and impact. Stay aligned to the data and questions. Say clearly how the insights would help Fairlight Advisors in that context.
4. Depth of solution: How useful the solution is, level of detail, and how broadly it applies.

Data analysis (20%)

5. Tool accuracy and precision (10): Describe the solution correctly. Judges read code to confirm outputs reflect the model. Features should be intuitive and interpretable with business sense.
6. Model development (10): Appropriate methods, feature selection when it matters, solid evaluation metrics, and justification for the method given the problem. Be ready to cite what EDA led you to that choice.

Solution development (20%)

7. Results (10): Findings are easy to follow and backed by data. Add evaluation of the solution when you can.
8. Level of insights (10): Recommendations fit the problem. Resiliency or threshold findings should be grounded in data but go beyond obvious intuition.

Business storytelling (20%)

Clear, organized, engaging talk for a business audience. Emphasize business impact and monetary outcomes where you can. Use charts, graphs, or dashboards. Be ready to defend the value proposition and answer judge questions.

## **Problem** you are solving

Business context (problem statement): U.S. public charities underpin community well being, but many face funding risk, donor fatigue, and shocks. IRS Form 990 exists, yet leaders and funders still lack accessible tools for resilience, benchmarking, and targeting support.

Core questions the prompt repeats:

- Who is thriving, and what makes a nonprofit financially durable?
- Who is at risk, and what institutional changes build resilience?
- Who deserves attention: thresholds where giving has outsized impact, including hidden gems where a donation expands scope or impact?

Analytical challenge: Use 7 years of IRS Form 990 data for U.S. public charities. Build analytics, models, and tools that stay simple and transparent while covering these four pillars (official problem statement):

1. Resilience prediction: Model or score which nonprofits are most likely to stay financially stable through funding swings. Surface drivers of long term sustainability across sectors and geographies.
2. Peer benchmarking: Compare each nonprofit to meaningful peers by sector, size, and geography. Show departures from norms and call out top performers. Problem notes: find peers in the industry, use ProPublica as one path.
3. Financial risk simulation: Classify income (government grants, donations, program revenue, and so on). Simulate a funding shock, show vulnerability, and outline recovery paths.
4. High impact discovery: Find organizations that deliver disproportionate community value versus budget. Surface hidden gems that deserve more funder attention.

Sponsor context (kickoff, Maya Tussing): Nonprofits are tax exempt; common form is 501(c). Filings are public. If the sector were an industry it would rank third in the United States by size after retail and manufacturing, with about $1.4 trillion in economic activity in 2023, about 13 million employees, and on the order of 2 million organizations. About 4% of organizations generate about 80% of revenue. Healthcare and education (including private universities) were named as two large slices; legal aid, environmental protection, child safety, animal welfare, and immigration were listed as examples of other areas. She wants to see which organizations could build invested reserves; 96% lack enough cushion to do that comfortably. Geography may vary. One Form 990 from a single year is not enough for her firm to decide whether to pursue a client.

## **Dataset** (official brief)

- Who: U.S. 501(c)(3) public charities filing Form 990 or 990-EZ. The written brief says to exclude 990-PF foundations for this phase.
- Time: 7 most recent fiscal years per EIN (rolling panel).
- Sources (open): IRS Form 990 bulk XML (monthly), IRS TEOS bulk files for status and revocations, NCCS Urban Institute Core and E filers for consistent fields and backfill, Federal Audit Clearinghouse (FAC) for Single Audit findings where federal spend is at least $1M (questioned costs, opinions). Optional accelerator: GivingTuesday curated 990 data marts or API for fast prototypes.
- Audit note: Not every charity posts GAAP audits. FAC gives standardized Single Audit material for material federal funding; where audits are missing, Form 990 remains the public machine readable filing.

Canonical download links from `Main Dataset.pdf` are in the table below.

| Source | URL |
|--------|-----|
| IRS Form 990 series bulk | https://www.irs.gov/charities-non-profits/form-990-series-downloads |
| IRS TEOS bulk | https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads |
| NCCS Core | https://nccs.urban.org/nccs/datasets/core/ |
| NCCS e-file | https://nccsgit.urban.org/nccs/datasets/efile/ |
| Federal Audit Clearinghouse | https://www.fac.gov/ |
| CRS context (linked from brief) | https://www.congress.gov/crs-product/IF12965 |
| GivingTuesday 990 (optional) | https://990data.givingtuesday.org/ |

### **Office** hours clarifications (transcript)

**990-PF (private foundations):** These are not the same population as standard public charities (for example many family foundations). The brief excludes PF for this phase so you do not mix or benchmark private foundations together with regular nonprofits in one analysis. You may instead choose a clearly scoped project only on foundations (for example what makes family foundations resilient). Stating that you left PF out of a public-charity model is valid.

**990-EZ:** Short form filers skew smaller (discussion referenced roughly under $500k revenue) and carry less line detail. Organizers said you are free to include EZ filers if you want. A curated build from Jacob applied filters (for example income tiers); in one example, no EZ filers crossed a higher income bar over seven years, so they dropped out of that slice. Treat EZ as optional and know that a team-made extract may already remove small filers by design.

**Raw bulk vs curated upload:** Raw IRS-style sources can contain all form types. A processed “hackathon” file may drop EZ or PF to match the public-charity focus. Upload timing to shared cloud was uncertain in session; organizers said you do not need to wait to begin. Pull a thin sample first.

**Do you need to download everything?** No. Downloading the full bulk archive was described as impractical for one machine. Take one or two bulk files to learn the schema, then scale.

**Is there a secret dataset later?** No. The content is public data assembled from listed sources. Jacob sorted it into smaller pieces for the class. Optional cloud copies of those sources may appear when upload finishes.

**ProPublica:** Speakers said ProPublica is a strong path for exploration and that a message with ProPublica data sources (by industry and nonprofit type) was planned to go out (same week as that session). Check email or Slack if you do not see it.

## **Who** runs it and judges

Student leadership (slide deck): Jacob Renneisen, President, MSBA DSAC. Niti Chirag Patel, Vice President, MSBA DSAC.

Sponsors and judges (slide deck): Maya Tussing (Founder and Partner) and Deborah Finestone (Business Development and Marketing Associate), Fairlight Advisors.

Judges named on the deck: Prof. Prasad Nayak (also listed as Prasad A. Naik on the deck), UC Davis alum Jyothika Mohan, plus Maya Tussing and Deborah Finestone.

Program leadership (kickoff): Eric, executive director, backs the event.

Kickoff also mentioned a Fairlight representative for final round only and other guests; use the deck plus live instructions if they differ.

## **Behaviors** that convert to points

Read the problem statement and know your focus before you touch data (slide).

Budget real time for cleaning. Form 990 is messy (slide and kickoff).

Start simple: a clean working model beats a complex broken one (slide). Kickoff: stress test complex ideas against simpler models (for example gradient boosting or linear forms) until you find what is robust.

Prioritize visualizations and reproducibility. Judges want decision ready insight (slide).

Lead the presentation with business impact, not methods first (slide).

Define peer group methodology clearly for benchmarking (slide and rubric).

Think as a funder or nonprofit leader, not only as a data scientist (slide and kickoff).

Narrative matters as much as the model; tell a clear story (slide).

Document assumptions and model choices. Rubric rewards justified methods and EDA to model choice.

Define metrics and success criteria explicitly.

Run as a team: split work, keep the problem statement first when opinions clash, one owner for deadlines and deliverables.

Time phases with buffers (kickoff). Do not quit; other teams feel the same pressure (kickoff).

## **Official** tips from the slide deck

Same themes as above, repeated for emphasis: read the problem carefully, budget cleaning time, start simple, prioritize viz and reproducibility, lead with impact, define peers, think like a funder or ED, narrative matters.

## **Deliverables** and timing

Video length 5 minutes (kickoff). Slides: no hard cap; aim for about 15 or fewer (kickoff). Full presentation rules ship separately. `AGENTS.md` in this repo adds workspace specifics (for example presentation due time, Q&A length, slide tool); if anything conflicts with an official email or brief, follow the official one.

Office hours (slide): Sunday April 12, 6 to 8 pm. Monday April 13, 3 to 8 pm. You can also reach Jacob and Niti outside those windows (slide).

You may publish after the event; organizers encourage GitHub and LinkedIn; data is public (kickoff). Eric offered marketing or blog connections and noted a photographer Tim may be at the award event.

## **Prizes** and ceremony

Team cash (slide deck):

- Grand Gold Award: $3,000 per team  
- Sterling Silver Award: $2,000 per team  
- Bronze Brilliance Award: $1,000 per team  

Additional awards (slide deck): Best submission by a group, best storytelling, best individual presenter, best presenter, and best mixed team (at least one MSBA and one MBA student on the team).

Ceremony at Spark Social on April 21 (kickoff). Showing up to support classmates was encouraged even if you do not advance.

## **Repository** hygiene for this workspace

Do not commit API tokens or team secrets. Use environment variables or local untracked files.

Cursor agent skills live under `.agents/skills/`. See `AGENTS.md` for agent notes.
