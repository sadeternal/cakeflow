-- Função helper para verificar se o usuário atual é admin
-- Usa SECURITY DEFINER para poder consultar profiles sem restrição de RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Admin pode ver todas as confeitarias (além da própria, já coberta pela policy existente)
CREATE POLICY "confeitarias_admin_select"
  ON public.confeitarias FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.can_access_confeitaria(id));

-- Admin pode ver todos os profiles (além do próprio, já coberto pela policy existente)
CREATE POLICY "profiles_admin_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Ativar o usuário criador do sistema como admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'sugimoto365@gmail.com';
