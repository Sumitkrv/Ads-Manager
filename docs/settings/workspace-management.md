# Workspace management

The established workspace business editor continues to own the canonical name, slug, industry, website, country code and business timezone. Workspace-wide description, category, operating region and display-currency preference are persisted in `workspace_preferences` alongside typed landing/campaign/report/objective/density defaults. The form keeps region free-text and does not infer an address.

Owners and admins can edit these shared values; other roles receive read-only defaults where the page is available. Server authorization and table policies enforce the same boundary. A workspace’s selected industry comes from the existing shared industry catalogue. Changing it requires confirmation and affects future defaults/guidance only; campaigns, creative projects, Brand Kit data and historical reports remain intact.

Brand identity is not copied into a second profile: logo, colors, type, tone, CTA and assets remain managed in the existing Brand Kit. Settings links there. Agency profile details and client relationships remain in Agency Command Center.

Workspace-wide display currency is descriptive. It does not convert saved amounts, campaign budgets, invoices or subscription records. No exchange rate is applied.
