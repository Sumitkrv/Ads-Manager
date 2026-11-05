# Profile management

The existing profile editor remains the account profile editor. It supports display name and a private avatar upload (PNG/JPEG/WebP, maximum 2 MB). Avatar objects use the private `tandem-user-avatars` bucket, are stored under the authenticated user ID and use a UUID filename. Replaced/failed uploads are cleaned up when safe; private image references are signed for display.

The Auth identity remains authoritative for email. The Security section calls Supabase Auth `updateUser` for verified email change and reports the pending confirmation flow. It does not write an email value into `profiles` to imitate an Auth change.

Personal language, theme, timezone, date/time format, currency display and supported notification choices are stored in `user_preferences`. English is the only enabled language because other translation bundles are absent. Account preferences are reloaded from the API after navigation/refresh.

No external profile image service is used. Storage rules and profile RLS require the additive Prompt 13 migration before these new avatar paths work in a database.
