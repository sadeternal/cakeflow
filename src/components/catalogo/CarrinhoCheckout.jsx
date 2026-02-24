import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  ShoppingCart,
  Trash2,
  MapPin,
  Store,
  MessageCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CPFInput, TelefoneInput } from '@/components/ui/masked-input';
import { useToast } from '@/components/ui/use-toast';

export default function CarrinhoCheckout({ confeitaria, carrinho, onClose, onUpdateQuantidade, onRemoverItem, onLimparCarrinho }) {
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
  const [pedidoCriado, setPedidoCriado] = useState(false);
  const [carrinhoSalvo, setCarrinhoSalvo] = useState([]);

  const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  const taxaDelivery = tipoEntrega === 'delivery' ? (confeitaria?.taxa_delivery || 0) : 0;
  const total = subtotal + taxaDelivery;

  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      // Criar pedido
      const observacoesCompletas = `PEDIDO DO CATÁLOGO - ${tipoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA NO LOCAL'}\n\nProdutos:\n${carrinho.map(item => `- ${item.nome} (${item.quantidade}x) - R$ ${(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')}\n\n${clienteData.cpf ? `CPF: ${clienteData.cpf}\n` : ''}${clienteData.observacoes ? `Observações: ${clienteData.observacoes}` : ''}`;

      return appClient.functions.invokePublicRpc('catalog_create_pedido', {
        payload: {
          confeitaria_id: confeitaria.id,
          cliente_id: null,
          cliente_nome: clienteData.nome,
          cliente_telefone: clienteData.telefone,
          numero: null,
          tipo: 'produto_pronto',
          observacoes: observacoesCompletas,
          valor_total: total,
          valor_extras: taxaDelivery,
          status: 'orcamento',
          forma_pagamento: formaPagamento,
          produtos_catalogo: carrinho.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
          }))
        }
      });
    },
    onSuccess: () => {
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
    const mensagem = `*Novo Pedido - ${tipoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA'}*\n\n*Cliente:* ${clienteData.nome}\n*Telefone:* ${clienteData.telefone}\n*Forma de Pagamento:* ${formaPagamento}\n${tipoEntrega === 'delivery' ? `*Endereço:* ${clienteData.endereco}\n` : ''}\n\n*Produtos:*\n${carrinhoParaUsar.map(item => `• ${item.nome}\n  Quantidade: ${item.quantidade}\n  Valor: R$ ${(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n\n')}\n\n*Subtotal:* R$ ${subtotalWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${tipoEntrega === 'delivery' ? `\n*Taxa de Entrega:* R$ ${taxaDeliveryWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}\n*TOTAL:* R$ ${totalWhatsApp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${clienteData.observacoes ? `\n\n*Observações:* ${clienteData.observacoes}` : ''}`;
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
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              {step === 1 ? 'Carrinho' : 'Finalizar Pedido'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <>
                {carrinho.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Seu carrinho está vazio</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {carrinho.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        {item.foto_url && (
                          <img
                            src={item.foto_url}
                            alt={item.nome}
                            className="w-20 h-20 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.nome}</h3>
                          <p className="text-sm text-gray-500">
                            R$ {item.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => onUpdateQuantidade(item.id, Math.max(1, item.quantidade - 1))}
                              className="w-8 h-8 rounded-lg border hover:bg-gray-100 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantidade}</span>
                            <button
                              onClick={() => onUpdateQuantidade(item.id, item.quantidade + 1)}
                              className="w-8 h-8 rounded-lg border hover:bg-gray-100 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            R$ {(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <button
                            onClick={() => onRemoverItem(item.id)}
                            className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1 mt-2 ml-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Subtotal</span>
                        <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {/* Tipo de Entrega */}
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

                {/* Dados do Cliente */}
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
                    <Label>Forma de Pagamento *</Label>
                    <RadioGroup value={formaPagamento} onValueChange={setFormaPagamento}>
                      <div className="grid gap-2 mt-2">
                        {formasPagamento.map((forma) => (
                          <label
                            key={forma.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              formaPagamento === forma.nome
                                ? 'bg-rose-50 border-2 border-rose-500'
                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }`}
                          >
                            <RadioGroupItem value={forma.nome} />
                            <span className="font-medium">{forma.nome}</span>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
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
                  <div>
                    <Label>Telefone / WhatsApp *</Label>
                    <TelefoneInput
                      value={clienteData.telefone}
                      onChange={(e) => setClienteData({ ...clienteData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="mt-1"
                    />
                  </div>
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

                {/* Resumo */}
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
          </div>

          {/* Footer */}
          <div className="border-t p-6 flex gap-3">
            {step === 2 && (
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Voltar
              </Button>
            )}
            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={carrinho.length === 0}
                className="flex-1 bg-rose-500 hover:bg-rose-600"
              >
                Continuar
              </Button>
            ) : (
              <Button
                onClick={handleFinalizar}
                disabled={!clienteData.nome || !clienteData.telefone || !formaPagamento || (tipoEntrega === 'delivery' && !clienteData.endereco) || criarPedidoMutation.isPending}
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
