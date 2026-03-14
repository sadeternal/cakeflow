ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS catalogo_ativo boolean DEFAULT true;
