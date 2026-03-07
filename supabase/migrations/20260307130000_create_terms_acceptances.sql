-- Tabela de registro de aceite dos termos de uso
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  terms_version text NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own terms acceptance"
  ON terms_acceptances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own terms acceptance"
  ON terms_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin can read all terms acceptances"
  ON terms_acceptances FOR SELECT
  USING (public.is_admin());

-- RPC autenticada: registra aceite com IP capturado dos headers do request
CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_ip text DEFAULT NULL,
  p_terms_version text DEFAULT '1.0'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ip text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prefere o IP dos headers do request (proxy/CDN); fallback para o parâmetro do cliente
  BEGIN
    v_ip := trim(split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',', 1
    ));
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF (v_ip IS NULL OR v_ip = '') THEN
    v_ip := p_ip;
  END IF;

  INSERT INTO terms_acceptances (user_id, ip_address, terms_version)
  VALUES (v_user_id, v_ip, p_terms_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_terms_acceptance(text, text) TO authenticated;
