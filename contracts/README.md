# Hackathon contract shapes

These are the mocked handoff shapes for the frontend foundation.

- `ScreenerRowContract`: one row in the portfolio screener table.
- `OrgDetailContract`: a single organization detail payload.
- `ScenarioResultContract`: the output of the scenario evaluator.
- `MemoContextContract`: the narrative context used to write the memo.
- `HeroCaseStudyContract`: the featured case used in the demo hero.

The `required` arrays in `hackathon-contracts.ts` are the JSON-schema-ish part of the contract and are meant to make backend integration explicit without depending on a live API yet.
