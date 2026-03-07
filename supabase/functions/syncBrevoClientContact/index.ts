import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import { requireEnv } from '../_shared/supabase.ts';

const normalizePhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `+${withCountryCode}`;
};

const normalizeEmail = (value: unknown) => {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await readJsonBody(req);
    const nome = String(payload.nome || '').trim();
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.telefone);
    const clienteId = String(payload.cliente_id || '').trim();
    const confeitariaId = String(payload.confeitaria_id || '').trim();

    if (!nome) {
      throw new HttpError(400, 'nome obrigatório');
    }

    if (!email && !phone && !clienteId) {
      throw new HttpError(400, 'Informe ao menos email, telefone ou cliente_id');
    }

    const brevoApiKey = requireEnv('BREVO_API_KEY');
    const brevoListIdRaw = Deno.env.get('BREVO_LIST_ID');
    const brevoListId = brevoListIdRaw ? Number(brevoListIdRaw) : null;

    const attributes: Record<string, string> = {
      FIRSTNAME: nome
    };

    if (phone) {
      attributes.SMS = phone;
    }

    const brevoPayload: Record<string, unknown> = {
      updateEnabled: true,
      attributes
    };

    if (email) {
      brevoPayload.email = email;
    }

    if (clienteId) {
      brevoPayload.ext_id = clienteId;
    } else if (confeitariaId && phone) {
      brevoPayload.ext_id = `${confeitariaId}:${phone.replace(/\D/g, '')}`;
    } else if (confeitariaId && email) {
      brevoPayload.ext_id = `${confeitariaId}:${email}`;
    }

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

    if (!brevoRes.ok && brevoRes.status !== 204) {
      const errBody = await brevoRes.text();
      throw new HttpError(502, `Erro na API do Brevo: ${brevoRes.status}`, errBody);
    }

    return jsonResponse({
      success: true,
      email,
      phone,
      ext_id: brevoPayload.ext_id ?? null
    });
  } catch (error) {
    console.error('❌ [syncBrevoClientContact] Erro:', error);
    return errorResponse(error);
  }
});
