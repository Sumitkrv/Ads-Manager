# Preferences and defaults

## Personal preferences

`user_preferences` stores theme (`light`, `dark`, `system`), English language, timezone, date order, 12/24-hour time, display currency and notification booleans. The existing universal theme provider remains the single theme authority. The timezone/date/time controls provide a formatted preview using `Intl`; records remain stored in UTC. Personal currency is a display choice and does not convert money.

Notification choices apply to eligible in-app notification creation/presentation in the existing optimization notification repository. Unsupported categories are shown disabled when no producer exists. Security notifications remain mandatory. No email, WhatsApp or SMS delivery toggle is presented as working.

## Workspace profile/defaults

`workspace_preferences` stores workspace description/category/region/currency and typed defaults: landing page, campaign draft format, report range, objective and display density. These are separate from personal preferences. Defaults are used only in the app flows that read them. Currency remains a display preference.

Workspace preference mutations generate an audit event. Zod schemas reject unknown fields; arbitrary JSON cannot set permissions, billing limits or feature flags.
