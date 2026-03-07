create table if not exists public.pedido_notification_reads (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (pedido_id, user_id)
);

alter table public.pedido_notification_reads enable row level security;

drop policy if exists "pedido_notification_reads_select_own" on public.pedido_notification_reads;
create policy "pedido_notification_reads_select_own"
  on public.pedido_notification_reads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "pedido_notification_reads_insert_own" on public.pedido_notification_reads;
create policy "pedido_notification_reads_insert_own"
  on public.pedido_notification_reads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "pedido_notification_reads_update_own" on public.pedido_notification_reads;
create policy "pedido_notification_reads_update_own"
  on public.pedido_notification_reads for update
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
      and tablename = 'pedidos'
  ) then
    execute 'alter publication supabase_realtime add table public.pedidos';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedido_notification_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.pedido_notification_reads';
  end if;
end $$;
