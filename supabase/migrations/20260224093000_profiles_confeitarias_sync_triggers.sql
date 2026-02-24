-- Mantem os vinculos entre profiles e confeitarias sincronizados por email.

create or replace function public.sync_profile_confeitaria_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confeitaria_id uuid;
begin
  if new.confeitaria_id is null and new.email is not null then
    select c.id
    into v_confeitaria_id
    from public.confeitarias c
    where c.owner_email is not null
      and lower(c.owner_email) = lower(new.email)
    order by c.created_date desc
    limit 1;

    if v_confeitaria_id is not null then
      new.confeitaria_id := v_confeitaria_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_profiles_sync_confeitaria on public.profiles;
create trigger tr_profiles_sync_confeitaria
before insert or update of email, confeitaria_id
on public.profiles
for each row
execute function public.sync_profile_confeitaria_by_email();

create or replace function public.sync_confeitaria_owner_to_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_email is not null then
    update public.profiles p
    set confeitaria_id = new.id,
        updated_at = now()
    where p.email is not null
      and lower(p.email) = lower(new.owner_email)
      and (p.confeitaria_id is null or p.confeitaria_id = new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_confeitarias_sync_owner_email on public.confeitarias;
create trigger tr_confeitarias_sync_owner_email
after insert or update of owner_email
on public.confeitarias
for each row
execute function public.sync_confeitaria_owner_to_profiles();

-- Backfill imediato apos criar os triggers.
update public.profiles p
set confeitaria_id = c.id,
    updated_at = now()
from public.confeitarias c
where p.confeitaria_id is null
  and p.email is not null
  and c.owner_email is not null
  and lower(p.email) = lower(c.owner_email);
