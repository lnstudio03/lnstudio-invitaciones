import { api, ApiError } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const state = {
  eventId: null,
  event: null,
  client: null,
  user: null,
  profile: null,
  members: [],
  rsvps: [],
  passes: [],
  checkins: [],
  currentToken: null,
  currentData: null,
  stream: null,
  detector: null,
  scanning: false
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", stopCamera);

async function init() {
  const params = new URLSearchParams(location.search);
  state.eventId = params.get("event");
  const token = extractToken(params.get("token") || "");

  const session = await api.getSession();
  if (!session) return location.replace(`admin.html?return=${encodeURIComponent(location.href)}`);

  state.user = await api.getUser();
  bind();

  // Compatibilidad con pases creados antes de v4.1: el token permite resolver
  // el evento, pero solo cuando la cuenta autenticada tiene permiso de escaneo.
  if (!state.eventId && token) {
    try {
      const resolved = await api.rpc("lookup_access_pass", { p_token: token, p_event_id: null });
      state.eventId = resolved?.event?.id || null;
      if (state.eventId) history.replaceState({}, document.title, `scanner.html?event=${encodeURIComponent(state.eventId)}&token=${encodeURIComponent(token)}`);
    } catch (error) { return fail(errorMessage(error)); }
  }

  if (!state.eventId) return fail("Este escáner debe abrirse desde un evento específico. Regresa al dashboard y pulsa ‘Escáner’ dentro del evento.");

  await loadEvent();
  if (token && state.event) await lookup(token);
}

function bind() {
  $("#manual-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const credential = extractToken(new FormData(event.currentTarget).get("token"));
    if (credential) await lookup(credential);
  });
  $("[data-start-camera]").addEventListener("click", startCamera);
  $("[data-stop-camera]").addEventListener("click", stopCamera);
  $("[data-approve]").addEventListener("click", () => processDecision("approved"));
  $("[data-reject]").addEventListener("click", () => processDecision("rejected"));
  $("[data-refresh]").addEventListener("click", loadStats);
  $("[data-logout]").addEventListener("click", async () => { await api.signOut(); location.replace("admin.html"); });
}

async function loadEvent() {
  setPageStatus("Validando acceso al evento…", "loading");
  try {
    const [profiles, events, members] = await Promise.all([
      api.select("profiles", { filters: { id: state.user.id }, limit: 1 }),
      api.select("events", { filters: { id: state.eventId }, limit: 1 }),
      api.select("event_members", { filters: { event_id: state.eventId }, order: "created_at.desc" })
    ]);

    state.profile = profiles?.[0] || null;
    state.event = events?.[0] || null;
    state.members = members || [];
    if (!state.event) throw new Error("No tienes acceso a este evento o el evento fue eliminado.");

    const membership = state.members.find((member) => member.user_id === state.user.id || member.email?.toLowerCase() === state.user.email?.toLowerCase());
    const globalAdmin = ["owner", "staff"].includes(state.profile?.global_role);
    const canScan = globalAdmin || (membership?.active && ["client_admin", "event_staff"].includes(membership.role));
    if (!canScan) throw new Error("Tu cuenta puede consultar el evento, pero no tiene permiso para usar el escáner.");

    if (state.event.client_id) state.client = (await api.select("clients", { filters: { id: state.event.client_id }, limit: 1 }))?.[0] || null;

    $("[data-event-client]").textContent = state.client?.business_name || "Evento privado";
    $("[data-event-name]").textContent = state.event.name;
    $("[data-event-date]").textContent = formatDate(state.event.event_date);
    $("[data-event-admin]").href = `evento-admin.html?id=${encodeURIComponent(state.eventId)}`;
    $("[data-guests-link]").href = `evento-admin.html?id=${encodeURIComponent(state.eventId)}&tab=rsvp`;
    document.title = `Escáner · ${state.event.name} | LN Studio`;

    await loadStats();
    setPageStatus("", "info");
  } catch (error) {
    fail(errorMessage(error));
    disableScanner();
  }
}

