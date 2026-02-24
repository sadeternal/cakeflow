const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';
const supabaseAuthRedirectUrl = import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas.');
}

const saveAuthSessionFromUrl = () => {
  if (typeof window === 'undefined') return;

  const fragment = window.location.hash?.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = fragment ? new URLSearchParams(fragment) : null;
  const searchParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams?.get('access_token') || searchParams.get('access_token');
  const refreshToken = hashParams?.get('refresh_token') || searchParams.get('refresh_token');

  const oauthErrorCode = searchParams.get('error_code');
  const oauthErrorMessage = searchParams.get('error_description') || searchParams.get('error');

  if (!accessToken && oauthErrorCode) {
    const authUrl = new URL(`${window.location.origin}/auth`);
    authUrl.searchParams.set('mode', 'login');
    authUrl.searchParams.set('redirect', `${window.location.origin}${window.location.pathname}`);
    authUrl.searchParams.set(
      'oauth_error',
      oauthErrorMessage || `Falha no login social (${oauthErrorCode}).`
    );
    window.location.replace(authUrl.toString());
    return;
  }

  if (!accessToken) return;

  window.localStorage.setItem('supabase_access_token', accessToken);
  if (refreshToken) {
    window.localStorage.setItem('supabase_refresh_token', refreshToken);
  }

  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
};

saveAuthSessionFromUrl();

