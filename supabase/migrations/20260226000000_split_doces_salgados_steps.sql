-- Migração para separar "doces_salgados" em "doces" e "salgados"
-- Atualiza as confeitarias existentes
UPDATE public.confeitarias
SET etapas_pedido = (
  SELECT jsonb_agg(new_el)
  FROM (
    SELECT new_el
    FROM (
      SELECT value as element, ordinality
      FROM jsonb_array_elements(etapas_pedido) WITH ORDINALITY
    ) s,
    LATERAL (
      SELECT CASE 
        WHEN s.element->>'key' = 'doces_salgados' THEN 
          jsonb_build_object('key', 'doces', 'label', 'Doces', 'ativo', COALESCE((s.element->>'ativo')::boolean, true))
        ELSE s.element 
      END AS new_el, 0 as sub_ord
      UNION ALL
      SELECT 
        jsonb_build_object('key', 'salgados', 'label', 'Salgados', 'ativo', COALESCE((s.element->>'ativo')::boolean, true)),
        1 as sub_ord
      WHERE s.element->>'key' = 'doces_salgados'
    ) l
    ORDER BY s.ordinality, l.sub_ord
  ) sub
)
WHERE etapas_pedido @> '[{"key": "doces_salgados"}]';

-- Atualiza o valor padrão da coluna para novas confeitarias
ALTER TABLE public.confeitarias 
ALTER COLUMN etapas_pedido SET DEFAULT '[
  {"key": "tamanho", "label": "Tamanho", "ativo": true},
  {"key": "massa", "label": "Massa", "ativo": true},
  {"key": "recheios", "label": "Recheios", "ativo": true},
  {"key": "cobertura", "label": "Cobertura", "ativo": true},
  {"key": "extras", "label": "Extras", "ativo": true},
  {"key": "doces", "label": "Doces", "ativo": true},
  {"key": "salgados", "label": "Salgados", "ativo": true},
  {"key": "entrega", "label": "Entrega", "ativo": true},
  {"key": "dados", "label": "Seus Dados", "ativo": true},
  {"key": "pagamento", "label": "Pagamento", "ativo": true},
  {"key": "resumo", "label": "Resumo", "ativo": true}
]'::jsonb;
