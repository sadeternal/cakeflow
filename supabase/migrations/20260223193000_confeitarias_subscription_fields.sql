alter table public.confeitarias
  add column if not exists como_conheceu text;

create index if not exists idx_confeitarias_stripe_customer_id
  on public.confeitarias (stripe_customer_id);

create index if not exists idx_confeitarias_stripe_subscription_id
  on public.confeitarias (stripe_subscription_id);
