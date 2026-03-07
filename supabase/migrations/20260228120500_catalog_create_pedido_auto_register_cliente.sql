-- Atualiza catalog_create_pedido para auto-registrar clientes via telefone.
--
-- Comportamento:
--   1. Busca cliente existente por (confeitaria_id, telefone).
--   2. Se não encontrar: insere novo registro em clientes.
--   3. Usa ON CONFLICT DO NOTHING para ser race-safe.
--   4. Vincula o cliente_id resolvido ao pedido criado.

-- Índice único parcial: garante lookup eficiente e previne duplicatas por telefone por confeitaria.
-- Parcial para permitir múltiplos clientes sem telefone na mesma confeitaria.
create unique index if not exists idx_clientes_confeitaria_telefone_unique
  on public.clientes (confeitaria_id, telefone)
  where telefone is not null and telefone <> '';

create or replace function public.catalog_create_pedido(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id               uuid;
  v_confeitaria_id   uuid;
  v_cliente_id       uuid;
  v_cliente_nome     text;
  v_cliente_telefone text;
  v_cliente_cpf      text;
  v_cliente_endereco text;
begin
  if payload is null then
    raise exception 'payload obrigatório';
  end if;

  v_confeitaria_id   := nullif(payload->>'confeitaria_id', '')::uuid;
  v_cliente_nome     := trim(coalesce(payload->>'cliente_nome', ''));
  v_cliente_telefone := trim(coalesce(payload->>'cliente_telefone', ''));
  v_cliente_cpf      := nullif(trim(coalesce(payload->>'cliente_cpf', '')), '');
  v_cliente_endereco := nullif(trim(coalesce(payload->>'cliente_endereco', '')), '');

  if v_confeitaria_id is null then
    raise exception 'confeitaria_id obrigatório';
  end if;

  if v_cliente_nome = '' then
    raise exception 'cliente_nome obrigatório';
  end if;

  if v_cliente_telefone = '' then
    raise exception 'cliente_telefone obrigatório';
  end if;

  -- Passo 1: Buscar cliente existente pelo telefone nesta confeitaria.
  select id into v_cliente_id
  from public.clientes
  where confeitaria_id = v_confeitaria_id
    and telefone = v_cliente_telefone
  limit 1;

  -- Passo 2: Se não encontrado, inserir novo cliente.
  --   ON CONFLICT DO NOTHING garante que corridas simultâneas não gerem duplicata.
  if v_cliente_id is null then
    insert into public.clientes (confeitaria_id, nome, telefone, cpf, endereco)
    values (v_confeitaria_id, v_cliente_nome, v_cliente_telefone, v_cliente_cpf, v_cliente_endereco)
    on conflict (confeitaria_id, telefone)
      where (telefone is not null and telefone <> '')
      do nothing
    returning id into v_cliente_id;

    -- Se ON CONFLICT disparou (corrida), RETURNING não retorna nada — re-busca.
    if v_cliente_id is null then
      select id into v_cliente_id
      from public.clientes
      where confeitaria_id = v_confeitaria_id
        and telefone = v_cliente_telefone
      limit 1;
    end if;
  end if;

  -- Passo 3: Inserir o pedido com o cliente_id resolvido.
  insert into public.pedidos (
    confeitaria_id,
    cliente_id,
    cliente_nome,
    cliente_telefone,
    numero,
    status,
    tipo,
    tipo_entrega,
    valor_total,
    data_entrega,
    horario_entrega,
    observacoes,
    forma_pagamento,
    tamanho_id,
    tamanho_nome,
    massa_id,
    massa_nome,
    recheios,
    cobertura_id,
    cobertura_nome,
    extras,
    doces,
    salgados,
    produtos_catalogo,
    valor_tamanho,
    valor_massa,
    valor_recheios,
    valor_cobertura,
    valor_extras,
    valor_doces,
    valor_salgados,
    valor_urgencia,
    itens
  ) values (
    v_confeitaria_id,
    v_cliente_id,
    v_cliente_nome,
    v_cliente_telefone,
    nullif(payload->>'numero', '')::int,
    coalesce(nullif(payload->>'status', ''), 'orcamento'),
    nullif(payload->>'tipo', ''),
    nullif(payload->>'tipo_entrega', ''),
    coalesce(nullif(payload->>'valor_total', '')::numeric, 0),
    nullif(payload->>'data_entrega', '')::date,
    nullif(payload->>'horario_entrega', ''),
    nullif(payload->>'observacoes', ''),
    nullif(payload->>'forma_pagamento', ''),
    nullif(payload->>'tamanho_id', '')::uuid,
    nullif(payload->>'tamanho_nome', ''),
    nullif(payload->>'massa_id', '')::uuid,
    nullif(payload->>'massa_nome', ''),
    coalesce(payload->'recheios', '[]'::jsonb),
    nullif(payload->>'cobertura_id', '')::uuid,
    nullif(payload->>'cobertura_nome', ''),
    coalesce(payload->'extras', '[]'::jsonb),
    coalesce(payload->'doces', '[]'::jsonb),
    coalesce(payload->'salgados', '[]'::jsonb),
    coalesce(payload->'produtos_catalogo', '[]'::jsonb),
    coalesce(nullif(payload->>'valor_tamanho', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_massa', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_recheios', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_cobertura', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_extras', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_doces', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_salgados', '')::numeric, 0),
    coalesce(nullif(payload->>'valor_urgencia', '')::numeric, 0),
    payload->'itens'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.catalog_create_pedido(jsonb) to anon, authenticated;
