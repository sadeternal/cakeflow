-- Adiciona campos para fluxo de entrega de produtos prontos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS cpf_cliente text,
  ADD COLUMN IF NOT EXISTS endereco_entrega text,
  ADD COLUMN IF NOT EXISTS valor_delivery numeric(10,2) DEFAULT 0;
