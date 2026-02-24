alter table public.massas
  add column if not exists descricao text,
  add column if not exists valor_adicional numeric(10,2);

alter table public.massas
  alter column valor_adicional set default 0;

alter table public.recheios
  add column if not exists tipo text,
  add column if not exists valor_adicional numeric(10,2);

alter table public.recheios
  alter column tipo set default 'tradicional',
  alter column valor_adicional set default 0;

alter table public.tamanhos
  add column if not exists tipo_medida text,
  add column if not exists quantidade_base numeric(10,2),
  add column if not exists valor_base numeric(10,2),
  add column if not exists max_recheios int;

alter table public.tamanhos
  alter column tipo_medida set default 'kg',
  alter column quantidade_base set default 1,
  alter column valor_base set default 0,
  alter column max_recheios set default 2;

alter table public.coberturas
  add column if not exists observacoes text,
  add column if not exists valor_adicional numeric(10,2);

alter table public.coberturas
  alter column valor_adicional set default 0;

alter table public.extras
  add column if not exists valor numeric(10,2),
  add column if not exists valor_variavel boolean,
  add column if not exists requer_observacao boolean;

alter table public.extras
  alter column valor set default 0,
  alter column valor_variavel set default false,
  alter column requer_observacao set default false;

alter table public.doces
  add column if not exists valor_unitario numeric(10,2),
  add column if not exists quantidade_minima int;

alter table public.doces
  alter column valor_unitario set default 0,
  alter column quantidade_minima set default 1;

alter table public.salgados
  add column if not exists valor_unitario numeric(10,2),
  add column if not exists quantidade_minima int;

alter table public.salgados
  alter column valor_unitario set default 0,
  alter column quantidade_minima set default 1;

update public.massas
set valor_adicional = coalesce(valor_adicional, preco, 0);

update public.recheios
set valor_adicional = coalesce(valor_adicional, preco, 0),
    tipo = coalesce(tipo, 'tradicional');

update public.tamanhos
set valor_base = coalesce(valor_base, preco, 0),
    tipo_medida = coalesce(tipo_medida, 'kg'),
    quantidade_base = coalesce(quantidade_base, 1),
    max_recheios = coalesce(max_recheios, 2);

update public.coberturas
set valor_adicional = coalesce(valor_adicional, preco, 0);

update public.extras
set valor = coalesce(valor, preco, 0),
    valor_variavel = coalesce(valor_variavel, false),
    requer_observacao = coalesce(requer_observacao, false);

update public.doces
set valor_unitario = coalesce(valor_unitario, preco, 0),
    quantidade_minima = coalesce(quantidade_minima, 1);

update public.salgados
set valor_unitario = coalesce(valor_unitario, preco, 0),
    quantidade_minima = coalesce(quantidade_minima, 1);
