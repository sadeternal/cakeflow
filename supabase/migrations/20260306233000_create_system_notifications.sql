create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  status text not null default 'published' check (status in ('published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.system_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (notification_id, user_id)
);

alter table public.system_notifications enable row level security;
alter table public.system_notification_reads enable row level security;

drop policy if exists "system_notifications_select_published" on public.system_notifications;
create policy "system_notifications_select_published"
  on public.system_notifications for select
  to authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "system_notifications_admin_insert" on public.system_notifications;
create policy "system_notifications_admin_insert"
  on public.system_notifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "system_notifications_admin_update" on public.system_notifications;
create policy "system_notifications_admin_update"
  on public.system_notifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "system_notification_reads_select_own" on public.system_notification_reads;
create policy "system_notification_reads_select_own"
  on public.system_notification_reads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "system_notification_reads_insert_own" on public.system_notification_reads;
create policy "system_notification_reads_insert_own"
  on public.system_notification_reads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "system_notification_reads_update_own" on public.system_notification_reads;
create policy "system_notification_reads_update_own"
  on public.system_notification_reads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'system_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.system_notifications';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'system_notification_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.system_notification_reads';
  end if;
end $$;
