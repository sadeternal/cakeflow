-- Libera criação de pedidos do catálogo para qualquer sessão (anon/autenticado).
-- Mantém segurança do resto via policies de select/update/delete.

drop policy if exists "pedidos_public_insert_anon" on public.pedidos;

create policy "pedidos_public_insert_public"
  on public.pedidos
  for insert
  to public
  with check (true);
