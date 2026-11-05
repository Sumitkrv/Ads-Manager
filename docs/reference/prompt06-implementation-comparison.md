# Prompt 06 — implementation comparison

This compares Tandem Ads with publicly observable or advertised kAInet workflow concepts captured through REA. It does not claim access to kAInet's private editor or backend.

| Public reference evidence | Tandem Ads implementation | Status and boundary |
| --- | --- | --- |
| Guided workflow from direction through review | Creative project creation starts from an industry-mapped template or a blank canvas, then opens the editable studio | Implemented locally; no provider calls |
| Public claims of creative variations | Eight deterministic, structured layout variations use workspace industry, brand and selected campaign brief inputs | Simulated offline composition; no generative AI or image generation |
| Public campaign creative presentation | Layered SVG canvas with text, shapes, private image references, reposition/resize, properties, undo/redo and aspect presets | Implemented; browser-authenticated editor flow still requires a real authorized local test account |
| Public review and approval messaging | Creative revision history with submit, owner/admin approval, change request and approval invalidation on edits | Implemented in additive local migration and API; campaign approval is invalidated when attached creative changes |
| Marketing dashboard example | Tandem Creative Library shows records from the active workspace and filters by search, campaign, platform, dimensions, status and sort | Database-backed; no seeded designs or fabricated totals |
| Public post-launch metrics claims | Creative preview says “Demo Mode · Not Published”; campaign analytics remain in Prompt 05's separate simulated system | No real advertising metrics or publication are implemented here |
| Private brand/editor capabilities were not observable | Workspace Brand Kit, private asset metadata/storage, signed access, private download and export are implemented from Tandem Ads requirements | Asset lifecycle depends on the local Supabase Storage configuration; no hosted migration was applied |

## Verification boundary

- **Implemented:** routes, Brand Kit, private asset upload path, creative list/editor, templates, offline variations, campaign links, revision and review UI, PNG/JPEG export code, theme reuse.
- **Tested locally:** typecheck and lint passed; API suite passed 45/45; web suite passed 38/38; production build passed; the new migration was applied to the existing local database without reset; 164 pgTAP assertions passed across the database suite.
- **Simulated:** layout variation generation and all provider-oriented creative labels. No real AI or ad provider is invoked.
- **Unverified at Prompt 06 close:** authenticated browser upload → private Storage retrieval → refresh, canvas export in a real browser, and signed-in workspace switching. Prompt 07 is running isolated local browser acceptance against the empty local Supabase project.
- **Deferred:** actual Google/Meta creative upload and provider placement approval, external image generation, and deployment of this migration to hosted Supabase.

## Storage boundary — hardened in Prompt 07

Prompt 06 originally allowed authenticated managers to insert directly into the private Storage bucket. Prompt 07 removes that direct INSERT and DELETE path and removes client INSERT permission on creative metadata. A single API upload route decodes and normalizes PNG/JPEG/WebP images before invoking a server-only fixed-bucket uploader. A local SQL reservation locks the workspace row, checks current assets plus concurrent reservations against count/byte quotas, and returns a server-derived immutable path. Finalization rechecks membership before persisting metadata; failed uploads remove the object where possible and retain a reservation for cleanup if removal fails. The private bucket stays private, ordinary reads remain user-scoped, and the service-role key never reaches the browser. This is local-only; the migration is not deployed to hosted Supabase.

