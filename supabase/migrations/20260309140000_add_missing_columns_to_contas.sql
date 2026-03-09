-- contas_receber: add missing columns used by the frontend
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS cliente_nome    text,
  ADD COLUMN IF NOT EXISTS valor           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo            text,
  ADD COLUMN IF NOT EXISTS data_recebimento date;

-- contas_pagar: add missing columns used by the frontend
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS fornecedor      text,
  ADD COLUMN IF NOT EXISTS valor           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_pagamento  date;

-- Backfill valor from amount where it's null/zero
UPDATE public.contas_receber SET valor = amount WHERE valor IS NULL OR valor = 0;
UPDATE public.contas_pagar   SET valor = amount WHERE valor IS NULL OR valor = 0;
