drop policy if exists "system_notifications_admin_delete" on public.system_notifications;

create policy "system_notifications_admin_delete"
  on public.system_notifications for delete
  to authenticated
  using (public.is_admin());
