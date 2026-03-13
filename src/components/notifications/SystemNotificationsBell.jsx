import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ClipboardList,
  Loader2,
  Megaphone,
  Package,
  Square
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';

const formatarData = (value) => {
  if (!value) return 'Agora';
  try {
    return format(parseISO(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Agora';
  }
};

const isHtmlMessage = (value = '') => /<\/?[a-z][\s\S]*>/i.test(String(value));

const getPedidoTitulo = (pedido) => {
  const numero = pedido.numero ? `#${pedido.numero}` : 'novo';
  const cliente = pedido.cliente_nome || 'Cliente não identificado';
  return `Pedido ${numero} - ${cliente}`;
};

const getPedidoResumo = (pedido) => {
  const tipo = pedido.tipo === 'produto_pronto' ? 'Produto pronto' : 'Personalizado';
  const valor = Number(pedido.valor_total || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2
  });
  return `${tipo} • ${pedido.status || 'orcamento'} • R$ ${valor}`;
};

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-gray-500">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
        <Icon className="w-6 h-6 text-rose-400" />
      </div>
      <div>
        <p className="font-medium text-gray-800">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

export default function SystemNotificationsBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('avisos');
  const [selectedAvisoId, setSelectedAvisoId] = useState(null);
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);

  // Estado local para ocultar notificações sem depender do banco (ou enquanto a tabela não existe)
  const [dismissedAvisoIds, setDismissedAvisoIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cakeflow_dismissed_avisos') || '[]');
    } catch {
      return [];
    }
  });
  const [dismissedPedidoIds, setDismissedPedidoIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cakeflow_dismissed_pedidos') || '[]');
    } catch {
      return [];
    }
  });

  const notificationsQuery = useQuery({
    queryKey: ['system-notifications', 'published'],
    queryFn: () => appClient.entities.SystemNotification.filter({ status: 'published' }, '-published_at'),
    enabled: !!user?.id,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });

  const notificationReadsQuery = useQuery({
    queryKey: ['system-notification-reads', user?.id],
    queryFn: () => appClient.entities.SystemNotificationRead.filter({ user_id: user.id }, '-read_at'),
    enabled: !!user?.id,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });

  const pedidosQuery = useQuery({
    queryKey: ['notification-pedidos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }, '-created_date'),
    enabled: !!user?.id && !!user?.confeitaria_id,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });

  const pedidoReadsQuery = useQuery({
    queryKey: ['pedido-notification-reads', user?.id],
    queryFn: () => appClient.entities.PedidoNotificationRead.filter({ user_id: user.id }, '-read_at'),
    enabled: !!user?.id,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });

  const notificationReadMap = useMemo(() => {
    return new Map((notificationReadsQuery.data || []).map((item) => [item.notification_id, item]));
  }, [notificationReadsQuery.data]);

  const pedidoReadMap = useMemo(() => {
    return new Map((pedidoReadsQuery.data || []).map((item) => [item.pedido_id, item]));
  }, [pedidoReadsQuery.data]);

  const avisos = useMemo(() => {
    return ((notificationsQuery.data || []) || [])
      .map((item) => ({
        ...item,
        is_read: notificationReadMap.has(item.id) || dismissedAvisoIds.includes(item.id)
      }))
      .filter((item) => !item.is_read);
  }, [notificationReadMap, notificationsQuery.data, dismissedAvisoIds]);

  const pedidos = useMemo(() => {
    return ((pedidosQuery.data || []) || [])
      .map((item) => ({
        ...item,
        is_read: pedidoReadMap.has(item.id) || dismissedPedidoIds.includes(item.id)
      }))
      .filter((item) => !item.is_read);
  }, [pedidoReadMap, pedidosQuery.data, dismissedPedidoIds]);

  const unreadCount = avisos.length + pedidos.length;
  const selectedAviso = avisos.find((item) => item.id === selectedAvisoId) || null;
  const selectedPedido = pedidos.find((item) => item.id === selectedPedidoId) || null;

  const markAvisoAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      if (!user?.id) return null;
      if (notificationReadMap.has(notificationId)) return notificationReadMap.get(notificationId);

      return appClient.entities.SystemNotificationRead.create({
        notification_id: notificationId,
        user_id: user.id,
        read_at: new Date().toISOString()
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['system-notification-reads', user?.id] });
    }
  });

  const markPedidoAsReadMutation = useMutation({
    mutationFn: async (pedidoId) => {
      if (!user?.id) return null;
      if (pedidoReadMap.has(pedidoId)) return pedidoReadMap.get(pedidoId);

      return appClient.entities.PedidoNotificationRead.create({
        pedido_id: pedidoId,
        user_id: user.id,
        read_at: new Date().toISOString()
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pedido-notification-reads', user?.id] });
    }
  });

  useEffect(() => {
    if (!open) {
      setSelectedAvisoId(null);
      setSelectedPedidoId(null);
      setActiveTab('avisos');
    }
  }, [open]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let unsubscribe = null;
    let cancelled = false;
    const changes = [
      { table: 'system_notifications', event: '*' },
      { table: 'system_notification_reads', event: '*', filter: `user_id=eq.${user.id}` },
      { table: 'pedido_notification_reads', event: '*', filter: `user_id=eq.${user.id}` }
    ];

    if (user?.confeitaria_id) {
      changes.push({ table: 'pedidos', event: '*', filter: `confeitaria_id=eq.${user.confeitaria_id}` });
    }

    appClient.realtime.subscribeToPostgresChanges({
      channel: `system-notifications-${user.id}`,
      changes,
      onChange: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['system-notifications', 'published'] }),
          queryClient.invalidateQueries({ queryKey: ['system-notification-reads', user.id] }),
          queryClient.invalidateQueries({ queryKey: ['notification-pedidos', user.confeitaria_id] }),
          queryClient.invalidateQueries({ queryKey: ['pedido-notification-reads', user.id] })
        ]);
      },
      onError: (error) => {
        console.error('Falha no realtime de notificações:', error);
      }
    }).then((cleanup) => {
      if (cancelled) {
        cleanup?.();
        return;
      }
      unsubscribe = cleanup;
    }).catch((error) => {
      console.error('Falha ao iniciar realtime de notificações:', error);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, user?.confeitaria_id, user?.id]);

  const handleOpenAviso = (notification) => {
    const isSame = selectedAvisoId === notification.id;
    setSelectedAvisoId(isSame ? null : notification.id);
  };

  const handleOpenPedido = (pedido) => {
    const isSame = selectedPedidoId === pedido.id;
    setSelectedPedidoId(isSame ? null : pedido.id);
  };

  const handleMarkAvisoAsRead = async (notification) => {
    // Oculta localmente primeiro para resposta imediata
    const newDismissed = [...dismissedAvisoIds, notification.id];
    setDismissedAvisoIds(newDismissed);
    localStorage.setItem('cakeflow_dismissed_avisos', JSON.stringify(newDismissed));
    setSelectedAvisoId((current) => (current === notification.id ? null : current));

    try {
      await markAvisoAsReadMutation.mutateAsync(notification.id);
    } catch (error) {
      // Ignora erro visualmente se o usuário pediu para apenas ocultar
      console.warn('Erro ao sincronizar leitura de aviso com o servidor:', error);
    }
  };

  const handleMarkPedidoAsRead = async (pedido) => {
    // Oculta localmente primeiro para resposta imediata
    const newDismissed = [...dismissedPedidoIds, pedido.id];
    setDismissedPedidoIds(newDismissed);
    localStorage.setItem('cakeflow_dismissed_pedidos', JSON.stringify(newDismissed));
    setSelectedPedidoId((current) => (current === pedido.id ? null : current));

    try {
      await markPedidoAsReadMutation.mutateAsync(pedido.id);
    } catch (error) {
      // Ignora erro visualmente conforme solicitado ("apenas oculte")
      console.warn('Erro ao sincronizar leitura de pedido com o servidor (tabela pode estar faltando):', error);
    }
  };

  if (!user?.id) return null;

  const isLoading =
    notificationsQuery.isLoading ||
    notificationReadsQuery.isLoading ||
    pedidosQuery.isLoading ||
    pedidoReadsQuery.isLoading;

  return (
    <>
      <style>{`
        @keyframes notification-bell-blink {
          0%, 100% { color: #e11d48; opacity: 1; }
          50% { color: #fb7185; opacity: 0.45; }
        }
      `}</style>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-xl text-gray-600 hover:bg-rose-50 hover:text-rose-600"
        >
          <Bell
            className="w-5 h-5"
            style={unreadCount > 0 ? { animation: 'notification-bell-blink 1.5s ease-in-out infinite' } : undefined}
          />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-rose-100 px-6 py-5">
              <SheetTitle className="flex items-center gap-2 text-gray-900">
                <Bell className="w-5 h-5 text-rose-500" />
                Atualizações do sistema
              </SheetTitle>
              <SheetDescription>
                Avisos do sistema e novos pedidos da sua confeitaria.
              </SheetDescription>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-rose-100 px-6 py-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="avisos">
                    Avisos {avisos.length > 0 ? `(${avisos.length})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="pedidos">
                    Pedidos {pedidos.length > 0 ? `(${pedidos.length})` : ''}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando notificações...
                  </div>
                ) : (
                  <>
                    <TabsContent value="avisos" className="mt-0 h-full">
                      {avisos.length === 0 ? (
                        <EmptyState
                          icon={Megaphone}
                          title="Nenhum aviso pendente"
                          description="Quando houver novas atualizações, elas aparecerão aqui."
                        />
                      ) : (
                        <div className="divide-y divide-rose-100">
                          <div className="px-6 py-3 text-xs font-medium text-gray-500">
                            {avisos.length} aviso(s) não lido(s)
                          </div>
                          <div className="max-h-[45vh] overflow-y-auto">
                            {avisos.map((notification) => (
                              <div
                                key={notification.id}
                                className={`w-full px-6 py-4 transition-colors ${
                                  selectedAviso?.id === notification.id ? 'bg-rose-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkAvisoAsRead(notification)}
                                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-300 transition-colors hover:border-emerald-500 hover:text-emerald-600"
                                    title="Marcar como lida"
                                  >
                                    <Square className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAviso(notification)}
                                      className="w-full text-left"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="font-semibold text-gray-900">{notification.title}</p>
                                        <span className="shrink-0 text-[11px] text-gray-400">
                                          {formatarData(notification.published_at)}
                                        </span>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {selectedAviso && (
                            <div className="px-6 py-5 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-semibold text-gray-900">{selectedAviso.title}</h3>
                                <span className="text-xs text-gray-400">
                                  {formatarData(selectedAviso.published_at)}
                                </span>
                              </div>
                              {isHtmlMessage(selectedAviso.message) ? (
                                <div
                                  className="text-sm leading-6 text-gray-600 [&_a]:text-rose-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                                  dangerouslySetInnerHTML={{ __html: selectedAviso.message }}
                                />
                              ) : (
                                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                                  {selectedAviso.message}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="pedidos" className="mt-0 h-full">
                      {pedidos.length === 0 ? (
                        <EmptyState
                          icon={ClipboardList}
                          title="Nenhum pedido pendente"
                          description="Novos pedidos aparecerão aqui até serem marcados como lidos."
                        />
                      ) : (
                        <div className="divide-y divide-rose-100">
                          <div className="px-6 py-3 text-xs font-medium text-gray-500">
                            {pedidos.length} pedido(s) não lido(s)
                          </div>
                          <div className="max-h-[45vh] overflow-y-auto">
                            {pedidos.map((pedido) => (
                              <div
                                key={pedido.id}
                                className={`w-full px-6 py-4 transition-colors ${
                                  selectedPedido?.id === pedido.id ? 'bg-rose-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkPedidoAsRead(pedido)}
                                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-300 transition-colors hover:border-emerald-500 hover:text-emerald-600"
                                    title="Marcar pedido como lido"
                                  >
                                    <Square className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPedido(pedido)}
                                      className="w-full text-left"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-semibold text-gray-900">{getPedidoTitulo(pedido)}</p>
                                          <p className="mt-1 text-sm text-gray-500">{getPedidoResumo(pedido)}</p>
                                        </div>
                                        <span className="shrink-0 text-[11px] text-gray-400">
                                          {formatarData(pedido.created_date)}
                                        </span>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {selectedPedido && (
                            <div className="px-6 py-5 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-semibold text-gray-900">{getPedidoTitulo(selectedPedido)}</h3>
                                <span className="text-xs text-gray-400">
                                  {formatarData(selectedPedido.created_date)}
                                </span>
                              </div>
                              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
                                <div className="flex items-center gap-2 text-gray-800">
                                  <Package className="h-4 w-4 text-rose-500" />
                                  <span className="font-medium">{getPedidoResumo(selectedPedido)}</span>
                                </div>
                                <p><span className="font-medium text-gray-800">Forma de pagamento:</span> {selectedPedido.forma_pagamento_nome || selectedPedido.forma_pagamento || 'Não definido'}</p>
                                <p><span className="font-medium text-gray-800">Entrega:</span> {selectedPedido.data_entrega || 'Não definida'} {selectedPedido.horario_entrega ? `às ${selectedPedido.horario_entrega}` : ''}</p>
                                {selectedPedido.observacoes && (
                                  <p className="whitespace-pre-wrap"><span className="font-medium text-gray-800">Observações:</span> {selectedPedido.observacoes}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
