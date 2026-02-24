import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.5.0';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import { resolveSubscriptionStatus, toIsoFromUnix } from '../_shared/subscription.ts';
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
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia'
    });

    const userContext = await requireUserContext(req);
    assertConfeitariaAccess(userContext, confeitariaId);

    const { adminClient } = getSupabaseClients(req);
    const confeitaria = await getConfeitariaById(adminClient, confeitariaId);

    if (!confeitaria.stripe_subscription_id) {
      throw new HttpError(404, 'Nenhuma assinatura encontrada');
    }

    const subscription = await stripe.subscriptions.retrieve(confeitaria.stripe_subscription_id);
    const status = resolveSubscriptionStatus(subscription);

    const updateData = {
      status_assinatura: status,
      data_fim_trial: toIsoFromUnix(subscription.trial_end),
      data_proximo_pagamento: toIsoFromUnix(subscription.current_period_end)
    };

    await updateConfeitariaById(adminClient, confeitaria.id, updateData);

    return jsonResponse({
      success: true,
      status,
      data_proximo_pagamento: updateData.data_proximo_pagamento,
      data_fim_trial: updateData.data_fim_trial
    });
  } catch (error) {
    console.error('❌ [syncSubscription] Erro:', error);
    return errorResponse(error);
  }
});
