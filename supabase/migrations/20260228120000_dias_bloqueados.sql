-- Cria tabela de dias bloqueados para confeitarias.
-- Dias bloqueados impedem clientes de fazer pedidos nesses dias via catálogo público.

CREATE TABLE IF NOT EXISTS public.dias_bloqueados (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  confeitaria_id uuid        NOT NULL REFERENCES public.confeitarias(id) ON DELETE CASCADE,
  data           date        NOT NULL,
  motivo         text,
  created_date   timestamptz DEFAULT now(),
  UNIQUE (confeitaria_id, data)
);

ALTER TABLE public.dias_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dias_bloqueados_rw_own"
  ON public.dias_bloqueados FOR ALL
  TO authenticated
  USING  (confeitaria_id = public.current_confeitaria_id())
  WITH CHECK (confeitaria_id = public.current_confeitaria_id());
