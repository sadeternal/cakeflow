const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';
const supabaseAuthRedirectUrl = import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL;

const SUPABASE_PLACEHOLDER_VALUES = new Set(['...', 'SEU-PROJETO', 'SUA_ANON_KEY', 'SEU_PROJECT_REF']);

const hasPlaceholder = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (SUPABASE_PLACEHOLDER_VALUES.has(normalized)) return true;
  return normalized.includes('SEU-PROJETO') || normalized.includes('SUA_ANON_KEY') || normalized === '...';
};

const getSupabaseConfigStatus = () => {
  const issues = [];
  const normalizedUrl = String(supabaseUrl || '').trim();
  const normalizedAnonKey = String(supabaseAnonKey || '').trim();

  if (!normalizedUrl || hasPlaceholder(normalizedUrl)) {
    issues.push('Defina `VITE_SUPABASE_URL` com a URL real do projeto Supabase.');
  } else {
    try {
      const parsedUrl = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        issues.push('`VITE_SUPABASE_URL` precisa começar com `http://` ou `https://`.');
      }
    } catch {
      issues.push('`VITE_SUPABASE_URL` não é uma URL válida.');
    }
  }

  if (!normalizedAnonKey || hasPlaceholder(normalizedAnonKey)) {
    issues.push('Defina `VITE_SUPABASE_ANON_KEY` com a anon key real do projeto.');
  }

  return {
    isConfigured: issues.length === 0,
    issues
  };
};

const getSupabaseConfigError = () => {
  const status = getSupabaseConfigStatus();
  if (status.isConfigured) return null;

  const err = new Error(`Supabase não configurado no ambiente local. ${status.issues.join(' ')}`);
  err.code = 'supabase_config_missing';
  err.status = 503;
  err.details = status;
  return err;
};

const assertSupabaseConfigured = () => {
  const error = getSupabaseConfigError();
  if (error) throw error;
};

if (!getSupabaseConfigStatus().isConfigured) {
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
  DiaBloqueado: 'dias_bloqueados',
  SystemNotification: 'system_notifications',
  SystemNotificationRead: 'system_notification_reads',
  PedidoNotificationRead: 'pedido_notification_reads',
  ParcelamentoPedido: 'parcelamento_pedidos',
  TermsAcceptance: 'terms_acceptances',
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

const isTokenFromCurrentProject = (token) => {
  if (!isJwtLike(token)) return false;

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') return false;
  const issuer = payload?.iss;
  if (typeof issuer !== 'string' || !issuer) return false;

  try {
    const issuerHost = new URL(issuer).hostname;
    const projectHost = new URL(supabaseUrl).hostname;
    return issuerHost === projectHost;
  } catch {
    return true;
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
    const session = getStoredSession();
    const fromSession = readSessionToken(session, 'access_token');
    if (isJwtLike(fromSession) && isTokenFromCurrentProject(fromSession)) return fromSession;

    const fromCustomStorage = window.localStorage.getItem('supabase_access_token');
    if (isJwtLike(fromCustomStorage) && isTokenFromCurrentProject(fromCustomStorage)) {
      return fromCustomStorage;
    }

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

const ensureOk = async (response) => {
  if (response.ok) return;
  const payload = await safeJson(response);
  const message =
    payload?.msg ||
    payload?.message ||
    payload?.error_description ||
    payload?.error ||
    `HTTP ${response.status}`;

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

  const tokenPayload = decodeJwtPayload(token);
  if (!tokenPayload) {
    const refreshedMalformed = await refreshSession();
    if (refreshedMalformed) return refreshedMalformed;
    clearStoredSession();
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(tokenPayload?.exp || 0);
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

const validateAccessTokenWithAuthApi = async (token) => {
  assertSupabaseConfigured();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey || '',
      Authorization: `Bearer ${token}`
    }
  });

  if (response.ok) {
    return safeJson(response);
  }

  if (response.status === 401 || response.status === 403) {
    const err = new Error('Unauthorized');
    err.status = 401;
    err.payload = await safeJson(response);
    throw err;
  }

  await ensureOk(response);
  return null;
};

const buildAuthHeaders = async (extra = {}) => {
  assertSupabaseConfigured();
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
  assertSupabaseConfigured();
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
  assertSupabaseConfigured();
  const getFunctionHeaders = async () => {
    let token = await ensureValidAccessToken();
    if (!token) {
      const err = new Error('Sessão expirada. Faça login novamente.');
      err.status = 401;
      throw err;
    }

    try {
      await validateAccessTokenWithAuthApi(token);
    } catch (error) {
      if (Number(error?.status) !== 401) throw error;

      const refreshed = await refreshSession();
      if (!refreshed) {
        clearStoredSession();
        const err = new Error('Sessão expirada. Faça login novamente.');
        err.status = 401;
        throw err;
      }

      token = refreshed;
      await validateAccessTokenWithAuthApi(token);
    }

    return {
      apikey: supabaseAnonKey || '',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const headers = await getFunctionHeaders();

  let response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {})
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: await getFunctionHeaders(),
        body: JSON.stringify(payload || {})
      });
    }
  }

  await ensureOk(response);
  return safeJson(response);
};

