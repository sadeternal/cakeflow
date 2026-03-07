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
  Trash2
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
  const [enviandoBrevo, setEnviandoBrevo] = useState({});
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
    return matchStatus && matchBusca;
  });

  const copiar = (texto, label) => {
    navigator.clipboard.writeText(texto);
    toast({ title: `${label} copiado!` });
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
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
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
