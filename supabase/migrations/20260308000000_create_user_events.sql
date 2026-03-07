-- ─── user_events: rastreamento de eventos do funil de conversão ───────────────

CREATE TABLE IF NOT EXISTS public.user_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confeitaria_id  uuid        REFERENCES public.confeitarias(id) ON DELETE SET NULL,
  event_name      text        NOT NULL,
  metadata        jsonb       DEFAULT '{}',
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX user_events_user_id_idx       ON public.user_events(user_id);
CREATE INDEX user_events_confeitaria_id_idx ON public.user_events(confeitaria_id);
CREATE INDEX user_events_event_name_idx    ON public.user_events(event_name);
CREATE INDEX user_events_created_at_idx    ON public.user_events(created_at);

-- Deduplicação: apenas 1 session_day por usuário por dia calendário
CREATE UNIQUE INDEX user_events_session_day_dedup
  ON public.user_events(user_id, (created_at::date))
  WHERE event_name = 'session_day';

-- Deduplicação: apenas 1 first_order_created por usuário
CREATE UNIQUE INDEX user_events_first_order_dedup
  ON public.user_events(user_id)
  WHERE event_name = 'first_order_created';

-- Deduplicação: apenas 1 first_client_created por usuário
CREATE UNIQUE INDEX user_events_first_client_dedup
  ON public.user_events(user_id)
  WHERE event_name = 'first_client_created';

-- Deduplicação: apenas 1 plans_page_viewed por usuário por dia
CREATE UNIQUE INDEX user_events_plans_view_dedup
  ON public.user_events(user_id, (created_at::date))
  WHERE event_name = 'plans_page_viewed';

-- RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem inserir os próprios eventos
CREATE POLICY "user_events_insert_own" ON public.user_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin pode ler todos os eventos
CREATE POLICY "user_events_admin_read" ON public.user_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ─── feedback_requested_at em confeitarias ────────────────────────────────────
-- Marca o momento em que o usuário foi sinalizado para receber email de feedback
-- (48h após expiração do trial sem conversão)
ALTER TABLE public.confeitarias
  ADD COLUMN IF NOT EXISTS feedback_requested_at timestamptz;
