# Supabase Edge Functions (CakeFlow)

Funções migradas da Base44:

- `checkSubscriptionStatus`
- `createCheckoutSession`
- `createCustomerPortal`
- `syncSubscription`
- `stripeWebhook`
- `generateWeeklyReport`
- `deleteAccount`

## Secrets necessários

Configure no projeto Supabase:

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=... \
  STRIPE_PRICE_ID=... \
  STRIPE_WEBHOOK_SECRET=... \
  APP_URL=https://app.cakeflow.com.br
```

Para relatório por e-mail (opcional):

```bash
npx supabase secrets set \
  RESEND_API_KEY=... \
  REPORT_EMAIL_TO=contato@cakeflow.com.br \
  REPORT_EMAIL_FROM="CakeFlow <no-reply@cakeflow.com.br>"
```

## Deploy

```bash
npx supabase functions deploy checkSubscriptionStatus
npx supabase functions deploy createCheckoutSession
npx supabase functions deploy createCustomerPortal
npx supabase functions deploy syncSubscription
npx supabase functions deploy stripeWebhook
npx supabase functions deploy generateWeeklyReport
npx supabase functions deploy deleteAccount
```

## Webhook Stripe

Depois do deploy, configure no Stripe:

- Endpoint: `https://<PROJECT_REF>.supabase.co/functions/v1/stripeWebhook`
- Eventos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