const toAbsoluteInternalUrl = (target) => {
  if (typeof window === 'undefined') return target || '';
  const fallback = `${window.location.origin}/`;

  try {
    const resolved = new URL(target || window.location.href, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
    return resolved.toString();
  } catch {
    return fallback;
  }
};

const getSafeAuthCallbackUrl = () => {
  if (typeof window === 'undefined') {
    return supabaseAuthRedirectUrl || '';
  }

  const fallback = `${window.location.origin}/auth/callback`;

  if (!supabaseAuthRedirectUrl) return fallback;

  try {
    const resolved = new URL(supabaseAuthRedirectUrl, window.location.origin);
    const isLocalHost = ['localhost', '127.0.0.1'].includes(resolved.hostname);
    const runningInLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    // Evita callback para localhost quando o app roda em domínio publicado.
    if (!runningInLocalHost && isLocalHost) return fallback;

    if (resolved.origin !== window.location.origin && isLocalHost) return fallback;

    return resolved.toString();
  } catch {
    return fallback;
  }
};

const ENTITY_TABLE_MAP = {
  Confeitaria: 'confeitarias',
  Cliente: 'clientes',
  Pedido: 'pedidos',
  ContaReceber: 'contas_receber',
  ContaPagar: 'contas_pagar',
  Produto: 'produtos',
  FormaPagamento: 'formas_pagamento',
  Massa: 'massas',
  Recheio: 'recheios',
  Tamanho: 'tamanhos',
  Cobertura: 'coberturas',
  Extra: 'extras',
  Doce: 'doces',
  Salgado: 'salgados',
  AcessoCatalogo: 'acessos_catalogo',
  User: 'profiles'
};

const toSnake = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();

const resolveTable = (entityName) => ENTITY_TABLE_MAP[entityName] || toSnake(entityName);

const encodeValue = (value) => encodeURIComponent(String(value));

const isJwtLike = (value) =>
  typeof value === 'string' && value.split('.').length === 3;

const getProjectRef = () => {
  try {
    const url = new URL(supabaseUrl);
    return url.hostname.split('.')[0] || null;
  } catch {
    return null;
  }
};

const getProjectStorageKey = () => {
  const projectRef = getProjectRef();
  if (!projectRef || typeof window === 'undefined') return null;

  const expectedKey = `sb-${projectRef}-auth-token`;
  if (window.localStorage.getItem(expectedKey)) return expectedKey;

  return (
    Object.keys(window.localStorage).find((key) => key === expectedKey) ||
    Object.keys(window.localStorage).find((key) =>
      key.startsWith(`sb-${projectRef}`) && key.endsWith('-auth-token')
    ) ||
    null
  );
};

const getStoredSession = () => {
  try {
    const key = getProjectStorageKey();
    if (!key) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  if (!isJwtLike(token)) return null;
  try {
    const payloadPart = token.split('.')[1];
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const setStoredSession = (payload) => {
  const key = getProjectStorageKey();
  if (!key || !payload) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // noop
  }
};

const clearStoredSession = () => {
  try {
    window.localStorage.removeItem('supabase_access_token');
    window.localStorage.removeItem('supabase_refresh_token');
    const key = getProjectStorageKey();
    if (key) {
      window.localStorage.removeItem(key);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cakeflow:auth-cleared'));
    }
  } catch {
    // noop
  }
};

const readSessionToken = (session, tokenKey) => {
  if (!session || typeof session !== 'object') return null;

  const direct = session[tokenKey];
  if (typeof direct === 'string' && direct.length > 10) return direct;

  const currentSession = session.currentSession?.[tokenKey];
  if (typeof currentSession === 'string' && currentSession.length > 10) return currentSession;

  const nestedSession = session.session?.[tokenKey];
  if (typeof nestedSession === 'string' && nestedSession.length > 10) return nestedSession;

  if (Array.isArray(session) && session.length > 0) {
    return readSessionToken(session[0], tokenKey);
  }

  return null;
};

const getStoredAccessToken = () => {
  try {
    const fromCustomStorage = window.localStorage.getItem('supabase_access_token');
    if (isJwtLike(fromCustomStorage)) {
      return fromCustomStorage;
    }

    const session = getStoredSession();
    const fromSession = readSessionToken(session, 'access_token');
    if (isJwtLike(fromSession)) return fromSession;

    return null;
  } catch {
    return null;
  }
};

const getStoredRefreshToken = () => {
  try {
    const fromCustomStorage = window.localStorage.getItem('supabase_refresh_token');
    if (typeof fromCustomStorage === 'string' && fromCustomStorage.length > 10) return fromCustomStorage;

    const session = getStoredSession();
    const fromSession = readSessionToken(session, 'refresh_token');
    if (typeof fromSession === 'string' && fromSession.length > 10) return fromSession;
    return null;
  } catch {
    return null;
  }
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isInvalidJwtMessage = (payload, message) => {
  const serializedPayload =
    typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const text = String(message || '');
  return /invalid\s*jw?t|jwt/i.test(text) || /invalid\s*jw?t|jwt/i.test(serializedPayload);
};

const ensureOk = async (response) => {
  if (response.ok) return;
  const payload = await safeJson(response);
  const message =
    payload?.msg ||
    payload?.message ||
    payload?.error_description ||
    payload?.error ||
    `HTTP ${response.status}`;

  if (response.status === 401 && isInvalidJwtMessage(payload, message)) {
    clearStoredSession();
    const authError = new Error('Sessão expirada. Faça login novamente.');
    authError.status = 401;
    authError.payload = payload;
    throw authError;
  }

  const err = new Error(message);
  err.status = response.status;
  err.payload = payload;
  throw err;
};

const persistSession = (payload) => {
  if (!payload || typeof window === 'undefined') return;
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;

  if (accessToken) {
    window.localStorage.setItem('supabase_access_token', accessToken);
  }

  if (refreshToken) {
    window.localStorage.setItem('supabase_refresh_token', refreshToken);
  }

  const current = getStoredSession() || {};
  setStoredSession({
    ...current,
    ...payload
  });
};

const getTokenExpiry = (token) => {
  const payload = decodeJwtPayload(token);
  return Number(payload?.exp || 0);
};

let refreshPromise = null;

const refreshSession = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) return null;

    const payload = await safeJson(response);
    persistSession(payload);
    return payload?.access_token || null;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const ensureValidAccessToken = async () => {
  const token = getStoredAccessToken();
  if (!token) {
    const refreshedWithoutAccess = await refreshSession();
    return refreshedWithoutAccess || null;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = getTokenExpiry(token);
  // Se nao conseguirmos ler exp, mantemos o token atual e deixamos o backend validar.
  const shouldRefresh = exp > 0 && exp - now < 60;

  if (!shouldRefresh) return token;

  const refreshed = await refreshSession();
  if (refreshed) return refreshed;

  const fallbackToken = getStoredAccessToken();
  const fallbackExp = getTokenExpiry(fallbackToken);
  const isFallbackExpired = fallbackExp > 0 && fallbackExp <= now;

  if (isFallbackExpired || !fallbackToken) {
    clearStoredSession();
    return null;
  }

  return fallbackToken;
};

const buildAuthHeaders = async (extra = {}) => {
  const token = await ensureValidAccessToken();
  const headers = {
    apikey: supabaseAnonKey || '',
    ...extra
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const requestRest = async ({ table, method = 'GET', query = '', body = null, prefer = null, asAnon = false }) => {
  const url = `${supabaseUrl}/rest/v1/${table}${query}`;
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json'
  });
  if (asAnon) {
    delete headers.Authorization;
  }

  const isWriteOperation = method !== 'GET';
  const PUBLIC_ANON_INSERT_TABLES = new Set(['pedidos', 'acessos_catalogo']);
  const isPublicAnonInsert =
    method === 'POST' &&
    !headers.Authorization &&
    PUBLIC_ANON_INSERT_TABLES.has(table);

  if (isWriteOperation && !headers.Authorization && !isPublicAnonInsert) {
    const error = new Error('Sessão expirada. Faça login novamente para salvar alterações.');
    error.status = 401;
    throw error;
  }

  if (prefer) headers.Prefer = prefer;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  await ensureOk(response);
  return safeJson(response);
};

const requestFunction = async (name, payload) => {
  let response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: await buildAuthHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(payload || {})
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: await buildAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload || {})
      });
    }
  }

  await ensureOk(response);
  return safeJson(response);
};

