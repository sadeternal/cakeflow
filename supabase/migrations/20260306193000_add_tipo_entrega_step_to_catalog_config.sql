alter table public.confeitarias
alter column etapas_pedido set default '[
  {"key": "tamanho", "label": "Tamanho", "ativo": true},
  {"key": "massa", "label": "Massa", "ativo": true},
  {"key": "recheios", "label": "Recheios", "ativo": true},
  {"key": "cobertura", "label": "Cobertura", "ativo": true},
  {"key": "extras", "label": "Extras", "ativo": true},
  {"key": "doces", "label": "Doces", "ativo": true},
  {"key": "salgados", "label": "Salgados", "ativo": true},
  {"key": "tipo_entrega", "label": "Tipo de Entrega", "ativo": true},
  {"key": "entrega", "label": "Entrega", "ativo": true},
  {"key": "dados", "label": "Seus Dados", "ativo": true},
  {"key": "pagamento", "label": "Pagamento", "ativo": true},
  {"key": "resumo", "label": "Resumo", "ativo": true}
]'::jsonb;
