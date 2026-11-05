# Campaign Studio — Prompt 05

## Runtime safety

The API is fixed to `ADS_EXECUTION_MODE=demo`; provider-side advertising execution remains disabled. Campaign text generation defaults to `CAMPAIGN_GENERATION_MODE=simulation`. An operator may enable `openai` mode by configuring the server-only `OPENAI_API_KEY` and `OPENAI_CAMPAIGN_MODEL`; client requests cannot select the mode. Google/Meta OAuth routes remain disabled, and no provider account, live publish, spend, or real-performance status is created.

Simulation output is labeled `AI Simulation` and comes from `SimulationCampaignProvider`, a deterministic, industry-aware template/rule engine. OpenAI copy is labeled `AI Generated Draft` and uses the Responses API with a strict JSON Schema output contract and `store:false`. Before each live text-generation request, the user must consent to sending the full campaign brief to the configured OpenAI API. The API records one campaign-generation usage operation before calling the model. The result passes local campaign validation and stays an editable Tandem Ads draft for human review. The model is never asked to create an ad account, campaign, audience, budget or provider-side action. Image generation is not included.

Demo publishing creates a `demo_…` Tandem Ads reference and records `published_externally=false`. Demo reports are stored separately and labeled `Simulated Data — Not Actual Ad Performance`.

## Local schema and persistence

`20261028010000_create_campaign_studio.sql` is additive and depends on `20261027010000_create_multi_tenant_workspaces.sql` (`public.workspaces`, `public.workspace_memberships`, and `tandem_internal.has_workspace_role`). It creates:

- `public.campaigns` and `public.campaign_revisions`
- `public.campaign_activity` and `public.campaign_reviews`
- `public.demo_publish_attempts` and `public.demo_campaign_analytics`

`20261028020000_normalize_campaign_plan_null.sql` is a follow-on migration that converts an ungenerated draft's JSON `null` plan into SQL `NULL` before the campaign JSON-shape constraint is checked.

`20261029000000_enable_openai_campaign_generation.sql` extends persisted generation provenance for OpenAI drafts. It has been prepared but was not applied during this implementation or verification. Apply it only to a local database before enabling OpenAI generation there; no hosted project was accessed.

Campaign plans contain the structured ad groups/ad sets and copy/creative references. There is no private asset bucket or long-term image upload persistence; image references selected in the preview stay in the current browser tab.

Every campaign record is workspace-scoped. Direct client writes are revoked; user-scoped API requests call role-checked RPCs. RLS guards reads. Composite tenant foreign keys prevent campaign child records from crossing workspaces. The API checks current membership and centralized capabilities for every operation.

## Routes

The workspace route family is `/api/workspaces/:workspaceId/campaigns`:

- `GET` list/filter/paginate and persisted status counts
- `POST` create a draft; `GET`/`PATCH` fetch and revise it
- `POST .../:campaignId/duplicate`, `/archive`, `/generate-demo`, `/generate-openai`, `/validate`
- `POST .../:campaignId/submit-review`, `/approve-demo`, `/request-changes`, `/reopen`
- `POST .../:campaignId/simulate-publish`
- `GET .../:campaignId/activity`, `/revisions`, `/reviews`, `/demo-analytics`, `/demo-publishing`

The application paths are `/app/campaigns`, `/new`, `/:campaignId`, `/:campaignId/edit`, `/:campaignId/review`, and `/:campaignId/preview` beneath `/app`.

## Review and permissions

Owners and admins can create/edit, review, approve, and simulate publishing. Editors can create/edit and submit drafts. Viewers can only read. Approval is tied to a specific revision; saving a changed submitted or approved draft clears approval and returns it to an editable state. “Approved for demo” is not an advertising-platform approval.

## Verification and deployment boundary

The unit/API tests use deterministic generation, fake repository fixtures, and loopback HTTP only. They do not make external provider requests. The local pgTAP suite covers profiles, workspaces, Prompt 04 integrations, and campaign tenant isolation. The final local run passed 137 assertions across four files. The REA browser smoke check confirmed that an unauthenticated visit to `/app/campaigns` is redirected to `/login`; no authenticated demo account was available for a browser-driven campaign workflow.

The local controlled browser capture is REA Evidence `ev_01839ee4a86bd516c833c8ebf64a2a9f8faef8514a598d7a22ab829e5e333f7e` (Chromium 156.0.8078.48, 1280×720). It captured the final URL, screenshot, DOM, and accessibility tree after the protected route redirected. It verifies the route guard and login surface, not wizard or publishing interactions.

The hosted project has not received the pending Prompt 03 workspace migration or either Prompt 05 migration. Both the workspace and campaign migrations were applied to the existing local Supabase database without a reset, and the local pgTAP suite passed. Do not push these migrations as part of local implementation verification.