const requestPublicFunction = async (name, payload) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  await ensureOk(response);
  return safeJson(response);
};

const requestRpc = async (name, payload, options = {}) => {
  const asAnon = options?.asAnon === true;
  const headers = asAnon
    ? {
        apikey: supabaseAnonKey || '',
        'Content-Type': 'application/json'
      }
    : await buildAuthHeaders({
        'Content-Type': 'application/json'
      });

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {})
  });

  await ensureOk(response);
  return safeJson(response);
};

const buildFilterQuery = (filters = {}) => {
  const params = new URLSearchParams();
  params.set('select', '*');

  Object.entries(filters).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$in' in value && Array.isArray(value.$in)) {
        const joined = value.$in.map((item) => `"${String(item)}"`).join(',');
        params.set(key, `in.(${joined})`);
      }
      return;
    }
    params.set(key, `eq.${encodeValue(value)}`);
  });

  return params;
};

const buildOrder = (params, order) => {
  if (!order || typeof order !== 'string') return;
  const desc = order.startsWith('-');
  const column = desc ? order.slice(1) : order;
  if (!column) return;
  params.set('order', `${column}.${desc ? 'desc' : 'asc'}`);
};

const normalizeEntityPayload = (table, payload) => {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeEntityPayload(table, item));
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (table === 'produtos') {
    const mapped = { ...payload };
    if ('foto_url' in mapped) {
      if (!('imagem_url' in mapped)) {
        mapped.imagem_url = mapped.foto_url || null;
      }
      delete mapped.foto_url;
    }
    return mapped;
  }

  if (table === 'contas_receber' || table === 'contas_pagar') {
    const mapped = { ...payload };

    if ('amount' in mapped && !('valor' in mapped)) {
      mapped.valor = mapped.amount;
    }
    if ('valor' in mapped && !('amount' in mapped)) {
      mapped.amount = mapped.valor;
    }

    if ('date' in mapped && !('data_vencimento' in mapped)) {
      mapped.data_vencimento = mapped.date;
    }
    if ('data_vencimento' in mapped && !('date' in mapped)) {
      mapped.date = mapped.data_vencimento;
    }

    return mapped;
  }

  if (table === 'acessos_catalogo') {
    const mapped = { ...payload };

    if ('referrer' in mapped && !('origem' in mapped)) {
      mapped.origem = mapped.referrer;
    }
    if ('origem' in mapped && !('referrer' in mapped)) {
      mapped.referrer = mapped.origem;
    }

    return mapped;
  }

  return payload;
};

const normalizeEntityRow = (table, row) => {
  if (Array.isArray(row)) {
    return row.map((item) => normalizeEntityRow(table, item));
  }

  if (!row || typeof row !== 'object') {
    return row;
  }

  if (table === 'produtos') {
    return {
      ...row,
      foto_url: row.foto_url || row.imagem_url || ''
    };
  }

  if (table === 'contas_receber' || table === 'contas_pagar') {
    return {
      ...row,
      valor: row.valor ?? row.amount ?? 0,
      amount: row.amount ?? row.valor ?? 0,
      data_vencimento: row.data_vencimento || row.date || null,
      date: row.date || row.data_vencimento || null
    };
  }

  if (table === 'acessos_catalogo') {
    return {
      ...row,
      referrer: row.referrer || row.origem || null,
      origem: row.origem || row.referrer || null
    };
  }

  return row;
};

