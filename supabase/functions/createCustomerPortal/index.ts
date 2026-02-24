import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.5.0';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import {
  assertConfeitariaAccess,
  getAppUrl,
  getConfeitariaById,
  getSupabaseClients,
  requireEnv,
  requireUserContext
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
    if (!confeitaria.stripe_customer_id) {
      throw new HttpError(400, 'Cliente Stripe não configurado');
    }

    const appUrl = getAppUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: confeitaria.stripe_customer_id,
      return_url: `${appUrl}/Configuracoes?tab=assinaturas`
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('❌ [createCustomerPortal] Erro:', error);
    return errorResponse(error);
  }
});
