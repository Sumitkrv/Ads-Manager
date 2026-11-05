# Prompt 06 — REA reference research

Research date: 2026-10-28. REA MCP 6.8.0 was used to inspect only public kAInet pages. The captures were controlled browser replays in an owned temporary Chromium profile. No sign-in, form submission, private session, source extraction, or provider action was performed.

## REA calls and evidence

| REA tool call | Public target | Evidence | Capture details |
| --- | --- | --- | --- |
| `capture_browser_scenario` | `https://www.kainet.tech/` | `ev_a2e55c673a9645a27f3e36cb9f85657e613b0e025a6ad1ff4da42dbf2a90e4af` | Chromium 156.0.8078.48; launch mode; URL, DOM, accessibility tree and screenshot retained; screenshot SHA-256 `58408e3a3a851995e8a0d5c0ad2c5276706024c6a26b7ed766cccfb8fcf22d5a` |
| `capture_browser_scenario` | `https://www.kainet.tech/features` | `ev_b519dcb032f6ec16c5f72e7ff43f7d6131e4f9195c15b05ee4e8905c9676b2d2` | Chromium 156.0.8078.48; launch mode; URL, DOM, accessibility tree and screenshot retained; screenshot SHA-256 `ed48b2e5b193169724b03a2588a63c86e29cbaf25ec593d0c8bf761ba69f0f58` |

The retained result for both pages identifies the authority as a controlled replay and reports complete page captures. The calls did not exercise page controls or authenticated behavior.

## Findings

### OBSERVED

- Public pages use a compact marketing navigation and present the product through a staged workflow.
- The homepage describes a sequence of setting direction, building a campaign, then review and launch.
- The pages organize product messaging around campaign structure, creative variants, review and post-launch visibility.
- A dashboard-style example is shown as marketing content. It is not evidence of a verified account or live customer report.

### ADVERTISED

- kAInet publicly advertises campaign building for Google Ads and Meta, generated campaign and creative variations, human review, launch, and post-launch metrics. The replay did not verify these backend operations.

### INFERRED

- A guided setup followed by an editable workspace can keep first-time campaign creation understandable.
- Separating the design canvas, preview, saved assets and review state should make creative work easier to inspect.
- Tandem Ads should make workspace scope and offline provenance visible at the point of use.

### UNAVAILABLE

- No public editor, template picker, Brand Kit, private asset library, or authenticated creative workflow was exposed by these captures.
- Real campaign editing, provider permissions, approvals, publication, and analytics could not be verified.
- Private source code and private customer sessions were not inspected.

## Tandem Ads design decisions

- Build an original structured SVG editor, with editable layers, local templates, private workspace assets, revision history and PNG/JPEG export.
- Keep offline variations explicitly labeled and never represent them as output from a live AI model.
- Keep campaign attachment and Brand Kit records scoped to the selected workspace.
- Treat provider-specific upload, approval and publication as deferred capabilities.

