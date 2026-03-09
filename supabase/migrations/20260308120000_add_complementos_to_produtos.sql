-- Adiciona coluna complementos (jsonb) na tabela produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS complementos jsonb DEFAULT '[]'::jsonb;
