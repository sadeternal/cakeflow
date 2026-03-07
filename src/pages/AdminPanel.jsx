import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  Search,
  Phone,
  Mail,
  Loader2,
  Archive,
  Bell,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Ban,
  ShieldCheck as ShieldCheckIcon,
  History,
  CalendarX,
  ExternalLink,
  ReceiptText
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import 'react-quill/dist/quill.snow.css';

const STATUS_LABELS = {
  active: 'Ativo',
  trial: 'Trial',
  canceling: 'Cancelando',
  past_due: 'Inadimplente',
  canceled: 'Cancelado',
  incomplete: 'Incompleto'
};

const STATUS_VARIANT = {
  active: 'default',
  trial: 'secondary',
  canceling: 'outline',
  past_due: 'destructive',
  canceled: 'destructive',
  incomplete: 'outline'
};

const STATUS_COLOR = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  trial: 'bg-amber-100 text-amber-700 border-amber-200',
  canceling: 'bg-orange-100 text-orange-700 border-orange-200',
  past_due: 'bg-red-100 text-red-700 border-red-200',
  canceled: 'bg-gray-100 text-gray-600 border-gray-200',
  incomplete: 'bg-gray-100 text-gray-600 border-gray-200'
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean']
  ]
};

const QUILL_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'list',
  'bullet',
  'link'
];

const normalizeRichText = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '<p><br></p>') return '';
  return trimmed;
};

