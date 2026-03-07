-- Tabela de parcelamento de pedidos
CREATE TABLE IF NOT EXISTS public.parcelamento_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confeitaria_id uuid NOT NULL,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  numero_parcela int NOT NULL,
  valor numeric(10, 2) NOT NULL,
  data_vencimento date NOT NULL,
  status varchar(20) DEFAULT 'pendente',
  data_pagamento date,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now()
);

ALTER TABLE public.parcelamento_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_rw_own" ON public.parcelamento_pedidos;
CREATE POLICY "pp_rw_own" ON public.parcelamento_pedidos
  FOR ALL USING (confeitaria_id = current_confeitaria_id());
