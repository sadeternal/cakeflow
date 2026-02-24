import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { errorResponse, HttpError, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { getSupabaseClients } from '../_shared/supabase.ts';

const DELETE_ORDER_TABLES = [
  'pedidos',
  'clientes',
  'produtos',
  'formas_pagamento',
  'massas',
  'recheios',
  'tamanhos',
  'coberturas',
  'extras',
  'doces',
  'salgados',
  'contas_receber',
  'contas_pagar',
  'acessos_catalogo'
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userClient, adminClient } = getSupabaseClients(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData?.user?.id) {
      throw new HttpError(401, 'Unauthorized');
    }

    const userId = String(authData.user.id);
    const authEmail = authData.user.email ? String(authData.user.email).trim().toLowerCase() : null;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, confeitaria_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new HttpError(500, 'Erro ao buscar perfil do usuário', profileError);
    }

    const profileEmail = profile?.email ? String(profile.email).trim().toLowerCase() : null;
    const confeitariaIds = new Set<string>();

    if (profile?.confeitaria_id) {
      confeitariaIds.add(String(profile.confeitaria_id));
    }

    const ownerEmailCandidates = [authEmail, profileEmail].filter(Boolean) as string[];

    if (ownerEmailCandidates.length > 0) {
      const { data: ownedConfeitarias, error: ownedConfeitariasError } = await adminClient
        .from('confeitarias')
        .select('id')
        .in('owner_email', ownerEmailCandidates);

      if (ownedConfeitariasError) {
        throw new HttpError(
          500,
          'Erro ao buscar confeitarias vinculadas ao usuário',
          ownedConfeitariasError
        );
      }

      for (const confeitaria of ownedConfeitarias || []) {
        if (confeitaria?.id) confeitariaIds.add(String(confeitaria.id));
      }
    }

    const confeitariaIdList = Array.from(confeitariaIds);

    if (confeitariaIdList.length > 0) {
      for (const table of DELETE_ORDER_TABLES) {
        const { error: tableDeleteError } = await adminClient
          .from(table)
          .delete()
          .in('confeitaria_id', confeitariaIdList);

        if (tableDeleteError) {
          throw new HttpError(
            500,
            `Erro ao excluir dados da tabela ${table}`,
            tableDeleteError
          );
        }
      }

      const { error: deleteConfeitariasError } = await adminClient
        .from('confeitarias')
        .delete()
        .in('id', confeitariaIdList);

      if (deleteConfeitariasError) {
        throw new HttpError(
          500,
          'Erro ao excluir confeitaria',
          deleteConfeitariasError
        );
      }
    }

    const { error: deleteAppLogsError } = await adminClient
      .from('app_logs')
      .delete()
      .eq('user_id', userId);

    if (deleteAppLogsError) {
      throw new HttpError(500, 'Erro ao excluir logs do usuário', deleteAppLogsError);
    }

    const { error: deleteProfileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      throw new HttpError(500, 'Erro ao excluir perfil do usuário', deleteProfileError);
    }

    const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
      throw new HttpError(500, 'Erro ao excluir usuário de autenticação', deleteAuthUserError);
    }

    return jsonResponse({
      success: true,
      message: 'Conta e dados relacionados removidos com sucesso.'
    });
  } catch (error) {
    console.error('❌ [deleteAccount] Erro:', error);
    return errorResponse(error);
  }
});