const requestPublicFunction = async (name, payload) => {
  assertSupabaseConfigured();
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
  assertSupabaseConfigured();
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

const getRealtimeWebsocketUrl = () => {
  const parsed = new URL(supabaseUrl);
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${parsed.host}/realtime/v1/websocket?apikey=${encodeURIComponent(supabaseAnonKey || '')}&vsn=1.0.0`;
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

const realtimeApi = {
  async subscribeToPostgresChanges({ channel, changes = [], onChange, onError }) {
    assertSupabaseConfigured();

    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return () => {};
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error('Informe ao menos uma tabela para assinar no realtime.');
    }

    const token = await ensureValidAccessToken();
    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const topic = `realtime:${channel || `channel-${Date.now()}`}`;
    const socket = new WebSocket(getRealtimeWebsocketUrl());
    let heartbeatTimer = null;
    let ref = 1;

    const nextRef = () => String(ref++);

    const send = (event, payload = {}, targetTopic = topic) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({
        topic: targetTopic,
        event,
        payload,
        ref: nextRef()
      }));
    };

    const cleanup = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    socket.addEventListener('open', () => {
      send('phx_join', {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '' },
          postgres_changes: changes.map((change) => ({
            event: change.event || '*',
            schema: change.schema || 'public',
            table: change.table,
            filter: change.filter
          }))
        },
        access_token: token
      });

      heartbeatTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: nextRef()
          }));
        }
      }, 25000);
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event === 'postgres_changes') {
          onChange?.(payload.payload, payload);
          return;
        }

        if (payload?.event === 'phx_error') {
          onError?.(new Error('Falha na assinatura realtime do Supabase.'));
        }
      } catch (error) {
        onError?.(error);
      }
    });

    socket.addEventListener('error', () => {
      onError?.(new Error('Erro de conexão com o realtime do Supabase.'));
    });

    socket.addEventListener('close', cleanup);

    return () => {
      cleanup();
      if (socket.readyState === WebSocket.OPEN) {
        send('phx_leave', {});
      }
      socket.close();
    };
  }
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
    assertSupabaseConfigured();
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
    assertSupabaseConfigured();
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
    assertSupabaseConfigured();
    let accessToken = await ensureValidAccessToken();
    if (!accessToken) throw new Error('Unauthorized');

    let authUser = null;
    try {
      authUser = await validateAccessTokenWithAuthApi(accessToken);
    } catch (error) {
      if (Number(error?.status) !== 401) throw error;

      const refreshed = await refreshSession();
      if (!refreshed) {
        clearStoredSession();
        throw error;
      }

      accessToken = refreshed;
      authUser = await validateAccessTokenWithAuthApi(accessToken);
    }

    const tokenPayload = decodeJwtPayload(accessToken);
    const user = {
      id: String(authUser?.id || tokenPayload?.sub || ''),
      email: authUser?.email || tokenPayload?.email || null,
      user_metadata: authUser?.user_metadata || tokenPayload?.user_metadata || {}
    };
    if (!user.id) throw new Error('Unauthorized');

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
    assertSupabaseConfigured();
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

  async resetPassword(email) {
    assertSupabaseConfigured();
    const redirectTo = `${window.location.origin}/auth?mode=login`;
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey
      },
      body: JSON.stringify({ email: email.trim(), gotrue_meta_security: {}, redirect_to: redirectTo })
    });
    await ensureOk(response);
  },

  async logout(redirectTo) {
    assertSupabaseConfigured();
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
    assertSupabaseConfigured();
    const redirect = toAbsoluteInternalUrl(returnTo);
    const callbackUrl = new URL(getSafeAuthCallbackUrl());
    callbackUrl.searchParams.set('redirect', redirect);

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', 'google');
    authorizeUrl.searchParams.set('redirect_to', callbackUrl.toString());

    window.location.href = authorizeUrl.toString();
  },

  redirectToLogin(returnTo, options = {}) {
    if (typeof window === 'undefined') return;
    const shouldForce = options?.force === true;

    const redirect = toAbsoluteInternalUrl(returnTo);
    const authPath = new URL(`${window.location.origin}/auth`);
    authPath.searchParams.set('redirect', redirect);
    authPath.searchParams.set('mode', 'login');
    if (shouldForce) {
      authPath.searchParams.set('force', '1');
    }

    const currentUrl = new URL(window.location.href);
    const currentRedirect = new URLSearchParams(currentUrl.search).get('redirect') || '';
    const currentMode = new URLSearchParams(currentUrl.search).get('mode') || '';
    const currentForce = new URLSearchParams(currentUrl.search).get('force') || '';
    const isSameAuthRoute =
      currentUrl.pathname === '/auth' &&
      currentMode === 'login' &&
      currentRedirect === redirect &&
      (shouldForce ? currentForce === '1' : currentForce !== '1');
    if (isSameAuthRoute) return;

    // Evita loop de redirecionamento em sequência quando múltiplos componentes disparam auth_required.
    try {
      const key = 'cakeflow_auth_redirect_ts';
      const now = Date.now();
      const last = Number(window.sessionStorage.getItem(key) || 0);
      if (now - last < 1200) return;
      window.sessionStorage.setItem(key, String(now));
    } catch {
      // noop
    }

    window.location.href = authPath.toString();
  }
};

const functionsApi = {
  async invoke(name, payload) {
    const data = await requestFunction(name, payload);
    return { data };
  },

  async invokePublic(name, payload) {
    const data = await requestPublicFunction(name, payload);
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
  realtime: realtimeApi,
  functions: functionsApi,
  integrations: integrationsApi,
  appLogs: appLogsApi,
  config: {
    getStatus: getSupabaseConfigStatus,
    getError: getSupabaseConfigError
  },
  asServiceRole: {
    entities: entitiesProxy,
    integrations: integrationsApi
  }
});
