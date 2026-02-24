-- Permite que visitantes do catálogo público criem pedidos (somente insert controlado).

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos'
      and policyname = 'pedidos_public_insert_anon'
  ) then
    create policy "pedidos_public_insert_anon"
      on public.pedidos
      for insert
      to anon
      with check (
        confeitaria_id is not null
        and exists (
          select 1
          from public.confeitarias c
          where c.id = pedidos.confeitaria_id
        )
        and status = 'orcamento'
        and tipo in ('produto_pronto', 'personalizado')
      );
  end if;
end $$;
