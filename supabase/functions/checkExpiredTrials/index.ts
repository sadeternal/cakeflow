import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { errorResponse, HttpError, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { getSupabaseClients, requireUserContext } from '../_shared/supabase.ts';

/**
 * Marca confeitarias cujo trial expirou há 48h+ sem conversão
 * com feedback_requested_at = now(), para disparo de email de feedback.
 *
 * Pode ser chamada manualmente pelo admin ou via pg_cron:
 *   SELECT cron.schedule('check-expired-trials', '0 * * * *',
 *     $$ SELECT net.http_post(url := '<FUNCTION_URL>', headers := '{"Authorization": "Bearer <SERVICE_KEY>"}') $$
 *   );
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  try {
    const userContext = await requireUserContext(req);

    if (userContext.role !== 'admin') {
      throw new HttpError(403, 'Acesso restrito a administradores');
    }

    const { adminClient } = getSupabaseClients(req);

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await adminClient
      .from('confeitarias')
      .update({ feedback_requested_at: new Date().toISOString() })
      .eq('status_assinatura', 'trial')
      .lt('data_fim_trial', cutoff)
      .is('feedback_requested_at', null)
      .select('id, nome, owner_email');

    if (error) throw new HttpError(500, 'Erro ao atualizar confeitarias', error);

    const updated = data || [];
    console.log(`[checkExpiredTrials] ${updated.length} confeitaria(s) marcada(s) para feedback`);

    return jsonResponse({ updated: updated.length, confeitarias: updated });
  } catch (error) {
    console.error('[checkExpiredTrials] Erro:', error);
    return errorResponse(error);
  }
});
