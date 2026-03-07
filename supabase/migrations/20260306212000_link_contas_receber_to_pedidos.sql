alter table public.contas_receber
  add column if not exists pedido_id uuid references public.pedidos(id) on delete cascade,
  add column if not exists pedido_numero text,
  add column if not exists forma_pagamento text,
  add column if not exists parcela_atual int,
  add column if not exists parcelas_total int,
  add column if not exists origem text;

create index if not exists idx_contas_receber_pedido_id on public.contas_receber (pedido_id);
create index if not exists idx_contas_receber_origem on public.contas_receber (origem);
