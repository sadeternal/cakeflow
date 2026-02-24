-- Backfill para perfis antigos sem confeitaria_id.
-- Vincula profile -> confeitaria quando o email do profile bate com owner_email da confeitaria.

update public.profiles p
set confeitaria_id = c.id,
    updated_at = now()
from public.confeitarias c
where p.confeitaria_id is null
  and p.email is not null
  and c.owner_email is not null
  and lower(p.email) = lower(c.owner_email);
