-- Adiciona campo de quantidade/estoque aos produtos
-- NULL = sem limite (venda livre)
-- 0 = sem estoque
-- > 0 = quantidade disponível

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT NULL;
