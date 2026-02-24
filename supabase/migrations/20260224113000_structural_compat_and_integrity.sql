-- Correções estruturais: compatibilidade de schema + integridade relacional
-- Objetivo: manter compatibilidade com dados legados e sem quebrar APIs atuais.

-- 1) Compatibilidade de colunas usadas pela UI
alter table public.clientes
  add column if not exists email text,
  add column if not exists bairro text,
  add column if not exists cidade text;

alter table public.pedidos
  add column if not exists cliente_nome text,
  add column if not exists cliente_telefone text,
  add column if not exists tamanho_id uuid,
  add column if not exists tamanho_nome text,
  add column if not exists massa_id uuid,
  add column if not exists massa_nome text,
  add column if not exists cobertura_id uuid,
  add column if not exists cobertura_nome text,
  add column if not exists recheios jsonb default '[]'::jsonb,
  add column if not exists extras jsonb default '[]'::jsonb,
  add column if not exists doces jsonb default '[]'::jsonb,
  add column if not exists salgados jsonb default '[]'::jsonb,
  add column if not exists produtos_catalogo jsonb default '[]'::jsonb,
  add column if not exists valor_tamanho numeric(10,2) default 0,
  add column if not exists valor_massa numeric(10,2) default 0,
  add column if not exists valor_recheios numeric(10,2) default 0,
  add column if not exists valor_cobertura numeric(10,2) default 0,
  add column if not exists valor_extras numeric(10,2) default 0,
  add column if not exists valor_doces numeric(10,2) default 0,
  add column if not exists valor_salgados numeric(10,2) default 0,
  add column if not exists valor_urgencia numeric(10,2) default 0;

alter table public.contas_receber
  add column if not exists valor numeric(10,2),
  add column if not exists cliente_nome text,
  add column if not exists data_recebimento date;

alter table public.contas_pagar
  add column if not exists valor numeric(10,2),
  add column if not exists fornecedor text,
  add column if not exists data_pagamento date;

alter table public.acessos_catalogo
  add column if not exists session_id text,
  add column if not exists referrer text;

-- 2) Backfill de compatibilidade
update public.pedidos set recheios = '[]'::jsonb where recheios is null;
update public.pedidos set extras = '[]'::jsonb where extras is null;
update public.pedidos set doces = '[]'::jsonb where doces is null;
update public.pedidos set salgados = '[]'::jsonb where salgados is null;
update public.pedidos set produtos_catalogo = '[]'::jsonb where produtos_catalogo is null;

update public.contas_receber
set valor = coalesce(valor, amount, 0),
    amount = coalesce(amount, valor, 0)
where valor is null or amount is null;

update public.contas_pagar
set valor = coalesce(valor, amount, 0),
    amount = coalesce(amount, valor, 0)
where valor is null or amount is null;

update public.acessos_catalogo
set referrer = coalesce(referrer, origem),
    origem = coalesce(origem, referrer)
where referrer is null or origem is null;

-- 3) Trigger de compatibilidade para contas (amount/date <-> valor/data_*)
create or replace function public.sync_conta_receber_compat()
returns trigger
language plpgsql
as $$
begin
  new.valor := coalesce(new.valor, new.amount, 0);
  new.amount := coalesce(new.amount, new.valor, 0);

  new.data_vencimento := coalesce(new.data_vencimento, new.date);
  new.date := coalesce(new.date, new.data_vencimento);

  if coalesce(new.recebido, false) and new.data_recebimento is null then
    new.data_recebimento := coalesce(new.date, new.data_vencimento, current_date);
  end if;

  if not coalesce(new.recebido, false) then
    new.data_recebimento := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_contas_receber_sync_compat on public.contas_receber;
create trigger tr_contas_receber_sync_compat
before insert or update on public.contas_receber
for each row execute function public.sync_conta_receber_compat();

create or replace function public.sync_conta_pagar_compat()
returns trigger
language plpgsql
as $$
begin
  new.valor := coalesce(new.valor, new.amount, 0);
  new.amount := coalesce(new.amount, new.valor, 0);

  new.data_vencimento := coalesce(new.data_vencimento, new.date);
  new.date := coalesce(new.date, new.data_vencimento);

  if coalesce(new.pago, false) and new.data_pagamento is null then
    new.data_pagamento := coalesce(new.date, new.data_vencimento, current_date);
  end if;

  if not coalesce(new.pago, false) then
    new.data_pagamento := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_contas_pagar_sync_compat on public.contas_pagar;
create trigger tr_contas_pagar_sync_compat
before insert or update on public.contas_pagar
for each row execute function public.sync_conta_pagar_compat();

