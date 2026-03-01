import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DiaDoPedidoDialog({
  dataStr,
  pedidos,
  onClose,
  onEdit,
  onDelete,
  statusConfig,
}) {
  const pedidosDia = pedidos.filter(p => p.data_entrega === dataStr);

  const titulo = dataStr
    ? format(parseISO(dataStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  return (
    <Dialog open={!!dataStr} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">{titulo}</DialogTitle>
          <p className="text-sm text-gray-500">
            {pedidosDia.length} pedido{pedidosDia.length !== 1 ? 's' : ''} para entrega
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mt-2">
          {pedidosDia.length === 0 ? (
            <p className="text-center text-gray-400 py-6">Nenhum pedido para este dia.</p>
          ) : (
            pedidosDia.map(pedido => (
              <div
                key={pedido.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                      #{pedido.numero || pedido.id?.slice(-4)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {pedido.tipo === 'personalizado' ? 'Personalizado' : 'Produto'}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{pedido.cliente_nome}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {statusConfig[pedido.status] && (
                      <Badge className={`${statusConfig[pedido.status].color} border text-xs`}>
                        {statusConfig[pedido.status].label}
                      </Badge>
                    )}
                    <span className="text-sm font-bold text-gray-700">
                      R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {pedido.horario_entrega && (
                    <p className="text-xs text-gray-400 mt-0.5">{pedido.horario_entrega}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                    onClick={() => onEdit(pedido)}
                    title="Ver detalhes"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(pedido)}
                    title="Excluir pedido"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
