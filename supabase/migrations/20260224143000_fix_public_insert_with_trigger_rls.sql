-- Corrige inserção pública em pedidos quando trigger interno consulta a própria tabela.
-- A função do trigger passa a ser SECURITY DEFINER para evitar bloqueio por RLS
-- durante o cálculo do próximo número por confeitaria.

create or replace function public.assign_pedido_numero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num integer;
begin
  if new.confeitaria_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.confeitaria_id::text));

  if new.numero is null
     or new.numero <= 0
     or exists (
       select 1
       from public.pedidos p
       where p.confeitaria_id = new.confeitaria_id
         and p.numero = new.numero
         and p.id is distinct from new.id
     ) then
    select coalesce(max(p.numero), 0) + 1
      into next_num
    from public.pedidos p
    where p.confeitaria_id = new.confeitaria_id;

    new.numero := next_num;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_pedidos_assign_numero on public.pedidos;
create trigger tr_pedidos_assign_numero
before insert or update of numero, confeitaria_id
on public.pedidos
for each row execute function public.assign_pedido_numero();

-- Reforça política pública de insert para catálogo
drop policy if exists "pedidos_public_insert_public" on public.pedidos;
create policy "pedidos_public_insert_public"
  on public.pedidos
  for insert
  to public
  with check (
    confeitaria_id is not null
    and coalesce(trim(cliente_nome), '') <> ''
    and coalesce(trim(cliente_telefone), '') <> ''
    and status = 'orcamento'
    and tipo in ('produto_pronto', 'personalizado')
    and coalesce(valor_total, 0) >= 0
  );
