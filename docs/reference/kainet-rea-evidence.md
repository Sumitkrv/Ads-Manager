# kAInet public reference evidence

Research date: 2026-10-28. Scope was limited to the publicly available homepage and Features page. No authenticated sessions, private product UI, source maps, or proprietary source code were inspected.

## REA calls

REA server package and MCP version were reported as 6.8.0. The two page captures used `capture_browser_scenario` in launch mode with an owned temporary Chromium profile, a 1280×720 viewport, one 1.2–1.5 second wait, and only DOM/accessibility/screenshot/URL capture. No buttons were clicked and no forms were submitted.

| Page | REA Evidence ID | Browser result | Retained evidence |
| --- | --- | --- | --- |
| [kAInet homepage](https://www.kainet.tech/) | `ev_bcd005d2e7957d4021d5085d46e2411e72fc10876b38c2d01a81e2eec0bfe113` | Observed controlled replay; Chromium 156.0.8078.48; final URL matched requested page; complete within capture | DOM, accessibility tree, viewport PNG (`58408e3a3a851995e8a0d5c0ad2c5276706024c6a26b7ed766cccfb8fcf22d5a`), URL |
| [kAInet Features](https://www.kainet.tech/features) | `ev_6767edbcb7fa09dd1175ae7765b9740f487236b86037cedff4e232e07726f728` | Observed controlled replay; Chromium 156.0.8078.48; final URL matched requested page; complete within capture | DOM, accessibility tree, URL |

The homepage accessibility tree showed top-level Features/Pricing/Compare/Log in navigation, a guided campaign proposition, “Set Direction / Build Automatically / Review & Launch” sections, and a dashboard example. That dashboard is reference-page sample content, not a verified customer report. The capture did not inspect interactive behavior, responsive breakpoints, authenticated workflows, provider calls, or private implementation.

## Evidence classes

### OBSERVED

- The public pages use a short marketing navigation and a staged product story.
- The homepage visibly presents a three-part path: define goals/budget/targeting, build structure/keywords/interests/demographics/creative, then review and launch.
- The homepage contains a dashboard-like sample with platform and metric labels.
- The Features page groups its claims into campaign structure, build acceleration, creative variants, human review, post-launch visibility, and generated creative.
- Both public pages present calls to action and a visible cookie notice. No CTA was activated in the capture.

### ADVERTISED

The site says kAInet can build Google Ads and Meta campaign structures, generate keywords and copy variants, stage campaigns for human approval, launch after sign-off, and show post-launch metrics. Those are statements made by the public site, not independently verified operations.

### INFERRED

- A campaign builder benefits from a compact guided brief before exposing the detailed editor.
- Separate review and preview surfaces make platform-specific structure easier to inspect.
- Tandem Ads should make demo provenance visible wherever generated content or performance appears.

These are product-design inferences for Tandem Ads, not claims about kAInet's private implementation.

### UNAVAILABLE

- Authenticated campaign creation, editing, account connection, approval, publication, and analytics behavior.
- Internal architecture, API behavior, generation quality, account permissions, and actual provider state.
- A responsive comparison across viewport sizes and the result of the visible CTA controls.

