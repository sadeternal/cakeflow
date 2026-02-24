import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody
} from '../_shared/http.ts';
import { requireEnv } from '../_shared/supabase.ts';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await readJsonBody(req);
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const fullName = payload.full_name ? String(payload.full_name).trim() : null;

    if (!isValidEmail(email)) {
      throw new HttpError(400, 'E-mail inválido', { error_code: 'email_address_invalid' });
    }

    if (!password || password.length < 8) {
      throw new HttpError(400, 'Senha deve ter no mínimo 8 caracteres', {
        error_code: 'weak_password'
      });
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {}
    });

    if (error) {
      const message = error.message || 'Erro ao criar usuário';
      if (/already been registered|already registered|already exists/i.test(message)) {
        throw new HttpError(409, 'Usuário já cadastrado', { error_code: 'user_already_exists' });
      }
      throw new HttpError(400, message, { error_code: error.code || 'register_user_error' });
    }

    const user = data.user;
    if (!user?.id) {
      throw new HttpError(500, 'Usuário criado sem id');
    }

    const { error: profileError } = await adminClient.from('profiles').upsert(
      {
        id: user.id,
        email: user.email || email,
        full_name: fullName
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      throw new HttpError(500, 'Erro ao criar perfil', profileError);
    }

    return jsonResponse({
      success: true,
      user_id: user.id
    });
  } catch (error) {
    console.error('❌ [registerUser] Erro:', error);
    return errorResponse(error);
  }
});
