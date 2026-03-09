ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS categorias_produto jsonb DEFAULT '[{"value":"bolo","label":"Bolo"},{"value":"doce","label":"Doce"},{"value":"salgado","label":"Salgado"},{"value":"bebida","label":"Bebida"},{"value":"outro","label":"Outro"}]'::jsonb;
