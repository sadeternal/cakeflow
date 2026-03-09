import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  ShoppingCart,
  ShoppingBag,
  MapPin,
  Store,
  MessageCircle,
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CPFInput, TelefoneInput } from '@/components/ui/masked-input';
import { useToast } from '@/components/ui/use-toast';
import { syncClientToBrevo } from '@/lib/brevoClientSync';

const isPixPaymentName = (name = '') => name.toLowerCase().includes('pix');

const normalizeFormaPagamento = (forma = {}) => {
  const pix = isPixPaymentName(forma.nome || '');
  const aVista = forma.a_vista === true;
  return {
    ...forma,
    descricao: aVista && pix && (!forma.descricao || forma.descricao === 'À vista')
      ? 'À vista'
      : (forma.descricao || ''),
    a_vista: aVista,
    parcelamento_max: aVista ? 1 : Math.max(Number(forma.parcelamento_max) || 1, 1),
  };
};

const fallbackFormasPagamento = [
  { id: '', nome: 'Pix', descricao: 'À vista', a_vista: true, parcelamento_max: 1 },
  { id: '', nome: 'Cartão', descricao: '', a_vista: false, parcelamento_max: 1 },
  { id: '', nome: 'Dinheiro', descricao: '', a_vista: true, parcelamento_max: 1 },
].map(normalizeFormaPagamento);

