import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  MessageCircle,
  Plus,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { CPFInput, TelefoneInput } from '@/components/ui/masked-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const steps = [
  { id: 1, title: 'Tamanho' },
  { id: 2, title: 'Massa' },
  { id: 3, title: 'Recheios' },
  { id: 4, title: 'Cobertura' },
  { id: 5, title: 'Extras' },
  { id: 6, title: 'Doces e Salgados' },
  { id: 7, title: 'Entrega' },
  { id: 8, title: 'Seus Dados' },
  { id: 9, title: 'Pagamento' },
  { id: 10, title: 'Resumo' },
];

export default function PedidoPublico({ confeitaria, onClose }) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  const [cliente, setCliente] = useState({
    nome: '',
    cpf: '',
    telefone: '',
  });

  const [pedido, setPedido] = useState({
    tamanho_id: '',
    tamanho_nome: '',
    massa_id: '',
    massa_nome: '',
    recheios: [],
    cobertura_id: '',
    cobertura_nome: '',
    extras: [],
    doces: [],
    salgados: [],
    deseja_doces: false,
    deseja_salgados: false,
    data_entrega: '',
    horario_entrega: '',
    observacoes: '',
    forma_pagamento: '',
    valor_tamanho: 0,
    valor_massa: 0,
    valor_recheios: 0,
    valor_cobertura: 0,
    valor_extras: 0,
    valor_doces: 0,
    valor_salgados: 0,
    valor_urgencia: 0,
    valor_total: 0,
  });

  // Data queries
  const { data: tamanhos = [] } = useQuery({
    queryKey: ['tamanhos', confeitaria.id],
    queryFn: () => appClient.entities.Tamanho.filter({ confeitaria_id: confeitaria.id, ativo: true }),
  });

  const { data: massas = [] } = useQuery({
    queryKey: ['massas', confeitaria.id],
    queryFn: () => appClient.entities.Massa.filter({ confeitaria_id: confeitaria.id, ativo: true }),
  });

  const { data: recheios = [] } = useQuery({
    queryKey: ['recheios', confeitaria.id],
    queryFn: () => appClient.entities.Recheio.filter({ confeitaria_id: confeitaria.id, ativo: true }),
  });

  const { data: coberturas = [] } = useQuery({
    queryKey: ['coberturas', confeitaria.id],
    queryFn: () => appClient.entities.Cobertura.filter({ confeitaria_id: confeitaria.id, ativo: true }),
  });

  const { data: extras = [] } = useQuery({
    queryKey: ['extras', confeitaria.id],
    queryFn: () => appClient.entities.Extra.filter({ confeitaria_id: confeitaria.id, ativo: true }),
  });

  const { data: doces = [] } = useQuery({
    queryKey: ['doces-pedido', confeitaria.id],
    queryFn: () => appClient.entities.Doce.filter({ 
      confeitaria_id: confeitaria.id,
      ativo: true
    }),
  });

  const { data: salgados = [] } = useQuery({
    queryKey: ['salgados-pedido', confeitaria.id],
    queryFn: () => appClient.entities.Salgado.filter({ 
      confeitaria_id: confeitaria.id,
      ativo: true
    }),
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formasPagamento', confeitaria.id],
    queryFn: () => appClient.entities.FormaPagamento.filter({ 
      confeitaria_id: confeitaria.id,
      ativo: true
    }),
  });

  // Calculate totals
  useEffect(() => {
    const valorRecheios = pedido.recheios.reduce((acc, r) => acc + (r.valor || 0), 0);
    const valorExtras = pedido.extras.reduce((acc, e) => acc + (e.valor || 0), 0);
    const valorDoces = pedido.doces.reduce((acc, d) => acc + (d.valor_unitario * d.quantidade), 0);
    const valorSalgados = pedido.salgados.reduce((acc, s) => acc + (s.valor_unitario * s.quantidade), 0);

    let valorUrgencia = 0;
    if (pedido.data_entrega && confeitaria?.prazo_minimo_dias && confeitaria?.habilitar_taxa_urgencia !== false) {
      const dias = differenceInDays(parseISO(pedido.data_entrega), new Date());
      if (dias < confeitaria.prazo_minimo_dias && dias >= 0) {
        const subtotal = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras + valorDoces + valorSalgados;
        valorUrgencia = subtotal * ((confeitaria.taxa_urgencia_percentual || 20) / 100);
      }
    }

    const total = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras + valorDoces + valorSalgados + valorUrgencia;

    setPedido(prev => ({
      ...prev,
      valor_recheios: valorRecheios,
      valor_extras: valorExtras,
      valor_doces: valorDoces,
      valor_salgados: valorSalgados,
      valor_urgencia: valorUrgencia,
      valor_total: total,
    }));
  }, [pedido.valor_tamanho, pedido.valor_massa, pedido.recheios, pedido.valor_cobertura, pedido.extras, pedido.doces, pedido.salgados, pedido.data_entrega, confeitaria]);

  const selectedTamanho = tamanhos.find(t => t.id === pedido.tamanho_id);
  const maxRecheios = selectedTamanho?.max_recheios || 2;

  const handleEnviarWhatsApp = () => {
    const phone = confeitaria?.telefone?.replace(/\D/g, '');
    let mensagem = `*Novo Pedido Personalizado - ORÇAMENTO*\n\n`;
    mensagem += `*Cliente:* ${cliente.nome}\n`;
    mensagem += `*Telefone:* ${cliente.telefone}\n`;
    mensagem += `*Forma de Pagamento:* ${pedido.forma_pagamento}\n\n`;

    mensagem += `*Bolo:*\n`;
    mensagem += `- Tamanho: ${pedido.tamanho_nome} (R$ ${pedido.valor_tamanho?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
    mensagem += `- Massa: ${pedido.massa_nome}${pedido.valor_massa > 0 ? ` (+ R$ ${pedido.valor_massa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}\n`;
    if (pedido.recheios.length > 0) {
      mensagem += `- Recheios: ${pedido.recheios.map(r => r.nome).join(', ')}${pedido.valor_recheios > 0 ? ` (+ R$ ${pedido.valor_recheios?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}\n`;
    }
    mensagem += `- Cobertura: ${pedido.cobertura_nome}${pedido.valor_cobertura > 0 ? ` (+ R$ ${pedido.valor_cobertura?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}\n`;

    if (pedido.extras.length > 0) {
      mensagem += `\n*Extras:*\n`;
      pedido.extras.forEach(e => {
        mensagem += `- ${e.nome} (R$ ${e.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${e.observacao ? `\n  Obs: ${e.observacao}` : ''}\n`;
      });
    }

    if (pedido.doces.length > 0) {
      mensagem += `\n*Doces:*\n`;
      pedido.doces.forEach(d => {
        mensagem += `- ${d.nome} (x${d.quantidade}) - R$ ${(d.valor_unitario * d.quantidade)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
    }

    if (pedido.salgados.length > 0) {
      mensagem += `\n*Salgados:*\n`;
      pedido.salgados.forEach(s => {
        mensagem += `- ${s.nome} (x${s.quantidade}) - R$ ${(s.valor_unitario * s.quantidade)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
    }

    mensagem += `\n*Entrega:*\n`;
    mensagem += `- Data: ${format(parseISO(pedido.data_entrega), "dd/MM/yyyy")}\n`;
    if (pedido.horario_entrega) {
      mensagem += `- Horário: ${pedido.horario_entrega}\n`;
    }

    if (pedido.observacoes) {
      mensagem += `\n*Observações Adicionais:*\n${pedido.observacoes}\n`;
    }

    if (pedido.valor_urgencia > 0) {
      mensagem += `\n*Taxa de Urgência:* R$ ${pedido.valor_urgencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    }

    mensagem += `\n*Valor Total (Estimado):* R$ ${pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    mensagem += `\n_Aguarde nosso contato para confirmação e detalhes de pagamento._`;

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setTimeout(() => onClose(), 500);
  };

  const handleEnviarPedido = async () => {
    setEnviandoPedido(true);
    try {
      const observacoesComCpf = cliente.cpf
        ? `${pedido.observacoes ? `${pedido.observacoes}\n\n` : ''}CPF: ${cliente.cpf}`
        : pedido.observacoes;

      // Criar pedido
      await appClient.functions.invokePublicRpc('catalog_create_pedido', {
        payload: {
          ...pedido,
          confeitaria_id: confeitaria.id,
          cliente_id: null,
          cliente_nome: cliente.nome,
          cliente_telefone: cliente.telefone,
          numero: null,
          observacoes: observacoesComCpf,
          status: 'orcamento',
          tipo: 'personalizado',
        }
      });

      // Invalidar queries para atualizar lista de pedidos em tempo real
      queryClient.invalidateQueries(['pedidos']);
      queryClient.invalidateQueries(['contas-receber']);

      setPedidoEnviado(true);
    } catch (error) {
      alert(`Erro ao enviar pedido: ${error?.message || 'Tente novamente.'}`);
    } finally {
      setEnviandoPedido(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return pedido.tamanho_id;
      case 2: return pedido.massa_id;
      case 3: return pedido.recheios.length > 0;
      case 4: return pedido.cobertura_id;
      case 5: return true; // Extras
      case 6: return true; // Doces e Salgados
      case 7: return pedido.data_entrega;
      case 8: return cliente.nome && cliente.telefone;
      case 9: return pedido.forma_pagamento;
      default: return true;
    }
  };

  const corPrincipal = confeitaria.cor_principal || '#ec4899';

  if (pedidoEnviado) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${corPrincipal}20` }}
            >
              <Check className="w-8 h-8" style={{ color: corPrincipal }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Enviado!</h2>
            <p className="text-gray-600 mb-6">
              Recebemos seu pedido e entraremos em contato em breve para confirmação e pagamento.
            </p>
            {confeitaria.receber_pedidos_whatsapp && confeitaria.telefone ? (
              <Button 
                onClick={handleEnviarWhatsApp} 
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Detalhes via WhatsApp
              </Button>
            ) : (
              <Button onClick={onClose} style={{ backgroundColor: corPrincipal }}>
                Fechar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: corPrincipal }} />
            Monte seu Bolo Personalizado
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex gap-1 mb-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{
                  backgroundColor: step.id <= currentStep ? corPrincipal : '#e5e7eb'
                }}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 text-center">
            Passo {currentStep} de {steps.length}: {steps[currentStep - 1].title}
          </p>
        </div>

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Tamanho */}
          {currentStep === 1 && (
            <RadioGroup
              value={pedido.tamanho_id}
              onValueChange={(value) => {
                const tam = tamanhos.find(t => t.id === value);
                setPedido({
                  ...pedido,
                  tamanho_id: value,
                  tamanho_nome: tam?.nome || '',
                  valor_tamanho: tam?.valor_base || 0,
                  recheios: [],
                });
              }}
              className="grid gap-3"
            >
              {tamanhos.map((tamanho) => (
                <label
                  key={tamanho.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.tamanho_id === tamanho.id
                      ? 'border-2'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  style={{
                    backgroundColor: pedido.tamanho_id === tamanho.id ? `${corPrincipal}10` : undefined,
                    borderColor: pedido.tamanho_id === tamanho.id ? corPrincipal : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={tamanho.id} />
                    <div>
                      <p className="font-medium text-gray-900">{tamanho.nome}</p>
                      <p className="text-sm text-gray-500">
                        Até {tamanho.max_recheios} recheio(s)
                      </p>
                    </div>
                  </div>
                  <span className="font-bold" style={{ color: corPrincipal }}>
                    R$ {tamanho.valor_base?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 2: Massa */}
          {currentStep === 2 && (
            <RadioGroup
              value={pedido.massa_id}
              onValueChange={(value) => {
                const massa = massas.find(m => m.id === value);
                setPedido({
                  ...pedido,
                  massa_id: value,
                  massa_nome: massa?.nome || '',
                  valor_massa: massa?.valor_adicional || 0,
                });
              }}
              className="grid gap-3"
            >
              {massas.map((massa) => (
                <label
                  key={massa.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.massa_id === massa.id
                      ? 'border-2'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  style={{
                    backgroundColor: pedido.massa_id === massa.id ? `${corPrincipal}10` : undefined,
                    borderColor: pedido.massa_id === massa.id ? corPrincipal : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={massa.id} />
                    <div>
                      <p className="font-medium text-gray-900">{massa.nome}</p>
                      {massa.descricao && (
                        <p className="text-sm text-gray-500">{massa.descricao}</p>
                      )}
                    </div>
                  </div>
                  {massa.valor_adicional > 0 ? (
                    <span className="font-bold" style={{ color: corPrincipal }}>
                      + R$ {massa.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <Badge variant="secondary">Incluso</Badge>
                  )}
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 3: Recheios */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: `${corPrincipal}10` }}>
                <span className="text-sm font-medium" style={{ color: corPrincipal }}>
                  Selecione até {maxRecheios} recheio(s)
                </span>
                <Badge variant="secondary">
                  {pedido.recheios.length}/{maxRecheios}
                </Badge>
              </div>

              {['tradicional', 'premium', 'especial'].map((tipo) => {
                const recheiosTipo = recheios.filter(r => r.tipo === tipo);
                if (recheiosTipo.length === 0) return null;

                return (
                  <div key={tipo} className="space-y-2">
                    <h4 className="font-semibold text-gray-700 capitalize">{tipo}</h4>
                    <div className="grid gap-2">
                      {recheiosTipo.map((recheio) => {
                        const isSelected = pedido.recheios.some(r => r.id === recheio.id);
                        const canSelect = isSelected || pedido.recheios.length < maxRecheios;

                        return (
                          <label
                            key={recheio.id}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-2'
                                : canSelect
                                  ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                  : 'bg-gray-100 opacity-50 cursor-not-allowed border-2 border-transparent'
                            }`}
                            style={{
                              backgroundColor: isSelected ? `${corPrincipal}10` : undefined,
                              borderColor: isSelected ? corPrincipal : undefined,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                disabled={!canSelect}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPedido({
                                      ...pedido,
                                      recheios: [...pedido.recheios, {
                                        id: recheio.id,
                                        nome: recheio.nome,
                                        valor: recheio.valor_adicional || 0,
                                      }],
                                    });
                                  } else {
                                    setPedido({
                                      ...pedido,
                                      recheios: pedido.recheios.filter(r => r.id !== recheio.id),
                                    });
                                  }
                                }}
                              />
                              <span className="font-medium text-gray-900">{recheio.nome}</span>
                            </div>
                            {recheio.valor_adicional > 0 ? (
                              <span className="font-bold" style={{ color: corPrincipal }}>
                                + R$ {recheio.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <Badge variant="secondary">Incluso</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 4: Cobertura */}
          {currentStep === 4 && (
            <RadioGroup
              value={pedido.cobertura_id}
              onValueChange={(value) => {
                const cob = coberturas.find(c => c.id === value);
                setPedido({
                  ...pedido,
                  cobertura_id: value,
                  cobertura_nome: cob?.nome || '',
                  valor_cobertura: cob?.valor_adicional || 0,
                });
              }}
              className="grid gap-3"
            >
              {coberturas.map((cobertura) => (
                <label
                  key={cobertura.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.cobertura_id === cobertura.id
                      ? 'border-2'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  style={{
                    backgroundColor: pedido.cobertura_id === cobertura.id ? `${corPrincipal}10` : undefined,
                    borderColor: pedido.cobertura_id === cobertura.id ? corPrincipal : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={cobertura.id} />
                    <div>
                      <p className="font-medium text-gray-900">{cobertura.nome}</p>
                      {cobertura.observacoes && (
                        <p className="text-sm text-gray-500">{cobertura.observacoes}</p>
                      )}
                    </div>
                  </div>
                  {cobertura.valor_adicional > 0 ? (
                    <span className="font-bold" style={{ color: corPrincipal }}>
                      + R$ {cobertura.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <Badge variant="secondary">Incluso</Badge>
                  )}
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 5: Extras */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Selecione os extras desejados (opcional)</p>
              {extras.map((extra) => {
                const selected = pedido.extras.find(e => e.id === extra.id);

                return (
                  <div
                    key={extra.id}
                    className={`p-4 rounded-xl transition-colors ${
                      selected
                        ? 'border-2'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                    style={{
                      backgroundColor: selected ? `${corPrincipal}10` : undefined,
                      borderColor: selected ? corPrincipal : undefined,
                    }}
                  >
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!selected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPedido({
                                ...pedido,
                                extras: [...pedido.extras, {
                                  id: extra.id,
                                  nome: extra.nome,
                                  valor: extra.valor || 0,
                                  observacao: '',
                                }],
                              });
                            } else {
                              setPedido({
                                ...pedido,
                                extras: pedido.extras.filter(e => e.id !== extra.id),
                              });
                            }
                          }}
                        />
                        <span className="font-medium text-gray-900">{extra.nome}</span>
                      </div>
                      <span className="font-bold" style={{ color: corPrincipal }}>
                        R$ {extra.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </label>
                    {selected && extra.requer_observacao && (
                      <Input
                        className="mt-3"
                        placeholder="Observação (ex: texto do topo)"
                        value={selected.observacao || ''}
                        onChange={(e) => {
                          setPedido({
                            ...pedido,
                            extras: pedido.extras.map(ext =>
                              ext.id === extra.id ? { ...ext, observacao: e.target.value } : ext
                            ),
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 6: Doces e Salgados */}
          {currentStep === 6 && (
            <div className="space-y-6">
              {/* Doces */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Deseja adicionar doces?</p>
                    <p className="text-sm text-gray-500 mt-1">Brigadeiros, beijinhos, etc.</p>
                  </div>
                  <Checkbox
                    checked={pedido.deseja_doces}
                    onCheckedChange={(checked) => {
                      setPedido({ 
                        ...pedido, 
                        deseja_doces: checked,
                        doces: checked ? pedido.doces : []
                      });
                    }}
                  />
                </div>

                {pedido.deseja_doces && (
                  <div className="space-y-3 mt-4">
                    {doces.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        Nenhum doce disponível no momento
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">Selecione os doces:</p>
                        {doces.map((doce) => {
                          const selected = pedido.doces.find(d => d.id === doce.id);
                          
                          return (
                            <div
                              key={doce.id}
                              className={`p-4 rounded-xl transition-colors ${
                                selected ? 'border-2' : 'bg-gray-50 border-2 border-transparent'
                              }`}
                              style={{
                                backgroundColor: selected ? `${corPrincipal}10` : undefined,
                                borderColor: selected ? corPrincipal : undefined,
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={!!selected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setPedido({
                                          ...pedido,
                                          doces: [...pedido.doces, {
                                            id: doce.id,
                                            nome: doce.nome,
                                            valor_unitario: doce.valor_unitario,
                                            quantidade_minima: doce.quantidade_minima,
                                            quantidade: doce.quantidade_minima || 1,
                                          }],
                                        });
                                      } else {
                                        setPedido({
                                          ...pedido,
                                          doces: pedido.doces.filter(d => d.id !== doce.id),
                                        });
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{doce.nome}</p>
                                        {doce.quantidade_minima > 1 && (
                                          <p className="text-xs text-gray-500 mt-0.5">Mínimo: {doce.quantidade_minima} un.</p>
                                        )}
                                      </div>
                                      <span className="font-bold whitespace-nowrap" style={{ color: corPrincipal }}>
                                        R$ {doce.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                      </span>
                                    </div>
                                    {selected && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <Label className="text-sm">Quantidade:</Label>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = Math.max(selected.quantidade - 10, doce.quantidade_minima || 1);
                                              setPedido({
                                                ...pedido,
                                                doces: pedido.doces.map(d =>
                                                  d.id === doce.id ? { ...d, quantidade: novaQtd } : d
                                                ),
                                              });
                                            }}
                                          >
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <Input
                                            type="number"
                                            min={doce.quantidade_minima || 1}
                                            value={selected.quantidade}
                                            onChange={(e) => {
                                              const novaQtd = Math.max(parseInt(e.target.value) || 1, doce.quantidade_minima || 1);
                                              setPedido({
                                                ...pedido,
                                                doces: pedido.doces.map(d =>
                                                  d.id === doce.id ? { ...d, quantidade: novaQtd } : d
                                                ),
                                              });
                                            }}
                                            className="w-16 text-center"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = selected.quantidade + 10;
                                              setPedido({
                                                ...pedido,
                                                doces: pedido.doces.map(d =>
                                                  d.id === doce.id ? { ...d, quantidade: novaQtd } : d
                                                ),
                                              });
                                            }}
                                          >
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Salgados */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Deseja adicionar salgados?</p>
                    <p className="text-sm text-gray-500 mt-1">Coxinhas, risoles, etc.</p>
                  </div>
                  <Checkbox
                    checked={pedido.deseja_salgados}
                    onCheckedChange={(checked) => {
                      setPedido({ 
                        ...pedido, 
                        deseja_salgados: checked,
                        salgados: checked ? pedido.salgados : []
                      });
                    }}
                  />
                </div>

                {pedido.deseja_salgados && (
                  <div className="space-y-3 mt-4">
                    {salgados.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        Nenhum salgado disponível no momento
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">Selecione os salgados:</p>
                        {salgados.map((salgado) => {
                          const selected = pedido.salgados.find(s => s.id === salgado.id);
                          
                          return (
                            <div
                              key={salgado.id}
                              className={`p-4 rounded-xl transition-colors ${
                                selected ? 'border-2' : 'bg-gray-50 border-2 border-transparent'
                              }`}
                              style={{
                                backgroundColor: selected ? `${corPrincipal}10` : undefined,
                                borderColor: selected ? corPrincipal : undefined,
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={!!selected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setPedido({
                                          ...pedido,
                                          salgados: [...pedido.salgados, {
                                            id: salgado.id,
                                            nome: salgado.nome,
                                            valor_unitario: salgado.valor_unitario,
                                            quantidade_minima: salgado.quantidade_minima,
                                            quantidade: salgado.quantidade_minima || 1,
                                          }],
                                        });
                                      } else {
                                        setPedido({
                                          ...pedido,
                                          salgados: pedido.salgados.filter(s => s.id !== salgado.id),
                                        });
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{salgado.nome}</p>
                                        {salgado.quantidade_minima > 1 && (
                                          <p className="text-xs text-gray-500 mt-0.5">Mínimo: {salgado.quantidade_minima} un.</p>
                                        )}
                                      </div>
                                      <span className="font-bold whitespace-nowrap" style={{ color: corPrincipal }}>
                                        R$ {salgado.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                      </span>
                                    </div>
                                    {selected && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <Label className="text-sm">Quantidade:</Label>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = Math.max(selected.quantidade - 10, salgado.quantidade_minima || 1);
                                              setPedido({
                                                ...pedido,
                                                salgados: pedido.salgados.map(s =>
                                                  s.id === salgado.id ? { ...s, quantidade: novaQtd } : s
                                                ),
                                              });
                                            }}
                                          >
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <Input
                                            type="number"
                                            min={salgado.quantidade_minima || 1}
                                            value={selected.quantidade}
                                            onChange={(e) => {
                                              const novaQtd = Math.max(parseInt(e.target.value) || 1, salgado.quantidade_minima || 1);
                                              setPedido({
                                                ...pedido,
                                                salgados: pedido.salgados.map(s =>
                                                  s.id === salgado.id ? { ...s, quantidade: novaQtd } : s
                                                ),
                                              });
                                            }}
                                            className="w-16 text-center"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = selected.quantidade + 10;
                                              setPedido({
                                                ...pedido,
                                                salgados: pedido.salgados.map(s =>
                                                  s.id === salgado.id ? { ...s, quantidade: novaQtd } : s
                                                ),
                                              });
                                            }}
                                          >
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 7: Entrega */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <Label>Data de Entrega *</Label>
                <Input
                  type="date"
                  value={pedido.data_entrega}
                  onChange={(e) => setPedido({ ...pedido, data_entrega: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Horário de Entrega</Label>
                <Input
                  type="time"
                  value={pedido.horario_entrega}
                  onChange={(e) => setPedido({ ...pedido, horario_entrega: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={pedido.observacoes}
                  onChange={(e) => setPedido({ ...pedido, observacoes: e.target.value })}
                  placeholder="Detalhes adicionais, decoração específica..."
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </div>
          )}

          {/* Step 8: Seus Dados */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={cliente.nome}
                  onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <Label>CPF (opcional)</Label>
                <CPFInput
                  value={cliente.cpf}
                  onChange={(e) => setCliente({ ...cliente, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>WhatsApp *</Label>
                <TelefoneInput
                  value={cliente.telefone}
                  onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          {/* Step 9: Pagamento */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <Label>Forma de Pagamento *</Label>
              <RadioGroup
                value={pedido.forma_pagamento}
                onValueChange={(value) => setPedido({ ...pedido, forma_pagamento: value })}
                className="grid gap-3"
              >
                {formasPagamento.map((forma) => (
                  <label
                    key={forma.id}
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                      pedido.forma_pagamento === forma.nome
                        ? 'border-2'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    style={{
                      backgroundColor: pedido.forma_pagamento === forma.nome ? `${corPrincipal}10` : undefined,
                      borderColor: pedido.forma_pagamento === forma.nome ? corPrincipal : undefined,
                    }}
                  >
                    <RadioGroupItem value={forma.nome} />
                    <span className="font-medium text-gray-900">{forma.nome}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 10: Resumo */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-semibold text-gray-900">{cliente.nome}</p>
                  <p className="text-sm text-gray-600">{cliente.telefone}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Bolo</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.tamanho_nome} • {pedido.massa_nome}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pedido.recheios.map((r, i) => (
                      <Badge key={i} style={{ backgroundColor: `${corPrincipal}20`, color: corPrincipal }}>
                        {r.nome}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-gray-700">Cobertura: {pedido.cobertura_nome}</p>
                </div>

                {pedido.extras.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Extras</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pedido.extras.map((e, i) => (
                        <Badge key={i} variant="outline">
                          {e.nome}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {pedido.doces.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Doces</p>
                    <div className="mt-2 space-y-1">
                      {pedido.doces.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{d.quantidade}x {d.nome}</span>
                          <span className="font-medium">
                            R$ {(d.valor_unitario * d.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pedido.salgados.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Salgados</p>
                    <div className="mt-2 space-y-1">
                      {pedido.salgados.map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{s.quantidade}x {s.nome}</span>
                          <span className="font-medium">
                            R$ {(s.valor_unitario * s.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Entrega</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.data_entrega && format(parseISO(pedido.data_entrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {pedido.horario_entrega && ` às ${pedido.horario_entrega}`}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Pagamento</p>
                  <p className="font-semibold text-gray-900">{pedido.forma_pagamento}</p>
                </div>
              </div>

              {/* Valores */}
              <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: `${corPrincipal}10` }}>
                <div className="flex justify-between text-sm">
                  <span>Tamanho</span>
                  <span>R$ {pedido.valor_tamanho?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {pedido.valor_massa > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Massa</span>
                    <span>+ R$ {pedido.valor_massa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_recheios > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Recheios</span>
                    <span>+ R$ {pedido.valor_recheios?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_cobertura > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Cobertura</span>
                    <span>+ R$ {pedido.valor_cobertura?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_extras > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Extras</span>
                    <span>+ R$ {pedido.valor_extras?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_doces > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Doces</span>
                    <span>+ R$ {pedido.valor_doces?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_salgados > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Salgados</span>
                    <span>+ R$ {pedido.valor_salgados?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_urgencia > 0 && (
                  <div className="flex justify-between text-sm" style={{ color: corPrincipal }}>
                    <span>Taxa de urgência</span>
                    <span>+ R$ {pedido.valor_urgencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between font-bold text-lg" style={{ borderColor: corPrincipal }}>
                  <span>Total</span>
                  <span style={{ color: corPrincipal }}>
                    R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              style={{ backgroundColor: corPrincipal }}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleEnviarPedido}
              disabled={enviandoPedido}
              style={{ backgroundColor: corPrincipal }}
              className="shadow-lg"
            >
              {enviandoPedido ? 'Enviando...' : 'Enviar Pedido'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
