-- ============================================================
-- Formas de Pagamento — adiciona campos extras
-- (tabela e RLS já criados pelo supabaseCompatClient)
-- ============================================================
ALTER TABLE public.formas_pagamento
  ADD COLUMN IF NOT EXISTS descricao        text,
  ADD COLUMN IF NOT EXISTS parcelamento_max int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS chave_pix        text;

-- ============================================================
-- Pedidos: adicionar campos de pagamento
-- ============================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento_id   uuid,
  ADD COLUMN IF NOT EXISTS forma_pagamento_nome text,
  ADD COLUMN IF NOT EXISTS parcelas             int DEFAULT 1;
