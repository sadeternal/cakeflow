ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS max_complementos_produto integer DEFAULT 4;
