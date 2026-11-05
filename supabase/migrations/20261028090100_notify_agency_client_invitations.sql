-- Invitation links are created in-app; this notification announces the pending
-- link to the other workspace without exposing the token or implying email delivery.
create or replace function tandem_internal.notify_agency_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rel public.agency_client_relationships;
  target_workspace_id uuid;
  target_href text;
begin
  if new.status <> 'pending' or new.relationship_id is null then
    return new;
  end if;

  select * into rel
  from public.agency_client_relationships
  where id = new.relationship_id;
  if not found or rel.status <> 'active' then
    return new;
  end if;

  if new.workspace_id = rel.agency_workspace_id then
    target_workspace_id := rel.client_workspace_id;
    target_href := '/app/client/overview';
  elsif new.workspace_id = rel.client_workspace_id then
    target_workspace_id := rel.agency_workspace_id;
    target_href := '/app/agency/clients';
  else
    return new;
  end if;

  perform tandem_internal.notify_workspace_members(
    target_workspace_id,
    null,
    'agency_collaboration',
    'Collaboration invitation created',
    'A workspace created an in-app collaboration invitation. It was not emailed.',
    target_href,
    'agency-invitation:' || new.id::text,
    array['owner','admin']::text[]
  );
  return new;
end;
$$;

revoke all on function tandem_internal.notify_agency_invitation_created()
  from public, anon, authenticated, service_role;

create trigger agency_invitation_notifications
after insert on public.workspace_invitations
for each row execute function tandem_internal.notify_agency_invitation_created();
