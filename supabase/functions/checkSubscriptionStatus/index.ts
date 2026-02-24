import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { errorResponse, HttpError, jsonResponse, optionsResponse } from '../_shared/http.ts';
import {
  getConfeitariaById,
  getSupabaseClients,
  requireUserContext
} from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const userContext = await requireUserContext(req);

    if (!userContext.confeitaria_id) {
      return jsonResponse({ valid: false, reason: 'no_bakery' });
    }

    const { adminClient } = getSupabaseClients(req);

    const confeitaria = await getConfeitariaById(adminClient, userContext.confeitaria_id);
    const status = confeitaria.status_assinatura || 'trial';
    const trialEndDate = confeitaria.data_fim_trial ? new Date(confeitaria.data_fim_trial) : null;
    const now = new Date();

    if (status === 'trial' && trialEndDate && trialEndDate > now) {
      return jsonResponse({
        valid: true,
        status: 'trial',
        trialEndsAt: trialEndDate.toISOString()
      });
    }

    if (status === 'trial' && trialEndDate && trialEndDate <= now) {
      return jsonResponse({
        valid: false,
        reason: 'trial_expired',
        status: 'trial_expired'
      });
    }

    if (status === 'active' || status === 'canceling') {
      return jsonResponse({
        valid: true,
        status,
        nextPaymentDate: confeitaria.data_proximo_pagamento
      });
    }

    return jsonResponse({
      valid: false,
      reason: 'no_valid_subscription',
      status
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return jsonResponse({ valid: false, reason: 'bakery_not_found' });
    }
    console.error('❌ [checkSubscriptionStatus] Erro:', error);
    return errorResponse(error);
  }
});
