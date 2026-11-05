# Prompt 13 REA research

## Method

REA’s existing MCP browser-scenario provider captured the public kAInet homepage and `/features` page in headless Chromium 156.0.8078.49. The run used a 1280 × 720 viewport, `en-US`, UTC, light color scheme, reduced motion, empty cookie/storage state, and a 1.2 second settle after navigation. It captured DOM, accessibility text and URL. No controls were clicked. Request/response bodies and header values were not captured. These are observations of public pages, not authenticated product behavior.

## Evidence and classification

| Classification | Evidence |
| --- | --- |
| **OBSERVED** | Homepage evidence `ev_cef08f2405d7769c0770eb3e27d9269e70dd66af65740d9dd80a53da38de336a`: public navigation exposes Features, Pricing, Compare and Log in. The page presents an overview, a three-step brief/build/review workflow, a sample performance dashboard, pricing and FAQs. |
| **OBSERVED** | Features evidence `ev_5ea691b5355dfab54e3b1faf7583553996d381ce3a2a45376345a9f1c220da72`: six feature sections cover campaign structure, build acceleration, creative variants, human review before launch, post-launch metrics and generated visuals. Public sections also speak to performance marketers, SEM managers and agencies. |
| **ADVERTISED** | The public pages claim campaign creation and optimization, AI-generated campaign/creative work, Google Ads and Meta support, direct deployment, human approval before launch, and unified performance visibility. These are vendor claims; the capture did not verify private features, integrations or outcomes. |
| **INFERRED** | A product serving marketing teams and agencies benefits from clear account/workspace boundaries, team access controls, workspace defaults and links to brand, billing and collaboration areas. This inference informed Tandem Ads navigation and help text; it is not evidence that kAInet has matching settings screens. |
| **UNAVAILABLE** | No private account, settings, team, invitation or security pages were inspected. No customer data, authenticated session or proprietary source was accessed. The static capture does not establish responsive behavior, form behavior or implementation details. |

The homepage record includes a screenshot; the `/features` record has no screenshot. Both captures report complete DOM/accessibility/URL sections and no selected network content. Browser host platform and architecture were not observed. REA record limitations include receipt-order event reporting and the absence of request initiator stacks.

## Design decisions for Tandem Ads

- Use a dedicated Settings Center with a compact section rail and a visible current-workspace label.
- Separate personal preferences from workspace-wide settings so one person’s appearance or date choices do not silently change another member’s view.
- Place workspace role restrictions on both the UI and server/database paths.
- Keep existing Brand Kit, Billing, Agency Command Center and Integration Status as destinations instead of cloning their workflows.
- Use clear review and confirmation language for invitations, industry changes and closure requests.
- Keep invitations visibly manual: link creation is not email delivery.
- Use restrained dark/light styling, concise forms, status feedback and a horizontal settings navigation on smaller screens.

No kAInet page was used as a visual or code template.
