-- Permite que o admin atualize qualquer confeitaria (ex: bloquear/desbloquear conta)
CREATE POLICY "confeitarias_admin_update"
  ON public.confeitarias FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