const entityApi = (entityName) => {
  const table = resolveTable(entityName);

  return {
    async list() {
      const data = (await requestRest({ table, query: '?select=*' })) || [];
      return normalizeEntityRow(table, data);
    },

    async filter(filters = {}, order = null) {
      const params = buildFilterQuery(filters);
      buildOrder(params, order);
      const data = (await requestRest({ table, query: `?${params.toString()}` })) || [];
      return normalizeEntityRow(table, data);
    },

    async create(payload, options = {}) {
      const isAnon = options?.asAnon === true;
      const data = await requestRest({
        table,
        method: 'POST',
        body: normalizeEntityPayload(table, payload),
        prefer: isAnon ? 'return=minimal' : 'return=representation',
        asAnon: isAnon
      });
      if (isAnon) return data ?? { success: true };
      return normalizeEntityRow(table, Array.isArray(data) ? data[0] : data);
    },

    async bulkCreate(payloads, options = {}) {
      const isAnon = options?.asAnon === true;
      const data = (await requestRest({
        table,
        method: 'POST',
        body: normalizeEntityPayload(table, payloads),
        prefer: isAnon ? 'return=minimal' : 'return=representation',
        asAnon: isAnon
      })) || [];
      if (isAnon) return data;
      return normalizeEntityRow(table, data);
    },

    async update(id, payload) {
      const data = await requestRest({
        table,
        method: 'PATCH',
        query: `?id=eq.${encodeValue(id)}`,
        body: normalizeEntityPayload(table, payload),
        prefer: 'return=representation'
      });
      return normalizeEntityRow(table, Array.isArray(data) ? data[0] : data);
    },

    async delete(id) {
      await requestRest({
        table,
        method: 'DELETE',
        query: `?id=eq.${encodeValue(id)}`
      });
      return { success: true };
    }
  };
};

const entitiesProxy = new Proxy(
  {},
  {
    get(_, entityName) {
      return entityApi(String(entityName));
    }
  }
);

const authApi = {
  completeAuthCallback() {
    saveAuthSessionFromUrl();
  },

  async signInWithPassword({ email, password }) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    await ensureOk(response);
    const payload = await safeJson(response);
    persistSession(payload);
    return payload;
  },

  async signUpWithPassword({ email, password, fullName }) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          data: fullName ? { full_name: fullName } : undefined
        })
      });

      await ensureOk(response);
      const payload = await safeJson(response);
      persistSession(payload);
      return payload;
    } catch (error) {
      const code = error?.payload?.error_code;
      if (code !== 'over_email_send_rate_limit') {
        throw error;
      }

      await requestPublicFunction('registerUser', {
        email,
        password,
        full_name: fullName || null
      });

      return this.signInWithPassword({ email, password });
    }
  },

  async me() {
    const accessToken = await ensureValidAccessToken();
    const tokenPayload = decodeJwtPayload(accessToken);
    const userId = tokenPayload?.sub;
    if (!userId) throw new Error('Unauthorized');

    const user = {
      id: userId,
      email: tokenPayload?.email || null,
      user_metadata: tokenPayload?.user_metadata || {}
    };

    let profile = null;
    try {
      const profiles = await requestRest({
        table: 'profiles',
        query: `?select=*&id=eq.${encodeValue(user.id)}`
      });

      profile = Array.isArray(profiles) ? profiles[0] : profiles;
    } catch (error) {
      // Falha no perfil não deve derrubar sessão autenticada.
      console.warn('[supabase] Falha ao ler perfil, seguindo com user_metadata:', error);
    }

    if (!profile) {
      try {
        const ensured = await requestRest({
          table: 'profiles',
          method: 'POST',
          body: {
            id: user.id,
            email: user.email || null,
            full_name: user.user_metadata?.full_name || null
          },
          prefer: 'resolution=merge-duplicates,return=representation'
        });
        profile = Array.isArray(ensured) ? ensured[0] : ensured;
      } catch (error) {
        console.warn('[supabase] Falha ao criar/atualizar perfil automaticamente:', error);
      }
    } else {
      const metadataConfeitariaId = user.user_metadata?.confeitaria_id || null;
      const needsConfeitariaSync = !profile.confeitaria_id && !!metadataConfeitariaId;

      if (needsConfeitariaSync) {
        try {
          const ensured = await requestRest({
            table: 'profiles',
            method: 'POST',
            body: {
              id: user.id,
              confeitaria_id: metadataConfeitariaId,
              email: profile.email || user.email || null,
              full_name: profile.full_name || user.user_metadata?.full_name || null
            },
            prefer: 'resolution=merge-duplicates,return=representation'
          });
          profile = Array.isArray(ensured) ? ensured[0] : ensured;
        } catch (error) {
          console.warn('[supabase] Falha ao sincronizar confeitaria_id no perfil:', error);
        }
      }
    }

    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      role: profile?.role || user.user_metadata?.role || 'user',
      confeitaria_id: profile?.confeitaria_id || user.user_metadata?.confeitaria_id || null,
      onboarding_etapas_concluidas:
        profile?.onboarding_etapas_concluidas || user.user_metadata?.onboarding_etapas_concluidas || [],
      onboarding_finalizado:
        profile?.onboarding_finalizado ?? user.user_metadata?.onboarding_finalizado ?? false,
      onboarding_ocultar_dashboard:
        profile?.onboarding_ocultar_dashboard ?? user.user_metadata?.onboarding_ocultar_dashboard ?? false
    };
  },

  async updateMe(payload) {
    const current = await this.me();
    const data = await requestRest({
      table: 'profiles',
      method: 'POST',
      body: { id: current.id, ...payload },
      prefer: 'resolution=merge-duplicates,return=representation'
    });
    return Array.isArray(data) ? data[0] : data;
  },

  async updateAccount(payload = {}) {
    const nextEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
    const nextPassword = typeof payload.password === 'string' ? payload.password : '';
    const updatePayload = {};

    if (nextEmail) {
      updatePayload.email = nextEmail;
    }

    if (nextPassword) {
      updatePayload.password = nextPassword;
    }

    if (!Object.keys(updatePayload).length) {
      throw new Error('Informe ao menos um campo para atualizar.');
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: await buildAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(updatePayload)
    });

    await ensureOk(response);
    return safeJson(response);
  },

  async logout(redirectTo) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: await buildAuthHeaders()
      });
    } finally {
      clearStoredSession();
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    }
  },

  signInWithGoogle(returnTo) {
    const redirect = toAbsoluteInternalUrl(returnTo);
    const callbackUrl = new URL(getSafeAuthCallbackUrl());
    callbackUrl.searchParams.set('redirect', redirect);

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', 'google');
    authorizeUrl.searchParams.set('redirect_to', callbackUrl.toString());

    window.location.href = authorizeUrl.toString();
  },

  redirectToLogin(returnTo) {
    const redirect = toAbsoluteInternalUrl(returnTo);
    const authPath = new URL(`${window.location.origin}/auth`);
    authPath.searchParams.set('redirect', redirect);
    authPath.searchParams.set('mode', 'login');
    window.location.href = authPath.toString();
  }
};

