import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  CalendarDays,
  List,
  ChevronDown,
  MessageCircle,
  ArrowRight,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import PedidoDetalhes from '@/components/pedidos/PedidoDetalhes';
import CalendarioPedidos from '@/components/pedidos/CalendarioPedidos';
import DiaDoPedidoDialog from '@/components/pedidos/DiaDoPedidoDialog';

const statusConfig = {
  orcamento: { label: 'Orçamento', color: 'bg-gray-100 text-gray-700 border-gray-200', next: 'aprovado' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700 border-blue-200', next: 'producao' },
  producao: { label: 'Em Produção', color: 'bg-amber-100 text-amber-700 border-amber-200', next: 'pronto' },
  pronto: { label: 'Pronto', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', next: 'entregue' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700 border-green-200', next: null },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200', next: null },
};

export default function Pedidos() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pedidoToDelete, setPedidoToDelete] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vistaCalendario, setVistaCalendario] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [pedidoDiaDialog, setPedidoDiaDialog] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }, '-created_date'),
    enabled: !!user?.confeitaria_id,
  });

  // Check URL for pedido ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get('id');
    if (pedidoId && pedidos?.length) {
      const pedido = pedidos.find(p => p.id === pedidoId);
      if (pedido) setSelectedPedido(pedido);
    }
  }, [pedidos]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => appClient.entities.Pedido.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['parcelamentos'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.Pedido.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setShowDeleteDialog(false);
      setPedidoToDelete(null);
    },
  });

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch =
      pedido.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      pedido.numero?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || pedido.status === statusFilter;
    if (dataInicio && pedido.data_entrega && pedido.data_entrega.slice(0, 10) < dataInicio) return false;
    if (dataFim && pedido.data_entrega && pedido.data_entrega.slice(0, 10) > dataFim) return false;
    return matchesSearch && matchesStatus;
  });

  const handleWhatsApp = (telefone, pedido) => {
    const nome = pedido.cliente_nome || '';
    const num = pedido.numero || '';
    const dataEntrega = pedido.data_entrega
      ? format(parseISO(pedido.data_entrega), "dd/MM/yyyy", { locale: ptBR })
      : '';
    const message = `Olá ${nome}, seu pedido #${num} com data para ${dataEntrega}`;
    const phone = telefone?.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 border-gray-200"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="h-11 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <span className="text-gray-400 text-sm shrink-0">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="h-11 border border-gray-200 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            {(dataInicio || dataFim) && (
              <button
                onClick={() => { setDataInicio(''); setDataFim(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={vistaCalendario ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'h-11 w-11 shrink-0',
              vistaCalendario && 'bg-rose-500 hover:bg-rose-600 border-rose-500 text-white'
            )}
            onClick={() => setVistaCalendario(v => !v)}
            title={vistaCalendario ? 'Ver lista' : 'Ver calendário'}
          >
            {vistaCalendario ? <List className="w-5 h-5" /> : <CalendarDays className="w-5 h-5" />}
          </Button>
          <Link to={createPageUrl('NovoPedido')}>
            <Button className="w-full sm:w-auto h-11 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200">
              <Plus className="w-4 h-4 mr-2" />
              Novo Pedido
            </Button>
          </Link>
        </div>
      </div>

      {/* Status tabs — oculto em vista calendário */}
      {!vistaCalendario && <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={statusFilter === 'todos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('todos')}
          className={statusFilter === 'todos' ? 'bg-gray-900' : ''}
        >
          Todos ({pedidos.length})
        </Button>
        {Object.entries(statusConfig).map(([key, { label, color }]) => {
          const count = pedidos.filter(p => p.status === key).length;
          return (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter(key)}
              className={statusFilter === key ? `${color} border` : ''}
            >
              {label} ({count})
            </Button>
          );
        })}
      </div>}

      {/* Vista Calendário */}
      {vistaCalendario && (
        <CalendarioPedidos
          pedidos={pedidos}
          mes={mesCalendario}
          onMesChange={setMesCalendario}
          confeitariaId={user.confeitaria_id}
          onPedidoClick={(p) => setSelectedPedido(p)}
          onDeletePedido={(p) => { setPedidoToDelete(p); setShowDeleteDialog(true); }}
          onDiaClick={(dataStr) => setPedidoDiaDialog(dataStr)}
        />
      )}

      {/* Pedidos List — oculto em vista calendário */}
      {!vistaCalendario && <Card className="border-0 shadow-lg shadow-gray-100/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : filteredPedidos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPedido(pedido)}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-rose-600">
                          #{pedido.numero || pedido.id?.slice(-4)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{pedido.cliente_nome}</h3>
                          <Badge variant="outline" className="text-xs">
                            {pedido.tipo === 'personalizado' ? 'Personalizado' : 'Produto'}
                          </Badge>
                        </div>
                        
                        {pedido.tipo === 'personalizado' ? (
                          <p className="text-sm text-gray-500">
                            {pedido.tamanho_nome && pedido.massa_nome 
                              ? `${pedido.tamanho_nome} • ${pedido.massa_nome}${pedido.cobertura_nome ? ` • ${pedido.cobertura_nome}` : ''}`
                              : 'Pedido Personalizado'}
                          </p>
                        ) : (
                          <div className="text-sm text-gray-500">
                            {pedido.produtos_catalogo?.length > 0 ? (
                              <p>{pedido.produtos_catalogo.map(p => `${p.quantidade}x ${p.nome}`).join(', ')}</p>
                            ) : (
                              <p>Produto do Catálogo</p>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {pedido.tipo === 'produto_pronto' ? (
                              pedido.created_date ? format(parseISO(pedido.created_date), "dd/MM/yyyy", { locale: ptBR }) : 'Sem data'
                            ) : (
                              pedido.data_entrega ? format(parseISO(pedido.data_entrega), "dd/MM/yyyy", { locale: ptBR }) : 'Sem data'
                            )}
                          </span>
                          {pedido.horario_entrega && pedido.tipo !== 'produto_pronto' && (
                            <span>{pedido.horario_entrega}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-16 lg:ml-0">
                      <div className="text-right mr-4">
                        <p className="text-lg font-bold text-gray-900">
                          R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge className={`${statusConfig[pedido.status]?.color} border`}>
                          {statusConfig[pedido.status]?.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        {pedido.cliente_telefone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWhatsApp(pedido.cliente_telefone, pedido);
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {statusConfig[pedido.status]?.next && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatusMutation.mutate({
                                    id: pedido.id,
                                    status: statusConfig[pedido.status].next,
                                    pedido,
                                  });
                                }}
                                className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                              >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Avançar para {statusConfig[statusConfig[pedido.status].next]?.label}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `${createPageUrl('NovoPedido')}?editId=${pedido.id}`;
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 cursor-pointer hover:bg-red-50 hover:text-red-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPedidoToDelete(pedido);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Dialog de detalhe do dia no calendário */}
      {pedidoDiaDialog && (
        <DiaDoPedidoDialog
          dataStr={pedidoDiaDialog}
          pedidos={pedidos}
          onClose={() => setPedidoDiaDialog(null)}
          onEdit={(p) => { setPedidoDiaDialog(null); setSelectedPedido(p); }}
          onDelete={(p) => { setPedidoDiaDialog(null); setPedidoToDelete(p); setShowDeleteDialog(true); }}
          statusConfig={statusConfig}
        />
      )}

      {/* Detalhes Dialog */}
      {selectedPedido && (
        <PedidoDetalhes
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
          onStatusChange={(status) => {
            updateStatusMutation.mutate({ id: selectedPedido.id, status, pedido: selectedPedido });
            setSelectedPedido({ ...selectedPedido, status });
          }}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Pedido</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Tem certeza que deseja excluir o pedido de <strong>{pedidoToDelete?.cliente_nome}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(pedidoToDelete?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
