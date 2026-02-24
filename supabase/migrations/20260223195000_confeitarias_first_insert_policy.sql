create policy "confeitarias_insert_first"
  on public.confeitarias
  for insert
  with check (
    auth.uid() is not null
    and not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.confeitaria_id is not null
    )
  );
