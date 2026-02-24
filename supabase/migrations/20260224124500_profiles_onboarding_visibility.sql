alter table public.profiles
  add column if not exists onboarding_ocultar_dashboard boolean not null default false;

update public.profiles
set onboarding_ocultar_dashboard = coalesce(onboarding_ocultar_dashboard, false)
where onboarding_ocultar_dashboard is null;
