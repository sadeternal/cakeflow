-- Corrige RLS para permitir criação de pedidos no catálogo público (anon).

-- Remove política anterior, se existir.
drop policy if exists "pedidos_public_insert_anon" on public.pedidos;

-- Permite insert anônimo estritamente para pedidos de orçamento vindos do catálogo.
create policy "pedidos_public_insert_anon"
  on public.pedidos
  for insert
  to anon
  with check (
    confeitaria_id is not null
    and status = 'orcamento'
    and tipo in ('produto_pronto', 'personalizado')
    and coalesce(trim(cliente_nome), '') <> ''
    and coalesce(trim(cliente_telefone), '') <> ''
    and coalesce(valor_total, 0) >= 0
  );
