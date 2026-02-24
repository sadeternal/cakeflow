# Setup Supabase (CakeFlow)

## 1) Criar projeto no Supabase Cloud
- Acesse: https://supabase.com/dashboard
- Crie um novo projeto.

## 2) Configurar `.env.local`
Use como base o `.env.example`:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
VITE_SUPABASE_STORAGE_BUCKET=public
VITE_SUPABASE_AUTH_REDIRECT_URL=https://SEU-DOMINIO/auth/callback
```

## 3) Linkar CLI ao projeto
```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

## 4) Aplicar schema
```bash
npx supabase db push
```

## 5) Criar bucket público para uploads (se necessário)
- Storage > New bucket > `public` (public = true)

## 6) Configurar secrets das Edge Functions
Stripe:
```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=... \
  STRIPE_PRICE_ID=... \
  STRIPE_WEBHOOK_SECRET=... \
  APP_URL=https://SEU-DOMINIO
```

Relatório semanal (opcional):
```bash
npx supabase secrets set \
  RESEND_API_KEY=... \
  REPORT_EMAIL_TO=contato@cakeflow.com.br \
  REPORT_EMAIL_FROM="CakeFlow <no-reply@cakeflow.com.br>"
```

## 7) Deploy das Edge Functions
```bash
npx supabase functions deploy checkSubscriptionStatus
npx supabase functions deploy createCheckoutSession
npx supabase functions deploy createCustomerPortal
npx supabase functions deploy syncSubscription
npx supabase functions deploy stripeWebhook
npx supabase functions deploy generateWeeklyReport
```

## 8) Rodar app
```bash
npm run dev
```

## 9) Login Google (Supabase Auth)
1. No Supabase: Authentication > Providers > Google > Enable.
2. Configure o `Client ID` e `Client Secret` do Google Cloud.
3. Em Authentication > URL Configuration, inclua:
- Site URL: `https://SEU-DOMINIO` (ou `http://localhost:5173` no local)
- Redirect URL adicional: `https://SEU-DOMINIO/auth/callback`
4. No Google Cloud Console, adicione o redirect oficial do Supabase (mostrado no painel do provider Google do Supabase), normalmente:
- `https://SEU-PROJETO.supabase.co/auth/v1/callback`
5. Defina `VITE_SUPABASE_AUTH_REDIRECT_URL` com a URL de callback do app.

## Observações
- O cliente atual em `src/api/supabaseCompatClient.js` usa REST do Supabase e expõe a API de acesso de dados utilizada no frontend.
- As funções já migradas estão em `supabase/functions/*`.
