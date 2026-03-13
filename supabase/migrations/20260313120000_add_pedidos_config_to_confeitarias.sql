ALTER TABLE confeitarias
  ADD COLUMN IF NOT EXISTS delivery_ativo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mensagem_confirmacao_pedido text,
  ADD COLUMN IF NOT EXISTS delivery_catalogo_pronto boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_catalogo_personalizado boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_interno_pronto boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_interno_personalizado boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mensagem_status_orcamento text,
  ADD COLUMN IF NOT EXISTS mensagem_status_aprovado text,
  ADD COLUMN IF NOT EXISTS mensagem_status_producao text,
  ADD COLUMN IF NOT EXISTS mensagem_status_pronto text,
  ADD COLUMN IF NOT EXISTS mensagem_status_entregue text;
