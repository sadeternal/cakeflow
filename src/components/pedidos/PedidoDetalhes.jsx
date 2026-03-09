import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  X,
  User,
  Phone,
  Calendar,
  Clock,
  Cake,
  MessageCircle,
  CheckCircle2,
  Package,
  Truck,
  CreditCard,
  MapPin,
  Pencil } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle } from
"@/components/ui/sheet";

const statusConfig = {
  orcamento: { label: 'Orçamento', color: 'bg-gray-100 text-gray-700', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  producao: { label: 'Em Produção', color: 'bg-amber-100 text-amber-700', icon: Package },
  pronto: { label: 'Pronto', color: 'bg-emerald-100 text-emerald-700', icon: Cake },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: Truck },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: X }
};

const statusOrder = ['orcamento', 'aprovado', 'producao', 'pronto', 'entregue'];

export default function PedidoDetalhes({ pedido, onClose, onStatusChange }) {
  const StatusIcon = statusConfig[pedido.status]?.icon || Clock;
  const isProdutoPronto = pedido.tipo === 'produto_pronto';
  const paymentLabel = pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não definido';
  const parcelasLabel = `${Number(pedido.parcelas) || 1}x`;
  const createdAt = pedido.created_date ? parseISO(pedido.created_date) : null;
  const deliveryDate = pedido.data_entrega ? parseISO(pedido.data_entrega) : null;
  const orderItems = Array.isArray(pedido.produtos_catalogo) ? pedido.produtos_catalogo : [];
  const hasCustomObservations = Boolean(String(pedido.observacoes || '').trim());
  const deliveryTypeLabel =
    pedido.tipo_entrega === 'entrega'
      ? 'Delivery'
      : pedido.tipo_entrega === 'retirada'
        ? 'Retirada no local'
        : 'Não definido';

  const handleWhatsApp = () => {
    const nome = pedido.cliente_nome || '';
    const num = pedido.numero || '';
    const dataEntrega = pedido.data_entrega
      ? format(parseISO(pedido.data_entrega), "dd/MM/yyyy", { locale: ptBR })
      : '';
    const message = `Olá ${nome}, seu pedido #${num} com data para ${dataEntrega}`;
    const phone = pedido.cliente_telefone?.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const currentStatusIndex = statusOrder.indexOf(pedido.status);

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="my-4 flex items-center justify-between gap-4">
            <SheetTitle className="text-xl flex-shrink-0">
              Pedido #{pedido.numero || pedido.id?.slice(-4)}
            </SheetTitle>
            <Badge className={`${statusConfig[pedido.status]?.color} flex-shrink-0`}>
              <StatusIcon className="w-3.5 h-3.5 mr-1" />
              {statusConfig[pedido.status]?.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Cliente */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-500" />
              Cliente
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="font-medium text-gray-900">{pedido.cliente_nome}</p>
              {pedido.cliente_telefone &&
              <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    {pedido.cliente_telefone}
                  </span>
                  <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-600 hover:bg-green-50"
                  onClick={handleWhatsApp}>

                    <MessageCircle className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              }
            </div>
          </div>

          {/* Data, horário e entrega */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" />
              {isProdutoPronto ? 'Pedido' : 'Reserva'}
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-start gap-6">
                <div>
                  <p className="text-sm text-gray-500">{isProdutoPronto ? 'Data do pedido' : 'Data da reserva'}</p>
                  <p className="font-medium text-gray-900">
                    {isProdutoPronto ?
                    createdAt ?
                    format(createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) :
                    'Não definida' :
                    deliveryDate ?
                    format(deliveryDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) :
                    'Não definida'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">{isProdutoPronto ? 'Hora do pedido' : 'Hora da reserva'}</p>
                  <p className="font-medium text-gray-900">
                    {isProdutoPronto ?
                    createdAt ?
                    format(createdAt, 'HH:mm') :
                    'Não definida' :
                    pedido.horario_entrega || 'Não definida'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    Tipo de entrega
                  </p>
                  <p className="font-medium text-gray-900">{deliveryTypeLabel}</p>
                </div>
              </div>

              {isProdutoPronto && pedido.endereco_entrega &&
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Endereço
                  </p>
                  <p className="font-medium text-gray-900">{pedido.endereco_entrega}</p>
                </div>
              }
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-rose-500" />
              Pagamento
            </h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Forma de pagamento</p>
              <p className="font-medium text-gray-900">
                {paymentLabel} em {parcelasLabel}
              </p>
            </div>
          </div>

          {isProdutoPronto ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-500" />
                Itens
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {orderItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum item registrado.</p>
                ) : (
                  orderItems.map((item, index) => {
                    const quantidade = Number(item.quantidade || 0);
                    const preco = Number(item.preco || 0);
                    const subtotal = quantidade * preco;

                    const complementos = Array.isArray(item.complementos_selecionados)
                      ? item.complementos_selecionados
                      : [];

                    return (
                      <div key={index} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{item.nome}</p>
                            <p className="text-sm text-gray-500">
                              {quantidade}x de R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {complementos.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {complementos.map((c, i) => (
                                  <p key={i} className="text-xs text-rose-600">
                                    + {c.nome} (R$ {(parseFloat(c.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="font-semibold text-gray-900 shrink-0">
                            R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Cake className="w-4 h-4 text-rose-500" />
                Detalhes do Bolo
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tamanho</p>
                    <p className="font-medium text-gray-900">{pedido.tamanho_nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Massa</p>
                    <p className="font-medium text-gray-900">{pedido.massa_nome}</p>
                  </div>
                </div>
                {pedido.recheios?.length > 0 &&
                <div>
                    <p className="text-sm text-gray-500">Recheios</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pedido.recheios.map((r, i) =>
                    <Badge key={i} variant="secondary" className="bg-rose-100 text-rose-700">
                          {r.nome}
                        </Badge>
                    )}
                    </div>
                  </div>
                }
                <div>
                  <p className="text-sm text-gray-500">Cobertura</p>
                  <p className="font-medium text-gray-900">{pedido.cobertura_nome}</p>
                </div>
                {pedido.extras?.length > 0 &&
                <div>
                    <p className="text-sm text-gray-500">Extras</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pedido.extras.map((e, i) =>
                    <Badge key={i} variant="outline">
                          {e.nome}
                          {e.observacao && ` (${e.observacao})`}
                        </Badge>
                    )}
                    </div>
                  </div>
                }
              </div>
            </div>
          )}

          {/* Doces */}
          {pedido.doces?.length > 0 &&
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Doces</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {pedido.doces.map((doce, i) =>
              <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{doce.nome}</span>
                      <span className="text-gray-500 text-sm ml-2">x{doce.quantidade}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      R$ {(doce.valor_unitario * doce.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
              )}
              </div>
            </div>
          }

          {/* Salgados */}
          {pedido.salgados?.length > 0 &&
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Salgados</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {pedido.salgados.map((salgado, i) =>
              <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{salgado.nome}</span>
                      <span className="text-gray-500 text-sm ml-2">x{salgado.quantidade}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      R$ {(salgado.valor_unitario * salgado.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
              )}
              </div>
            </div>
          }

          {/* Observações */}
          {hasCustomObservations &&
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Observações</h3>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-gray-700">{pedido.observacoes}</p>
              </div>
            </div>
          }

          {/* Valores */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Valores</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tamanho base</span>
                <span>R$ {pedido.valor_tamanho?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {pedido.valor_massa > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Massa</span>
                  <span>+ R$ {pedido.valor_massa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_recheios > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Recheios</span>
                  <span>+ R$ {pedido.valor_recheios?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_cobertura > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cobertura</span>
                  <span>+ R$ {pedido.valor_cobertura?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_extras > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Extras</span>
                  <span>+ R$ {pedido.valor_extras?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_doces > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Doces</span>
                  <span>+ R$ {pedido.valor_doces?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_salgados > 0 &&
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Salgados</span>
                  <span>+ R$ {pedido.valor_salgados?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              {pedido.valor_urgencia > 0 &&
              <div className="flex justify-between text-sm text-amber-600">
                  <span>Taxa de urgência</span>
                  <span>+ R$ {pedido.valor_urgencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              }
              <div className="pt-2 border-t flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-rose-600">
                  R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          {pedido.status !== 'cancelado' &&
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Progresso</h3>
              <div className="flex items-center gap-1">
                {statusOrder.map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                return (
                  <React.Fragment key={status}>
                      <button
                      onClick={() => onStatusChange(status)}
                      className={`flex-1 h-2 rounded-full transition-all ${
                      isCompleted ?
                      isCurrent ?
                      'bg-rose-500' :
                      'bg-rose-300' :
                      'bg-gray-200 hover:bg-gray-300'}`
                      }
                      title={statusConfig[status].label} />

                    </React.Fragment>);

              })}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Orçamento</span>
                <span>Entregue</span>
              </div>
            </div>
          }

          {/* Actions */}
          <div className="pt-3">
            <Link to={`${createPageUrl('NovoPedido')}?editId=${pedido.id}`} className="w-full block">
              <Button variant="outline" className="w-full">
                <Pencil className="w-4 h-4 mr-2" />
                Editar Pedido
              </Button>
            </Link>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' &&
            <>
                <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => onStatusChange('cancelado')}>

                  Cancelar Pedido
                </Button>
                {statusOrder[currentStatusIndex + 1] &&
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600"
                onClick={() => onStatusChange(statusOrder[currentStatusIndex + 1])}>

                    {statusConfig[statusOrder[currentStatusIndex + 1]]?.label}
                  </Button>
              }
              </>
            }
          </div>
        </div>
      </SheetContent>
    </Sheet>);

}
