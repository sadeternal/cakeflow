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
    const requestedPlan = String(payload.plan || 'mensal');
    const rawTrialDays = Number(payload.trial_days ?? 0);

    const normalizePath = (value: unknown, fallback: string) => {
      const parsed = String(value || '').trim();
      if (!parsed) return fallback;
      if (!parsed.startsWith('/')) return fallback;
      if (parsed.startsWith('//')) return fallback;
      return parsed;
    };

    const successPath = normalizePath(
      payload.success_path,
      '/Configuracoes?tab=assinaturas&checkout=success'
    );
    const cancelPath = normalizePath(
      payload.cancel_path,
      '/Configuracoes?tab=assinaturas&checkout=canceled'
    );

    if (!confeitariaId) {
      throw new HttpError(400, 'confeitaria_id obrigatório');
    }

    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const fallbackPriceId = requireEnv('STRIPE_PRICE_ID');
    const mensalPriceId = Deno.env.get('STRIPE_PRICE_ID_MENSAL') || fallbackPriceId;
    const anualPriceId = Deno.env.get('STRIPE_PRICE_ID_ANUAL');
    const appUrl = getAppUrl(req);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia'
    });

    const userContext = await requireUserContext(req);
    assertConfeitariaAccess(userContext, confeitariaId);

    const { adminClient } = getSupabaseClients(req);
    const confeitaria = await getConfeitariaById(adminClient, confeitariaId);

    const status = confeitaria.status_assinatura;
    const hasOngoingSubscription =
      Boolean(confeitaria.stripe_subscription_id) &&
      ['active', 'canceling', 'past_due', 'incomplete', 'trial'].includes(String(status));

    const stripePriceId =
      requestedPlan === 'anual'
        ? anualPriceId || mensalPriceId
        : mensalPriceId;

    const trialDays = Number.isFinite(rawTrialDays)
      ? Math.max(0, Math.min(30, Math.trunc(rawTrialDays)))
      : 0;

    let customerId = confeitaria.stripe_customer_id as string | null;

    if (hasOngoingSubscription && confeitaria.stripe_subscription_id) {
      if (!customerId) {
        const subscription = await stripe.subscriptions.retrieve(confeitaria.stripe_subscription_id);
        const resolvedCustomerId =
          typeof subscription.customer === 'string' ? subscription.customer : null;

        if (resolvedCustomerId) {
          customerId = resolvedCustomerId;
          await updateConfeitariaById(adminClient, confeitaria.id, {
            stripe_customer_id: customerId
          });
        }
      }

      if (!customerId) {
        throw new HttpError(400, 'Cliente Stripe não configurado');
      }

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/Configuracoes?tab=assinaturas`
      });

      return jsonResponse({
        url: portal.url,
        mode: 'portal'
      });
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: confeitaria.owner_email || userContext.email || undefined,
        name: confeitaria.nome || undefined,
        metadata: {
          confeitaria_id: confeitaria.id
        }
      });

      customerId = customer.id;
      await updateConfeitariaById(adminClient, confeitaria.id, {
        stripe_customer_id: customerId
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          confeitaria_id: confeitaria.id,
          plan: requestedPlan
        },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {})
      },
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}${cancelPath}`,
      locale: 'pt-BR'
    });

    return jsonResponse({
      url: session.url,
      sessionId: session.id,
      mode: 'checkout'
    });
  } catch (error) {
    console.error('❌ [createCheckoutSession] Erro:', error);
    return errorResponse(error);
  }
});