async function loadStats() {
  if (!state.event) return;
  status("Actualizando control del evento…");
  try {
    const [rsvps, passes, checkins] = await Promise.all([
      api.select("rsvp_responses", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("access_passes", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("checkins", { filters: { event_id: state.eventId }, order: "created_at.desc" })
    ]);
    state.rsvps = rsvps || [];
    state.passes = passes || [];
    state.checkins = checkins || [];

    const confirmed = state.rsvps.filter((item) => item.attendance === "confirmed").reduce((sum, item) => sum + Number(item.party_size || 0), 0);
    const checked = state.checkins.filter((item) => item.decision === "approved").reduce((sum, item) => sum + Number(item.entries || 0), 0);
    $("[data-confirmed]").textContent = String(confirmed);
    $("[data-passes]").textContent = String(state.passes.length);
    $("[data-checked]").textContent = String(checked);
    $("[data-remaining-event]").textContent = String(Math.max(confirmed - checked, 0));
    renderLatest();
    status("");
  } catch (error) { status(errorMessage(error)); }
}

function renderLatest() {
  const passMap = new Map(state.passes.map((pass) => [pass.id, pass]));
  $("[data-latest-checkins]").innerHTML = state.checkins.slice(0, 8).map((item) => {
    const pass = passMap.get(item.pass_id);
    const label = item.decision === "approved" ? `${Number(item.entries || 0)} persona(s) ingresaron` : "Acceso rechazado";
    return `<article class="member-row"><div><strong>${esc(pass?.folio || "Pase")}</strong><small>${esc(formatDate(item.created_at))}</small></div><span>${esc(label)}</span></article>`;
  }).join("") || '<div class="empty-state">Todavía no hay accesos registrados.</div>';
}

async function startCamera() {
  if (!("BarcodeDetector" in window)) return status("Este navegador no permite escanear directamente. Usa Chrome Android actualizado o pega el token manualmente.");
  if (!navigator.mediaDevices?.getUserMedia) return status("No se encontró acceso a la cámara. Usa el campo manual.");
  try {
    state.detector = new BarcodeDetector({ formats: ["qr_code"] });
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const video = $("[data-video]");
    video.srcObject = state.stream; video.hidden = false; $("[data-camera-placeholder]").hidden = true; await video.play();
    state.scanning = true; $("[data-stop-camera]").hidden = false; $("[data-start-camera]").hidden = true;
    status("Apunta la cámara al código QR.");
    scanFrame();
  } catch (error) { status(`No fue posible abrir la cámara: ${error.message}`); stopCamera(); }
}

async function scanFrame() {
  if (!state.scanning || !state.detector) return;
  try {
    const codes = await state.detector.detect($("[data-video]"));
    const raw = codes?.[0]?.rawValue;
    if (raw) {
      state.scanning = false;
      await lookup(extractToken(raw));
      setTimeout(() => { if (state.stream) { state.scanning = true; scanFrame(); } }, 1800);
      return;
    }
  } catch { /* Se reintenta. */ }
  requestAnimationFrame(scanFrame);
}

function stopCamera() {
  state.scanning = false;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  const video = $("[data-video]");
  if (video) { video.pause(); video.srcObject = null; video.hidden = true; }
  if ($("[data-camera-placeholder]")) $("[data-camera-placeholder]").hidden = false;
  if ($("[data-stop-camera]")) $("[data-stop-camera]").hidden = true;
  if ($("[data-start-camera]")) $("[data-start-camera]").hidden = false;
}

async function lookup(credential) {
  if (!credential) return status("Escribe, pega o escanea un pase.");
  state.currentData = null;
  status("Consultando pase…");
  try {
    const token = await resolvePassToken(credential);
    if (!token) {
      state.currentToken = null;
      return show(false, "Pase no encontrado", "No se encontró un pase de este evento con ese folio o código.");
    }
    state.currentToken = token;
    const result = await api.rpc("lookup_access_pass", { p_token: token, p_event_id: state.eventId });
    state.currentData = result;
    if (!result?.ok) return show(false, "Código no válido", result?.message || "No se encontró el pase para este evento.");

    const pass = result.pass;
    const remaining = Number(result.remaining || 0);
    $("[data-folio]").textContent = pass.folio;
    $("[data-remaining]").textContent = `${remaining} de ${pass.allowed_entries}`;
    $("[data-result-event]").textContent = result.event?.name || state.event.name;
    $("[data-phone]").textContent = result.guest?.phone || "—";
    const entries = $("[data-entries]");
    entries.max = Math.max(remaining, 1); entries.value = Math.max(Math.min(remaining, 1), 1);
    const valid = pass.status === "active" && remaining > 0;
    show(valid, result.guest?.name || "Pase digital", pass.status === "completed" ? "Este pase ya fue utilizado por completo." : pass.status === "cancelled" ? "Este pase fue cancelado." : `${remaining} acceso(s) disponible(s).`);
  } catch (error) { show(false, "No fue posible validar", errorMessage(error)); }
}

function show(valid, title, message) {
  $("[data-result]").hidden = false;
  $("[data-result-state]").textContent = valid ? "Pase válido" : "Revisión requerida";
  $("[data-result-title]").textContent = title;
  $("[data-result-message]").textContent = message;
  $("[data-approve]").disabled = !valid;
  status("");
}

async function processDecision(decision) {
  if (!state.currentToken) return;
  const button = decision === "approved" ? $("[data-approve]") : $("[data-reject]");
  button.disabled = true; status("Registrando decisión…");
  try {
    const result = await api.rpc("process_checkin", {
      p_token: state.currentToken,
      p_entries: Number($("[data-entries]").value || 1),
      p_decision: decision,
      p_reason: $("[data-reason]").value || null,
      p_device: navigator.userAgent,
      p_event_id: state.eventId
    });
    status(result?.message || "Operación registrada.");
    await Promise.all([lookup(state.currentToken), loadStats()]);
  } catch (error) { status(errorMessage(error)); button.disabled = false; }
}

function disableScanner() {
  $("[data-start-camera]").disabled = true;
  $("#manual-form button").disabled = true;
  $("#manual-form input").disabled = true;
}
function extractToken(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return decodeURIComponent(url.searchParams.get("token") || url.searchParams.get("folio") || url.pathname.split("/").filter(Boolean).pop() || "").trim();
  } catch {
    return decodeURIComponent(text.replace(/^.*(?:token|folio)=/i, "").split("&")[0]).trim();
  }
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value).trim());
}

async function resolvePassToken(value = "") {
  const credential = extractToken(value);
  if (!credential) return null;
  if (isUuid(credential)) return credential;

  const normalizedFolio = credential.toUpperCase().replace(/\s+/g, "");
  let pass = state.passes.find((item) => String(item.folio || "").toUpperCase().replace(/\s+/g, "") === normalizedFolio);

  if (!pass && state.eventId) {
    try {
      const matches = await api.select("access_passes", {
        filters: { event_id: state.eventId, folio: credential },
        limit: 1
      });
      pass = matches?.[0] || null;
    } catch { /* Se mostrará un mensaje amistoso abajo. */ }
  }

  return pass?.token && isUuid(pass.token) ? pass.token : null;
}

function status(message) { $("#scan-status").textContent = message; }
function setPageStatus(message, type) { const node = $("[data-page-status]"); node.hidden = !message; node.dataset.type = type; node.textContent = message; }
function fail(message) { setPageStatus(message, "error"); }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "Error inesperado."; }
function formatDate(value) { if (!value) return "Fecha pendiente"; try { return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
