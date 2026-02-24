-- Reforco de acesso para confeitarias:
-- - Usa funcao SECURITY DEFINER para validar acesso sem depender de RLS em profiles
-- - Backfill de profile.email e profile.confeitaria_id
-- - Recria policies de confeitarias usando a funcao de acesso

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null;

update public.profiles p
set confeitaria_id = c.id,
    updated_at = now()
from public.confeitarias c
where p.confeitaria_id is null
  and p.email is not null
  and c.owner_email is not null
  and lower(p.email) = lower(c.owner_email);

do $$
declare
  v_count int;
  v_single_id uuid;
begin
  select count(*) into v_count from public.confeitarias;
  select c.id into v_single_id
  from public.confeitarias c
  order by c.created_date asc
  limit 1;
  if v_count = 1 then
    update public.profiles
    set confeitaria_id = v_single_id,
        updated_at = now()
    where confeitaria_id is null;
  end if;
end $$;

create or replace function public.can_access_confeitaria(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_profile_confeitaria_id uuid;
  v_claim_confeitaria_id uuid;
begin
  if v_user_id is null or target_id is null then
    return false;
  end if;

  select u.email into v_user_email
  from auth.users u
  where u.id = v_user_id;

  select p.confeitaria_id into v_profile_confeitaria_id
  from public.profiles p
  where p.id = v_user_id
  limit 1;

  v_claim_confeitaria_id := coalesce(
    nullif(auth.jwt() ->> 'confeitaria_id', '')::uuid,
    nullif(auth.jwt() -> 'user_metadata' ->> 'confeitaria_id', '')::uuid,
    nullif(auth.jwt() -> 'app_metadata' ->> 'confeitaria_id', '')::uuid
  );

  return exists (
    select 1
    from public.confeitarias c
    where c.id = target_id
      and (
        c.id = coalesce(v_profile_confeitaria_id, v_claim_confeitaria_id)
        or (
          v_user_email is not null
          and c.owner_email is not null
          and lower(c.owner_email) = lower(v_user_email)
        )
      )
  );
end;
$$;

revoke all on function public.can_access_confeitaria(uuid) from public;
grant execute on function public.can_access_confeitaria(uuid) to authenticated;

drop policy if exists "confeitarias_select_own" on public.confeitarias;
create policy "confeitarias_select_own"
  on public.confeitarias for select
  to authenticated
  using (public.can_access_confeitaria(id));

drop policy if exists "confeitarias_write_own" on public.confeitarias;
create policy "confeitarias_write_own"
  on public.confeitarias for all
  to authenticated
  using (public.can_access_confeitaria(id))
  with check (public.can_access_confeitaria(id));
