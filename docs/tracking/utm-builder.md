# UTM builder

The browser preview and API preview construct URLs locally. The backend never fetches the destination, preventing an SSRF/open-proxy path. Destinations must use HTTPS and cannot contain embedded URL credentials.

The builder supports source, medium, campaign, optional content and term, and custom parameters. It preserves unrelated query parameters and fragments. Existing standard UTM parameters require explicit replacement. Values are encoded with `URLSearchParams` once; dangerous URI schemes and email/phone-like values are rejected.

Workspace naming preferences support casing, separator, static campaign-name tokens (`{campaign}`, `{channel}`, `{date}`), date-token format, source presets and content labels. No arbitrary template execution is used. Personal information and secrets must not be placed in tracking URLs.

Saved templates can be edited, duplicated and archived. Campaign and goal references remain workspace-scoped. Campaign tracking associations are stored separately and do not change campaign revision or approval status.