-- 4) Endurecimento de numeração de pedidos (compatível + sem corrida)
with max_por_confeitaria as (
  select confeitaria_id, coalesce(max(numero), 0) as max_num
  from public.pedidos
  where numero is not null and numero > 0
  group by confeitaria_id
),
faltantes as (
  select p.id,
         p.confeitaria_id,
         row_number() over (partition by p.confeitaria_id order by p.created_date, p.id) as seq
  from public.pedidos p
  where p.numero is null or p.numero <= 0
)
update public.pedidos p
set numero = coalesce(m.max_num, 0) + f.seq
from faltantes f
left join max_por_confeitaria m on m.confeitaria_id = f.confeitaria_id
where p.id = f.id;

with duplicados as (
  select p.id,
         p.confeitaria_id,
         p.numero,
         row_number() over (
           partition by p.confeitaria_id, p.numero
           order by p.created_date, p.id
         ) as dup_rn
  from public.pedidos p
  where p.numero is not null and p.numero > 0
),
a_corrigir as (
  select d.id,
         d.confeitaria_id,
         row_number() over (partition by d.confeitaria_id order by d.numero, d.id) as seq
  from duplicados d
  where d.dup_rn > 1
),
maximos as (
  select confeitaria_id, coalesce(max(numero), 0) as max_num
  from public.pedidos
  group by confeitaria_id
)
update public.pedidos p
set numero = m.max_num + c.seq
from a_corrigir c
join maximos m on m.confeitaria_id = c.confeitaria_id
where p.id = c.id;

create unique index if not exists idx_pedidos_confeitaria_numero_unique
  on public.pedidos (confeitaria_id, numero);

create or replace function public.assign_pedido_numero()
returns trigger
language plpgsql
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

-- 5) Constraints seguras (NOT VALID para não bloquear legado)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'confeitarias_status_assinatura_check'
  ) then
    alter table public.confeitarias
      add constraint confeitarias_status_assinatura_check
      check (
        status_assinatura is null
        or status_assinatura in ('trial', 'active', 'canceling', 'past_due', 'canceled', 'incomplete')
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_status_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_status_check
      check (
        status is null
        or status in ('orcamento', 'aprovado', 'producao', 'pronto', 'entregue', 'cancelado')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_tipo_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_tipo_check
      check (
        tipo is null
        or tipo in ('personalizado', 'produto_pronto')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_valores_nonnegative_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_valores_nonnegative_check
      check (
        coalesce(valor_total, 0) >= 0
        and coalesce(valor_tamanho, 0) >= 0
        and coalesce(valor_massa, 0) >= 0
        and coalesce(valor_recheios, 0) >= 0
        and coalesce(valor_cobertura, 0) >= 0
        and coalesce(valor_extras, 0) >= 0
        and coalesce(valor_doces, 0) >= 0
        and coalesce(valor_salgados, 0) >= 0
        and coalesce(valor_urgencia, 0) >= 0
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produtos_preco_nonnegative_check'
  ) then
    alter table public.produtos
      add constraint produtos_preco_nonnegative_check
      check (coalesce(preco, 0) >= 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contas_receber_nonnegative_check'
  ) then
    alter table public.contas_receber
      add constraint contas_receber_nonnegative_check
      check (coalesce(valor, 0) >= 0 and coalesce(amount, 0) >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contas_receber_data_recebimento_check'
  ) then
    alter table public.contas_receber
      add constraint contas_receber_data_recebimento_check
      check (coalesce(recebido, false) = false or data_recebimento is not null) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contas_pagar_nonnegative_check'
  ) then
    alter table public.contas_pagar
      add constraint contas_pagar_nonnegative_check
      check (coalesce(valor, 0) >= 0 and coalesce(amount, 0) >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contas_pagar_data_pagamento_check'
  ) then
    alter table public.contas_pagar
      add constraint contas_pagar_data_pagamento_check
      check (coalesce(pago, false) = false or data_pagamento is not null) not valid;
  end if;
end $$;

-- 6) Índices para estabilidade de leitura
create index if not exists idx_clientes_confeitaria_created_date
  on public.clientes (confeitaria_id, created_date desc);

create index if not exists idx_pedidos_confeitaria_created_date
  on public.pedidos (confeitaria_id, created_date desc);

create index if not exists idx_acessos_catalogo_confeitaria_created_date
  on public.acessos_catalogo (confeitaria_id, created_date desc);

create index if not exists idx_acessos_catalogo_confeitaria_session
  on public.acessos_catalogo (confeitaria_id, session_id);
