import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  parseISO,
  addMonths,
  subMonths,
  getMonth,
  getYear,
  setMonth,
  setYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock, Unlock, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => ANO_ATUAL - 2 + i);

export default function CalendarioPedidos({
  pedidos,
  mes,
  onMesChange,
  confeitariaId,
  onPedidoClick,
  onDiaClick,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [bloqueioDialog, setBloqueioDialog] = useState(null); // { dataStr } | null
  const [motivoInput, setMotivoInput] = useState('');

  const { data: diasBloqueados = [] } = useQuery({
    queryKey: ['dias-bloqueados', confeitariaId],
    queryFn: () => appClient.entities.DiaBloqueado.filter({ confeitaria_id: confeitariaId }),
    enabled: !!confeitariaId,
  });

  const criarBloqueioMutation = useMutation({
    mutationFn: ({ data, motivo }) =>
      appClient.entities.DiaBloqueado.create({
        confeitaria_id: confeitariaId,
        data,
        motivo: motivo?.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['dias-bloqueados', confeitariaId]);
      toast({ description: 'Dia bloqueado.' });
      setBloqueioDialog(null);
      setMotivoInput('');
    },
    onError: () => {
      toast({ variant: 'destructive', description: 'Erro ao bloquear o dia.' });
    },
  });

  const deletarBloqueioMutation = useMutation({
    mutationFn: (id) => appClient.entities.DiaBloqueado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['dias-bloqueados', confeitariaId]);
      toast({ description: 'Dia desbloqueado.' });
    },
    onError: () => {
      toast({ variant: 'destructive', description: 'Erro ao desbloquear o dia.' });
    },
  });

  const pedidosDoMes = useMemo(() => {
    const inicio = startOfMonth(mes);
    const fim = endOfMonth(mes);
    return pedidos.filter(p => {
      if (!p.data_entrega) return false;
      const d = parseISO(p.data_entrega);
      return d >= inicio && d <= fim;
    });
  }, [pedidos, mes]);

  const pedidosPorDia = useMemo(() => {
    const map = {};
    pedidosDoMes.forEach(p => {
      if (!map[p.data_entrega]) map[p.data_entrega] = [];
      map[p.data_entrega].push(p);
    });
    return map;
  }, [pedidosDoMes]);

  const bloqueadosMap = useMemo(() => {
    const m = {};
    diasBloqueados.forEach(d => { m[d.data] = { id: d.id, motivo: d.motivo }; });
    return m;
  }, [diasBloqueados]);

  const diasGrade = useMemo(() => {
    const inicio = startOfMonth(mes);
    const grade = Array(getDay(inicio)).fill(null);
    eachDayOfInterval({ start: inicio, end: endOfMonth(mes) }).forEach(d => grade.push(d));
    while (grade.length % 7 !== 0) grade.push(null);
    return grade;
  }, [mes]);

  const diasDoMes = useMemo(() =>
    diasGrade.filter(d => d !== null),
  [diasGrade]);

  const isMutating = criarBloqueioMutation.isPending || deletarBloqueioMutation.isPending;

  const handleLockClick = (e, dataStr, bloqueado) => {
    e.stopPropagation();
    if (bloqueado) {
      deletarBloqueioMutation.mutate(bloqueado.id);
    } else {
      setMotivoInput('');
      setBloqueioDialog({ dataStr });
    }
  };

  // ─── Desktop: célula do grid ─────────────────────────────────────
  const DiaCell = ({ dia }) => {
    if (!dia) {
      return (
        <div className="min-h-[110px] bg-gray-50/50 rounded-lg border border-dashed border-gray-100" />
      );
    }

    const dataStr = format(dia, 'yyyy-MM-dd');
    const bloqueado = bloqueadosMap[dataStr];
    const pedidosDia = pedidosPorDia[dataStr] || [];
    const hoje = isToday(dia);

    return (
      <div
        className={cn(
          'min-h-[110px] rounded-lg border p-2 flex flex-col gap-1 transition-colors',
          pedidosDia.length > 0 ? 'cursor-pointer' : 'cursor-default',
          hoje ? 'border-rose-400 border-2' : 'border-gray-200',
          bloqueado ? 'bg-red-50 border-red-200' : 'bg-white hover:bg-gray-50'
        )}
        onClick={() => pedidosDia.length > 0 && onDiaClick(dataStr)}
      >
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full',
            hoje && 'bg-rose-500 text-white',
            !hoje && bloqueado && 'text-red-600',
            !hoje && !bloqueado && 'text-gray-700'
          )}>
            {format(dia, 'd')}
          </span>
          <Button
            variant="ghost" size="icon"
            className={cn('h-6 w-6',
              bloqueado ? 'text-red-500 hover:text-red-700 hover:bg-red-100' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
            )}
            onClick={(e) => handleLockClick(e, dataStr, bloqueado)}
            disabled={isMutating}
            title={bloqueado ? 'Desbloquear dia' : 'Bloquear dia'}
          >
            {bloqueado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {pedidosDia.length > 0 && (
          <Badge className="self-start text-xs bg-rose-100 text-rose-700 border-rose-200 px-1.5 py-0.5" variant="outline">
            <ShoppingBag className="w-3 h-3 mr-1" />
            {pedidosDia.length} pedido{pedidosDia.length !== 1 ? 's' : ''}
          </Badge>
        )}

        {pedidosDia.slice(0, 2).map(p => (
          <div
            key={p.id}
            className="text-xs bg-white rounded border border-gray-100 px-1.5 py-1 cursor-pointer hover:bg-rose-50 transition-colors"
            onClick={(e) => { e.stopPropagation(); onPedidoClick(p); }}
          >
            <span className="font-medium text-gray-800 block truncate">{p.cliente_nome}</span>
            <span className="text-gray-500">
              R$ {p.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}

        {pedidosDia.length > 2 && (
          <span className="text-xs text-gray-400 pl-1">...mais {pedidosDia.length - 2}</span>
        )}

        {bloqueado && (
          <div className="mt-auto">
            <span className="text-xs text-red-400 font-medium block">Bloqueado</span>
            {bloqueado.motivo && (
              <span className="text-xs text-red-300 block truncate" title={bloqueado.motivo}>
                {bloqueado.motivo}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Mobile: linha da agenda ──────────────────────────────────────
  const DiaAgenda = ({ dia }) => {
    const dataStr = format(dia, 'yyyy-MM-dd');
    const bloqueado = bloqueadosMap[dataStr];
    const pedidosDia = pedidosPorDia[dataStr] || [];
    const hoje = isToday(dia);
    const temAtividade = pedidosDia.length > 0 || !!bloqueado;

    return (
      <div className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
        hoje ? 'border-rose-400 border-2 bg-rose-50/40' : bloqueado ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white',
        !temAtividade && 'opacity-50'
      )}>
        {/* Círculo com dia da semana + número */}
        <div className={cn(
          'w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0',
          hoje ? 'bg-rose-500 text-white' : bloqueado ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
        )}>
          <span className="text-[10px] font-medium leading-tight capitalize">
            {format(dia, 'EEE', { locale: ptBR })}
          </span>
          <span className="text-base font-bold leading-tight">{format(dia, 'd')}</span>
        </div>

        {/* Conteúdo do dia */}
        <div
          className={cn('flex-1 min-w-0', pedidosDia.length > 0 && 'cursor-pointer')}
          onClick={() => pedidosDia.length > 0 && onDiaClick(dataStr)}
        >
          {bloqueado && (
            <div className="flex items-center gap-1.5 mb-0.5">
              <Lock className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-xs text-red-500 font-medium truncate">
                {bloqueado.motivo || 'Bloqueado'}
              </span>
            </div>
          )}

          {pedidosDia.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-800">
                  {pedidosDia.length} pedido{pedidosDia.length !== 1 ? 's' : ''}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {pedidosDia.slice(0, 3).map(p => p.cliente_nome).join(', ')}
                {pedidosDia.length > 3 && ` +${pedidosDia.length - 3}`}
              </p>
            </>
          ) : (
            <span className="text-xs text-gray-400">Sem pedidos</span>
          )}
        </div>

        {/* Botão de bloqueio */}
        <Button
          variant="ghost" size="icon"
          className={cn('h-9 w-9 shrink-0',
            bloqueado ? 'text-red-500 hover:bg-red-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
          )}
          onClick={(e) => handleLockClick(e, dataStr, bloqueado)}
          disabled={isMutating}
          title={bloqueado ? 'Desbloquear dia' : 'Bloquear dia'}
        >
          {bloqueado ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </Button>
      </div>
    );
  };

  // ─── Navegação de mês/ano (compartilhada) ────────────────────────
  const Navegacao = () => (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => onMesChange(subMonths(mes, 1))}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-2">
        <Select value={String(getMonth(mes))} onValueChange={(v) => onMesChange(setMonth(mes, parseInt(v)))}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(getYear(mes))} onValueChange={(v) => onMesChange(setYear(mes, parseInt(v)))}>
          <SelectTrigger className="w-24 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => onMesChange(addMonths(mes, 1))}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Navegacao />

      {/* ── Mobile: agenda ── */}
      <div className="md:hidden space-y-1.5">
        {diasDoMes.map((dia, idx) => (
          <DiaAgenda key={idx} dia={dia} />
        ))}
      </div>

      {/* ── Desktop: grade ── */}
      <div className="hidden md:block space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasGrade.map((dia, idx) => <DiaCell key={idx} dia={dia} />)}
        </div>
      </div>

      {/* Legenda (apenas desktop) */}
      <div className="hidden md:flex flex-wrap items-center gap-4 pt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-rose-400" /><span>Hoje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" /><span>Bloqueado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3" /><span>Clique no cadeado para bloquear/desbloquear</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="w-3 h-3 text-rose-500" /><span>Clique no dia para ver todos os pedidos</span>
        </div>
      </div>

      {/* Dialog para informar o motivo do bloqueio */}
      <Dialog open={!!bloqueioDialog} onOpenChange={(open) => { if (!open) setBloqueioDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              {bloqueioDialog && format(parseISO(bloqueioDialog.dataStr), "dd/MM/yyyy")}
            </p>
            <div>
              <Label htmlFor="motivo-bloqueio">
                Motivo <span className="text-gray-400">(opcional)</span>
              </Label>
              <Input
                id="motivo-bloqueio"
                className="mt-1"
                placeholder="Ex: Estou de folga"
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !criarBloqueioMutation.isPending) {
                    criarBloqueioMutation.mutate({ data: bloqueioDialog.dataStr, motivo: motivoInput });
                  }
                }}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Este motivo será exibido para os clientes no catálogo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBloqueioDialog(null)} disabled={criarBloqueioMutation.isPending}>
              Cancelar
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => criarBloqueioMutation.mutate({ data: bloqueioDialog.dataStr, motivo: motivoInput })}
              disabled={criarBloqueioMutation.isPending}
            >
              <Lock className="w-4 h-4 mr-2" />
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
