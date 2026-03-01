-- Adiciona limite diário de pedidos personalizados na confeitaria
ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS limite_pedidos_personalizados_diarios integer DEFAULT NULL;

-- Função pública para contar pedidos personalizados de uma data específica
CREATE OR REPLACE FUNCTION public.contar_pedidos_personalizados(
  p_confeitaria_id uuid,
  p_data_entrega    text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM public.pedidos
  WHERE confeitaria_id = p_confeitaria_id
    AND data_entrega   = p_data_entrega
    AND tipo           = 'personalizado';
$$;

-- Permite que usuários anônimos (catálogo público) consultem a contagem
GRANT EXECUTE ON FUNCTION public.contar_pedidos_personalizados TO anon;
