# Provider catalogue

| Provider | Category | Local planning purpose | Connection state |
| --- | --- | --- | --- |
| Google Ads | Advertising | Account identifier, ownership/access, website and conversion preparation | Disabled |
| Meta Ads | Advertising | Business portfolio, ad account and measurement preparation | Disabled |
| Google Analytics 4 | Measurement | Event and key-event planning | Disabled |
| Google Tag Manager | Measurement | Future tags/triggers/consent implementation plan | Disabled |
| Meta Pixel / Dataset | Measurement | Event mapping and consent planning | Disabled |
| Google Ads Conversion Tracking | Measurement | Conversion-action and future offline implementation plan | Disabled |

Future CRM, webhook and attribution cards are not exposed as actionable cards. There is no OAuth token, provider credential or connected-account record created by Prompt 14.

## Mapping examples

- GA4 `generate_lead` and `purchase` are public recommended event names. They remain mapping suggestions until a future provider integration validates them.
- Meta `Lead` and `Purchase` are displayed as planning suggestions only. This implementation did not verify them against a Meta account or schema endpoint.

## Disabled live actions

The existing advertising OAuth router returns a safe conflict response for every endpoint, even if provider credentials exist in environment variables. Account identifiers entered in this workspace are ordinary, non-secret metadata and do not prove the account exists.
