-- Adiciona coluna bloqueado à tabela confeitarias
ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.confeitarias.bloqueado IS 'Quando true, o acesso da confeitaria ao sistema é bloqueado.';