const functionsApi = {
  async invoke(name, payload) {
    const data = await requestFunction(name, payload);
    return { data };
  },

  async invokeRpc(name, payload) {
    const data = await requestRpc(name, payload);
    return { data };
  },

  async invokePublicRpc(name, payload) {
    const data = await requestRpc(name, payload, { asAnon: true });
    return { data };
  }
};

const integrationsApi = {
  Core: {
    async UploadFile({ file }) {
      const extension = file?.name?.includes('.') ? file.name.split('.').pop() : 'bin';
      const fileName = `${crypto.randomUUID()}.${extension}`;
      const filePath = `uploads/${fileName}`;
      const candidateBuckets = [...new Set([storageBucket, 'public', 'uploads', 'images'].filter(Boolean))];

      let lastError = null;

      for (const bucket of candidateBuckets) {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`, {
          method: 'POST',
          headers: await buildAuthHeaders({
            'x-upsert': 'false'
          }),
          body: file
        });

        if (response.ok) {
          return {
            file_url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`
          };
        }

        const payload = await safeJson(response);
        const message =
          payload?.message ||
          payload?.error ||
          payload?.msg ||
          `HTTP ${response.status}`;

        const bucketNotFound =
          /bucket\s+not\s+found/i.test(String(message)) ||
          (Number(response.status) === 404 && /bucket/i.test(String(message)));

        if (bucketNotFound) {
          lastError = new Error(message);
          continue;
        }

        const err = new Error(message);
        err.status = response.status;
        err.payload = payload;
        throw err;
      }

      if (lastError) {
        throw new Error(
          'Bucket de imagens não encontrado no Supabase. Execute as migrations para criar o bucket `public`.'
        );
      }

      throw new Error('Não foi possível enviar o arquivo para o Supabase Storage.');
    }
  }
};

const appLogsApi = {
  async logUserInApp(pageName) {
    const user = await authApi.me();
    await requestRest({
      table: 'app_logs',
      method: 'POST',
      body: {
        user_id: user.id,
        page_name: pageName,
        occurred_at: new Date().toISOString()
      }
    });
  }
};

export const createSupabaseCompatClient = () => ({
  auth: authApi,
  entities: entitiesProxy,
  functions: functionsApi,
  integrations: integrationsApi,
  appLogs: appLogsApi,
  asServiceRole: {
    entities: entitiesProxy,
    integrations: integrationsApi
  }
});
