CREATE TABLE IF NOT EXISTS public.prospeccao_contatos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cidade text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  enviado boolean NOT NULL DEFAULT false,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospeccao_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.prospeccao_contatos
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
