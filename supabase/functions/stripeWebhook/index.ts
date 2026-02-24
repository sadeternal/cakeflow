import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.5.0';
import { errorResponse, HttpError, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { resolveSubscriptionStatus, toIsoFromUnix } from '../_shared/subscription.ts';
import {
  findConfeitariaByStripeData,
  getSupabaseClients,
  requireEnv,
  updateConfeitariaById
} from '../_shared/supabase.ts';

const getStringId = (value: unknown) => (typeof value === 'string' ? value : null);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
    const allowTestEvents = Deno.env.get('STRIPE_WEBHOOK_ALLOW_TEST_EVENTS') === 'true';

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia'
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new HttpError(400, 'Missing signature');
    }

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);

    if (event.livemode === false && !allowTestEvents) {
      return jsonResponse({ received: true, ignored: 'test_mode' });
    }

    const { adminClient } = getSupabaseClients(req);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = getStringId(session.customer);
        const subscriptionId = getStringId(session.subscription);

        if (!customerId || !subscriptionId) break;

        const confeitaria = await findConfeitariaByStripeData(adminClient, {
          customerId
        });
        if (!confeitaria) break;

        await updateConfeitariaById(adminClient, confeitaria.id, {
          stripe_subscription_id: subscriptionId
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getStringId(subscription.customer);

        const confeitaria = await findConfeitariaByStripeData(adminClient, {
          customerId,
          subscriptionId: subscription.id
        });

        if (!confeitaria) break;

        await updateConfeitariaById(adminClient, confeitaria.id, {
          stripe_subscription_id: subscription.id,
          status_assinatura: resolveSubscriptionStatus(subscription),
          data_fim_trial: toIsoFromUnix(subscription.trial_end),
          data_proximo_pagamento: toIsoFromUnix(subscription.current_period_end)
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getStringId(subscription.customer);

        const confeitaria = await findConfeitariaByStripeData(adminClient, {
          customerId,
          subscriptionId: subscription.id
        });

        if (!confeitaria) break;

        await updateConfeitariaById(adminClient, confeitaria.id, {
          status_assinatura: 'canceled',
          data_proximo_pagamento: null
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getStringId(invoice.customer);
        if (!customerId) break;

        const confeitaria = await findConfeitariaByStripeData(adminClient, {
          customerId
        });
        if (!confeitaria) break;

        await updateConfeitariaById(adminClient, confeitaria.id, {
          status_assinatura: 'past_due'
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getStringId(invoice.customer);
        const subscriptionId = getStringId(invoice.subscription);
        if (!customerId || !subscriptionId) break;

        const confeitaria = await findConfeitariaByStripeData(adminClient, {
          customerId,
          subscriptionId
        });
        if (!confeitaria) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await updateConfeitariaById(adminClient, confeitaria.id, {
          status_assinatura: resolveSubscriptionStatus(subscription),
          data_proximo_pagamento: toIsoFromUnix(subscription.current_period_end)
        });
        break;
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('❌ [stripeWebhook] Erro:', error);
    return errorResponse(error);
  }
});
