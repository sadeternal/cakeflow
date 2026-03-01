-- Permite que usuários anônimos (catálogo público) leiam os dias bloqueados.
-- Necessário para validar datas no fluxo de pedido público.
CREATE POLICY "dias_bloqueados_public_read"
  ON public.dias_bloqueados FOR SELECT
  TO anon
  USING (true);
