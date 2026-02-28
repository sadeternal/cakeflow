-- Migration to create catalog_get_formas_pagamento RPC

CREATE OR REPLACE FUNCTION public.catalog_get_formas_pagamento(p_confeitaria_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  ativo BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    id,
    nome,
    ativo
  FROM public.formas_pagamento
  WHERE confeitaria_id = p_confeitaria_id 
    AND ativo = true;
$$;

-- Grant execution permission to anonymous users
GRANT EXECUTE ON FUNCTION public.catalog_get_formas_pagamento(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.catalog_get_formas_pagamento(UUID) TO authenticated;
