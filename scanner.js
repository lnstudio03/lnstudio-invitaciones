import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
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
  scanning: false,
  resultOpen: false,
  outcomeTimer: null,
  lastScannedToken: "",
  lastScannedAt: 0
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

  if (!state.eventId && token) {
    try {
      const resolved = await api.rpc("lookup_access_pass", { p_token: token, p_event_id: null });
      state.eventId = resolved?.event?.id || null;
      if (state.eventId) {
        history.replaceState({}, document.title, `scanner.html?event=${encodeURIComponent(state.eventId)}&token=${encodeURIComponent(token)}`);
      }
    } catch (error) {
      return fail(errorMessage(error));
    }
  }

  if (!state.eventId) {
    return fail("Este escáner debe abrirse desde un evento específico. Regresa al dashboard y pulsa “Escáner” dentro del evento.");
  }

  await loadEvent();
  if (token && state.event) await lookup(token);
}

function bind() {
  $("#manual-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = extractToken(new FormData(event.currentTarget).get("token"));
    if (token) await lookup(token);
  });

  $("[data-start-camera]").addEventListener("click", () => {
    if (state.stream) stopCamera();
    else startCamera();
  });

  $("[data-approve]").addEventListener("click", () => processDecision("approved"));
  $("[data-reject]").addEventListener("click", () => processDecision("rejected"));
  $("[data-refresh]").addEventListener("click", loadStats);
  $("[data-close-result]").addEventListener("click", closeResult);
  $("[data-result-dialog]").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeResult();
  });
  $("[data-result-dialog]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeResult();
  });
  $("[data-logout]").addEventListener("click", async () => {
    await api.signOut();
    location.replace("admin.html");
  });
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

    // El encabezado se completa aunque después falte permiso, evitando “Cargando evento…”.
    $("[data-event-name]").textContent = state.event.name;
    $("[data-event-date]").textContent = formatDate(state.event.event_date);
    $("[data-event-admin]").href = `evento-admin.html?id=${encodeURIComponent(state.eventId)}`;
    $("[data-guests-link]").href = `evento-admin.html?id=${encodeURIComponent(state.eventId)}&tab=rsvp`;
    document.title = `Escáner · ${state.event.name} | LN Studio`;

    const membership = state.members.find((member) =>
      member.user_id === state.user.id ||
      member.email?.toLowerCase() === state.user.email?.toLowerCase()
    );
    const globalAdmin = ["owner", "staff"].includes(state.profile?.global_role);
    const canScan = globalAdmin || (membership?.active && ["client_admin", "event_staff"].includes(membership.role));

    if (state.event.client_id) {
      state.client = (await api.select("clients", { filters: { id: state.event.client_id }, limit: 1 }))?.[0] || null;
    }
    $("[data-event-client]").textContent = state.client?.business_name || "Evento privado";

    if (!canScan) {
      throw new Error("Tu cuenta puede consultar el evento, pero no tiene permiso para usar el escáner.");
    }

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

    const confirmed = state.rsvps
      .filter((item) => item.attendance === "confirmed")
      .reduce((sum, item) => sum + Number(item.party_size || 0), 0);
    const checked = state.checkins
      .filter((item) => item.decision === "approved")
      .reduce((sum, item) => sum + Number(item.entries || 0), 0);

    $("[data-confirmed]").textContent = String(confirmed);
    $("[data-passes]").textContent = String(state.passes.length);
    $("[data-checked]").textContent = String(checked);
    $("[data-remaining-event]").textContent = String(Math.max(confirmed - checked, 0));
    renderLatest();
    status("");
  } catch (error) {
    status(errorMessage(error));
  }
}

function renderLatest() {
  const passMap = new Map(state.passes.map((pass) => [pass.id, pass]));
  $("[data-latest-checkins]").innerHTML = state.checkins.slice(0, 8).map((item) => {
    const pass = passMap.get(item.pass_id);
    const label = item.decision === "approved"
      ? `${Number(item.entries || 0)} persona(s) ingresaron`
      : "Acceso rechazado";
    return `<article class="member-row"><div><strong>${esc(pass?.folio || "Pase")}</strong><small>${esc(formatDate(item.created_at))}</small></div><span>${esc(label)}</span></article>`;
  }).join("") || '<div class="empty-state">Todavía no hay accesos registrados.</div>';
}

