create or replace function public.sync_parcelamento_pedido_aprovado(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_parcelas int;
  v_total numeric(10, 2);
  v_base numeric(10, 2);
  v_acumulado numeric(10, 2);
  v_diferenca numeric(10, 2);
  v_data_base date;
  v_valor_parcela numeric(10, 2);
  v_existentes int;
begin
  if p_pedido_id is null then
    return;
  end if;

  select *
    into v_pedido
  from public.pedidos
  where id = p_pedido_id;

  if not found then
    return;
  end if;

  if v_pedido.status is distinct from 'aprovado' then
    return;
  end if;

  select count(*)
    into v_existentes
  from public.parcelamento_pedidos
  where pedido_id = v_pedido.id;

  if coalesce(v_existentes, 0) > 0 then
    return;
  end if;

  v_parcelas := greatest(coalesce(v_pedido.parcelas, 1), 1);
  v_total := round(coalesce(v_pedido.valor_total, 0)::numeric, 2);
  v_base := trunc((v_total / v_parcelas) * 100) / 100;
  v_acumulado := round(v_base * v_parcelas, 2);
  v_diferenca := round(v_total - v_acumulado, 2);
  v_data_base := coalesce(v_pedido.data_entrega, v_pedido.created_date::date, current_date);

  for i in 1..v_parcelas loop
    v_valor_parcela := v_base;

    if i = v_parcelas then
      v_valor_parcela := round(v_valor_parcela + v_diferenca, 2);
    end if;

    insert into public.parcelamento_pedidos (
      confeitaria_id,
      pedido_id,
      numero_parcela,
      valor,
      data_vencimento,
      status
    ) values (
      v_pedido.confeitaria_id,
      v_pedido.id,
      i,
      v_valor_parcela,
      (v_data_base + make_interval(months => i - 1))::date,
      'pendente'
    );
  end loop;
end;
$$;

create or replace function public.trg_sync_parcelamento_pedido_aprovado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aprovado' then
    perform public.sync_parcelamento_pedido_aprovado(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_sync_parcelamento_pedido_aprovado on public.pedidos;
create trigger tr_sync_parcelamento_pedido_aprovado
after insert or update of status on public.pedidos
for each row
execute function public.trg_sync_parcelamento_pedido_aprovado();

grant execute on function public.sync_parcelamento_pedido_aprovado(uuid) to authenticated, anon;
