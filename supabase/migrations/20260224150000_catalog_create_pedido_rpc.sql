-- Criação de pedidos do catálogo público via RPC com SECURITY DEFINER
-- para evitar bloqueios de RLS no fluxo anônimo.

create or replace function public.catalog_create_pedido(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_confeitaria_id uuid;
  v_cliente_nome text;
  v_cliente_telefone text;
begin
  if payload is null then
    raise exception 'payload obrigatório';
  end if;

  v_confeitaria_id := nullif(payload->>'confeitaria_id', '')::uuid;
  v_cliente_nome := trim(coalesce(payload->>'cliente_nome', ''));
  v_cliente_telefone := trim(coalesce(payload->>'cliente_telefone', ''));

  if v_confeitaria_id is null then
    raise exception 'confeitaria_id obrigatório';
  end if;

  if v_cliente_nome = '' then
    raise exception 'cliente_nome obrigatório';
  end if;

  if v_cliente_telefone = '' then
    raise exception 'cliente_telefone obrigatório';
  end if;

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
    nullif(payload->>'cliente_id', '')::uuid,
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
