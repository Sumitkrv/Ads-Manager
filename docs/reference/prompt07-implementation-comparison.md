# Prompt 07 — implementation comparison

This comparison uses only the public kAInet evidence listed in [Prompt 07 REA findings](prompt07-rea-findings.md). It does not claim access to kAInet's private dashboard, optimization engine, or customer data.

| Public reference concept | Tandem Ads implementation | Status and boundary |
| --- | --- | --- |
| Public workflow messaging around campaign performance | Workspace-scoped Optimization overview from stored demo-published campaign records | Implemented locally; metrics are explicitly simulated |
| Optimization and creative improvement claims | Deterministic rules with thresholds, source measurements, proposed action, tradeoffs, confidence and limits | Offline rule-based intelligence; not machine learning, a provider forecast, or a guarantee |
| Performance comparison | Seven-day metric summaries and same-currency comparison helpers | Calculations are local; mixed currencies are rejected; creative-level attribution is unavailable |
| Budget planning | Persisted scenario, baseline/projection, revision-bound approval, and demo-only apply | Scenario is not a prediction; no provider budget changes occur |
| Automation messaging | Workspace-owned typed rules, manual test/run, idempotent execution records and approval | No scheduler/worker, arbitrary code, outbound network, or provider action |
| Human review concepts | Role-checked recommendation and scenario decisions, stale-version checks, execution history, internal notifications | Owners/admins approve; editor can manage but not approve; viewer is read-only |
| Reporting presentation | Simulated metric summaries, a budget comparison, and per-campaign daily CTR/spend line charts derived from stored daily inputs | Trend points are validated and limited to 14 days; no cross-currency aggregate or creative-level performance chart is shown without valid creative-level data |

## Implemented and tested locally

- API routes under `/api/workspaces/:workspaceId/optimization`, `/automation`, and `/notifications` use a verified bearer token, current workspace membership and centralized capability checks.
- An additive local migration persists recommendations, scenarios, automation rule versions/executions, activity and recipient notifications, with RLS and role-checked RPCs.
- The automation builder has editable, disabled starter rules for all 16 workspace industries, with cautious healthcare/finance copy; saved rules can be edited with version checks or duplicated into disabled drafts.
- Prompt 06 direct Storage INSERT/DELETE access was removed; validated server-side uploads use membership-checked, quota-reserved, fixed-bucket operations.
- Offline metric calculation, recommendation rules, scenario math and the rule DSL have unit tests. API tests cover authentication, viewer denial, unsafe action rejection and tenant mismatch.
- Final verification under Node 24: typecheck, lint and production build passed; 59 API tests and 44 web tests passed. Local Supabase pgTAP previously passed 194 assertions across seven files after the last database migration; no database schema changed after that run.
- The local authenticated browser flow covered sign-in, workspace onboarding/industry selection, Google Search draft creation, offline generation, review/approval, demo publishing, Optimization overview, recommendation analysis, budget scenario creation/approval/application, automation rule test/run, and approval/application of a proposed internal action.
- REA controlled-browser evidence IDs: onboarding `ev_6a84097d409d5562967e6321578700e7ceac668753b44b8a778e9b653203ca6f`; demo publish `ev_de4b6e6a664018f4a8b1665ce7fb82b35f974b4843c83c45bbdfbd5765c178d5`; overview `ev_8388ed27a15d2f4787fa8ecd475b58ad93432eb76b72359e246134c42bada16f`; analysis `ev_f0c96857fd89450e306e24a000cff0945fd0412c1f7b70669b5f9aced6e94f5b`; scenario create/submit/approve/apply `ev_83b1a95e3fe121fa083825bd2805baa80207da026526fa95c87025c693b229a1`, `ev_f449345882eab83b25d3d5e6c601cd9288005ebe01e20f468b05006acd48afc9`, `ev_f7ee0a5c26efee5b2942797abeeaa02a19dba8ffeddc6ae2d9689d6b729d8f40`, `ev_9888f4239484ef989bd0bfe9bbc382f03b37eb419919e38c633ebb2faf9f160c`; automation test/run/approval/apply `ev_2c14414b9edf1c8e1f067cc9f9e2540c31a123b5a0496cc16dd73899d33ad1d5`, `ev_797d3da1f00ba19b09894f9fc46f86576eeb1ac7d80ced1e91b9e694a20ffd23`, `ev_cae5e7a05966c9f8726bbe91b08d25a0eec40cbef20c70890622cc25e51dd5a8`, `ev_a65a4c7dfe1c534e99be9b09d65b527bdded12c0687af573edcdd8b96fde5713`.
- A regression found during asset-library verification was fixed: query strings `archived=false` had been coerced to `true`. After rebuilding/restarting the local API, an authenticated list request returned the uploaded private workspace image, and REA opened a fresh browser session and found it after sign-in (`ev_5d20c2295cb6c4e5efd6bcd9a67572a3f8afddb3a4570a2d1fa57aa95b147b24`, screenshot SHA-256 `44e6d155e435d7913e05134e1629ad15396daf32cfb34e43de28d71b093badc0`). An authenticated private signed-URL download returned HTTP 200; the bytes decoded as a 2×2 PNG. The asset was then removed through the authorized application cleanup route.
- Light appearance was selected and observed in REA (`ev_360a12890412d216bb500f6807309f2b2e3061334fa633578eb7a37b807694cd`). System appearance was selected on a 390×844 browser, survived refresh, and resolved to light under the light system preference (`ev_1a729fef098bdce18d80a100067ab9b03f075a139d052a3344b38377ebe4349a`, screenshot SHA-256 `0b1f3a0f2a5cdd631b4cf7875bbb9c28af459c468c334dd43a0dcfb815607bdc`). Theme unit tests also cover Light/Dark/System state and persistence.
- **Not verified in browser:** the signup form itself, every responsive breakpoint, and creative image upload through the browser file picker. Persistent upload and private retrieval were exercised through the authenticated local API, followed by fresh-browser library retrieval.
- Industry automation templates and the newer rule edit/duplicate controls were added after the authenticated REA journey; their data logic is covered by unit/type checks, but those final controls were not recaptured in the browser.

## Simulated and deferred

- All performance figures originate from the existing demo analytics engine and are labeled `Simulated Data — Not Actual Ad Performance`.
- Budget changes alter only `campaigns.brief` in the local Tandem Ads database and invalidate campaign approval; provider state is untouched.
- Manual automation is implemented. Scheduled and event-driven evaluations are unavailable without a persistent worker.
- Creative insights are deliberately an empty/insufficient-data view until creative-specific simulated metrics are stored.
- Google Ads, Meta Ads, OpenAI, Gemini, external messaging and live publishing remain disabled.
- Hosted Supabase migrations remain pending and were not pushed.
- The P07 database migration is additive and was applied only to the confirmed local Tandem Ads Supabase instance for tests; the hosted project was not changed.
- Isolated E2E user, workspace, campaign, scenario, automation records and private test asset were removed from the local instance after verification; no test records were left behind.
- The final trend-chart addition was verified by the daily-point engine test, API/web typechecks, full test suite and production build. REA captured the authenticated Optimization overview earlier in the E2E flow, before the chart component was added; the final chart viewport itself was not recaptured with stored campaign data after cleanup.
