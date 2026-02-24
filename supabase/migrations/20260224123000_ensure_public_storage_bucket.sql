-- Garante bucket de storage usado pelo frontend para uploads de imagem.
-- Necessário para evitar erro "Bucket not found" em produção/local.

insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_objects_select_anon'
  ) then
    create policy "storage_public_objects_select_anon"
      on storage.objects
      for select
      to anon
      using (bucket_id = 'public');
  end if;
end $$;
