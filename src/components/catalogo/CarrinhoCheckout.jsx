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

const fmt = (val) =>
  (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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
      setCarrinhoSalvo([...carrinho]);
      setPedidoCriado(true);
      if (onLimparCarrinho) onLimparCarrinho();
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
    const mensagem = `*Novo Pedido - ${tipoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA'}*\n\n*Cliente:* ${clienteData.nome}\n*Telefone:* ${clienteData.telefone}\n*Forma de Pagamento:* ${formaPagamentoNome || formaPagamento}${parcelas > 1 ? ` em ${parcelas}x` : ''}\n${tipoEntrega === 'delivery' ? `*Endereço:* ${clienteData.endereco}\n` : ''}\n\n*Produtos:*\n${carrinhoParaUsar.map(item => `• ${item.nome}\n  Quantidade: ${item.quantidade}\n  Valor: R$ ${fmt(item.preco * item.quantidade)}`).join('\n\n')}\n\n*Subtotal:* R$ ${fmt(subtotalWhatsApp)}${tipoEntrega === 'delivery' ? `\n*Taxa de Entrega:* R$ ${fmt(taxaDeliveryWhatsApp)}` : ''}\n*TOTAL:* R$ ${fmt(totalWhatsApp)}${clienteData.observacoes ? `\n\n*Observações:* ${clienteData.observacoes}` : ''}`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setTimeout(() => { onClose(); }, 1000);
  };

  if (pedidoCriado) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Recebido!</h2>
          <p className="text-gray-600 mb-6">
            Seu pedido foi registrado como orçamento. Em breve entraremos em contato para confirmar.
          </p>
          <div className="space-y-3">
            <Button onClick={handleEnviarWhatsApp} className="w-full bg-green-500 hover:bg-green-600">
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar pelo WhatsApp
            </Button>
            <Button onClick={onClose} variant="outline" className="w-full">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:bg-black/50 sm:items-center sm:justify-center sm:p-4">
      <div className="flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:w-full bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
              Finalizar Pedido
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
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

        {/* Progress bar */}
        <div className="px-4 sm:px-6 pt-3 pb-1 shrink-0">
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-colors ${s <= step ? 'bg-rose-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {carrinho.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Seu carrinho está vazio</p>
            </div>
          ) : (
            <>
              {/* Step 1: Cart items */}
              {step === 1 && (
                <div className="space-y-3">
                  {carrinho.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      {/* Image */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-white border">
                        {item.foto_url ? (
                          <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Info + Controls */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{item.nome}</h4>
                          <button
                            onClick={() => onRemoverItem(item.id)}
                            className="shrink-0 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-gray-500 mt-0.5">
                          R$ {fmt(item.preco)} un.
                        </p>

                        {item.complementos_selecionados?.length > 0 && (
                          <div className="mt-1">
                            {item.complementos_selecionados.map((c, i) => (
                              <span key={i} className="text-xs text-rose-500 block">+ {c.nome}</span>
                            ))}
                          </div>
                        )}

                        {/* Bottom row: qty + edit + total */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center border rounded-lg bg-white">
                            <button
                              onClick={() => onUpdateQuantidade(item.id, Math.max(1, item.quantidade - 1))}
                              className="px-2 py-1 hover:bg-gray-50 text-gray-500 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantidade}</span>
                            <button
                              onClick={() => onUpdateQuantidade(item.id, item.quantidade + 1)}
                              className="px-2 py-1 hover:bg-gray-50 text-gray-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {item.complementos_selecionados?.length > 0 && onEditarItem && (
                            <button
                              onClick={() => onEditarItem(item)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              title="Editar complementos"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <span className="ml-auto text-sm font-semibold text-rose-600">
                            R$ {fmt(item.preco * item.quantidade)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 border-t mt-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="text-rose-600 text-lg">R$ {fmt(subtotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Customer data */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Tipo de Entrega</Label>
                    <RadioGroup value={tipoEntrega} onValueChange={setTipoEntrega} className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors ${tipoEntrega === 'delivery' ? 'bg-rose-50 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                        <RadioGroupItem value="delivery" />
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            Delivery
                          </div>
                          {confeitaria?.taxa_delivery > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">+R$ {fmt(confeitaria.taxa_delivery)}</p>
                          )}
                        </div>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors ${tipoEntrega === 'retirada' ? 'bg-rose-50 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                        <RadioGroupItem value="retirada" />
                        <div className="flex items-center gap-1.5 font-medium text-sm">
                          <Store className="w-3.5 h-3.5" />
                          Retirada
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Nome Completo *</Label>
                      <Input
                        value={clienteData.nome}
                        onChange={(e) => setClienteData({ ...clienteData, nome: e.target.value })}
                        placeholder="Seu nome"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Telefone / WhatsApp *</Label>
                      <TelefoneInput
                        value={clienteData.telefone}
                        onChange={(e) => setClienteData({ ...clienteData, telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">CPF (opcional)</Label>
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

              {/* Step 3: Payment */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm font-semibold">Forma de Pagamento *</Label>
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
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}
                          >
                            <RadioGroupItem value={forma.nome} className="mt-0.5" />
                            <div>
                              <span className="font-medium text-sm">{forma.nome}</span>
                              {forma.descricao && <p className="text-xs text-gray-500 mt-0.5">{forma.descricao}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>

                  {shouldShowInstallments && (
                    <div>
                      <Label className="text-sm font-semibold">Parcelas</Label>
                      <RadioGroup
                        value={String(parcelas || 1)}
                        onValueChange={(value) => setParcelas(Number(value) || 1)}
                        className="grid grid-cols-3 gap-2 mt-2"
                      >
                        {Array.from({ length: selectedPayment.parcelamento_max }, (_, i) => i + 1).map((parcela) => (
                          <label
                            key={parcela}
                            className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${Number(parcelas || 1) === parcela
                              ? 'bg-rose-50 border-2 border-rose-500'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}
                          >
                            <RadioGroupItem value={String(parcela)} />
                            <span className="font-medium text-sm">{parcela}x</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {tipoEntrega === 'delivery' && (
                    <div>
                      <Label className="text-sm font-semibold">Endereço de Entrega *</Label>
                      <Textarea
                        value={clienteData.endereco}
                        onChange={(e) => setClienteData({ ...clienteData, endereco: e.target.value })}
                        placeholder="Rua, número, bairro, complemento..."
                        className="mt-1 min-h-[72px] text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-semibold">Observações</Label>
                    <Textarea
                      value={clienteData.observacoes}
                      onChange={(e) => setClienteData({ ...clienteData, observacoes: e.target.value })}
                      placeholder="Informações adicionais..."
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Summary */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Dados do Cliente</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Nome</p>
                        <p className="font-medium text-gray-900 truncate">{clienteData.nome || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Telefone</p>
                        <p className="font-medium text-gray-900">{clienteData.telefone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CPF</p>
                        <p className="font-medium text-gray-900">{clienteData.cpf || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Entrega</p>
                        <p className="font-medium text-gray-900">{tipoEntrega === 'delivery' ? 'Delivery' : 'Retirada'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Pagamento</h3>
                    <p className="font-medium text-sm text-gray-900">
                      {formaPagamentoNome || formaPagamento || '—'}
                      {parcelas > 1 ? ` em ${parcelas}x` : ''}
                    </p>
                    {selectedPayment?.descricao && (
                      <p className="text-xs text-gray-500">{selectedPayment.descricao}</p>
                    )}
                    {tipoEntrega === 'delivery' && clienteData.endereco && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">Endereço</p>
                        <p className="font-medium text-sm text-gray-900">{clienteData.endereco}</p>
                      </div>
                    )}
                    {clienteData.observacoes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">Observações</p>
                        <p className="font-medium text-sm text-gray-900">{clienteData.observacoes}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Itens do Pedido</h3>
                    <div className="space-y-1.5">
                      {carrinho.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.nome} <span className="text-gray-400">x{item.quantidade}</span></span>
                          <span className="font-medium shrink-0 ml-2">R$ {fmt(item.preco * item.quantidade)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-2 mt-3 space-y-1">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>R$ {fmt(subtotal)}</span>
                      </div>
                      {tipoEntrega === 'delivery' && taxaDelivery > 0 && (
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Taxa de Entrega</span>
                          <span>R$ {fmt(taxaDelivery)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-2 border-t">
                        <span>Total</span>
                        <span className="text-rose-600">R$ {fmt(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — fixed at bottom */}
        <div className="border-t px-4 py-3 sm:px-6 sm:py-4 flex gap-2 shrink-0 bg-white">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              Voltar
            </Button>
          )}
          {step < 4 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canAdvanceStep1 : step === 2 ? !canAdvanceStep2 : !canAdvanceStep3}
              className="flex-1 bg-rose-500 hover:bg-rose-600"
            >
              Continuar
            </Button>
          )}
          {step === 4 && (
            <Button
              onClick={() => criarPedidoMutation.mutate()}
              disabled={!canAdvanceStep2 || !canAdvanceStep3 || criarPedidoMutation.isPending}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              {criarPedidoMutation.isPending ? 'Enviando...' : 'Finalizar Pedido'}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
