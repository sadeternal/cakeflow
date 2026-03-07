import { addMonths, format, parseISO } from 'date-fns';
import { appClient } from '@/api/appClient';

const AUTO_ORIGEM = 'pedido_aprovado';

const isCreditPayment = (value = '') => {
  const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized.includes('credito');
};

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const splitInstallments = (total, count) => {
  const parcelas = Math.max(Number(count) || 1, 1);
  const totalRounded = roundCurrency(total);
  const base = Math.floor((totalRounded / parcelas) * 100) / 100;
  const valores = Array.from({ length: parcelas }, () => base);
  const accumulated = roundCurrency(base * parcelas);
  const diff = roundCurrency(totalRounded - accumulated);
  valores[valores.length - 1] = roundCurrency(valores[valores.length - 1] + diff);
  return valores;
};

const getApprovalBaseDate = (pedido) => {
  if (pedido.updated_date) {
    try {
      return parseISO(pedido.updated_date);
    } catch {
      // noop
    }
  }

  if (pedido.created_date) {
    try {
      return parseISO(pedido.created_date);
    } catch {
      // noop
    }
  }

  return new Date();
};

const buildRecebimentoDescription = (pedidoNumero, parcelaAtual, parcelasTotal) => (
  parcelasTotal > 1
    ? `Pedido #${pedidoNumero} - Parcela ${parcelaAtual}/${parcelasTotal}`
    : `Pedido #${pedidoNumero}`
);

export async function syncRecebimentosForPedido(pedido) {
  if (!pedido?.id || !pedido?.confeitaria_id) return;

  const existing = await appClient.entities.ContaReceber.filter({
    pedido_id: pedido.id,
    origem: AUTO_ORIGEM
  });

  if (existing.length > 0) {
    await Promise.all(existing.map((conta) => appClient.entities.ContaReceber.delete(conta.id)));
  }

  if (pedido.status !== 'aprovado') return;

  const approvalDate = getApprovalBaseDate(pedido);
  const paymentName = pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não definido';
  const parcelasTotal = Math.max(Number(pedido.parcelas) || 1, 1);
  const isCredit = isCreditPayment(paymentName);
  const shouldSplit = isCredit && parcelasTotal > 1;
  const valores = shouldSplit
    ? splitInstallments(pedido.valor_total || 0, parcelasTotal)
    : [roundCurrency(pedido.valor_total || 0)];

  const payloads = valores.map((valor, index) => {
    const parcelaAtual = shouldSplit ? index + 1 : 1;
    const dueDate = shouldSplit ? addMonths(approvalDate, index) : approvalDate;

    return {
      confeitaria_id: pedido.confeitaria_id,
      pedido_id: pedido.id,
      pedido_numero: pedido.numero || pedido.id?.slice(-4),
      cliente_nome: pedido.cliente_nome || '',
      descricao: buildRecebimentoDescription(pedido.numero || pedido.id?.slice(-4), parcelaAtual, shouldSplit ? parcelasTotal : 1),
      forma_pagamento: paymentName,
      parcela_atual: parcelaAtual,
      parcelas_total: shouldSplit ? parcelasTotal : 1,
      origem: AUTO_ORIGEM,
      valor,
      data_vencimento: format(dueDate, 'yyyy-MM-dd'),
      tipo: 'pagamento_final',
      recebido: false,
    };
  });

  await appClient.entities.ContaReceber.bulkCreate(payloads);
}
