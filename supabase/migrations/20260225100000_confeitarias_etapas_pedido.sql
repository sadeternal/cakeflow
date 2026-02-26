-- Adicionar coluna para configuração de etapas do pedido personalizado
alter table public.confeitarias 
add column if not exists etapas_pedido jsonb default '[
  {"key": "tamanho", "label": "Tamanho", "ativo": true},
  {"key": "massa", "label": "Massa", "ativo": true},
  {"key": "recheios", "label": "Recheios", "ativo": true},
  {"key": "cobertura", "label": "Cobertura", "ativo": true},
  {"key": "extras", "label": "Extras", "ativo": true},
  {"key": "doces_salgados", "label": "Doces e Salgados", "ativo": true},
  {"key": "entrega", "label": "Entrega", "ativo": true},
  {"key": "dados", "label": "Seus Dados", "ativo": true},
  {"key": "pagamento", "label": "Pagamento", "ativo": true},
  {"key": "resumo", "label": "Resumo", "ativo": true}
]'::jsonb;

-- Comentário para documentação
comment on column public.confeitarias.etapas_pedido is 'Configuração de ordem e visibilidade das etapas no pedido personalizado do catálogo';
