# Prompt 07 — REA public reference findings

Research date: 2026-10-28. REA MCP 6.8.0 was used against public kAInet pages in an owned temporary Chromium profile. The inspection did not sign in, submit forms, inspect private sessions, or extract source code.

## REA calls made

| Tool | Public URL | Evidence ID | Capture boundary |
| --- | --- | --- | --- |
| `capture_browser_scenario` | [kAInet homepage](https://www.kainet.tech/) | `ev_3e875e6bc5070f71a5634248e78e5356fcff71038ad52e4709806a1b5c86a29e` | Chromium 156.0.8078.49; launch mode; final URL captured after a 1.2 second wait. No controls were activated. |
| `capture_browser_scenario` | [kAInet Features](https://www.kainet.tech/features) | `ev_91f935ddd75ffe6a64b3615d6a990249899af5c28bc1ef2bab0345fbb9709b2b` | Chromium 156.0.8078.49; URL, DOM, accessibility tree and screenshot captured. Screenshot SHA-256: `e39bb4f55d36f74f35092b931d2f0d4b88df3fa9bfe7391c07f8ccafb0fb5681` (140,423 bytes). No controls were activated. |

Existing public-page observations are also recorded in [the reference evidence](kainet-rea-evidence.md), [Prompt 05 comparison](prompt05-feature-comparison.md), and [Prompt 06 research](prompt06-rea-research.md).

## Findings

### OBSERVED

- The public marketing pages use a staged product story and organize feature claims into campaign building, creative output, review and reporting concepts.
- The Features page was captured with DOM and accessibility information plus a screenshot; the homepage capture in this run retained only its final URL.
- The public pages present a polished workflow narrative. These captures did not test the advertised workflows.

### ADVERTISED

- kAInet publicly describes campaign creation for Google Ads and Meta, creative variations, human review, launch, and post-launch visibility. These are marketing claims, not verified provider operations.

### INFERRED

- An optimization product benefits from separating the observed measurement, the rule that triggered a suggestion, and the approval action.
- Showing current and proposed demo budgets side by side makes a scenario easier to review than presenting a single projected value.
- A compact automation sequence—manual trigger, typed condition, internal action, approval and history—keeps local automation understandable.

These are Tandem Ads design judgments based on the public product presentation and the Prompt 07 requirements; they are not descriptions of kAInet's private algorithm.

### UNAVAILABLE

- No authenticated customer dashboard, optimization recommendations, budget scenarios, automation builder, private reporting data, or campaign approval system was exposed by the public captures.
- The private optimization model, backend, provider calls, account state and customer analytics were not inspected.
- No responsive breakpoint comparison or interactive control behavior was tested in these two captures.

## Tandem Ads design decisions

- Recommendations are deterministic rules over persisted simulated analytics and include supporting evidence and limitations.
- Budget projections are labeled as scenarios, not forecasts; applying an approved scenario edits only a Tandem Ads demo draft.
- Automation accepts a strict typed condition schema, executes manually, persists the matched inputs, and keeps material actions behind workspace approval.
- Creative comparison shows an insufficient-data state because campaign-level metrics are not associated with individual creative revisions.
- No advertising provider or external AI endpoint is invoked.
