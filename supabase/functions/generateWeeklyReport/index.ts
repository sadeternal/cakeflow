import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse
} from '../_shared/http.ts';
import { getSupabaseClients, requireUserContext } from '../_shared/supabase.ts';

type PerfilSemana = {
  id: string;
  email: string | null;
  full_name: string | null;
  confeitaria_id: string | null;
  created_at: string;
};

type ConfeitariaResumo = {
  id: string;
  nome: string | null;
  telefone: string | null;
  como_conheceu: string | null;
  status_assinatura: string | null;
};

const comoConheceuLabels: Record<string, string> = {
  indicacao: 'Indicação',
  facebook: 'Facebook',
  instagram: 'Instagram',
  pesquisa_google: 'Pesquisa Google',
  outro: 'Outro'
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const buildReportHtml = (
  periodoInicio: Date,
  periodoFim: Date,
  dadosRelatorio: Array<{
    nome: string;
    email: string;
    confeitaria: string;
    telefone: string;
    comoConheceu: string;
    plano: string;
    dataCadastro: string;
  }>
) => {
  const totalUsuarios = dadosRelatorio.length;
  const totalPago = dadosRelatorio.filter((u) => u.plano === 'Pago').length;
  const totalTrial = dadosRelatorio.filter((u) => u.plano === 'Trial').length;
  const totalGratuito = dadosRelatorio.filter((u) => u.plano === 'Gratuito').length;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
    h1 { color: #e11d48; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .summary { background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e11d48; }
    .summary h2 { margin: 0 0 10px 0; color: #e11d48; font-size: 18px; }
    .summary p { margin: 5px 0; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #e11d48; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-pago { background-color: #dcfce7; color: #166534; }
    .badge-trial { background-color: #fef3c7; color: #92400e; }
    .badge-gratuito { background-color: #f3f4f6; color: #374151; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Relatório Semanal - CakeFlow</h1>
    <p class="subtitle">Período: ${periodoInicio.toLocaleDateString('pt-BR')} a ${periodoFim.toLocaleDateString('pt-BR')}</p>
    <div class="summary">
      <h2>Resumo</h2>
      <p><strong>Total de novos usuários:</strong> ${totalUsuarios}</p>
      <p><strong>Usuários com plano pago:</strong> ${totalPago}</p>
      <p><strong>Usuários em trial:</strong> ${totalTrial}</p>
      <p><strong>Usuários gratuitos:</strong> ${totalGratuito}</p>
    </div>
    ${
      totalUsuarios === 0
        ? '<p>Nenhum novo usuário cadastrado neste período.</p>'
        : `
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Confeitaria</th>
            <th>Telefone</th>
            <th>Como Conheceu</th>
            <th>Plano</th>
            <th>Data Cadastro</th>
          </tr>
        </thead>
        <tbody>
          ${dadosRelatorio
            .map(
              (usuario) => `
            <tr>
              <td>${usuario.nome}</td>
              <td>${usuario.email}</td>
              <td>${usuario.confeitaria}</td>
              <td>${usuario.telefone}</td>
              <td>${usuario.comoConheceu}</td>
              <td><span class="badge badge-${usuario.plano.toLowerCase()}">${usuario.plano}</span></td>
              <td>${usuario.dataCadastro}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
    }
  </div>
</body>
</html>
  `;
};

const sendEmailViaResend = async (subject: string, html: string) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { sent: false, reason: 'RESEND_API_KEY não configurada' };
  }

  const to = Deno.env.get('REPORT_EMAIL_TO') || 'contato@cakeflow.com.br';
  const from = Deno.env.get('REPORT_EMAIL_FROM') || 'CakeFlow <no-reply@cakeflow.com.br>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new HttpError(500, 'Erro ao enviar email via Resend', details);
  }

  return { sent: true };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const userContext = await requireUserContext(req);
    if (userContext.role !== 'admin') {
      throw new HttpError(403, 'Forbidden: Admin access required');
    }

    const { adminClient } = getSupabaseClients(req);
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    const { data: novosUsuarios, error: novosUsuariosError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, confeitaria_id, created_at')
      .gte('created_at', seteDiasAtras.toISOString())
      .lte('created_at', hoje.toISOString())
      .order('created_at', { ascending: false });

    if (novosUsuariosError) {
      throw new HttpError(500, 'Erro ao buscar usuários da semana', novosUsuariosError);
    }

    const usuarios = (novosUsuarios || []) as PerfilSemana[];
    const confeitariasIds = [...new Set(usuarios.map((u) => u.confeitaria_id).filter(Boolean))];

    let confeitarias: ConfeitariaResumo[] = [];
    if (confeitariasIds.length > 0) {
      const { data, error } = await adminClient
        .from('confeitarias')
        .select('id, nome, telefone, como_conheceu, status_assinatura')
        .in('id', confeitariasIds);

      if (error) {
        throw new HttpError(500, 'Erro ao buscar confeitarias do relatório', error);
      }

      confeitarias = (data || []) as ConfeitariaResumo[];
    }

    const confeitariasMap: Record<string, ConfeitariaResumo> = {};
    for (const confeitaria of confeitarias) {
      confeitariasMap[confeitaria.id] = confeitaria;
    }

    const dadosRelatorio = usuarios.map((usuario) => {
      const confeitaria = usuario.confeitaria_id ? confeitariasMap[usuario.confeitaria_id] : null;
      const statusAssinatura = confeitaria?.status_assinatura || 'trial';

      return {
        nome: usuario.full_name || 'Não informado',
        email: usuario.email || 'Não informado',
        confeitaria: confeitaria?.nome || 'Não cadastrada',
        telefone: confeitaria?.telefone || 'Não informado',
        comoConheceu: confeitaria?.como_conheceu
          ? comoConheceuLabels[confeitaria.como_conheceu] || confeitaria.como_conheceu
          : 'Não informado',
        plano:
          statusAssinatura === 'active'
            ? 'Pago'
            : statusAssinatura === 'trial'
              ? 'Trial'
              : 'Gratuito',
        dataCadastro: formatDateTime(usuario.created_at)
      };
    });

    const htmlRelatorio = buildReportHtml(seteDiasAtras, hoje, dadosRelatorio);
    const subject = `Relatório Semanal CakeFlow - ${dadosRelatorio.length} novos usuários`;
    const emailResult = await sendEmailViaResend(subject, htmlRelatorio);

    return jsonResponse({
      success: true,
      message: emailResult.sent
        ? 'Relatório enviado com sucesso'
        : 'Relatório gerado com sucesso (email não enviado)',
      totalUsuarios: dadosRelatorio.length,
      emailSent: emailResult.sent,
      emailReason: 'reason' in emailResult ? emailResult.reason : null
    });
  } catch (error) {
    console.error('❌ [generateWeeklyReport] Erro:', error);
    return errorResponse(error);
  }
});
