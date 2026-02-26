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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return optionsResponse();
    }

    // Webhooks do Supabase costumam usar POST
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const payload = await readJsonBody(req);

        // O payload do webhook do Supabase quando é INSERT segue esta estrutura:
        // { type: 'INSERT', table: 'clientes', record: { ... }, ... }
        const { record, type, table } = payload;

        if (type !== 'INSERT' || table !== 'clientes' || !record) {
            return jsonResponse({ success: true, message: 'Ignorado: não é um insert em clientes' });
        }

        const { nome, telefone, email: clientEmail, confeitaria_id } = record;

        const supabaseUrl = requireEnv('SUPABASE_URL');
        const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
        const adminClient = createClient(supabaseUrl, serviceRoleKey);

        // Buscar nome da confeitaria para o e-mail
        const { data: confeitaria } = await adminClient
            .from('confeitarias')
            .select('nome')
            .eq('id', confeitaria_id)
            .single();

        const confeitariaNome = confeitaria?.nome || 'Não identificada';

        // Configurações de e-mail (usando as mesmas envs do relatório semanal)
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const to = Deno.env.get('REPORT_EMAIL_TO') || 'contato@cakeflow.com.br';
        const from = Deno.env.get('REPORT_EMAIL_FROM') || 'CakeFlow <no-reply@cakeflow.com.br>';

        if (!resendApiKey) {
            console.error('❌ RESEND_API_KEY não configurada');
            return jsonResponse({ success: false, message: 'RESEND_API_KEY não configurada' }, 500);
        }

        const subject = `Novo Cliente Cadastrado: ${nome}`;
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
            <h2>Novo Cliente no CakeFlow!</h2>
          </div>
          <div class="info">
            <span class="label">Nome:</span> ${nome}
          </div>
          <div class="info">
            <span class="label">Confeitaria:</span> ${confeitariaNome}
          </div>
          <div class="info">
            <span class="label">Telefone:</span> ${telefone || 'Não informado'}
          </div>
          <div class="info">
            <span class="label">E-mail:</span> ${clientEmail || 'Não informado'}
          </div>
          <div class="footer">
            Este é um e-mail automático do sistema CakeFlow.
          </div>
        </div>
      </body>
      </html>
    `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
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

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            throw new Error(`Erro ao enviar e-mail via Resend: ${errorText}`);
        }

        return jsonResponse({ success: true, message: 'Notificação enviada com sucesso' });
    } catch (error) {
        console.error('❌ [notifyNewClient] Erro:', error);
        return errorResponse(error);
    }
});
