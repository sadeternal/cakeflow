import React, { useEffect, useState, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  format, parseISO,
  addMonths, subMonths, startOfMonth, endOfMonth,
  getMonth, getYear, setMonth, setYear,
  eachDayOfInterval, isSameDay, isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Send,
  Calendar,
  CalendarDays,
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Pencil,
  ShoppingBag,
  XCircle
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
import { useRegisterTour } from '@/lib/TourContext';

const PEDIDOS_TOUR_SLIDES = [
  {
    icon: ShoppingBag,
    title: 'Seus Pedidos em Um Só Lugar',
    description: 'Aqui você acompanha todos os pedidos da sua confeitaria. Cada pedido passa por etapas: Orçamento → Aprovado → Em Produção → Pronto → Entregue. Você pode filtrar por status ou período para encontrar o que precisa.',
    highlight: 'Use o filtro de status no topo para focar apenas nos pedidos relevantes.',
  },
  {
    icon: Plus,
    title: 'Criando e Gerenciando Pedidos',
    description: 'Clique em "Novo Pedido" para registrar uma encomenda. Você pode criar pedidos de produtos prontos do catálogo ou pedidos personalizados. Ao clicar em um pedido, você vê todos os detalhes e pode avançar o status.',
    highlight: 'O número do pedido é gerado automaticamente pelo sistema.',
  },
  {
    icon: CalendarDays,
    title: 'Filtros e Vista de Calendário',
    description: 'Além da lista, alterne para a vista de calendário para ver as entregas do mês de forma visual. Use as datas de início e fim para filtrar pedidos por período. O botão de WhatsApp em cada pedido abre a conversa diretamente com o cliente.',
    highlight: 'A vista de calendário é ideal para planejar a produção semanal.',
  },
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - 2 + i);

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
  useRegisterTour('pedidos', PEDIDOS_TOUR_SLIDES, !!user);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pedidoToDelete, setPedidoToDelete] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pedidoToCancel, setPedidoToCancel] = useState(null);
  const [vistaCalendario, setVistaCalendario] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [pedidoDiaDialog, setPedidoDiaDialog] = useState(null);
  const [diaFilter, setDiaFilter] = useState(null);
  const calendarScrollRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: confeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !!user?.confeitaria_id,
  });

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

  const inicioMes = startOfMonth(mesCalendario);
  const fimMes = endOfMonth(mesCalendario);
  const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });

  // Reset day filter when month changes
  useEffect(() => {
    setDiaFilter(null);
  }, [getMonth(mesCalendario), getYear(mesCalendario)]);

  // Auto-scroll to today or selected day in the horizontal strip
  useEffect(() => {
    if (!calendarScrollRef.current || vistaCalendario) return;
    const today = new Date();
    const target = diaFilter || (
      getMonth(today) === getMonth(mesCalendario) && getYear(today) === getYear(mesCalendario)
        ? today : inicioMes
    );
    const dayIndex = diasDoMes.findIndex(d => isSameDay(d, target));
    if (dayIndex < 0) return;
    const cardWidth = 72; // px per card including gap
    const containerWidth = calendarScrollRef.current.clientWidth;
    const scrollPos = dayIndex * cardWidth - containerWidth / 2 + cardWidth / 2;
    calendarScrollRef.current.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
  }, [diaFilter, mesCalendario, vistaCalendario]);

  const pedidosDoMes = pedidos.filter(pedido => {
    const dataRef = pedido.data_entrega || pedido.created_date;
    if (!dataRef) return false;
    const d = parseISO(dataRef);
    return d >= inicioMes && d <= fimMes;
  });

  const pedidosPorDia = (dia) => pedidosDoMes.filter(p => {
    const dataRef = p.data_entrega || p.created_date;
    if (!dataRef) return false;
    return isSameDay(parseISO(dataRef), dia);
  });

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch =
      pedido.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      pedido.numero?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || pedido.status === statusFilter;
    const dataRef = pedido.data_entrega || pedido.created_date;
    if (!dataRef) return false;
    const d = parseISO(dataRef);
    if (diaFilter) {
      return isSameDay(d, diaFilter) && matchesSearch && matchesStatus;
    }
    if (d < inicioMes || d > fimMes) return false;
    return matchesSearch && matchesStatus;
  });

  const scrollCalendar = (direction) => {
    if (!calendarScrollRef.current) return;
    const cardWidth = 72;
    const isMobile = window.innerWidth < 640;
    calendarScrollRef.current.scrollBy({ left: direction * cardWidth * (isMobile ? 4 : 7), behavior: 'smooth' });
  };

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

  const handleEnviarConfirmacao = (pedido) => {
    const dataEntrega = pedido.data_entrega
      ? format(parseISO(pedido.data_entrega), "dd/MM/yyyy", { locale: ptBR })
      : 'a combinar';
    const tipoEntrega = pedido.tipo_entrega === 'entrega' || pedido.tipo_entrega === 'delivery'
      ? 'Delivery'
      : pedido.tipo_entrega === 'retirada'
      ? 'Retirada'
      : pedido.tipo_entrega || '';
    const statusLabel = statusConfig[pedido.status]?.label || pedido.status || '';

    const defaultTemplate = `Ol\u00E1 {nome_cliente}!\nSeu pedido *#{numero}* est\u00E1 com status *{status}*.\nEntrega: {data_entrega}\nTotal: R$ {total}\nObrigada pela prefer\u00EAncia!`;
    const template = confeitaria?.mensagem_confirmacao_pedido || defaultTemplate;

    const message = template
      .replace(/{nome_cliente}/g, pedido.cliente_nome || '')
      .replace(/{numero}/g, `${pedido.numero || ''}`)
      .replace(/{status}/g, statusLabel)
      .replace(/{total}/g, (pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      .replace(/{data_entrega}/g, dataEntrega)
      .replace(/{forma_pagamento}/g, pedido.forma_pagamento || '')
      .replace(/{tipo_entrega}/g, tipoEntrega)
      .replace(/{nome_confeitaria}/g, confeitaria?.nome || '');

    const phone = pedido.cliente_telefone?.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:justify-between">

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-1">
          {/* Busca */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 border-gray-200 w-full"
            />
          </div>

          {/* Status */}
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

          {/* Navegação de mês */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setMesCalendario(m => subMonths(m, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Select value={String(getMonth(mesCalendario))} onValueChange={(v) => setMesCalendario(m => setMonth(m, parseInt(v)))}>
              <SelectTrigger className="flex-1 sm:w-32 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(getYear(mesCalendario))} onValueChange={(v) => setMesCalendario(m => setYear(m, parseInt(v)))}>
              <SelectTrigger className="w-24 h-11 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setMesCalendario(m => addMonths(m, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Calendário + Novo Pedido + Tour */}
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
          <Link to={createPageUrl('NovoPedido')} className="flex-1 sm:flex-none">
            <Button className="w-full h-11 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200">
              <Plus className="w-4 h-4 mr-2" />
              Novo Pedido
            </Button>
          </Link>
        </div>
      </div>


      {/* Calendário horizontal de dias — oculto em vista calendário */}
      {!vistaCalendario && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-gray-200 text-gray-600 hover:bg-gray-50 hidden sm:flex"
            onClick={() => scrollCalendar(-1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div
            ref={calendarScrollRef}
            className="flex gap-2 overflow-x-auto flex-1 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {/* "Todos" card */}
            <button
              onClick={() => setDiaFilter(null)}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[60px] shrink-0 border transition-all text-sm',
                !diaFilter
                  ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-70 mb-0.5">Todos</span>
              <span className="text-base font-bold leading-none">{pedidosDoMes.length}</span>
            </button>

            {diasDoMes.map((dia) => {
              const count = pedidosPorDia(dia).length;
              const isSelected = diaFilter && isSameDay(dia, diaFilter);
              const isTodayDate = isToday(dia);
              return (
                <button
                  key={dia.toISOString()}
                  onClick={() => setDiaFilter(isSelected ? null : dia)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl px-2 py-2.5 min-w-[60px] shrink-0 border transition-all relative',
                    isSelected
                      ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                      : isTodayDate
                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                      : count > 0
                      ? 'bg-white text-gray-700 border-gray-200 hover:border-rose-200 hover:bg-rose-50'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                  )}
                >
                  <span className={cn('text-[10px] font-medium uppercase tracking-wide mb-0.5', isSelected ? 'text-rose-100' : 'opacity-60')}>
                    {format(dia, 'EEE', { locale: ptBR })}
                  </span>
                  <span className="text-base font-bold leading-none">{format(dia, 'd')}</span>
                  {count > 0 && (
                    <span className={cn(
                      'mt-1 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center',
                      isSelected ? 'bg-white text-rose-500' : 'bg-rose-500 text-white'
                    )}>
                      {count}
                    </span>
                  )}
                  {count === 0 && <span className="mt-1 h-4" />}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-gray-200 text-gray-600 hover:bg-gray-50 hidden sm:flex"
            onClick={() => scrollCalendar(1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

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
          hideNavigation
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
                            title="Enviar confirmação via WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnviarConfirmacao(pedido);
                            }}
                          >
                            <Send className="w-4 h-4" />
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
                            {pedido.status !== 'cancelado' && (
                              <DropdownMenuItem
                                className="text-orange-600 cursor-pointer hover:bg-orange-50 hover:text-orange-700 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPedidoToCancel(pedido);
                                  setShowCancelDialog(true);
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancelar pedido
                              </DropdownMenuItem>
                            )}
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

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pedido</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Tem certeza que deseja cancelar o pedido de <strong>{pedidoToCancel?.cliente_nome}</strong>?
          </p>
          {pedidoToCancel?.tipo === 'produto_pronto' && pedidoToCancel?.produtos_catalogo?.length > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              O estoque dos produtos será restaurado automaticamente.
            </p>
          )}
          <p className="text-sm text-gray-500">
            O valor do pedido será removido do financeiro.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                updateStatusMutation.mutate({ id: pedidoToCancel.id, status: 'cancelado' });
                setShowCancelDialog(false);
                setPedidoToCancel(null);
              }}
              disabled={updateStatusMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
