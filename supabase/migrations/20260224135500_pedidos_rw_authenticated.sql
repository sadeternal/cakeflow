-- Evita conflito entre política privada e pública de pedidos.
-- Política privada deve valer apenas para usuários autenticados.

drop policy if exists "pedidos_rw_own" on public.pedidos;

create policy "pedidos_rw_own"
  on public.pedidos for all
  to authenticated
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());
