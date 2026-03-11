-- Adiciona coluna limite_complementos (integer) na tabela produtos
-- Define até quantos complementos o cliente pode selecionar ao adicionar o produto ao carrinho
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS limite_complementos integer DEFAULT NULL;
