-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Profiles (espelho mínimo do usuário autenticado)
create table if not exists public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  role text not null default 'user',
  confeitaria_id uuid,
  onboarding_etapas_concluidas jsonb not null default '[]'::jsonb,
  onboarding_finalizado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.confeitarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique,
  owner_email text,
  telefone text,
  endereco text,
  instagram text,
  descricao text,
  logo_url text,
  cor_principal text,
  prazo_minimo_dias int default 3,
  habilitar_taxa_urgencia boolean default true,
  taxa_urgencia_percentual numeric(10,2) default 20,
  taxa_delivery numeric(10,2) default 0,
  receber_pedidos_whatsapp boolean default true,
  exibir_pedido_personalizado boolean default true,
  frase_pedido_personalizado text,
  horario_funcionamento jsonb,
  dias_funcionamento jsonb,
  stripe_customer_id text,
  stripe_subscription_id text,
  status_assinatura text default 'trial',
  data_fim_trial timestamptz,
  data_proximo_pagamento timestamptz,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

alter table public.profiles
  add constraint profiles_confeitaria_id_fkey
  foreign key (confeitaria_id) references public.confeitarias(id) on delete set null;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  telefone text,
  cpf text,
  endereco text,
  observacoes text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  numero int,
  status text default 'orcamento',
  tipo text,
  tipo_entrega text,
  valor_total numeric(10,2) default 0,
  data_entrega date,
  horario_entrega text,
  observacoes text,
  itens jsonb,
  forma_pagamento text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(10,2) default 0,
  imagem_url text,
  categoria text,
  disponivel boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  ativo boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  descricao text,
  categoria text,
  amount numeric(10,2) default 0,
  date date,
  status text,
  type text,
  recebido boolean default false,
  data_vencimento date,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  descricao text,
  categoria text,
  amount numeric(10,2) default 0,
  date date,
  status text,
  type text,
  pago boolean default false,
  data_vencimento date,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists public.massas (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.recheios (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.tamanhos (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.coberturas (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.extras (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.doces (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.salgados (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) default 0,
  ativo boolean default true,
  created_date timestamptz default now()
);

create table if not exists public.acessos_catalogo (
  id uuid primary key default gen_random_uuid(),
  confeitaria_id uuid not null references public.confeitarias(id) on delete cascade,
  origem text,
  user_agent text,
  created_date timestamptz default now()
);

create table if not exists public.app_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  page_name text not null,
  occurred_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.confeitarias enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.produtos enable row level security;
alter table public.formas_pagamento enable row level security;
alter table public.contas_receber enable row level security;
alter table public.contas_pagar enable row level security;
alter table public.massas enable row level security;
alter table public.recheios enable row level security;
alter table public.tamanhos enable row level security;
alter table public.coberturas enable row level security;
alter table public.extras enable row level security;
alter table public.doces enable row level security;
alter table public.salgados enable row level security;
alter table public.acessos_catalogo enable row level security;
alter table public.app_logs enable row level security;

-- policies helpers
create or replace function public.current_confeitaria_id()
returns uuid
language sql
stable
as $$
  select confeitaria_id from public.profiles where id = auth.uid() limit 1;
$$;

-- profiles
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_upsert_own"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- confeitarias
create policy "confeitarias_select_own"
  on public.confeitarias for select
  using (id = public.current_confeitaria_id());

create policy "confeitarias_write_own"
  on public.confeitarias for all
  using (id = public.current_confeitaria_id())
  with check (id = public.current_confeitaria_id());

-- tabelas por confeitaria
create policy "clientes_rw_own"
  on public.clientes for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "pedidos_rw_own"
  on public.pedidos for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "produtos_rw_own"
  on public.produtos for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "formas_pagamento_rw_own"
  on public.formas_pagamento for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "contas_receber_rw_own"
  on public.contas_receber for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "contas_pagar_rw_own"
  on public.contas_pagar for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "massas_rw_own"
  on public.massas for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "recheios_rw_own"
  on public.recheios for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "tamanhos_rw_own"
  on public.tamanhos for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "coberturas_rw_own"
  on public.coberturas for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "extras_rw_own"
  on public.extras for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "doces_rw_own"
  on public.doces for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "salgados_rw_own"
  on public.salgados for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "acessos_catalogo_rw_own"
  on public.acessos_catalogo for all
  using (confeitaria_id = public.current_confeitaria_id())
  with check (confeitaria_id = public.current_confeitaria_id());

create policy "app_logs_rw_own"
  on public.app_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- acesso público de leitura ao catálogo
create policy "public_catalogo_read"
  on public.confeitarias for select
  using (true);

create policy "public_produtos_read"
  on public.produtos for select
  using (true);

create policy "public_formas_pagamento_read"
  on public.formas_pagamento for select
  using (true);

create policy "public_massas_read"
  on public.massas for select
  using (true);

create policy "public_recheios_read"
  on public.recheios for select
  using (true);

create policy "public_tamanhos_read"
  on public.tamanhos for select
  using (true);

create policy "public_coberturas_read"
  on public.coberturas for select
  using (true);

create policy "public_extras_read"
  on public.extras for select
  using (true);

create policy "public_doces_read"
  on public.doces for select
  using (true);

create policy "public_salgados_read"
  on public.salgados for select
  using (true);

-- updated_date automático
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create trigger tr_confeitarias_updated_date
before update on public.confeitarias
for each row execute function public.set_updated_date();

create trigger tr_clientes_updated_date
before update on public.clientes
for each row execute function public.set_updated_date();

create trigger tr_pedidos_updated_date
before update on public.pedidos
for each row execute function public.set_updated_date();

create trigger tr_produtos_updated_date
before update on public.produtos
for each row execute function public.set_updated_date();

create trigger tr_formas_pagamento_updated_date
before update on public.formas_pagamento
for each row execute function public.set_updated_date();

create trigger tr_contas_receber_updated_date
before update on public.contas_receber
for each row execute function public.set_updated_date();

create trigger tr_contas_pagar_updated_date
before update on public.contas_pagar
for each row execute function public.set_updated_date();
