-- PL/pgSQL must not access fields from another trigger table's NEW record.
-- Keep table-specific field reads inside their own branches.
create or replace function tandem_internal.notify_agency_client_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rel public.agency_client_relationships;
begin
  if tg_table_name = 'agency_client_relationships' then
    rel := new;
    if tg_op = 'INSERT' then
      perform tandem_internal.notify_workspace_members(
        rel.client_workspace_id, null, 'agency_collaboration',
        'Agency collaboration request',
        'An agency requested a workspace relationship. Review it in the client portal.',
        '/app/client/overview', 'agency-request:' || rel.id::text,
        array['owner','admin']::text[]
      );
    elsif new.status is distinct from old.status then
      perform tandem_internal.notify_workspace_members(
        rel.agency_workspace_id, null, 'agency_collaboration',
        'Client relationship updated',
        'A client workspace updated the collaboration relationship.',
        '/app/agency/clients', 'agency-state:' || rel.id::text || ':' || rel.status,
        array['owner','admin']::text[]
      );
    end if;
  elsif tg_table_name = 'client_tasks' then
    if tg_op = 'INSERT' and new.assigned_user_id is not null then
      insert into public.workspace_notifications(
        workspace_id, recipient_user_id, notification_type, title, body, href, dedupe_key
      ) values (
        new.workspace_id, new.assigned_user_id, 'client_task', 'Task assigned',
        'A workspace task was assigned to you.', '/app/client/tasks',
        'client-task:' || new.id::text
      ) on conflict(workspace_id, recipient_user_id, dedupe_key) do nothing;
    end if;
  elsif tg_table_name = 'client_collaboration_comments' then
    if tg_op = 'INSERT' and new.visibility = 'client_visible' and new.relationship_id is not null then
      select * into rel
      from public.agency_client_relationships
      where id = new.relationship_id and status = 'active';
      if found then
        if exists (
          select 1 from public.workspace_memberships
          where workspace_id = rel.agency_workspace_id and user_id = new.author_user_id
        ) then
          perform tandem_internal.notify_workspace_members(
            rel.client_workspace_id, null, 'client_comment', 'New client comment',
            'A client-visible discussion has a new comment.', '/app/client/overview',
            'comment:' || new.id::text, array['owner','admin','editor']::text[]
          );
        else
          perform tandem_internal.notify_workspace_members(
            rel.agency_workspace_id, null, 'client_comment', 'New client comment',
            'A client workspace added feedback.', '/app/agency/clients',
            'comment:' || new.id::text, array['owner','admin','editor']::text[]
          );
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function tandem_internal.notify_agency_client_changes()
  from public, anon, authenticated, service_role;
