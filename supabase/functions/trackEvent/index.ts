import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { errorResponse, jsonResponse, optionsResponse, readJsonBody } from '../_shared/http.ts';
import { getSupabaseClients, requireUserContext } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  try {
    const userContext = await requireUserContext(req);
    const body = await readJsonBody(req);
    const eventName = String(body.event_name || '');
    const metadata = (body.metadata && typeof body.metadata === 'object') ? body.metadata : {};

    if (!eventName) {
      return jsonResponse({ error: 'event_name obrigatório' }, 400);
    }

    const { adminClient } = getSupabaseClients(req);

    // Insere com ON CONFLICT DO NOTHING para respeitar os unique indexes de deduplicação
    const { error } = await adminClient
      .from('user_events')
      .insert({
        user_id: userContext.id,
        confeitaria_id: userContext.confeitaria_id ?? null,
        event_name: eventName,
        metadata,
      });

    // Ignora conflito de unicidade (deduplicação) — não é um erro
    if (error && error.code !== '23505') {
      console.error('[trackEvent] Erro ao inserir evento:', error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('[trackEvent] Erro:', error);
    return errorResponse(error);
  }
});