const hasRichTextContent = (value = '') => {
  const plainText = String(value || '')
    .replace(/<(.|\n)*?>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return plainText.length > 0;
};

const isHtmlMessage = (value = '') => /<\/?[a-z][\s\S]*>/i.test(String(value));

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [enviandoBrevo, setEnviandoBrevo] = useState({});
  const [sincronizando, setSincronizando] = useState({});
  const [bloqueando, setBloqueando] = useState({});
  const [cancelandoRecorrencia, setCancelandoRecorrencia] = useState({});
  const [historyConfeitaria, setHistoryConfeitaria] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: ''
  });

  // Guard: apenas admin
  if (user && user.role !== 'admin') {
    window.location.href = createPageUrl('Dashboard');
    return null;
  }

  const { data: confeitarias = [], isLoading } = useQuery({
    queryKey: ['admin-confeitarias'],
    queryFn: () => appClient.entities.Confeitaria.filter({}),
    enabled: user?.role === 'admin'
  });

  const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['admin-system-notifications'],
    queryFn: () => appClient.entities.SystemNotification.filter({}, '-published_at'),
    enabled: user?.role === 'admin'
  });

  // --- Métricas ---
  const total = confeitarias.length;
  const ativos = confeitarias.filter(c => c.status_assinatura === 'active').length;
  const trials = confeitarias.filter(c => c.status_assinatura === 'trial').length;
  const cancelados = confeitarias.filter(
    c => c.status_assinatura === 'canceled' || c.status_assinatura === 'past_due'
  ).length;

  const hoje = new Date();
  const trialsExpirando = confeitarias.filter(c => {
    if (c.status_assinatura !== 'trial' || !c.data_fim_trial) return false;
    const dias = differenceInDays(parseISO(c.data_fim_trial), hoje);
    return dias >= 0 && dias <= 7;
  });

  // --- Filtros ---
  const confeitariasFiltradas = confeitarias.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status_assinatura === filtroStatus;
    const matchBusca =
      !busca ||
      c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone?.includes(busca);

    let matchData = true;
    if (dataInicio || dataFim) {
      const cadastro = c.created_date ? c.created_date.slice(0, 10) : null;
      if (!cadastro) {
        matchData = false;
      } else {
        if (dataInicio && cadastro < dataInicio) matchData = false;
        if (dataFim && cadastro > dataFim) matchData = false;
      }
    }

    return matchStatus && matchBusca && matchData;
  });

  const copiar = (texto, label) => {
    navigator.clipboard.writeText(texto);
    toast({ title: `${label} copiado!` });
  };

  const handleSyncSubscription = async (confeitaria) => {
    setSincronizando(prev => ({ ...prev, [confeitaria.id]: true }));
    try {
      await appClient.functions.invoke('syncSubscription', { confeitaria_id: confeitaria.id });
      await queryClient.invalidateQueries({ queryKey: ['admin-confeitarias'] });
      toast({ title: 'Assinatura sincronizada com o Stripe!' });
    } catch (err) {
      toast({ title: 'Erro ao sincronizar assinatura', description: err?.message || '', variant: 'destructive' });
    } finally {
      setSincronizando(prev => ({ ...prev, [confeitaria.id]: false }));
    }
  };

  const handleAddBrevo = async (confeitaria) => {
    setEnviandoBrevo(prev => ({ ...prev, [confeitaria.id]: true }));
    try {
      await appClient.functions.invoke('addBrevoContact', { confeitaria_id: confeitaria.id });
      toast({ title: 'Contato adicionado ao Brevo!' });
    } catch {
      toast({ title: 'Erro ao adicionar no Brevo', variant: 'destructive' });
    } finally {
      setEnviandoBrevo(prev => ({ ...prev, [confeitaria.id]: false }));
    }
  };

  const handleToggleBloqueado = async (confeitaria) => {
    setBloqueando(prev => ({ ...prev, [confeitaria.id]: true }));
    const novoBloqueado = !confeitaria.bloqueado;
    try {
      await appClient.entities.Confeitaria.update(confeitaria.id, { bloqueado: novoBloqueado });
      await queryClient.invalidateQueries({ queryKey: ['admin-confeitarias'] });
      toast({ title: novoBloqueado ? 'Conta bloqueada' : 'Conta desbloqueada' });
    } catch (err) {
      toast({ title: 'Erro ao alterar bloqueio', description: err?.message || '', variant: 'destructive' });
    } finally {
      setBloqueando(prev => ({ ...prev, [confeitaria.id]: false }));
    }
  };

  const handleOpenHistory = async (confeitaria) => {
    setHistoryConfeitaria(confeitaria);
    setHistoryData(null);
    setLoadingHistory(true);
    try {
      const resp = await appClient.functions.invoke('getSubscriptionHistory', {
        confeitaria_id: confeitaria.id
      });
      setHistoryData(resp?.data || { subscriptions: [], invoices: [] });
    } catch (err) {
      toast({ title: 'Erro ao carregar histórico', description: err?.message || '', variant: 'destructive' });
      setHistoryData({ subscriptions: [], invoices: [] });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCancelRecorrencia = async () => {
    if (!historyConfeitaria) return;
    setCancelandoRecorrencia(prev => ({ ...prev, [historyConfeitaria.id]: true }));
    try {
      const resp = await appClient.functions.invoke('cancelSubscription', { confeitaria_id: historyConfeitaria.id });
      await queryClient.invalidateQueries({ queryKey: ['admin-confeitarias'] });
      const accessUntil = resp?.data?.access_until;
      toast({
        title: 'Recorrência cancelada',
        description: accessUntil
          ? `O acesso continua até ${formatarData(accessUntil)}.`
          : 'O acesso continua até a data de renovação.'
      });
      setCancelConfirmOpen(false);
      setHistoryConfeitaria(null);
    } catch (err) {
      toast({ title: 'Erro ao cancelar recorrência', description: err?.message || '', variant: 'destructive' });
    } finally {
      setCancelandoRecorrencia(prev => ({ ...prev, [historyConfeitaria?.id]: false }));
    }
  };

  const formatarData = (iso) => {
    if (!iso) return '—';
    try {
      return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '—';
    }
  };

  const diasRestantesTrial = (data_fim_trial) => {
    if (!data_fim_trial) return null;
    const dias = differenceInDays(parseISO(data_fim_trial), hoje);
    return dias;
  };

  const resetNotificationForm = () => {
    setEditingNotification(null);
    setNotificationForm({ title: '', message: '' });
    setShowNotificationDialog(false);
  };

  const openNewNotificationDialog = () => {
    setEditingNotification(null);
    setNotificationForm({ title: '', message: '' });
    setShowNotificationDialog(true);
  };

  const openEditNotificationDialog = (notification) => {
    setEditingNotification(notification);
    setNotificationForm({
      title: notification.title || '',
      message: notification.message || ''
    });
    setShowNotificationDialog(true);
  };

  const saveNotificationMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: notificationForm.title.trim(),
        message: normalizeRichText(notificationForm.message),
        updated_at: new Date().toISOString()
      };

      if (editingNotification?.id) {
        return appClient.entities.SystemNotification.update(editingNotification.id, payload);
      }

      return appClient.entities.SystemNotification.create({
        ...payload,
        status: 'published',
        created_by: user.id,
        published_at: new Date().toISOString()
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-system-notifications'] });
      toast({ title: editingNotification ? 'Aviso atualizado' : 'Aviso publicado' });
      resetNotificationForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar aviso',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive'
      });
    }
  });

  const archiveNotificationMutation = useMutation({
    mutationFn: (notificationId) =>
      appClient.entities.SystemNotification.update(notificationId, {
        status: 'archived',
        updated_at: new Date().toISOString()
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-system-notifications'] });
      toast({ title: 'Aviso arquivado' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao arquivar aviso',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive'
      });
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => appClient.entities.SystemNotification.delete(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-system-notifications'] });
      toast({ title: 'Aviso excluído' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir aviso',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads & Usuários</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="avisos">Avisos do Sistema</TabsTrigger>
        </TabsList>

        {/* ─── ABA LEADS ─── */}
        <TabsContent value="leads" className="mt-6 space-y-4">

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="canceling">Cancelando</SelectItem>
                <SelectItem value="past_due">Inadimplente</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">Cadastro:</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-36 text-sm"
                title="Data início"
              />
              <span className="text-gray-400 text-sm">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="w-36 text-sm"
                title="Data fim"
              />
              {(dataInicio || dataFim) && (
                <button
                  onClick={() => { setDataInicio(''); setDataFim(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                >
                  limpar
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500">
            {confeitariasFiltradas.length} confeitaria(s) encontrada(s)
          </p>

          {/* Tabela */}
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Confeitaria</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Trial / Próx. pgto</TableHead>
                  <TableHead>Como conheceu</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : confeitariasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      Nenhuma confeitaria encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  confeitariasFiltradas.map(c => {
                    const dias = diasRestantesTrial(c.data_fim_trial);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{c.nome || '—'}</div>
                          {c.instagram && (
                            <div className="text-xs text-gray-400">@{c.instagram.replace('@', '')}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {c.owner_email && (
                              <button
                                onClick={() => copiar(c.owner_email, 'E-mail')}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline text-left"
                              >
                                <Copy className="w-3 h-3" />
                                {c.owner_email}
                              </button>
                            )}
                            {c.telefone && (
                              <button
                                onClick={() => copiar(c.telefone, 'Telefone')}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:underline text-left"
                              >
                                <Phone className="w-3 h-3" />
                                {c.telefone}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[c.status_assinatura] || STATUS_COLOR.incomplete}`}>
                            {STATUS_LABELS[c.status_assinatura] || c.status_assinatura || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatarData(c.created_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.status_assinatura === 'trial' && dias !== null ? (
                            <span className={dias <= 3 ? 'text-red-600 font-medium' : 'text-amber-600'}>
                              {dias > 0 ? `${dias}d restantes` : dias === 0 ? 'Expira hoje' : 'Expirado'}
                            </span>
                          ) : c.data_proximo_pagamento ? (
                            <span className="text-gray-600">{formatarData(c.data_proximo_pagamento)}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {c.como_conheceu || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleBloqueado(c)}
                              disabled={bloqueando[c.id]}
                              title={c.bloqueado ? 'Desbloquear conta' : 'Bloquear conta'}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                c.bloqueado
                                  ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              }`}
                            >
                              {bloqueando[c.id]
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : c.bloqueado
                                  ? <Ban className="w-4 h-4" />
                                  : <ShieldCheckIcon className="w-4 h-4" />
                              }
                            </button>
                            <button
                              onClick={() => handleSyncSubscription(c)}
                              disabled={sincronizando[c.id] || !c.stripe_customer_id}
                              title={c.stripe_customer_id ? 'Sincronizar assinatura com Stripe' : 'Sem customer Stripe'}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                            >
                              {sincronizando[c.id]
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <RefreshCw className="w-4 h-4" />
                              }
                            </button>
                            <button
                              onClick={() => handleAddBrevo(c)}
                              disabled={enviandoBrevo[c.id]}
                              title="Adicionar ao Brevo"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                              {enviandoBrevo[c.id]
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Mail className="w-4 h-4" />
                              }
                            </button>
                            <button
                              onClick={() => handleOpenHistory(c)}
                              title="Histórico de assinatura"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── ABA RELATÓRIOS ─── */}
        <TabsContent value="relatorios" className="mt-6 space-y-6">

          {/* Cards de métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Users className="w-4 h-4" />
                Total de usuários
              </div>
              <p className="text-3xl font-bold text-gray-900">{total}</p>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Plano ativo
              </div>
              <p className="text-3xl font-bold text-emerald-700">{ativos}</p>
            </div>

            <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <Clock className="w-4 h-4" />
                Em trial
              </div>
              <p className="text-3xl font-bold text-amber-700">{trials}</p>
            </div>

            <div className="bg-white rounded-xl border border-red-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <XCircle className="w-4 h-4" />
                Cancelados / Inadimplentes
              </div>
              <p className="text-3xl font-bold text-red-700">{cancelados}</p>
            </div>
          </div>

          {/* Distribuição por status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Distribuição por status</h3>
            {total === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum dado disponível.</p>
            ) : (
              Object.entries(STATUS_LABELS).map(([status, label]) => {
                const count = confeitarias.filter(c => c.status_assinatura === status).length;
                if (count === 0) return null;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-gray-900">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status === 'active' ? 'bg-emerald-500' :
                          status === 'trial' ? 'bg-amber-400' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Trials expirando em breve */}
          {trialsExpirando.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-gray-900">
                  Trials expirando nos próximos 7 dias ({trialsExpirando.length})
                </h3>
              </div>
              <div className="space-y-3">
                {trialsExpirando
                  .sort((a, b) => new Date(a.data_fim_trial) - new Date(b.data_fim_trial))
                  .map(c => {
                    const dias = diasRestantesTrial(c.data_fim_trial);
                    return (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{c.nome}</p>
                          <p className="text-xs text-gray-500">{c.owner_email}</p>
                        </div>
                        <span className={`text-sm font-medium ${dias <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                          {dias === 0 ? 'Expira hoje' : `${dias}d`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Canal de aquisição */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Canal de aquisição</h3>
            {(() => {
              const canais = confeitarias.reduce((acc, c) => {
                const canal = c.como_conheceu || 'Não informado';
                acc[canal] = (acc[canal] || 0) + 1;
                return acc;
              }, {});
              return Object.entries(canais)
                .sort(([, a], [, b]) => b - a)
                .map(([canal, count]) => (
                  <div key={canal} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-600">{canal}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ));
            })()}
          </div>

        </TabsContent>

        <TabsContent value="avisos" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Avisos do Sistema</h3>
              <p className="text-sm text-gray-500">
                Publique novidades globais para todos os usuários autenticados.
              </p>
            </div>
            <Button onClick={openNewNotificationDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Novo aviso
            </Button>
          </div>

          <div className="space-y-3">
            {isLoadingNotifications ? (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-gray-400">
                Carregando avisos...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
                <Bell className="w-8 h-8 text-rose-300 mx-auto mb-3" />
                <p className="font-medium text-gray-900">Nenhum aviso publicado</p>
                <p className="text-sm text-gray-500 mt-1">
                  Use esta área para informar novidades e atualizações do sistema.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          notification.status === 'published'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {notification.status === 'published' ? 'Publicado' : 'Arquivado'}
                        </span>
                      </div>
                      {isHtmlMessage(notification.message) ? (
                        <div
                          className="text-sm leading-6 text-gray-600 line-clamp-3 [&_a]:text-rose-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                          dangerouslySetInnerHTML={{ __html: notification.message }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {notification.published_at
                          ? `Publicado em ${formatarData(notification.published_at)}`
                          : `Criado em ${formatarData(notification.created_at)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditNotificationDialog(notification)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      {notification.status === 'published' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveNotificationMutation.mutate(notification.id)}
                          disabled={archiveNotificationMutation.isPending}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Arquivar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        disabled={deleteNotificationMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOG CONFIRMAR CANCELAMENTO ─── */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <CalendarX className="w-5 h-5" />
              Cancelar recorrência?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-gray-700">
            <p>
              A renovação automática de <strong>{historyConfeitaria?.nome}</strong> será cancelada.
            </p>
            {historyConfeitaria?.data_proximo_pagamento && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <p className="font-medium text-orange-800">Tempo restante de acesso:</p>
                <p className="text-orange-700 mt-0.5">
                  O acesso permanece ativo até{' '}
                  <strong>{formatarData(historyConfeitaria.data_proximo_pagamento)}</strong>.
                  Após essa data, o usuário precisará contratar um novo plano para continuar usando o sistema.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>
              Manter assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelRecorrencia}
              disabled={cancelandoRecorrencia[historyConfeitaria?.id]}
            >
              {cancelandoRecorrencia[historyConfeitaria?.id]
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                : 'Sim, cancelar recorrência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG HISTÓRICO DE ASSINATURA ─── */}
      <Dialog open={!!historyConfeitaria && !cancelConfirmOpen} onOpenChange={(open) => !open && setHistoryConfeitaria(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-purple-600" />
              Histórico de Assinatura — {historyConfeitaria?.nome}
            </DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Assinaturas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Assinaturas
                </h4>
                {!historyData?.subscriptions?.length ? (
                  <p className="text-sm text-gray-400">Nenhuma assinatura encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.subscriptions.map((sub) => (
                      <div key={sub.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            sub.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            sub.status === 'canceled' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                            sub.cancel_at_period_end ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            sub.status === 'past_due' ? 'bg-red-100 text-red-700 border-red-200' :
                            sub.status === 'trialing' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {sub.cancel_at_period_end ? 'Cancelamento agendado' :
                              sub.status === 'active' ? 'Ativo' :
                              sub.status === 'canceled' ? 'Cancelado' :
                              sub.status === 'past_due' ? 'Inadimplente' :
                              sub.status === 'trialing' ? 'Trial' :
                              sub.status}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{sub.id}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600 mt-1">
                          <span>Criado: {formatarData(sub.created)}</span>
                          {sub.trial_end && <span>Fim trial: {formatarData(sub.trial_end)}</span>}
                          {sub.current_period_start && <span>Período início: {formatarData(sub.current_period_start)}</span>}
                          {sub.current_period_end && <span>Período fim: {formatarData(sub.current_period_end)}</span>}
                          {sub.canceled_at && <span className="text-red-600">Cancelado em: {formatarData(sub.canceled_at)}</span>}
                          {sub.ended_at && <span className="text-red-600">Encerrado em: {formatarData(sub.ended_at)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Faturas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4" />
                  Faturas
                </h4>
                {!historyData?.invoices?.length ? (
                  <p className="text-sm text-gray-400">Nenhuma fatura encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.invoices.map((inv) => (
                      <div key={inv.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              inv.status === 'open' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              inv.status === 'void' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                              'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {inv.status === 'paid' ? 'Pago' : inv.status === 'open' ? 'Em aberto' : inv.status === 'void' ? 'Anulado' : inv.status}
                            </span>
                            {inv.number && <span className="text-xs text-gray-400">{inv.number}</span>}
                          </div>
                          <p className="text-gray-600">
                            {formatarData(inv.created)}
                            {inv.period_start && inv.period_end && (
                              <span className="text-gray-400"> · {formatarData(inv.period_start)} → {formatarData(inv.period_end)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-semibold text-gray-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: (inv.currency || 'brl').toUpperCase() }).format((inv.amount_paid || 0) / 100)}
                          </span>
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Ver fatura"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-between items-center gap-2">
            <div>
              {historyConfeitaria?.stripe_subscription_id &&
                (historyConfeitaria?.status_assinatura === 'active' || historyConfeitaria?.status_assinatura === 'past_due') && (
                <Button
                  variant="outline"
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  <CalendarX className="w-4 h-4 mr-2" />
                  Cancelar recorrência
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setHistoryConfeitaria(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNotificationDialog} onOpenChange={(open) => !open && resetNotificationForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNotification ? 'Editar aviso do sistema' : 'Novo aviso do sistema'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Título</label>
              <Input
                value={notificationForm.title}
                onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Nova atualização disponível"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Mensagem</label>
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-white [&_.ql-container]:min-h-[180px] [&_.ql-editor]:min-h-[150px]">
                <ReactQuill
                  theme="snow"
                  value={notificationForm.message}
                  onChange={(value) => setNotificationForm((prev) => ({ ...prev, message: value }))}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                  placeholder="Descreva a novidade que os usuários devem ver no sino."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetNotificationForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveNotificationMutation.mutate()}
              disabled={
                saveNotificationMutation.isPending ||
                !notificationForm.title.trim() ||
                !hasRichTextContent(notificationForm.message)
              }
            >
              {saveNotificationMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
