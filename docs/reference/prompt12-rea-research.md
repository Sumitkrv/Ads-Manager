# Prompt 12 — Public reference research

Research date: 2026-10-29. REA’s controlled browser scenario capture was used against the public kAInet homepage and Features page. The captures used an owned Chromium session and recorded the public page output. No account was created, no login was attempted and no private customer content was inspected.

## Actual REA calls

| REA tool | Target | Evidence | Result |
| --- | --- | --- | --- |
| `mcp__rea__capture_browser_scenario` | `https://www.kainet.tech/` | `ev_fefe6cf23a22260e7f495291efb76e15fa1b3e2372672d0fe44174671f9e88e` | Public homepage DOM/accessibility evidence and final URL were captured. |
| `mcp__rea__capture_browser_scenario` | `https://www.kainet.tech/features` | `ev_65dbb7c89678cdb93464982c31448d5cc77fdb72eb636ddc167b8b4f5fed0b79` | Public feature page DOM, accessibility tree, screenshot and final URL were captured. |
| `mcp__rea__capture_browser_scenario` | `https://www.kainet.tech/features` | `ev_4ed36b140064fb6cd92e50b1ff2f5ceeb95acd250e22a3397789eca1e5658bb3` | Step-level artifact inspection confirmed DOM and accessibility were captured after the render wait. |
| `mcp__rea__capture_browser_scenario` | `https://www.kainet.tech/features` | `ev_89403a1acf7c9777936c58f8c024f8b9c69dd3a30f06631f16bf56b1a2dac223` | Follow-up owned-Chromium capture confirmed the feature page accessibility tree, DOM and final URL. No control was activated. |
| `mcp__rea__capture_browser_scenario` | `https://www.kainet.tech/features` | `ev_056f9c2dd7311aad07caaf50796cbc0a4f4868e2d67fc0fbbf7c6a0fcd2c3715` | Current follow-up captured rendered feature headings and accessibility text with owned Chromium. No control was activated. |

The installed REA MCP browser scenario tool was called directly. The captures waited for the pages to render. No CTA, form, login flow, campaign controls or approval button was activated, so this evidence describes publicly rendered content rather than product behavior. Earlier REA observations in [kAInet public reference evidence](kainet-rea-evidence.md) and [Prompt 11 research](prompt11-rea-research.md) are retained as related evidence.

## Findings by evidence class

### OBSERVED

- The homepage presents a short staged campaign story using “Set Direction,” “Build Automatically,” and “Review & Launch.”
- Public page content positions the product around Google and Meta campaign work and displays a dashboard-style reporting example.
- The Features page groups public product descriptions around campaign structure, faster building, creative testing, human approval, and performance visibility.
- The public marketing pages describe use by agencies and marketing teams.
- This capture was a static page inspection. No public workflow interaction was observed.

### ADVERTISED

- kAInet markets campaign planning/building, creative generation/testing, human review, launch and unified performance reporting.
- The Features page advertises AI-assisted creative and multi-client agency use.
- Feature copy describes campaign architecture using objectives, ad groups, budgets, bid strategies and targeting. Cards also advertise faster campaign building, creative variations, human review before publishing and post-launch metrics.
- These statements are public marketing claims. The captures do not verify whether private account, provider, approval, billing or reporting operations behave as described.

### INFERRED

- A guided brief can reduce the amount of campaign setup users face at once.
- Clear transitions between planning, building and review help users understand where a draft stands.
- Tandem Ads benefits from making saved state, authorization, demo publishing and simulated metrics visible beside the relevant actions.

These are product design inferences for Tandem Ads. The implementation uses an original workspace setup flow and the existing Campaign Studio; it does not reproduce kAInet's page composition or claim recovered private behavior.

### UNAVAILABLE

- Authenticated signup, onboarding, campaign creation, creative editing, review and publishing behavior.
- Private workspace, agency, role, invitation, billing, tenant-isolation and admin details.
- Responsive behavior across device sizes, motion behavior and the result of interactive public controls.
- Internal generation models, API calls, provider account state and real campaign performance.

An initial summary pass displayed the `scenario_start` artifact states (`not_requested`) before showing the rendered step. Step-level inspection then confirmed DOM and accessibility were captured for the rendered Features page. The evidence rows above refer to those captured page artifacts.

## Tandem Ads design decisions

- Use the reference's public high-level path as inspiration while retaining Tandem Ads terminology, components, permissions and existing modules.
- Split setup into short steps, persist drafts and let authorized users enter workspace features before the activation checklist is complete.
- Treat campaign generation, review, publishing and analytics as Tandem Ads local simulation records. State that no Google or Meta campaign is published and no ad spend occurs.
- Use role-scoped tours and help content that explain current Tandem Ads behavior rather than implying kAInet internals are known.
