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
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

    const userContext = await requireUserContext(req);
    assertConfeitariaAccess(userContext, confeitariaId);

    const { adminClient } = getSupabaseClients(req);
    const confeitaria = await getConfeitariaById(adminClient, confeitariaId);

    if (!confeitaria.stripe_customer_id) {
      return jsonResponse({ subscriptions: [], invoices: [] });
    }

    const customerId = confeitaria.stripe_customer_id as string;

    const [subscriptionsList, invoicesList] = await Promise.all([
      stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
        expand: ['data.latest_invoice']
      }),
      stripe.invoices.list({
        customer: customerId,
        limit: 30
      })
    ]);

    const subscriptions = subscriptionsList.data.map((sub) => ({
      id: sub.id,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      created: new Date(sub.created * 1000).toISOString(),
      ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
    }));

    const invoices = invoicesList.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_paid: inv.amount_paid,
      amount_due: inv.amount_due,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      hosted_invoice_url: inv.hosted_invoice_url || null,
      period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null
    }));

    return jsonResponse({ subscriptions, invoices });
  } catch (error) {
    console.error('❌ [getSubscriptionHistory] Erro:', error);
    return errorResponse(error);
  }
});
