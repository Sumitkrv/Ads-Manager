# Prompt 09 — REA public reference research

Research date: 2026-10-28. REA MCP 6.8.0 was used only against public kAInet marketing pages. No sign-in, private customer area, provider account, or external advertising action was used.

## Calls and evidence

| REA call | Target | Evidence | Scope |
| --- | --- | --- | --- |
| `capture_browser_scenario` (current Prompt 09 pass) | <https://www.kainet.tech/features> | `ev_822dbf7f10a24b33c9058d3520d410c6a194dbe182d6a789f64b46e106453a02` | Controlled Chromium replay of the public page; visited and waited for public content; retained URL/action evidence. This pass did not retain DOM or screenshots. |
| `capture_browser_scenario` (reused Prompt 08 evidence) | <https://www.kainet.tech/> | `ev_027cc587017331a91954b9f2d7573355d892775293a65340710e57a3194f1876` | Public homepage capture. |
| `capture_browser_scenario` (reused Prompt 08 evidence) | <https://www.kainet.tech/features> | `ev_e3c54bae91a47d5d92d82445f005b31ce2b6fa964525b8e7e914b7e038c425fd` | Public features page with retained DOM, accessibility content and screenshot evidence; see `prompt08-rea-analysis.md` for capture details. |

The reusable captures and this pass concern marketing content only. They do not establish private agency-dashboard behavior.

## Findings by evidence class

### OBSERVED

- Public pages organize product messaging around campaign workflows and review concepts.
- The features page presents cross-platform advertising and unified performance visibility as product concepts.
- The page hierarchy uses a marketing navigation, feature sections and calls to action. These are public website observations, not observations of an authenticated agency workspace.

### ADVERTISED

- The site advertises campaign management across Google and Meta and reporting concepts such as spend, impressions, clicks, CTR and CPC.
- Public product messaging describes review/approval as part of campaign work.
- These are claims made by the marketing site; the captures do not prove provider operations or private product implementation.

### INFERRED

- Agency work benefits from a portfolio-level view that links client identity, assigned staff, open reviews and recent activity.
- Client authorization should remain explicit and independent from an agency's organizational relationship.
- A request/accept flow is clearer than immediately exposing a client's workspace after an agency enters its identifier.
- Relationship, membership and assignment status should be shown as separate concepts.

These are Tandem Ads design decisions, not claims about kAInet internals.

### UNAVAILABLE

- No public agency command center, client portal, team assignment screen, invitation lifecycle, client comments, task manager, or client-specific access model was observable.
- Private approval behavior, tenant architecture, RLS policies, notifications, data model, and agency permissions were not available from public pages.
- No competitor source code, private account, or customer data was inspected.

## Original Tandem Ads decisions

- Model agency and client as separate existing workspaces, with a relationship record that does not itself authorize client-data access.
- Require current user membership in both workspaces for agency collaboration records and require client-workspace membership for client records and client-context navigation.
- Require client-owner consent for agency-originated requests. Client-issued requests require agency-owner/admin acceptance.
- Track memberships provisioned by an agency-client invitation so relationship revocation can remove only those grants; preserve independently held memberships.
- Keep invitation secrets single-use and hashed in storage. Create an in-app invitation link and explicitly state it was not emailed.
- Keep client-visible comments separate from internal agency notes at the database policy boundary.
- Reuse the existing campaign, creative, report, notification and theme systems rather than creating parallel product modules.

