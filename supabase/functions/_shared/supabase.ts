import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { HttpError } from './http.ts';

type UserContext = {
  id: string;
  email: string | null;
  role: string;
  confeitaria_id: string | null;
  user: Record<string, unknown>;
  profile: Record<string, unknown> | null;
};

const missingEnvError = (name: string) => new HttpError(500, `${name} não configurada`);

export const requireEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw missingEnvError(name);
  return value;
};

export const getAppUrl = (req: Request) => {
  const configuredAppUrl = Deno.env.get('APP_URL');
  if (configuredAppUrl) return configuredAppUrl.replace(/\/$/, '');

  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');

  return 'http://localhost:5173';
};

export const getSupabaseClients = (req: Request) => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { userClient, adminClient };
};

export const requireUserContext = async (req: Request): Promise<UserContext> => {
  const { userClient, adminClient } = getSupabaseClients(req);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data?.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = data.user as unknown as Record<string, unknown>;
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, confeitaria_id, full_name, email')
    .eq('id', String(data.user.id))
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new HttpError(500, 'Erro ao buscar perfil do usuário', profileError);
  }

  const userMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : {};

  const role =
    (profile?.role as string | undefined) ||
    (userMetadata.role as string | undefined) ||
    'user';
  const confeitaria_id =
    (profile?.confeitaria_id as string | undefined) ||
    (userMetadata.confeitaria_id as string | undefined) ||
    null;
  const email =
    (data.user.email as string | undefined) ||
    (profile?.email as string | undefined) ||
    null;

  return {
    id: String(data.user.id),
    email,
    role,
    confeitaria_id,
    user,
    profile: profile as Record<string, unknown> | null
  };
};

export const assertConfeitariaAccess = (userContext: UserContext, confeitariaId: string) => {
  if (!userContext.confeitaria_id && userContext.role !== 'admin') {
    throw new HttpError(403, 'Usuário sem confeitaria vinculada');
  }

  if (userContext.role !== 'admin' && userContext.confeitaria_id !== confeitariaId) {
    throw new HttpError(403, 'Forbidden: confeitaria inválida para este usuário');
  }
};

export const getConfeitariaById = async (
  adminClient: ReturnType<typeof createClient>,
  confeitariaId: string
) => {
  const { data, error } = await adminClient
    .from('confeitarias')
    .select('*')
    .eq('id', confeitariaId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Erro ao buscar confeitaria', error);
  }

  if (!data) {
    throw new HttpError(404, 'Confeitaria não encontrada');
  }

  return data;
};

export const updateConfeitariaById = async (
  adminClient: ReturnType<typeof createClient>,
  confeitariaId: string,
  payload: Record<string, unknown>
) => {
  const { error } = await adminClient
    .from('confeitarias')
    .update(payload)
    .eq('id', confeitariaId);

  if (error) {
    throw new HttpError(500, 'Erro ao atualizar confeitaria', error);
  }
};

export const findConfeitariaByStripeData = async (
  adminClient: ReturnType<typeof createClient>,
  params: { customerId?: string | null; subscriptionId?: string | null }
) => {
  if (params.customerId) {
    const { data, error } = await adminClient
      .from('confeitarias')
      .select('*')
      .eq('stripe_customer_id', params.customerId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new HttpError(500, 'Erro ao buscar confeitaria por customer', error);
    }

    if (data) return data;
  }

  if (params.subscriptionId) {
    const { data, error } = await adminClient
      .from('confeitarias')
      .select('*')
      .eq('stripe_subscription_id', params.subscriptionId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new HttpError(500, 'Erro ao buscar confeitaria por assinatura', error);
    }

    if (data) return data;
  }

  return null;
};
