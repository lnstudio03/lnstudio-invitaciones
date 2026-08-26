/**
 * LN Studio · Cliente HTTP mínimo para Supabase.
 * No depende de CDNs ni expone claves secretas.
 * La publishable key es pública; la seguridad depende de Auth + RLS.
 */
export const SUPABASE_CONFIG = Object.freeze({
  url: "https://kdaxxmszehjwcqpuzkki.supabase.co",
  publishableKey: "sb_publishable_UpGMapFj20qOKGOCxg1GsQ_PqPrXZXr"
});

const SESSION_KEY = "lnstudio.supabase.session.v4";
const isLocalTest = typeof location !== "undefined"
  && ["localhost", "127.0.0.1"].includes(location.hostname);
const baseUrl = isLocalTest ? `${location.origin}/mock-api` : SUPABASE_CONFIG.url;

class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message || "Error de conexión");
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function normalizeSession(payload) {
  if (!payload?.access_token) return null;
  const expiresIn = Number(payload.expires_in || 3600);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    token_type: payload.token_type || "bearer",
    expires_in: expiresIn,
    expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + expiresIn,
    user: payload.user || null
  };
}

function parseHashSession() {
  if (typeof location === "undefined" || !location.hash.includes("access_token=")) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const session = normalizeSession({
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
    token_type: params.get("token_type")
  });
  if (session) {
    saveSession(session);
    history.replaceState({}, document.title, `${location.pathname}${location.search}`);
  }
  return session;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Error ${response.status}`;
    throw new ApiError(message, response.status, data);
  }
  return data;
}

function apiHeaders(session, extra = {}) {
  const headers = {
    apikey: SUPABASE_CONFIG.publishableKey,
    "Content-Type": "application/json",
    ...extra
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function rawFetch(path, options = {}, session = null) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: apiHeaders(session, options.headers || {})
  });
  return parseResponse(response);
}

async function refreshSession() {
  const current = readSession();
  if (!current?.refresh_token) {
    saveSession(null);
    return null;
  }
  try {
    const data = await rawFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    const next = normalizeSession(data);
    saveSession(next);
    return next;
  } catch {
    saveSession(null);
    return null;
  }
}

async function getValidSession() {
  let session = parseHashSession() || readSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at - now < 60) session = await refreshSession();
  return session;
}

function encodeQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
    else query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function dbRequest(table, { method = "GET", query = {}, body, prefer, single = false } = {}) {
  const session = await getValidSession();
  const headers = {};
  if (prefer) headers.Prefer = prefer;
  if (single) headers.Accept = "application/vnd.pgrst.object+json";
  return rawFetch(`/rest/v1/${table}${encodeQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }, session);
}

export const api = {
  isConfigured() {
    return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey);
  },

  async signInWithPassword(email, password) {
    const data = await rawFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password: String(password) })
    });
    const session = normalizeSession(data);
    saveSession(session);
    return session;
  },

  async signUp(email, password) {
    return rawFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        data: { source: "lnstudio_portal" }
      })
    });
  },

  async sendPasswordRecovery(email) {
    const redirectTo = `${location.origin}${location.pathname}?recovery=1`;
    return rawFetch(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      body: JSON.stringify({ email: String(email).trim().toLowerCase() })
    });
  },

  async updatePassword(password) {
    const session = await getValidSession();
    if (!session) throw new ApiError("La sesión de recuperación ya no es válida.", 401);
    const data = await rawFetch("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ password: String(password) })
    }, session);
    return data;
  },

  async getSession() {
    return getValidSession();
  },

  async getUser() {
    const session = await getValidSession();
    if (!session) return null;
    if (session.user?.id) return session.user;
    const user = await rawFetch("/auth/v1/user", { method: "GET" }, session);
    session.user = user;
    saveSession(session);
    return user;
  },

  async signOut() {
    const session = await getValidSession();
    try {
      if (session) await rawFetch("/auth/v1/logout", { method: "POST" }, session);
    } catch { /* La sesión local se elimina aunque la red falle. */ }
    saveSession(null);
  },

  async select(table, { select = "*", filters = {}, order, limit, single = false } = {}) {
    const query = { select };
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      query[key] = String(value).startsWith("eq.") || String(value).startsWith("in.") || String(value).startsWith("is.")
        ? value : `eq.${value}`;
    });
    if (order) query.order = order;
    if (limit) query.limit = limit;
    return dbRequest(table, { query, single });
  },

  async insert(table, rows, { onConflict, upsert = false, returning = true } = {}) {
    const query = onConflict ? { on_conflict: onConflict } : {};
    const prefer = `${upsert ? "resolution=merge-duplicates," : ""}${returning ? "return=representation" : "return=minimal"}`;
    return dbRequest(table, { method: "POST", query, body: rows, prefer });
  },

  async update(table, values, filters = {}) {
    const query = {};
    Object.entries(filters).forEach(([key, value]) => { query[key] = `eq.${value}`; });
    return dbRequest(table, { method: "PATCH", query, body: values, prefer: "return=representation" });
  },

  async remove(table, filters = {}) {
    const query = {};
    Object.entries(filters).forEach(([key, value]) => { query[key] = `eq.${value}`; });
    return dbRequest(table, { method: "DELETE", query, prefer: "return=representation" });
  },

  async rpc(name, args = {}, { publicCall = false } = {}) {
    const session = publicCall ? null : await getValidSession();
    return rawFetch(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args)
    }, session);
  },

  async invokeFunction(name, body = {}) {
    const session = await getValidSession();
    if (!session) throw new ApiError("Debes iniciar sesión para realizar esta acción.", 401);
    return rawFetch(`/functions/v1/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify(body)
    }, session);
  },

  async uploadFile(bucket, path, file, { upsert = true, cacheControl = "3600" } = {}) {
    const session = await getValidSession();
    if (!session) throw new ApiError("Debes iniciar sesión para subir archivos.", 401);
    if (!(file instanceof Blob)) throw new ApiError("El archivo seleccionado no es válido.");
    const cleanBucket = encodeURIComponent(String(bucket || "").trim());
    const cleanPath = String(path || "").split("/").map((part) => encodeURIComponent(part)).join("/");
    const response = await fetch(`${baseUrl}/storage/v1/object/${cleanBucket}/${cleanPath}`, {
      method: "POST",
      headers: apiHeaders(session, {
        "Content-Type": file.type || "application/octet-stream",
        "cache-control": cacheControl,
        "x-upsert": String(Boolean(upsert))
      }),
      body: file
    });
    return parseResponse(response);
  },

  async uploadPublicFile(bucket, path, file) {
    if (!(file instanceof Blob)) throw new ApiError("El archivo seleccionado no es válido.");
    const cleanBucket = encodeURIComponent(String(bucket || "").trim());
    const cleanPath = String(path || "").split("/").map((part) => encodeURIComponent(part)).join("/");
    const response = await fetch(`${baseUrl}/storage/v1/object/${cleanBucket}/${cleanPath}`, {
      method: "POST",
      headers: apiHeaders(null, { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
      body: file
    });
    return parseResponse(response);
  },

  async removeFile(bucket, paths = []) {
    const session = await getValidSession();
    if (!session) throw new ApiError("Debes iniciar sesión para eliminar archivos.", 401);
    const list = Array.isArray(paths) ? paths : [paths];
    return rawFetch(`/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: list.filter(Boolean) })
    }, session);
  },

  getPublicFileUrl(bucket, path) {
    const cleanBucket = encodeURIComponent(String(bucket || "").trim());
    const cleanPath = String(path || "").split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
  }
};

export { ApiError };
