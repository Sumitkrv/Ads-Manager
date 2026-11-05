# Prompt 10 — Public pricing reference research

Research date: 2026-10-28. REA MCP was used in a controlled Chromium replay of public kAInet marketing pages. No login, private dashboard, provider account, or external advertising action was used.

## Calls made and evidence

| REA call | Target and action | Evidence ID | Result |
| --- | --- | --- | --- |
| `capture_browser_scenario` | Opened `https://www.kainet.tech/`, waited, then inspected the two public Pricing links. | `ev_98c06a0b5754a9bcd3feeef71e84127b2f0b1c0921ab34a489778d139ba5b6cd` | The ambiguous role locator found both header and footer links and the click failed in strict mode. The trace exposed each public link's `href="/pricing"`; no inference about pricing behavior was drawn from the failed click. |
| `capture_browser_scenario` | Clicked `nav a[href='/pricing']` from the public homepage and retained the destination URL and screenshot. | `ev_e8575503f0e5d717d285123e3784ed79a74c79c1219bdde4c0d23fd61c94f1a8` | Observed the public navigation reach `https://www.kainet.tech/pricing`. The screenshot digest was `b8ff811724c7003695394a0a80f690fc3030df1acf3da3901fac6b79b0c3c698`. |
| `capture_browser_scenario` | Opened the now-observed public `/pricing` destination and retained rendered DOM, accessibility text, and URL. | `ev_a1b09bb2b95bc19bb0cd1ee8f8b350b9a095013977ab482d5cfcf0ea5c9aefff` | Observed the pricing page contents, headings, plan descriptions, pricing units, and FAQ labels in the accessibility snapshot. |

Provider: REA Playwright browser scenario capture provider 1. Chromium 156.0.8078.49. Controlled replay used an empty browser profile and public pages only. The first call's ambiguous click is recorded as a failed action, not successful evidence.

## Findings

### OBSERVED

- The homepage header and footer each expose a Pricing link to `/pricing`.
- The public pricing page has a prominent pricing headline, a plan comparison, a set of FAQs, and a clear call-to-action for each displayed plan.
- At capture time the page showed “Starter,” “Growth,” and “Enterprise” plan sections. It also showed an early-adopter “Start-up” message above the comparison.
- Pricing was displayed in INR per month, with separate advertising-spend fees, monthly session/image-credit quantities, platform lists, and support levels on some tiers. The enterprise section described negotiated extra usage and dedicated support.
- The FAQ headings cover account access, launch behavior, supported campaign types, product positioning, and target customers.

### ADVERTISED

- kAInet advertises cross-platform Google Ads and Meta Ads management, campaign workflows with human approval, and pricing differentiated by plan, monthly usage, platform, and support.
- These are public marketing claims. The capture does not establish whether provider operations, fees, limits, or billing are enforced as described in private production systems.

### INFERRED

- A plan page should explain limits and product access near the selection control, and billing configuration should distinguish recurring price from usage units.
- Tandem Ads uses these usability concepts but keeps prices, terms, and quotas independent and explicitly marks all local catalog prices as samples.

### UNAVAILABLE

- Private subscription lifecycle, checkout, invoice generation, plan entitlements, renewal processing, customer-specific pricing, and billing administration are not observable from the public page.
- No kAInet source code, customer account, or private billing data was inspected.

## Tandem Ads design decisions

- Tandem Ads has five distinct configurable catalog entries: Free Trial, Starter, Growth, Agency, and Enterprise. Sample prices are USD minor units from the local database, not copied kAInet INR pricing or advertising-spend fees.
- Pricing comparisons emphasize workspace-scoped features, seats, campaign limits, storage, and agency client capacity. They do not suggest that an ad account is connected.
- Upgrade selection creates a pending request. A separate local trusted operator gate can grant demo entitlements; no checkout, card, payment intent, or actual charge exists.
- Billing pages use an original Tandem Ads layout and branding and disclose “Payment simulation only. No money charged.”
