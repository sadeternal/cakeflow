import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import {
  getConfeitariaById,
  getSupabaseClients,
  requireEnv,
  requireUserContext
} from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const userContext = await requireUserContext(req);

    if (userContext.role !== 'admin') {
      throw new HttpError(403, 'Apenas administradores podem usar esta função');
    }

    const payload = await readJsonBody(req);
    const confeitariaId = String(payload.confeitaria_id || '');

    if (!confeitariaId) {
      throw new HttpError(400, 'confeitaria_id obrigatório');
    }

    const brevoApiKey = requireEnv('BREVO_API_KEY');
    const brevoListIdRaw = Deno.env.get('BREVO_LIST_ID');
    const brevoListId = brevoListIdRaw ? Number(brevoListIdRaw) : null;

    const { adminClient } = getSupabaseClients(req);
    const confeitaria = await getConfeitariaById(adminClient, confeitariaId);

    const email = confeitaria.owner_email as string | null;
    if (!email) {
      throw new HttpError(400, 'Confeitaria sem e-mail do proprietário');
    }

    const attributes: Record<string, string> = {};

    if (confeitaria.nome) {
      attributes['NOME'] = String(confeitaria.nome);
    }
    if (confeitaria.telefone) {
      attributes['SMS'] = String(confeitaria.telefone).replace(/\D/g, '');
    }
    if (confeitaria.instagram) {
      attributes['INSTAGRAM'] = String(confeitaria.instagram);
    }
    if (confeitaria.como_conheceu) {
      attributes['COMO_CONHECEU'] = String(confeitaria.como_conheceu);
    }
    if (confeitaria.status_assinatura) {
      attributes['STATUS_ASSINATURA'] = String(confeitaria.status_assinatura);
    }

    const brevoPayload: Record<string, unknown> = {
      email,
      updateEnabled: true,
      attributes
    };

    if (brevoListId) {
      brevoPayload.listIds = [brevoListId];
    }

    const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(brevoPayload)
    });

    // 201 = criado, 204 = atualizado (sem body)
    if (!brevoRes.ok && brevoRes.status !== 204) {
      const errBody = await brevoRes.text();
      throw new HttpError(502, `Erro na API do Brevo: ${brevoRes.status}`, errBody);
    }

    return jsonResponse({ success: true, email });
  } catch (error) {
    console.error('❌ [addBrevoContact] Erro:', error);
    return errorResponse(error);
  }
});
