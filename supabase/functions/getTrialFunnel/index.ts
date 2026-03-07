import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { errorResponse, HttpError, jsonResponse, optionsResponse, readJsonBody } from '../_shared/http.ts';
import { getSupabaseClients, requireUserContext } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  try {
    const userContext = await requireUserContext(req);

    if (userContext.role !== 'admin') {
      throw new HttpError(403, 'Acesso restrito a administradores');
    }

    const body = await readJsonBody(req);
    const periodDays = Number(body.period_days) || 30;

    const { adminClient } = getSupabaseClients(req);

    // Busca confeitarias criadas no período
    const { data: confeitarias, error: confeitariasError } = await adminClient
      .from('confeitarias')
      .select('id, nome, owner_email, status_assinatura, data_fim_trial, data_proximo_pagamento, created_date, feedback_requested_at')
      .gte('created_date', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString())
      .order('created_date', { ascending: false });

    if (confeitariasError) throw new HttpError(500, 'Erro ao buscar confeitarias', confeitariasError);
    if (!confeitarias || confeitarias.length === 0) return jsonResponse({ users: [] });

    const confeitariaIds = confeitarias.map((c: Record<string, unknown>) => c.id as string);

    // Busca profiles para mapear confeitaria_id → user_id
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, confeitaria_id')
      .in('confeitaria_id', confeitariaIds);

    if (profilesError) throw new HttpError(500, 'Erro ao buscar profiles', profilesError);

    const profileMap: Record<string, string> = {};
    for (const p of (profiles || [])) {
      profileMap[(p as Record<string, unknown>).confeitaria_id as string] = (p as Record<string, unknown>).id as string;
    }

    const userIds = Object.values(profileMap);

    // Busca todos os eventos dos usuários encontrados
    const { data: events, error: eventsError } = await adminClient
      .from('user_events')
      .select('user_id, event_name, created_at')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    if (eventsError) throw new HttpError(500, 'Erro ao buscar eventos', eventsError);

    // Agrega eventos por user_id
    const eventsByUser: Record<string, {
      session_days: Set<string>;
      has_first_order: boolean;
      has_first_client: boolean;
      has_viewed_plans: boolean;
    }> = {};

    for (const ev of (events || [])) {
      const e = ev as Record<string, unknown>;
      const uid = e.user_id as string;
      if (!eventsByUser[uid]) {
        eventsByUser[uid] = {
          session_days: new Set(),
          has_first_order: false,
          has_first_client: false,
          has_viewed_plans: false,
        };
      }
      const name = e.event_name as string;
      const day = (e.created_at as string).slice(0, 10);
      if (name === 'session_day') eventsByUser[uid].session_days.add(day);
      if (name === 'first_order_created') eventsByUser[uid].has_first_order = true;
      if (name === 'first_client_created') eventsByUser[uid].has_first_client = true;
      if (name === 'plans_page_viewed') eventsByUser[uid].has_viewed_plans = true;
    }

    // Monta resultado final
    const users = confeitarias.map((c: Record<string, unknown>) => {
      const userId = profileMap[c.id as string];
      const agg = userId ? eventsByUser[userId] : null;

      const status = c.status_assinatura as string;
      const sessionDays = agg ? agg.session_days.size : 0;
      const hasAction = agg ? (agg.has_first_order || agg.has_first_client) : false;

      // Segmentação
      let segmento: string;
      if (status === 'active' || status === 'canceling') {
        segmento = 'convertido';
      } else if (sessionDays >= 3) {
        segmento = 'engajado';
      } else if (hasAction || sessionDays >= 1) {
        segmento = 'ativo';
      } else {
        segmento = 'inativo';
      }

      return {
        confeitaria_id: c.id,
        nome: c.nome,
        owner_email: c.owner_email,
        status_assinatura: status,
        data_fim_trial: c.data_fim_trial,
        data_proximo_pagamento: c.data_proximo_pagamento,
        created_date: c.created_date,
        feedback_requested_at: c.feedback_requested_at,
        user_id: userId || null,
        session_days: sessionDays,
        has_first_order: agg?.has_first_order ?? false,
        has_first_client: agg?.has_first_client ?? false,
        has_viewed_plans: agg?.has_viewed_plans ?? false,
        segmento,
      };
    });

    return jsonResponse({ users });
  } catch (error) {
    console.error('[getTrialFunnel] Erro:', error);
    return errorResponse(error);
  }
});