async function startCamera() {
  if (!("BarcodeDetector" in window)) {
    return status("Este navegador no permite escanear directamente. Usa Chrome Android actualizado o ingresa el folio manualmente.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return status("No se encontró acceso a la cámara. Usa el campo manual.");
  }

  try {
    state.detector = new BarcodeDetector({ formats: ["qr_code"] });
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    const video = $("[data-video]");
    video.srcObject = state.stream;
    video.hidden = false;
    $("[data-camera-placeholder]").hidden = true;
    await video.play();

    state.scanning = true;
    $("[data-camera-box]").classList.add("is-active");
    $("[data-camera-state]").textContent = "Cámara activa";
    $("[data-camera-state]").classList.add("active");
    $("[data-start-camera]").textContent = "Detener cámara";
    status("Coloca el código QR dentro del marco.");
    scanFrame();
  } catch (error) {
    status(`No fue posible abrir la cámara: ${error.message}`);
    stopCamera();
  }
}

async function scanFrame() {
  if (!state.scanning || !state.detector || !state.stream) return;
  try {
    const codes = await state.detector.detect($("[data-video]"));
    const raw = codes?.[0]?.rawValue;
    if (raw && !state.resultOpen) {
      const token = extractToken(raw);
      const now = Date.now();
      if (token && !(token === state.lastScannedToken && now - state.lastScannedAt < 3500)) {
        state.lastScannedToken = token;
        state.lastScannedAt = now;
        state.scanning = false;
        await lookup(token);
        return;
      }
    }
  } catch {
    // El navegador reintenta en el siguiente cuadro.
  }
  requestAnimationFrame(scanFrame);
}

function stopCamera() {
  state.scanning = false;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;

  const video = $("[data-video]");
  if (video) {
    video.pause();
    video.srcObject = null;
    video.hidden = true;
  }

  $("[data-camera-placeholder]").hidden = false;
  $("[data-camera-box]").classList.remove("is-active");
  $("[data-camera-state]").textContent = "En espera";
  $("[data-camera-state]").classList.remove("active");
  $("[data-start-camera]").textContent = "Activar cámara";
}

function resumeScanning() {
  if (!state.stream || !state.detector || state.resultOpen) return;
  state.scanning = true;
  requestAnimationFrame(scanFrame);
}

async function lookup(token) {
  if (!token) return status("Escribe o escanea un folio, token o enlace.");

  state.currentToken = token;
  state.currentData = null;
  status("Consultando pase…");

  try {
    const result = await api.rpc("lookup_access_pass", {
      p_token: token,
      p_event_id: state.eventId
    });

    state.currentData = result;
    if (!result?.ok) {
      return showValidation(false, "Código no válido", result?.message || "No se encontró el pase para este evento.", result);
    }

    const pass = result.pass || {};
    const remaining = Number(result.remaining || 0);
    const valid = pass.status === "active" && remaining > 0;
    const message = pass.status === "completed"
      ? "Este pase ya fue utilizado por completo."
      : pass.status === "cancelled"
        ? "Este pase fue cancelado."
        : `${remaining} acceso(s) disponible(s).`;

    showValidation(valid, guestName(result.guest) || "Pase digital", message, result);
  } catch (error) {
    showValidation(false, "No fue posible validar", errorMessage(error), null);
  }
}

function showValidation(valid, title, message, result) {
  const dialog = $("[data-result-dialog]");
  const validation = $("[data-validation-view]");
  const outcome = $("[data-outcome]");
  const pass = result?.pass || {};
  const guest = result?.guest || {};
  const remaining = Number(result?.remaining || 0);

  clearTimeout(state.outcomeTimer);
  state.resultOpen = true;
  state.scanning = false;

  validation.hidden = false;
  outcome.hidden = true;
  outcome.className = "scan-outcome";
  validation.classList.toggle("invalid", !valid);

  $("[data-validation-icon]").textContent = valid ? "✓" : "!";
  $("[data-result-state]").textContent = valid ? "Pase válido" : "Revisión requerida";
  $("[data-result-title]").textContent = title;
  $("[data-result-message]").textContent = message;
  $("[data-guest-name]").textContent = guestName(guest) || "Sin nombre disponible";
  $("[data-email]").textContent = guest.email || "Correo no registrado";
  $("[data-folio]").textContent = pass.folio || extractToken(state.currentToken) || "—";
  $("[data-remaining]").textContent = result?.ok ? `${remaining} de ${Number(pass.allowed_entries || 0)}` : "—";
  $("[data-result-event]").textContent = result?.event?.name || state.event?.name || "—";
  $("[data-phone]").textContent = guest.phone || "—";
  $("[data-companions]").textContent = companionText(guest);

  const entries = $("[data-entries]");
  entries.max = Math.max(remaining, 1);
  entries.value = Math.max(Math.min(remaining || 1, 1), 1);
  entries.disabled = !valid;
  $("[data-reason]").value = "";
  $("[data-approve]").disabled = !valid;
  $("[data-reject]").disabled = false;

  status("");
  if (!dialog.open) dialog.showModal();
}

async function processDecision(decision) {
  if (!state.currentToken) return;

  const approve = $("[data-approve]");
  const reject = $("[data-reject]");
  approve.disabled = true;
  reject.disabled = true;

  // Para códigos inválidos, “Rechazar” cierra el flujo con la animación roja
  // sin intentar registrar un check-in que no existe.
  if (decision === "rejected" && !state.currentData?.ok) {
    showOutcome("rejected", "Acceso rechazado", "El código no corresponde a un pase válido de este evento.");
    return;
  }

  status("Registrando decisión…");
  try {
    const entries = Math.max(1, Number($("[data-entries]").value || 1));
    const result = await api.rpc("process_checkin", {
      p_token: state.currentToken,
      p_entries: entries,
      p_decision: decision,
      p_reason: $("[data-reason]").value || null,
      p_device: navigator.userAgent,
      p_event_id: state.eventId
    });

    await loadStats();

    if (decision === "approved") {
      const remainingText = Number.isFinite(Number(result?.remaining))
        ? ` Quedan ${Number(result.remaining)} acceso(s) disponibles.`
        : "";
      showOutcome("approved", "Acceso aprobado", `${result?.message || `Se registró el ingreso de ${entries} persona(s).`}${remainingText}`);
    } else {
      showOutcome("rejected", "Acceso rechazado", result?.message || "La decisión quedó registrada.");
    }
  } catch (error) {
    showOutcome("warning", "No se pudo registrar", errorMessage(error));
  }
}

function showOutcome(type, title, message) {
  const validation = $("[data-validation-view]");
  const outcome = $("[data-outcome]");

  validation.hidden = true;
  outcome.hidden = false;
  outcome.className = `scan-outcome ${type}`;
  $("[data-outcome-icon]").textContent = type === "approved" ? "✓" : type === "rejected" ? "×" : "!";
  $("[data-outcome-label]").textContent = type === "approved" ? "Ingreso registrado" : type === "rejected" ? "Acceso denegado" : "Revisión requerida";
  $("[data-outcome-title]").textContent = title;
  $("[data-outcome-message]").textContent = message;
  status("");

  clearTimeout(state.outcomeTimer);
  state.outcomeTimer = setTimeout(closeResult, type === "warning" ? 2500 : 1900);
}

function closeResult() {
  const dialog = $("[data-result-dialog]");
  clearTimeout(state.outcomeTimer);
  if (dialog.open) dialog.close();

  state.resultOpen = false;
  state.currentToken = null;
  state.currentData = null;
  $("[data-validation-view]").hidden = false;
  $("[data-outcome]").hidden = true;
  $("#manual-form").reset();
  status(state.stream ? "Listo para escanear el siguiente pase." : "");

  window.setTimeout(resumeScanning, 180);
}

function disableScanner() {
  $("[data-start-camera]").disabled = true;
  $("#manual-form button").disabled = true;
  $("#manual-form input").disabled = true;
}

function guestName(guest = {}) {
  return guest.name || guest.respondent_name || guest.full_name || guest.display_name || "";
}

function companionText(guest = {}) {
  const value = guest.companions ?? guest.companion_names ?? guest.guest_names;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "Sin acompañantes registrados";
  if (value && typeof value === "object") return Object.values(value).filter(Boolean).join(", ") || "Sin acompañantes registrados";
  return String(value || "Sin acompañantes registrados");
}

function extractToken(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.searchParams.get("token") || url.searchParams.get("folio") || url.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return text.replace(/^.*token=/, "").split("&")[0].trim();
  }
}

function status(message) {
  $("#scan-status").textContent = message;
}

function setPageStatus(message, type) {
  const node = $("[data-page-status]");
  node.hidden = !message;
  node.dataset.type = type;
  node.textContent = message;
}

function fail(message) {
  setPageStatus(message, "error");
}

function errorMessage(error) {
  return error instanceof ApiError ? error.message : error?.message || "Error inesperado.";
}

function formatDate(value) {
  if (!value) return "Fecha pendiente";
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}
