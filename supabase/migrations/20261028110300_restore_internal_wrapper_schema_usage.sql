begin;

-- Existing workspace and campaign SQL wrappers resolve narrow helper
-- functions in tandem_internal as the authenticated caller. Keep schema
-- USAGE for compatibility; the schema is excluded from the Supabase Data API,
-- helper-table privileges remain revoked, and sensitive platform RPCs remain
-- service-role-only.
grant usage on schema tandem_internal to authenticated;

commit;
