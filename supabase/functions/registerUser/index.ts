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

    // Enviar notificação por e-mail sobre o novo usuário
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const to = Deno.env.get('REPORT_EMAIL_TO') || 'contato@cakeflow.com.br';
      const from = Deno.env.get('REPORT_EMAIL_FROM') || 'CakeFlow <no-reply@cakeflow.com.br>';

      if (resendApiKey) {
        const subject = `Novo Usuário Cadastrado: ${fullName || email}`;
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px; }
              .header { border-bottom: 2px solid #e11d48; padding-bottom: 10px; margin-bottom: 20px; }
              .header h2 { color: #e11d48; margin: 0; }
              .info { margin-bottom: 10px; }
              .label { font-weight: bold; color: #666; }
              .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>O CakeFlow tem um novo usuário!</h2>
              </div>
              <div class="info">
                <span class="label">Nome:</span> ${fullName || 'Não informado'}
              </div>
              <div class="info">
                <span class="label">E-mail:</span> ${email}
              </div>
              <div class="info">
                <span class="label">ID do Usuário:</span> ${user.id}
              </div>
              <div class="footer">
                Este é um e-mail automático do sistema CakeFlow.
              </div>
            </div>
          </body>
          </html>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            html
          })
        });
      }
    } catch (emailError) {
      // Logamos o erro mas não impedimos a resposta de sucesso do cadastro
      console.error('⚠️ [registerUser] Falha ao enviar e-mail de notificação:', emailError);
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
