import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.5.0';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import { toIsoFromUnix } from '../_shared/subscription.ts';
import {
  assertConfeitariaAccess,
  getConfeitariaById,
  getSupabaseClients,
  requireEnv,
  requireUserContext,
  updateConfeitariaById
} from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await readJsonBody(req);
    const confeitariaId = String(payload.confeitaria_id || '');

    if (!confeitariaId) {
      throw new HttpError(400, 'confeitaria_id obrigatório');
    }

    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

    const userContext = await requireUserContext(req);
    // Admin pode cancelar qualquer confeitaria; usuário só a própria
    assertConfeitariaAccess(userContext, confeitariaId);

    const { adminClient } = getSupabaseClients(req);
    const confeitaria = await getConfeitariaById(adminClient, confeitariaId);

    if (!confeitaria.stripe_subscription_id) {
      throw new HttpError(400, 'Esta conta não possui assinatura no Stripe');
    }

    const status = String(confeitaria.status_assinatura || '');
    if (status === 'canceling') {
      throw new HttpError(400, 'Assinatura já está agendada para cancelamento');
    }
    if (status === 'canceled') {
      throw new HttpError(400, 'Assinatura já foi cancelada');
    }

    const subscription = await stripe.subscriptions.update(
      confeitaria.stripe_subscription_id as string,
      { cancel_at_period_end: true }
    );

    // Atualiza DB imediatamente, sem esperar o webhook
    await updateConfeitariaById(adminClient, confeitariaId, {
      status_assinatura: 'canceling',
      data_proximo_pagamento: toIsoFromUnix(subscription.current_period_end)
    });

    return jsonResponse({
      success: true,
      access_until: toIsoFromUnix(subscription.current_period_end)
    });
  } catch (error) {
    console.error('❌ [cancelSubscription] Erro:', error);
    return errorResponse(error);
  }
});
