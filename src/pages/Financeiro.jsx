import React, { useEffect, useState, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Check, Trash2,
  ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  { value: 1,  label: 'Janeiro' },
  { value: 2,  label: 'Fevereiro' },
  { value: 3,  label: 'Março' },
  { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Maio' },
  { value: 6,  label: 'Junho' },
  { value: 7,  label: 'Julho' },
  { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const categoriasDespesa = [
  { value: 'ingredientes', label: 'Ingredientes' },
  { value: 'embalagens',   label: 'Embalagens' },
  { value: 'entregas',     label: 'Entregas' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'aluguel',      label: 'Aluguel' },
  { value: 'outros',       label: 'Outros' },
];

const tiposReceita = [
  { value: 'sinal',            label: 'Sinal' },
  { value: 'pagamento_final',  label: 'Pagamento Final' },
  { value: 'outro',            label: 'Outro' },
];

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

const makeEmptyForm = () => ({
  tipo: 'receita',
  cliente_nome: '',
  descricao: '',
  tipo_receita: 'pagamento_final',
  fornecedor: '',
  categoria: 'ingredientes',
  valor: '',
  data_vencimento: todayStr(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtDate = (d) => { try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return '—'; } };

const normalizePaymentName = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isPixPayment         = (v = '') => normalizePaymentName(v).includes('pix');
const getPedidoPaymentName = (p)      => p?.forma_pagamento_nome || p?.forma_pagamento || 'Não definido';

const getPedidoPaymentMeta = (ped, parcela, installments) => {
  const name = getPedidoPaymentName(ped);
  if (installments > 1) {
    const val = parseFloat(parcela?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return `${name} • ${installments}x de R$ ${val}`;
  }
  return isPixPayment(name) ? 'Pix • À vista' : `${name} • À vista`;
};

const inMonth = (dateStr, inicio, fim) => {
  if (!dateStr) return false;
  try { return isWithinInterval(parseISO(dateStr), { start: inicio, end: fim }); } catch { return false; }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date();
  const [mesSel, setMesSel] = useState(today.getMonth() + 1); // 1–12
  const [anoSel, setAnoSel] = useState(today.getFullYear());

  const [filtroTipo,   setFiltroTipo]   = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(makeEmptyForm);
  const [clienteManual, setClienteManual] = useState(false);

  useEffect(() => {
    if (user && !user.confeitaria_id) window.location.href = createPageUrl('Onboarding');
  }, [user]);

  // Navegar por mês com as setas
  const navegarMes = (delta) => {
    const base = new Date(anoSel, mesSel - 1, 1);
    const next = addMonths(base, delta);
    setMesSel(next.getMonth() + 1);
    setAnoSel(next.getFullYear());
  };

  // Anos disponíveis no seletor
  const anosDisponiveis = useMemo(() => {
    const y = today.getFullYear();
    return [y - 2, y - 1, y, y + 1, y + 2];
  }, []);

  // Intervalo do mês
  const mesSelecionado = useMemo(() => new Date(anoSel, mesSel - 1, 1), [anoSel, mesSel]);
  const inicioMes      = useMemo(() => startOfMonth(mesSelecionado), [mesSelecionado]);
  const fimMes         = useMemo(() => endOfMonth(mesSelecionado),   [mesSelecionado]);

  // ── Queries ──
  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', user?.confeitaria_id],
    queryFn:  () => appClient.entities.ContaReceber.filter({ confeitaria_id: user.confeitaria_id }, '-data_vencimento'),
    enabled:  !!user?.confeitaria_id,
  });
  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar', user?.confeitaria_id],
    queryFn:  () => appClient.entities.ContaPagar.filter({ confeitaria_id: user.confeitaria_id }, '-data_vencimento'),
    enabled:  !!user?.confeitaria_id,
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', user?.confeitaria_id],
    queryFn:  () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }),
    enabled:  !!user?.confeitaria_id,
  });
  const { data: parcelamentos = [] } = useQuery({
    queryKey: ['parcelamentos', user?.confeitaria_id],
    queryFn:  () => appClient.entities.ParcelamentoPedido.filter({ confeitaria_id: user.confeitaria_id }),
    enabled:  !!user?.confeitaria_id,
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.confeitaria_id],
    queryFn:  () => appClient.entities.Cliente.filter({ confeitaria_id: user.confeitaria_id }, 'nome'),
    enabled:  !!user?.confeitaria_id,
  });

  // ── Mutations ──
  const createReceita = useMutation({
    mutationFn: (d) => appClient.entities.ContaReceber.create({
      cliente_nome:    d.cliente_nome || null,
      descricao:       d.descricao    || null,
      tipo:            d.tipo_receita,
      valor:           parseFloat(d.valor) || 0,
      amount:          parseFloat(d.valor) || 0,
      data_vencimento: d.data_vencimento || null,
      confeitaria_id:  user.confeitaria_id,
      recebido:        false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      toast.success('Receita salva com sucesso!');
      setShowForm(false);
      setForm(makeEmptyForm());
      setClienteManual(false);
    },
    onError: (err) => toast.error('Erro ao salvar receita: ' + (err?.message || 'tente novamente')),
  });
  const createDespesa = useMutation({
    mutationFn: (d) => appClient.entities.ContaPagar.create({
      descricao:       d.descricao || null,
      fornecedor:      d.fornecedor || null,
      categoria:       d.categoria,
      valor:           parseFloat(d.valor) || 0,
      amount:          parseFloat(d.valor) || 0,
      data_vencimento: d.data_vencimento || null,
      confeitaria_id:  user.confeitaria_id,
      pago:            false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      toast.success('Despesa salva com sucesso!');
      setShowForm(false);
      setForm(makeEmptyForm());
    },
    onError: (err) => toast.error('Erro ao salvar despesa: ' + (err?.message || 'tente novamente')),
  });
  const marcarPago = useMutation({
    mutationFn: ({ id, pago }) => appClient.entities.ContaPagar.update(id, { pago, data_pagamento: pago ? format(new Date(), 'yyyy-MM-dd') : null }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['contasPagar'] }),
    onError:    (err) => toast.error('Erro: ' + (err?.message || 'tente novamente')),
  });
  const marcarRecebido = useMutation({
    mutationFn: ({ id, recebido }) => appClient.entities.ContaReceber.update(id, { recebido, data_recebimento: recebido ? format(new Date(), 'yyyy-MM-dd') : null }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['contasReceber'] }),
    onError:    (err) => toast.error('Erro: ' + (err?.message || 'tente novamente')),
  });
  const marcarParcelaPaga = useMutation({
    mutationFn: ({ id, pago }) => appClient.entities.ParcelamentoPedido.update(id, { status: pago ? 'pago' : 'pendente', data_pagamento: pago ? format(new Date(), 'yyyy-MM-dd') : null }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['parcelamentos'] }),
    onError:    (err) => toast.error('Erro: ' + (err?.message || 'tente novamente')),
  });
  const deleteDespesa = useMutation({
    mutationFn: (id) => appClient.entities.ContaPagar.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['contasPagar'] }),
    onError:    (err) => toast.error('Erro ao excluir: ' + (err?.message || 'tente novamente')),
  });
  const deleteReceita = useMutation({
    mutationFn: (id) => appClient.entities.ContaReceber.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['contasReceber'] }),
    onError:    (err) => toast.error('Erro ao excluir: ' + (err?.message || 'tente novamente')),
  });

  const handleSave = () => {
    if (!form.valor) return;
    if (form.tipo === 'receita') {
      if (!form.cliente_nome && !form.descricao) return;
      createReceita.mutate(form);
    } else {
      if (!form.descricao) return;
      createDespesa.mutate(form);
    }
  };

  const isSaving = createReceita.isPending || createDespesa.isPending;

  // ── Parcelamentos ──
  const pedidosAprovados = useMemo(() =>
    new Set(pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'cancelado').map(p => p.id)),
    [pedidos]
  );
  const installmentCountsByPedido = useMemo(() =>
    parcelamentos.reduce((acc, p) => { if (p?.pedido_id) acc[p.pedido_id] = (acc[p.pedido_id] || 0) + 1; return acc; }, {}),
    [parcelamentos]
  );
  const getPedidoInstallments = (ped) => {
    const c = ped?.id ? installmentCountsByPedido[ped.id] : 0;
    return c > 0 ? c : Math.max(Number(ped?.parcelas) || 1, 1);
  };

  // ── Lista unificada do mês ──
  const lancamentos = useMemo(() => {
    const items = [];

    parcelamentos
      .filter(p => pedidosAprovados.has(p.pedido_id) && inMonth(p.data_vencimento, inicioMes, fimMes))
      .forEach(p => {
        const ped          = pedidos.find(pd => pd.id === p.pedido_id);
        const installments = getPedidoInstallments(ped);
        const isPago       = p.status === 'pago';
        items.push({
          id:       `parcela-${p.id}`,
          tipo:     'receita',
          fonte:    'parcela',
          nome:     installments <= 1
            ? (ped?.cliente_nome || 'Cliente')
            : `${ped?.cliente_nome || 'Cliente'} — Parcela ${p.numero_parcela}/${installments}`,
          meta:     getPedidoPaymentMeta(ped, p, installments),
          valor:    parseFloat(p.valor) || 0,
          data:     p.data_vencimento,
          pago:     isPago,
          rawId:    p.id,
          onToggle: () => marcarParcelaPaga.mutate({ id: p.id, pago: !isPago }),
        });
      });

    contasReceber
      .filter(c => inMonth(c.data_vencimento, inicioMes, fimMes))
      .forEach(c => {
        items.push({
          id:       `receber-${c.id}`,
          tipo:     'receita',
          fonte:    'manual',
          nome:     c.cliente_nome || c.descricao || 'Receita',
          meta:     [tiposReceita.find(t => t.value === c.tipo)?.label, c.descricao].filter(Boolean).join(' • '),
          valor:    c.valor || 0,
          data:     c.data_vencimento,
          pago:     !!c.recebido,
          rawId:    c.id,
          onToggle: () => marcarRecebido.mutate({ id: c.id, recebido: !c.recebido }),
          onDelete: () => deleteReceita.mutate(c.id),
        });
      });

    contasPagar
      .filter(c => inMonth(c.data_vencimento, inicioMes, fimMes))
      .forEach(c => {
        items.push({
          id:       `pagar-${c.id}`,
          tipo:     'despesa',
          fonte:    'manual',
          nome:     c.descricao || 'Despesa',
          meta:     [categoriasDespesa.find(x => x.value === c.categoria)?.label, c.fornecedor].filter(Boolean).join(' • '),
          valor:    c.valor || 0,
          data:     c.data_vencimento,
          pago:     !!c.pago,
          rawId:    c.id,
          onToggle: () => marcarPago.mutate({ id: c.id, pago: !c.pago }),
          onDelete: () => deleteDespesa.mutate(c.id),
        });
      });

    return items.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [parcelamentos, contasReceber, contasPagar, pedidos, inicioMes, fimMes, pedidosAprovados, installmentCountsByPedido]);

  // ── Totais ──
  const receitaMes = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  const despesaMes = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  const lucroMes   = receitaMes - despesaMes;
  const aReceber   = lancamentos.filter(l => l.tipo === 'receita' && !l.pago).reduce((s, l) => s + l.valor, 0);
  const aPagar     = lancamentos.filter(l => l.tipo === 'despesa' && !l.pago).reduce((s, l) => s + l.valor, 0);

  // ── Filtro ──
  const lancamentosFiltrados = lancamentos.filter(l => {
    if (filtroTipo   !== 'todos' && l.tipo !== filtroTipo)         return false;
    if (filtroStatus === 'pendente' && l.pago)                     return false;
    if (filtroStatus === 'pago'     && !l.pago)                    return false;
    return true;
  });

  const TIPO_FILTERS   = [{ key: 'todos', label: 'Todos' }, { key: 'receita', label: 'Receitas' }, { key: 'despesa', label: 'Despesas' }];
  const STATUS_FILTERS = [{ key: 'todos', label: 'Todos' }, { key: 'pendente', label: 'Pendente' }, { key: 'pago', label: 'Pago' }];

  if (!user) return null;

  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        {/* Seletor mês + ano */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navegarMes(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            <Select value={String(mesSel)} onValueChange={v => setMesSel(Number(v))}>
              <SelectTrigger className="h-9 w-[120px] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(anoSel)} onValueChange={v => setAnoSel(Number(v))}>
              <SelectTrigger className="h-9 w-[84px] text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => navegarMes(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <Button
          onClick={() => { setForm(makeEmptyForm()); setClienteManual(false); setShowForm(true); }}
          className="bg-rose-500 hover:bg-rose-600 text-white gap-2 hidden sm:flex"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </Button>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">Receitas</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">R$ {fmt(receitaMes)}</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-100">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">Despesas</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">R$ {fmt(despesaMes)}</p>
            </div>
            <div className="p-2 rounded-xl bg-red-100">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">Lucro</p>
              <p className={`text-lg sm:text-xl font-bold mt-0.5 ${lucroMes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {fmt(lucroMes)}
              </p>
            </div>
            <div className={`p-2 rounded-xl ${lucroMes >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-4 h-4 ${lucroMes >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm">
                <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />A Receber
              </span>
              <span className="font-semibold text-emerald-600 text-xs sm:text-sm">R$ {fmt(aReceber)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm">
                <ArrowDownCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />A Pagar
              </span>
              <span className="font-semibold text-red-600 text-xs sm:text-sm">R$ {fmt(aPagar)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Pill buttons — desktop */}
        <div className="hidden sm:flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TIPO_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFiltroTipo(f.key)}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filtroTipo === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex gap-1 bg-gray-100 p-1 rounded-lg">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filtroStatus === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Dropdowns — mobile */}
        <div className="flex sm:hidden gap-2 w-full">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_FILTERS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Botão novo lançamento — mobile (abaixo dos dropdowns) */}
        <Button
          onClick={() => { setForm(makeEmptyForm()); setClienteManual(false); setShowForm(true); }}
          className="sm:hidden bg-rose-500 hover:bg-rose-600 text-white gap-2 w-full"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </Button>

        <span className="text-xs text-gray-400 ml-auto hidden sm:block">{lancamentosFiltrados.length} lançamento(s)</span>
      </div>

      {/* ── Lista unificada ── */}
      <div className="space-y-2">
        {lancamentosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200 text-sm">
            Nenhum lançamento encontrado para o período
          </div>
        ) : lancamentosFiltrados.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-colors ${
              item.pago
                ? item.tipo === 'receita' ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
                : item.tipo === 'receita' ? 'bg-white border-gray-100 hover:bg-emerald-50/30' : 'bg-white border-gray-100 hover:bg-red-50/30'
            }`}
          >
            {/* Checkbox */}
            <button
              onClick={item.onToggle}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                item.pago
                  ? item.tipo === 'receita' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-gray-400 border-gray-400 text-white'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {item.pago && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* Badge tipo — oculto em telas muito pequenas */}
            <span className={`hidden xs:inline-flex sm:inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              item.tipo === 'receita' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {item.tipo === 'receita' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
              <span className="hidden sm:inline">{item.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
            </span>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {/* Badge inline em mobile */}
                <span className={`inline-flex sm:hidden shrink-0 items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  item.tipo === 'receita' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {item.tipo === 'receita' ? <ArrowUpCircle className="w-2.5 h-2.5" /> : <ArrowDownCircle className="w-2.5 h-2.5" />}
                </span>
                <p className={`font-medium text-sm truncate ${item.pago ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.nome}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                {item.meta && <span className="text-xs text-gray-500 truncate max-w-[180px] sm:max-w-none">{item.meta}</span>}
                {item.data && (
                  <span className="text-xs text-gray-400">Vence: {fmtDate(item.data)}</span>
                )}
              </div>
            </div>

            {/* Valor + ações */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <span className={`font-bold text-sm ${
                item.pago ? 'text-gray-400' : item.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                R$ {fmt(item.valor)}
              </span>
              {item.onDelete && (
                <button
                  onClick={item.onDelete}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialog novo lançamento ── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setForm(makeEmptyForm()); setClienteManual(false); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo de lançamento</Label>
              <Select value={form.tipo} onValueChange={v => { setForm({ ...makeEmptyForm(), tipo: v }); setClienteManual(false); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-600" />Receita
                    </span>
                  </SelectItem>
                  <SelectItem value="despesa">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="w-4 h-4 text-red-600" />Despesa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campos dinâmicos: RECEITA */}
            {form.tipo === 'receita' && (
              <>
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  {!clienteManual ? (
                    <Select
                      value={form.cliente_nome}
                      onValueChange={v => {
                        if (v === '__manual__') {
                          setClienteManual(true);
                          setForm(f => ({ ...f, cliente_nome: '' }));
                        } else {
                          setForm(f => ({ ...f, cliente_nome: v }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map(c => (
                          <SelectItem key={c.id} value={c.nome || c.id}>{c.nome}</SelectItem>
                        ))}
                        <SelectItem value="__manual__">
                          <span className="text-gray-500 italic">Digitar manualmente...</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome do cliente"
                        value={form.cliente_nome}
                        onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => { setClienteManual(false); setForm(f => ({ ...f, cliente_nome: '' })); }}
                        className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                      >
                        ← Lista
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Pagamento final do bolo" value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de receita</Label>
                  <Select value={form.tipo_receita} onValueChange={v => setForm(f => ({ ...f, tipo_receita: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposReceita.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Campos dinâmicos: DESPESA */}
            {form.tipo === 'despesa' && (
              <>
                <div className="space-y-1.5">
                  <Label>Descrição *</Label>
                  <Input placeholder="Ex: Compra de ingredientes" value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoriasDespesa.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <Input placeholder="Nome do fornecedor (opcional)" value={form.fornecedor}
                    onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} />
                </div>
              </>
            )}

            {/* Campos comuns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de vencimento</Label>
                <Input type="date" value={form.data_vencimento}
                  onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !form.valor ||
                (form.tipo === 'despesa' && !form.descricao) ||
                (form.tipo === 'receita' && !form.cliente_nome && !form.descricao)
              }
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
