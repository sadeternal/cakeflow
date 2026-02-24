-- Corrige RLS para salvar configuracoes e upload de imagens no bucket public.
-- 1) current_confeitaria_id com fallback em claims JWT
-- 2) policy de confeitarias com fallback por owner_email
-- 3) policies de storage.objects para bucket public (upload/update/delete/list)

create or replace function public.current_confeitaria_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (select p.confeitaria_id from public.profiles p where p.id = auth.uid() limit 1),
    nullif(auth.jwt() ->> 'confeitaria_id', '')::uuid,
    nullif(auth.jwt() -> 'user_metadata' ->> 'confeitaria_id', '')::uuid,
    nullif(auth.jwt() -> 'app_metadata' ->> 'confeitaria_id', '')::uuid
  );
$$;

drop policy if exists "confeitarias_select_own" on public.confeitarias;
create policy "confeitarias_select_own"
  on public.confeitarias for select
  using (
    id = public.current_confeitaria_id()
    or lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "confeitarias_write_own" on public.confeitarias;
create policy "confeitarias_write_own"
  on public.confeitarias for all
  using (
    id = public.current_confeitaria_id()
    or lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    id = public.current_confeitaria_id()
    or lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_objects_select_authenticated'
  ) then
    create policy "storage_public_objects_select_authenticated"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'public');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_objects_insert_authenticated'
  ) then
    create policy "storage_public_objects_insert_authenticated"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'public');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_objects_update_authenticated'
  ) then
    create policy "storage_public_objects_update_authenticated"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'public')
      with check (bucket_id = 'public');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_objects_delete_authenticated'
  ) then
    create policy "storage_public_objects_delete_authenticated"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'public');
  end if;
end $$;
