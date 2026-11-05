# Prompt 05 feature comparison

This is a workflow-level comparison against public kAInet pages captured through REA. It does not reproduce private code or assert parity with the inaccessible product backend. See [the evidence record](./kainet-rea-evidence.md).

| Publicly observable / advertised kAInet concept | Tandem Ads Campaign Studio implementation | Status and boundary |
| --- | --- | --- |
| Guided direction for goals, budgets and targeting | Eight-step brief wizard for platform, objective, business, audience, budget, creative direction, brief review and simulation | Implemented locally; saved workspace record is required before simulation |
| Campaign structure covering platform-specific fields | Google Search draft hierarchy with ad groups, keyword themes and responsive search copy; Meta campaign/ad-set/ad structure | Implemented as editable planning data; no provider-side validation |
| Multiple copy/creative variants | Deterministic industry-aware simulation with editable headline, description and Meta copy fields | Simulated; no live AI, no image-generation API |
| Human review before launch | Workspace review timeline, change requests, revision-bound owner/admin approval | Implemented in Tandem Ads; approval does not mean provider approval |
| Dashboard and post-launch visibility | Persisted demo publishing attempts and scenario metrics, shown in a separate analytics area | Simulated data only; never combined with real provider reports |
| Direct Google/Meta launch described by reference site | Local `demo_` publishing attempt with explicit “Not live on Google Ads or Meta Ads” result | Simulated; no real ad account, external call or spend |
| Dashboard sample on public homepage | Tandem dashboard uses saved campaign counts and only shows demo analytics when records exist | Real counts require the campaign migration and hosted workspace schema to be deployed |

## Product choices

- Tandem Ads uses its existing sixteen-industry workspace catalogue; there is no real-estate-only default.
- Generated copy carries `AI Simulation` and a stable seed/version. The timestamp records when that stored draft was generated.
- Metrics carry `Simulated Data — Not Actual Ad Performance` provenance and are persisted separately from campaign structure.
- The existing Prompt 04 OAuth/ad-account routes are disabled in the demo server mode so accidental credentials do not activate provider calls.
- The app does not create sample campaigns or performance totals for existing workspaces.

