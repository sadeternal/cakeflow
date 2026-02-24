create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_email text;
  v_profile_confeitaria_id uuid;
  v_jwt_email text := nullif(auth.jwt() ->> 'email', '');
  v_match_email text;
  v_confeitaria_ids uuid[];
  v_table text;
  v_tables text[] := array[
    'pedidos',
    'clientes',
    'produtos',
    'formas_pagamento',
    'massas',
    'recheios',
    'tamanhos',
    'coberturas',
    'extras',
    'doces',
    'salgados',
    'contas_receber',
    'contas_pagar',
    'acessos_catalogo'
  ];
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.email, p.confeitaria_id
  into v_profile_email, v_profile_confeitaria_id
  from public.profiles p
  where p.id = v_user_id
  limit 1;

  v_match_email := coalesce(v_profile_email, v_jwt_email);

  select array_agg(src.id)::uuid[]
  into v_confeitaria_ids
  from (
    select c.id
    from public.confeitarias c
    where v_profile_confeitaria_id is not null
      and c.id = v_profile_confeitaria_id

    union

    select c.id
    from public.confeitarias c
    where v_match_email is not null
      and c.owner_email is not null
      and lower(c.owner_email) = lower(v_match_email)
  ) src;

  if v_confeitaria_ids is not null and array_length(v_confeitaria_ids, 1) > 0 then
    -- 1) Exclui primeiro os dados vinculados por confeitaria
    foreach v_table in array v_tables loop
      execute format('delete from public.%I where confeitaria_id = any($1)', v_table)
      using v_confeitaria_ids;
    end loop;
  end if;

  -- 2) Exclui dados do usuário da aplicação
  delete from public.app_logs
  where user_id = v_user_id;

  delete from public.profiles
  where id = v_user_id;

  -- 3) Por último, exclui a confeitaria
  if v_confeitaria_ids is not null and array_length(v_confeitaria_ids, 1) > 0 then
    delete from public.confeitarias
    where id = any(v_confeitaria_ids);
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_confeitarias', coalesce(array_length(v_confeitaria_ids, 1), 0)
  );
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
