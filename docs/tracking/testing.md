# Tracking validation and test history

`POST /api/workspaces/:workspaceId/tracking/validate` validates a synthetic event against the saved local event definition. It checks required parameter presence/types, unknown parameters, active local mappings and consent-planning warnings. Results are stored in `tracking_test_runs` with `delivery_status = not_sent` and the label “SIMULATED EVENT — NOT SENT TO PROVIDER.”

Diagnostics report local setup coverage and always disclose that external verification is unavailable. Test-run counts are not mixed with campaign conversions, analytics or billing usage.

The pure validation/UTM unit tests and API tests are included in the project suites. pgTAP and authenticated browser verification require a confirmed local Supabase runtime. That runtime was not available during this implementation, so no migration application or authenticated database write was attempted.
