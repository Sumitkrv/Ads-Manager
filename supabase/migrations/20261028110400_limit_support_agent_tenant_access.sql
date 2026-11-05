begin;

-- Support agents can see case-scoped requester/workspace metadata through
-- support operations, but do not receive a general tenant directory capability.
delete from tandem_internal.platform_admin_role_capabilities
where role_key='support_agent' and capability_key='platform.tenants.read';

commit;