export default function CarrinhoCheckout({ confeitaria, carrinho, onClose, onUpdateQuantidade, onRemoverItem, onLimparCarrinho, onEditarItem }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [tipoEntrega, setTipoEntrega] = useState('delivery');
  const [clienteData, setClienteData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    endereco: '',
    observacoes: ''
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formasPagamento', confeitaria?.id],
    queryFn: () => appClient.entities.FormaPagamento.filter({
      confeitaria_id: confeitaria.id,
      ativo: true
    }),
    enabled: !!confeitaria?.id,
  });

  const [formaPagamento, setFormaPagamento] = useState('');
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [formaPagamentoNome, setFormaPagamentoNome] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [pedidoCriado, setPedidoCriado] = useState(false);
  const [carrinhoSalvo, setCarrinhoSalvo] = useState([]);

  const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  const taxaDelivery = tipoEntrega === 'delivery' ? (confeitaria?.taxa_delivery || 0) : 0;
  const total = subtotal + taxaDelivery;
  const paymentOptions = (formasPagamento.length > 0 ? formasPagamento : fallbackFormasPagamento).map(normalizeFormaPagamento);
  const selectedPayment = paymentOptions.find((item) =>
    (item.id && item.id === formaPagamentoId) ||
    item.nome === (formaPagamentoNome || formaPagamento)
  ) || null;
  const shouldShowInstallments = selectedPayment && !selectedPayment.a_vista && selectedPayment.parcelamento_max > 1;
  const stepTitles = {
    1: 'Seu Carrinho',
    2: 'Dados do cliente',
    3: 'Pagamento e entrega',
    4: 'Resumo do pedido'
  };
  const canAdvanceStep1 = carrinho.length > 0;
  const canAdvanceStep2 = carrinho.length > 0 && clienteData.nome.trim() && clienteData.telefone.trim() && tipoEntrega;
  const canAdvanceStep3 = !!(formaPagamentoNome || formaPagamento) && (tipoEntrega !== 'delivery' || clienteData.endereco.trim());

  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      // Criar pedido
      const observacoesCompletas = [
        clienteData.cpf ? `CPF: ${clienteData.cpf}` : '',
        clienteData.observacoes ? clienteData.observacoes.trim() : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      return appClient.functions.invokePublicRpc('catalog_create_pedido', {
        payload: {
          confeitaria_id: confeitaria.id,
          cliente_id: null,
          cliente_nome: clienteData.nome,
          cliente_telefone: clienteData.telefone,
          endereco_entrega: tipoEntrega === 'delivery' ? clienteData.endereco : null,
          tipo_entrega: tipoEntrega === 'delivery' ? 'entrega' : 'retirada',
          numero: null,
          tipo: 'produto_pronto',
          observacoes: observacoesCompletas,
          valor_total: total,
          valor_extras: taxaDelivery,
          status: 'orcamento',
          forma_pagamento: formaPagamentoNome || formaPagamento,
          forma_pagamento_id: formaPagamentoId || null,
          forma_pagamento_nome: formaPagamentoNome || formaPagamento || null,
          parcelas: parcelas || 1,
          produtos_catalogo: carrinho.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
            ...(item.complementos_selecionados?.length > 0 && {
              complementos_selecionados: item.complementos_selecionados,
              preco_base: item.preco_base,
            }),
          }))
        }
      });
    },
    onSuccess: async () => {
      await syncClientToBrevo(
        {
          confeitaria_id: confeitaria.id,
          nome: clienteData.nome,
          telefone: clienteData.telefone,
          email: ''
        },
        { isPublic: true }
      );
      setCarrinhoSalvo([...carrinho]); // Salvar carrinho antes de limpar
      setPedidoCriado(true);
      if (onLimparCarrinho) {
        onLimparCarrinho();
      }
    },
    onError: (error) => {
      toast({
        title: 'Erro ao finalizar pedido',
        description: error?.message || 'Não foi possível finalizar agora. Tente novamente.',
        variant: 'destructive'
      });
    }
  });

  const handleEnviarWhatsApp = () => {
    const phone = confeitaria?.telefone?.replace(/\D/g, '');
    const carrinhoParaUsar = carrinhoSalvo.length > 0 ? carrinhoSalvo : carrinho;
    const subtotalWhatsApp = carrinhoParaUsar.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const taxaDeliveryWhatsApp = tipoEntrega === 'delivery' ? (confeitaria?.taxa_delivery || 0) : 0;
    const totalWhatsApp = subtotalWhatsApp + taxaDeliveryWhatsApp;
    const mensagem = `*Novo Pedido - ${tipoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA'}*\n\n*Cliente:* ${clienteData.nome}\n*Telefone:* ${clienteData.telefone}\n*Forma de Pagamento:* ${formaPagamentoNome || formaPagamento}${parcelas > 1 ? ` em ${parcelas}x` : ''}\n${tipoEntrega === 'delivery' ? `*Endereço:* ${clienteData.endereco}\n` : ''}\n\n*Produtos:*\n${carrinhoParaUsar.map(item => `• ${item.nome}\n  Quantidade: ${item.quantidade}\n  Valor: R$ ${(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n\n')}\n\n*Subtotal:* R$ ${subtotalWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${tipoEntrega === 'delivery' ? `\n*Taxa de Entrega:* R$ ${taxaDeliveryWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}\n*TOTAL:* R$ ${totalWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${clienteData.observacoes ? `\n\n*Observações:* ${clienteData.observacoes}` : ''}`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleFinalizar = () => {
    criarPedidoMutation.mutate();
  };

  if (pedidoCriado) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Recebido!</h2>
          <p className="text-gray-600 mb-6">
            Seu pedido foi registrado como orçamento. Em breve entraremos em contato para confirmar.
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleEnviarWhatsApp}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar pelo WhatsApp
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 pt-20">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Finalizar Pedido
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Etapa {step} de 4: {stepTitles[step]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pt-4">
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((currentStep) => (
                <div
                  key={currentStep}
                  className={`h-2 rounded-full transition-colors ${currentStep <= step ? 'bg-rose-500' : 'bg-gray-200'
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {carrinho.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Seu carrinho está vazio</p>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    {carrinho.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-16 h-16 shrink-0 bg-white rounded-lg overflow-hidden border">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                              <ShoppingBag className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 leading-tight">{item.nome}</h4>
                          <p className="text-sm text-gray-500">
                            R$ {(item.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} un.
                          </p>
                          {item.complementos_selecionados?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {item.complementos_selecionados.map((c, i) => (
                                <p key={i} className="text-xs text-rose-500">
                                  + {c.nome}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border rounded-lg bg-white">
                            <button
                              onClick={() => onUpdateQuantidade(item.id, Math.max(1, item.quantidade - 1))}
                              className="p-2 hover:bg-gray-50 text-gray-500 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantidade}</span>
                            <button
                              onClick={() => onUpdateQuantidade(item.id, item.quantidade + 1)}
                              className="p-2 hover:bg-gray-50 text-gray-500 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {item.complementos_selecionados?.length > 0 && onEditarItem && (
                            <button
                              onClick={() => onEditarItem(item)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Editar complementos"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onRemoverItem(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t mt-6">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Subtotal do Carrinho</span>
                        <span className="text-rose-600">
                          R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-semibold mb-3 block">Tipo de Entrega</Label>
                      <RadioGroup value={tipoEntrega} onValueChange={setTipoEntrega}>
                        <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-colors ${tipoEntrega === 'delivery' ? 'bg-rose-50 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                          <RadioGroupItem value="delivery" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium">
                              <MapPin className="w-4 h-4" />
                              Delivery
                            </div>
                            {confeitaria?.taxa_delivery > 0 && (
                              <p className="text-sm text-gray-500">
                                Taxa: R$ {confeitaria.taxa_delivery.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </label>
                        <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-colors ${tipoEntrega === 'retirada' ? 'bg-rose-50 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                          <RadioGroupItem value="retirada" />
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="w-4 h-4" />
                            Retirada no Local
                          </div>
                        </label>
                      </RadioGroup>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Nome Completo *</Label>
                        <Input
                          value={clienteData.nome}
                          onChange={(e) => setClienteData({ ...clienteData, nome: e.target.value })}
                          placeholder="Seu nome"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Telefone / WhatsApp *</Label>
                        <TelefoneInput
                          value={clienteData.telefone}
                          onChange={(e) => setClienteData({ ...clienteData, telefone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>CPF (opcional)</Label>
                        <CPFInput
                          value={clienteData.cpf}
                          onChange={(e) => setClienteData({ ...clienteData, cpf: e.target.value })}
                          placeholder="000.000.000-00"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <Label>Forma de Pagamento *</Label>
                      <RadioGroup
                        value={formaPagamentoNome || formaPagamento}
                        onValueChange={(value) => {
                          const forma = paymentOptions.find((item) => item.nome === value);
                          if (!forma) return;
                          setFormaPagamento(forma.nome);
                          setFormaPagamentoId(forma.id || '');
                          setFormaPagamentoNome(forma.nome);
                          setParcelas(forma.a_vista ? 1 : Math.min(parcelas || 1, forma.parcelamento_max));
                        }}
                      >
                        <div className="grid gap-2 mt-2">
                          {paymentOptions.map((forma) => (
                            <label
                              key={`${forma.id || 'fallback'}-${forma.nome}`}
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${(formaPagamentoNome || formaPagamento) === forma.nome
                                ? 'bg-rose-50 border-2 border-rose-500'
                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                              <RadioGroupItem value={forma.nome} className="mt-1" />
                              <div>
                                <span className="font-medium">{forma.nome}</span>
                                {forma.descricao && (
                                  <p className="text-sm text-gray-500 mt-1">{forma.descricao}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>

                    {shouldShowInstallments && (
                      <div>
                        <Label>Parcelas</Label>
                        <RadioGroup
                          value={String(parcelas || 1)}
                          onValueChange={(value) => setParcelas(Number(value) || 1)}
                          className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-3"
                        >
                          {Array.from({ length: selectedPayment.parcelamento_max }, (_, index) => index + 1).map((parcela) => (
                            <label
                              key={parcela}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${Number(parcelas || 1) === parcela
                                ? 'bg-rose-50 border-2 border-rose-500'
                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                }`}
                            >
                              <RadioGroupItem value={String(parcela)} />
                              <span className="font-medium">{parcela}x</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {tipoEntrega === 'delivery' && (
                      <div>
                        <Label>Endereço de Entrega *</Label>
                        <Textarea
                          value={clienteData.endereco}
                          onChange={(e) => setClienteData({ ...clienteData, endereco: e.target.value })}
                          placeholder="Rua, número, bairro, complemento..."
                          className="mt-1 min-h-[80px]"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={clienteData.observacoes}
                        onChange={(e) => setClienteData({ ...clienteData, observacoes: e.target.value })}
                        placeholder="Informações adicionais..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold text-gray-900">Dados do Cliente</h3>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <p className="text-gray-500">Nome</p>
                          <p className="font-medium text-gray-900">{clienteData.nome || 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Telefone</p>
                          <p className="font-medium text-gray-900">{clienteData.telefone || 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">CPF</p>
                          <p className="font-medium text-gray-900">{clienteData.cpf || 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Tipo de entrega</p>
                          <p className="font-medium text-gray-900">
                            {tipoEntrega === 'delivery' ? 'Delivery' : 'Retirada no Local'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold text-gray-900">Pagamento e Entrega</h3>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <p className="text-gray-500">Forma de pagamento</p>
                          <p className="font-medium text-gray-900">
                            {formaPagamentoNome || formaPagamento || 'Não informado'}
                            {parcelas > 1 ? ` em ${parcelas}x` : ''}
                          </p>
                          {selectedPayment?.descricao && (
                            <p className="text-gray-500 mt-1">{selectedPayment.descricao}</p>
                          )}
                        </div>
                        {tipoEntrega === 'delivery' && (
                          <div className="sm:col-span-2">
                            <p className="text-gray-500">Endereço</p>
                            <p className="font-medium text-gray-900">{clienteData.endereco || 'Não informado'}</p>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <p className="text-gray-500">Observações</p>
                          <p className="font-medium text-gray-900">{clienteData.observacoes || 'Sem observações'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <h3 className="font-semibold text-gray-900 mb-3">Resumo do Pedido</h3>
                      {carrinho.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.nome} (x{item.quantidade})</span>
                          <span>R$ {(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {tipoEntrega === 'delivery' && taxaDelivery > 0 && (
                          <div className="flex justify-between">
                            <span>Taxa de Entrega</span>
                            <span>R$ {taxaDelivery.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                          <span>Total</span>
                          <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-6 flex gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
              >
                Voltar
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={() => setStep(2)}
                disabled={!canAdvanceStep1}
                className="flex-1 bg-rose-500 hover:bg-rose-600"
              >
                Continuar
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => setStep(3)}
                disabled={!canAdvanceStep2}
                className="flex-1 bg-rose-500 hover:bg-rose-600"
              >
                Continuar
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={() => setStep(4)}
                disabled={!canAdvanceStep3}
                className="flex-1 bg-rose-500 hover:bg-rose-600"
              >
                Continuar
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={handleFinalizar}
                disabled={!canAdvanceStep2 || !canAdvanceStep3 || criarPedidoMutation.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {criarPedidoMutation.isPending ? 'Enviando...' : 'Finalizar Pedido'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
