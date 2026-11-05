# Event mapping

An event mapping relates one internal event definition to one provider event name and a local parameter map. Validation checks the local event schema only. It does not query provider schemas or test account access.

Examples shown in the UI are suggestions:

- `LEAD_FORM_SUBMITTED` → GA4 `generate_lead`
- `PURCHASE_COMPLETED` → GA4 `purchase`
- lead/purchase definitions → Meta `Lead` / `Purchase` planning suggestions

Mapping status is a local draft/active/archived state for future implementation. “Active” does not activate a pixel, tag or API transmission. Every change is recorded in the configuration audit.
