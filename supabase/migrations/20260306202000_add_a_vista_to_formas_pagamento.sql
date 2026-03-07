alter table public.formas_pagamento
  add column if not exists a_vista boolean not null default false;

update public.formas_pagamento
set
  a_vista = true,
  parcelamento_max = 1,
  descricao = 'À vista'
where lower(coalesce(nome, '')) like '%pix%';
