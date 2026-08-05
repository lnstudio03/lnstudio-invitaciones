import { api, ApiError } from "./supabase.js";

const state = {
  user: null,
  profile: null,
  events: [], clients: [], requests: [], templates: [], members: [], guestGroups: [], rsvps: [], checkins: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const navigateTo = (url) => { if (typeof window.__LN_TEST_NAV__ === "function") window.__LN_TEST_NAV__(url); else location.href = url; };
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
  showGlobal(errorMessage(event.reason));
});

document.addEventListener("DOMContentLoaded", init);

async function init() {
  scrubCredentialQuery();
  bindEvents();
  const session = await api.getSession();
  if (session) {
    if (new URLSearchParams(location.search).get("recovery") === "1") return openPasswordUpdate();
    await openPortal();
  }
}

function scrubCredentialQuery() {
  const params = new URLSearchParams(location.search);
  if (!params.has("email") && !params.has("password")) return;
  params.delete("email"); params.delete("password");
  const query = params.toString();
  history.replaceState({}, document.title, `${location.pathname}${query ? `?${query}` : ""}`);
}

function bindEvents() {
  $("#login-form").addEventListener("submit", login);
  $("[data-login-button]").addEventListener("click", () => $("#login-form").requestSubmit());
  $("[data-recover]")?.addEventListener("click", () => openAuthDialog("recover"));
  $("#auth-form").addEventListener("submit", handleAuthDialog);
  $("[data-logout]").addEventListener("click", logout);
  $("[data-refresh]").addEventListener("click", load);
  $("[data-menu]").addEventListener("click", () => document.body.classList.toggle("sidebar-open"));

  $$('[data-close]').forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  $$('[data-new-client]').forEach((button) => button.addEventListener("click", () => openClient()));
  $$('[data-new-event], [data-quick-event]').forEach((button) => button.addEventListener("click", () => openEvent()));
  $$('[data-new-member]').forEach((button) => button.addEventListener("click", () => openMember()));
  $("[data-new-template]").addEventListener("click", () => openTemplate());
  $("[data-open-requests]").addEventListener("click", () => switchView("solicitudes"));
  $("[data-go-events]").addEventListener("click", () => switchView("eventos"));
  $$('.nav-item').forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

  $("#client-form").addEventListener("submit", saveClient);
  $("#event-form").addEventListener("submit", saveEvent);
  $("#member-form").addEventListener("submit", saveMember);
  $("#template-form").addEventListener("submit", saveTemplate);

  $("[data-event-search]").addEventListener("input", renderEvents);
  $("[data-event-status]").addEventListener("change", renderEvents);
  $("[data-client-search]").addEventListener("input", renderClients);
  $("[data-request-status]").addEventListener("change", renderRequests);
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#login-status");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  setBusy(form, true);
  status.textContent = "Verificando acceso…";
  try {
    await api.signInWithPassword(data.get("email"), data.get("password"));
    form.elements.password.value = "";
    status.textContent = "";
    await openPortal();
  } catch (error) {
    status.textContent = translateAuthError(error);
  } finally {
    setBusy(form, false);
  }
}

async function openPortal() {
  try {
    const user = await api.getUser();
    if (!user) return;
    state.user = user;
    const profiles = await api.select("profiles", { filters: { id: user.id }, limit: 1 });
    state.profile = profiles?.[0] || null;
    if (!state.profile?.active) throw new Error("Esta cuenta no está activa en LN Studio.");
    try { await api.rpc("complete_event_invitation", { p_event_id: null }); } catch { /* Compatible con bases anteriores a v4.2. */ }

    $("[data-login]").hidden = true;
    $("[data-app]").hidden = false;
    $("[data-user-email]").textContent = user.email || state.profile.email;
    $("[data-role]").textContent = globalRoleLabel(state.profile.global_role);
    const owner = isOwner();
    document.body.classList.toggle("not-owner", !owner);
    $("[data-brand-subtitle]").textContent = owner ? "Control central" : "Mi evento";
    $("[data-nav-events]").textContent = owner ? "Eventos" : "Mis eventos";
    $("[data-welcome-role]").textContent = owner ? "Cuenta propietaria" : "Panel de evento";
    $("[data-welcome-copy]").textContent = owner
      ? "Administra clientes, eventos, accesos, cotizaciones y plantillas desde un panel claro."
      : "Consulta únicamente los eventos que LN Studio asignó a tu correo.";
    $("[data-owner-home]").hidden = !owner;
    $("[data-client-home]").hidden = owner;
    await load();
    const params = new URLSearchParams(location.search);
    const requestedReturn = params.get("return");
    if (requestedReturn) {
      try {
        const target = new URL(requestedReturn, location.origin);
        const allowedPath = /\/(scanner|evento-admin|disenador)(?:\.html)?$/.test(target.pathname);
        if (target.origin === location.origin && allowedPath) return navigateTo(`${target.pathname.replace(/^\//, "")}${target.search}`);
      } catch { /* Ignorar retornos inválidos. */ }
    }
    const requestedView = params.get("view");
    if (requestedView) switchView(requestedView);
  } catch (error) {
    await api.signOut();
    $("[data-login]").hidden = false;
    $("[data-app]").hidden = true;
    $("#login-status").textContent = errorMessage(error);
  }
}

async function load() {
  showGlobal("Actualizando información…", "loading");
  try {
    const owner = isOwner();
    const tasks = [
      api.select("events", { order: "created_at.desc" }),
      api.select("clients", { order: "business_name.asc" }),
      api.select("templates", { order: "name.asc" }),
      api.select("event_members", { order: "created_at.desc" }),
      api.select("guest_groups", { order: "created_at.desc" }),
      api.select("rsvp_responses", { order: "created_at.desc" }),
      api.select("checkins", { order: "created_at.desc" })
    ];
    if (owner) tasks.push(api.select("quote_requests", { order: "created_at.desc" }));
    const [events, clients, templates, members, guestGroups, rsvps, checkins, requests = []] = await Promise.all(tasks);
    state.events = events || [];
    state.clients = clients || [];
    state.templates = templates || [];
    state.members = members || [];
    state.guestGroups = guestGroups || [];
    state.rsvps = rsvps || [];
    state.checkins = checkins || [];
    state.requests = requests || [];
    renderAll();
    hideGlobal();
  } catch (error) {
    showGlobal(`No fue posible cargar el panel: ${errorMessage(error)}`, "error");
  }
}

function renderAll() {
  renderMetrics(); renderEvents(); renderClients(); renderRequests(); renderTemplates(); renderMembers(); populateSelects();
  if (isOwner()) {
    $("[data-home-events]").innerHTML = eventCards(state.events.slice(0, 3));
    bindDynamicActions($("[data-home-events]"));
  } else {
    renderClientHome();
  }
}

function renderMetrics() {
  const activeEvents = state.events.filter((event) => !["finished", "archived"].includes(event.status));
  const confirmed = state.rsvps.filter((item) => item.attendance === "confirmed").reduce((sum, item) => sum + Number(item.party_size || 0), 0);
  const checked = state.checkins.filter((item) => item.decision === "approved").reduce((sum, item) => sum + Number(item.entries || 0), 0);
  setText("[data-metric-events]", activeEvents.length);
  setText("[data-metric-clients]", state.clients.length);
  setText("[data-metric-confirmed]", confirmed);
  setText("[data-metric-checkins]", checked);
  const newRequests = state.requests.filter((request) => request.status === "new").length;
  setText("[data-request-badge]", newRequests);
}

function renderEvents() {
  const query = ($("[data-event-search]").value || "").trim().toLowerCase();
  const status = $("[data-event-status]").value;
  const clientMap = new Map(state.clients.map((client) => [client.id, client]));
  const rows = state.events.filter((event) => {
    const haystack = `${event.name} ${clientMap.get(event.client_id)?.business_name || ""}`.toLowerCase();
    return (status === "all" || event.status === status) && (!query || haystack.includes(query));
  });
  $("[data-events]").innerHTML = eventCards(rows);
  $("[data-events-empty]").hidden = rows.length > 0;
  bindDynamicActions($("[data-events]"));
}

function eventCards(rows) {
  const clientMap = new Map(state.clients.map((client) => [client.id, client]));
  return rows.map((event) => {
    const confirmed = eventConfirmed(event.id);
    const checkins = eventChecked(event.id);
    const canScan = canScanEvent(event.id);
    const typeClass = `event-type-${esc(event.event_type || "other")}`;
    return `<article class="event-card ${typeClass}">
      <div class="event-card-top"><div class="event-card-badges"><span class="status-pill status-${esc(event.status)}">${statusLabel(event.status)}</span><span class="event-type-chip">${eventTypeLabel(event.event_type)}</span></div>${isOwner() ? `<div class="event-owner-actions"><button type="button" class="dots" data-edit-event="${event.id}" aria-label="Editar evento">Editar</button><button type="button" class="danger-link" data-delete-event="${event.id}" aria-label="Eliminar evento">Eliminar</button></div>` : ""}</div>
      <p class="admin-eyebrow">${esc(clientMap.get(event.client_id)?.business_name || (isOwner() ? "Sin cliente" : "Tu celebración"))}</p>
      <h2>${esc(event.name)}</h2><p class="event-date-line">${formatDate(event.event_date)}</p>
      <div class="event-card-stats"><span><b>${confirmed}</b> confirmados</span><span><b>${checkins}</b> ingresaron</span></div>
      <div class="event-card-actions">
        <a class="event-action-main" href="evento-admin.html?id=${encodeURIComponent(event.id)}">${isOwner() ? "Administrar" : "Abrir mi evento"}</a>
        ${canDesignEvent(event.id) ? `<a href="disenador.html?id=${encodeURIComponent(event.id)}">Diseñar</a>` : ""}
        ${event.private_token ? `<a href="${isOwner() ? `evento.html?id=${encodeURIComponent(event.id)}&preview=1` : `evento.html?token=${encodeURIComponent(event.private_token)}`}" target="_blank" rel="noopener">Invitación</a>` : ""}
        ${canScan ? `<a href="scanner.html?event=${encodeURIComponent(event.id)}">Escáner</a>` : ""}
      </div>
    </article>`;
  }).join("");
}

function renderClientHome() {
  const shell = $("[data-client-home]");
  if (!shell) return;
  const upcoming = state.events
    .filter((item) => !["finished", "archived"].includes(item.status))
    .sort((a, b) => new Date(a.event_date || "2999-01-01") - new Date(b.event_date || "2999-01-01"));
  const event = upcoming[0] || state.events[0];
  const noEvent = $("[data-client-no-event]");
  const eventCard = $("[data-client-event-card]");
  if (!event) {
    eventCard.hidden = true;
    noEvent.hidden = false;
    $(".client-metrics").hidden = true;
    $(".client-dashboard-grid").hidden = true;
    return;
  }
  eventCard.hidden = false;
  noEvent.hidden = true;
  $(".client-metrics").hidden = false;
  $(".client-dashboard-grid").hidden = false;

  const confirmed = eventConfirmed(event.id);
  const declined = state.rsvps.filter((item) => item.event_id === event.id && item.attendance === "declined").length;
  const checked = eventChecked(event.id);
  const remaining = Math.max(confirmed - checked, 0);
  const membership = memberForEvent(event.id);

  const statusNode = $("[data-client-event-status]");
  statusNode.textContent = statusLabel(event.status);
  statusNode.className = `status-pill status-${event.status}`;
  setText("[data-client-event-type]", eventTypeLabel(event.event_type));
  setText("[data-client-event-name]", event.name);
  setText("[data-client-event-date]", formatDate(event.event_date));
  setText("[data-client-event-venue]", event.venue_name || event.venue_address || "Lugar por confirmar");
  setText("[data-client-confirmed]", confirmed);
  setText("[data-client-declined]", declined);
  setText("[data-client-checked]", checked);
  setText("[data-client-remaining]", remaining);

  const manageUrl = `evento-admin.html?id=${encodeURIComponent(event.id)}`;
  const scanUrl = `scanner.html?event=${encodeURIComponent(event.id)}`;
  setLink("[data-client-manage]", manageUrl);
  setLink("[data-client-guests]", `${manageUrl}&tab=rsvp`);
  setLink("[data-client-passes]", `${manageUrl}&tab=rsvp`);
  setLink("[data-client-access]", scanUrl);
  setLink("[data-client-scanner]", scanUrl, !(membership?.active && ["client_admin", "event_staff"].includes(membership.role)));
  if (event.private_token) setLink("[data-client-invitation]", `evento.html?token=${encodeURIComponent(event.private_token)}`);
  else $("[data-client-invitation]").hidden = true;

  const activity = [];
  state.rsvps.filter((item) => item.event_id === event.id).slice(0, 6).forEach((item) => activity.push({
    date: item.created_at,
    icon: item.attendance === "confirmed" ? "✅" : "💬",
    title: item.attendance === "confirmed" ? `${item.respondent_name || "Un invitado"} confirmó ${Number(item.party_size || 1)} persona(s)` : `${item.respondent_name || "Un invitado"} indicó que no asistirá`,
    meta: item.phone || "Respuesta RSVP"
  }));
  state.checkins.filter((item) => item.event_id === event.id).slice(0, 6).forEach((item) => activity.push({
    date: item.created_at,
    icon: item.decision === "approved" ? "📲" : "⚠️",
    title: item.decision === "approved" ? `Se registró el ingreso de ${Number(item.entries || 0)} persona(s)` : "Se rechazó un intento de acceso",
    meta: "Control de acceso"
  }));
  activity.sort((a, b) => new Date(b.date) - new Date(a.date));
  $("[data-client-activity]").innerHTML = activity.slice(0, 7).map((item) => `<article class="activity-item"><span>${item.icon}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.meta)} · ${formatRelative(item.date)}</small></div></article>`).join("") || '<div class="empty-state compact-empty">Todavía no hay actividad. Las confirmaciones aparecerán aquí.</div>';
}

function eventConfirmed(eventId) {
  return state.rsvps.filter((item) => item.event_id === eventId && item.attendance === "confirmed").reduce((sum, item) => sum + Number(item.party_size || 0), 0);
}
function eventChecked(eventId) {
  return state.checkins.filter((item) => item.event_id === eventId && item.decision === "approved").reduce((sum, item) => sum + Number(item.entries || 0), 0);
}
function memberForEvent(eventId) {
  return state.members.find((member) => member.event_id === eventId && (member.user_id === state.user?.id || member.email?.toLowerCase() === state.user?.email?.toLowerCase()));
}
function canScanEvent(eventId) {
  if (isOwner()) return true;
  const membership = memberForEvent(eventId);
  return Boolean(membership?.active && ["client_admin", "event_staff"].includes(membership.role));
}
function canDesignEvent() {
  return isOwner();
}
function setLink(selector, href, hide = false) {
  const node = $(selector); if (!node) return;
  node.href = href; node.hidden = hide;
}

function renderClients() {
  const query = ($("[data-client-search]").value || "").trim().toLowerCase();
  const rows = state.clients.filter((client) => !query || `${client.business_name} ${client.contact_name || ""} ${client.email || ""}`.toLowerCase().includes(query));
  $("[data-clients]").innerHTML = rows.map((client) => `<article class="data-card">
    <span class="status-pill status-${esc(client.status)}">${esc(client.status)}</span><h3>${esc(client.business_name)}</h3><p>${esc(client.contact_name || "Sin contacto")}</p>
    <dl><div><dt>Correo</dt><dd>${esc(client.email || "—")}</dd></div><div><dt>WhatsApp</dt><dd>${esc(client.phone || "—")}</dd></div><div><dt>Eventos</dt><dd>${state.events.filter((event) => event.client_id === client.id).length}</dd></div></dl>
    <div class="card-actions"><button type="button" data-client-event="${client.id}">Crear evento</button><button type="button" data-edit-client="${client.id}">Editar</button></div>
  </article>`).join("");
  $("[data-clients-empty]").hidden = rows.length > 0;
  bindDynamicActions($("[data-clients]"));
}

function renderRequests() {
  if (!isOwner()) return;
  const status = $("[data-request-status]").value;
  const rows = state.requests.filter((request) => status === "all" || request.status === status);
  $("[data-requests]").innerHTML = rows.map((request) => {
    const view = requestView(request);
    return `<article class="request-card">
      <div>
        <span class="status-pill status-${esc(request.status)}">${requestStatus(request.status)}</span>
        <h3>${esc(view.name)}</h3>
        <p>${esc(view.eventLabel)} · ${esc(view.dateText)} · ${Number(view.guestCount || 0)} invitados</p>
        <small>${esc(view.folio)} · ${formatDate(request.created_at)}</small>
      </div>
      <div>
        <strong>${esc(view.contact)}</strong>
        <button type="button" data-request="${request.id}">Abrir solicitud</button>
      </div>
    </article>`;
  }).join("");
  $("[data-requests-empty]").hidden = rows.length > 0;
  bindDynamicActions($("[data-requests]"));
}

function renderTemplates() {
  if (!isOwner()) return;
  $("[data-templates]").innerHTML = state.templates.map((template) => `<article class="template-card">
    <div class="template-preview template-${esc(template.category)}"><span>LN</span></div><p class="admin-eyebrow">${esc(template.category)}</p><h3>${esc(template.name)}</h3><p>${esc(template.description || "Plantilla editable")}</p>
    <div class="card-actions"><button type="button" data-template-event="${esc(template.template_key)}">Crear evento</button><button type="button" data-edit-template="${template.id}">Editar</button>${template.preview_url ? `<a href="${esc(template.preview_url)}" target="_blank" rel="noopener">Vista previa</a>` : ""}</div>
  </article>`).join("");
  bindDynamicActions($("[data-templates]"));
}

function renderMembers() {
  const eventMap = new Map(state.events.map((event) => [event.id, event]));
  $("[data-members]").innerHTML = state.members.map((member) => `<article class="member-row">
    <div><strong>${esc(member.email)}</strong><small>${esc(eventMap.get(member.event_id)?.name || "Evento")}</small></div>
    <span>${roleLabel(member.role)}</span>
    <span class="status-pill ${invitationStatusClass(member)}">${invitationStatusLabel(member)}</span>
    <div class="card-actions">
      ${isOwner() && member.invitation_status !== "active" && member.invitation_status !== "revoked" ? `<button type="button" data-resend-member="${member.id}">Reenviar</button>` : ""}
      ${isOwner() ? `<button type="button" data-edit-member="${member.id}">Editar</button>` : ""}
      ${isOwner() && member.invitation_status !== "revoked" ? `<button type="button" class="danger-link" data-revoke-member="${member.id}">Revocar</button>` : ""}
    </div>
  </article>`).join("") || '<div class="empty-state">Todavía no hay usuarios asignados.</div>';
  bindDynamicActions($("[data-members]"));
}

function bindDynamicActions(root) {
  $$('[data-client-event]', root).forEach((button) => button.addEventListener("click", () => openEvent({ clientId: button.dataset.clientEvent })));
  $$('[data-edit-client]', root).forEach((button) => button.addEventListener("click", () => openClient(button.dataset.editClient)));
  $$('[data-edit-event]', root).forEach((button) => button.addEventListener("click", () => openEvent({ id: button.dataset.editEvent })));
  $$('[data-delete-event]', root).forEach((button) => button.addEventListener("click", () => deleteEvent(button.dataset.deleteEvent)));
  $$('[data-template-event]', root).forEach((button) => button.addEventListener("click", () => openEvent({ templateKey: button.dataset.templateEvent })));
  $$('[data-edit-template]', root).forEach((button) => button.addEventListener("click", () => openTemplate(button.dataset.editTemplate)));
  $$('[data-edit-member]', root).forEach((button) => button.addEventListener("click", () => openMember(button.dataset.editMember)));
  $$('[data-resend-member]', root).forEach((button) => button.addEventListener("click", () => resendMember(button.dataset.resendMember)));
  $$('[data-revoke-member]', root).forEach((button) => button.addEventListener("click", () => revokeMember(button.dataset.revokeMember)));
  $$('[data-request]', root).forEach((button) => button.addEventListener("click", () => openRequest(button.dataset.request)));
}

function populateSelects() {
  const clients = '<option value="">Sin cliente por ahora</option>' + state.clients.map((client) => `<option value="${client.id}">${esc(client.business_name)}</option>`).join("");
  $("#event-form [name=client_id]").innerHTML = clients;
  $("#event-form [name=template_key]").innerHTML = state.templates.filter((template) => template.active !== false).map((template) => `<option value="${esc(template.template_key)}">${esc(template.name)}</option>`).join("");
  $("#member-form [name=event_id]").innerHTML = state.events.map((event) => `<option value="${event.id}">${esc(event.name)}</option>`).join("");
}

function openClient(id = null) {
  const form = $("#client-form"); form.reset(); form.elements.id.value = "";
  $("[data-client-status]").textContent = "";
  const item = id ? state.clients.find((client) => client.id === id) : null;
  $("[data-client-dialog-title]").textContent = item ? "Editar cliente" : "Nuevo cliente";
  if (item) fillForm(form, item);
  $("#client-dialog").showModal();
}

async function saveClient(event) {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-client-status]"); status.textContent = "Guardando…"; setBusy(form, true);
  try {
    const values = formObject(form, ["id"]); const id = form.elements.id.value;
    values.email = values.email ? values.email.toLowerCase().trim() : null;
    values.created_by = id ? undefined : state.user.id;
    stripUndefined(values);
    if (id) await api.update("clients", values, { id });
    else await api.insert("clients", values);
    $("#client-dialog").close(); await load();
  } catch (error) { status.textContent = errorMessage(error); }
  finally { setBusy(form, false); }
}

function openEvent(options = {}) {
  const form = $("#event-form"); form.reset(); form.elements.id.value = ""; form.elements.max_companions.value = "3"; form.elements.qr_enabled.value = "true";
  $("[data-event-status-message]").textContent = "";
  const item = options.id ? state.events.find((event) => event.id === options.id) : null;
  $("[data-event-dialog-title]").textContent = item ? "Editar invitación" : "Crear invitación";
  if (item) {
    fillForm(form, item);
    if (item.event_date) form.elements.event_date.value = toLocalInput(item.event_date);
    form.elements.qr_enabled.value = String(Boolean(item.qr_enabled));
  } else {
    if (options.clientId) form.elements.client_id.value = options.clientId;
    if (options.templateKey) form.elements.template_key.value = options.templateKey;
  }
  $("#event-dialog").showModal();
}

async function saveEvent(event) {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-event-status-message]"); status.textContent = "Guardando…"; setBusy(form, true);
  try {
    const id = form.elements.id.value;
    const values = formObject(form, ["id"]);
    values.client_id = values.client_id || null;
    values.max_companions = Number(values.max_companions || 0);
    values.qr_enabled = values.qr_enabled === "true";
    values.event_date = values.event_date ? new Date(values.event_date).toISOString() : null;
    values.slug = slugify(values.slug || values.name);
    if (!id) values.created_by = state.user.id;
    let saved;
    if (id) saved = await api.update("events", values, { id });
    else saved = await api.insert("events", values);
    const eventId = id || saved?.[0]?.id;
    $("#event-dialog").close();
    await load();
    if (eventId) navigateTo(`evento-admin.html?id=${encodeURIComponent(eventId)}`);
  } catch (error) { status.textContent = errorMessage(error); }
  finally { setBusy(form, false); }
}

async function deleteEvent(id) {
  if (!isOwner()) return;
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  const answer = prompt(`Eliminará permanentemente “${event.name}”, junto con confirmaciones, QR, invitados y accesos. El cliente NO se eliminará.\n\nEscribe ELIMINAR para continuar:`);
  if (answer !== "ELIMINAR") return;
  showGlobal(`Eliminando ${event.name}…`, "loading");
  try {
    await api.remove("events", { id });
    await load();
    switchView("eventos");
  } catch (error) {
    showGlobal(`No fue posible eliminar el evento: ${errorMessage(error)}`, "error");
  }
}

function openTemplate(id = null) {
  const form = $("#template-form"); form.reset(); form.elements.id.value = ""; form.elements.active.checked = true; $("[data-template-status]").textContent = "";
  const item = id ? state.templates.find((template) => template.id === id) : null;
  if (item) { fillForm(form, item); form.elements.active.checked = item.active !== false; }
  $("#template-dialog").showModal();
}

async function saveTemplate(event) {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-template-status]"); status.textContent = "Guardando…"; setBusy(form, true);
  try {
    const id = form.elements.id.value;
    const values = formObject(form, ["id"]); values.active = form.elements.active.checked; values.template_key = slugify(values.template_key);
    if (!id) values.created_by = state.user.id;
    if (id) await api.update("templates", values, { id }); else await api.insert("templates", values);
    $("#template-dialog").close(); await load();
  } catch (error) { status.textContent = errorMessage(error); }
  finally { setBusy(form, false); }
}

function openMember(id = null) {
  const form = $("#member-form");
  form.reset();
  form.elements.id.value = "";
  form.elements.active.checked = true;
  if (form.elements.send_invite) form.elements.send_invite.checked = true;
  $("[data-member-status]").textContent = "";
  const item = id ? state.members.find((member) => member.id === id) : null;
  if (item) {
    fillForm(form, item);
    form.elements.active.checked = item.active;
    if (form.elements.send_invite) form.elements.send_invite.checked = item.invitation_status !== "active";
  }
  $("#member-dialog").showModal();
}

async function saveMember(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-member-status]");
  const data = new FormData(form);
  const eventId = String(data.get("event_id"));
  const email = String(data.get("email")).trim().toLowerCase();
  const role = String(data.get("role"));
  const sendInvite = Boolean(form.elements.send_invite?.checked);
  status.textContent = sendInvite ? "Enviando invitación…" : "Guardando acceso…";
  setBusy(form, true);
  try {
    if (sendInvite && isOwner()) {
      const result = await api.invokeFunction("invitar-usuario-evento", {
        action: form.elements.id.value ? "resend" : "invite",
        event_id: eventId,
        email,
        role
      });
      status.textContent = result.message || "Invitación enviada.";
    } else {
      await api.rpc("upsert_event_member", {
        p_event_id: eventId,
        p_email: email,
        p_role: role,
        p_active: form.elements.active.checked
      });
    }
    await load();
    setTimeout(() => $("#member-dialog").close(), 450);
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    setBusy(form, false);
  }
}

async function resendMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member || !isOwner()) return;
  showGlobal(`Reenviando acceso a ${member.email}…`, "loading");
  try {
    const result = await api.invokeFunction("invitar-usuario-evento", {
      action: "resend",
      event_id: member.event_id,
      email: member.email,
      role: member.role
    });
    await load();
    showGlobal(result.message || "Invitación reenviada.", "success");
    setTimeout(hideGlobal, 2600);
  } catch (error) {
    showGlobal(`No fue posible reenviar: ${errorMessage(error)}`, "error");
  }
}

async function revokeMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member || !isOwner()) return;
  if (!confirm(`¿Revocar el acceso de ${member.email}? El usuario conservará su cuenta, pero dejará de ver este evento.`)) return;
  showGlobal(`Revocando acceso de ${member.email}…`, "loading");
  try {
    await api.invokeFunction("invitar-usuario-evento", { action: "revoke", member_id: member.id });
    await load();
    showGlobal("Acceso revocado.", "success");
    setTimeout(hideGlobal, 2200);
  } catch (error) {
    showGlobal(`No fue posible revocar: ${errorMessage(error)}`, "error");
  }
}

function openRequest(id) {
  const request = state.requests.find((item) => item.id === id); if (!request) return;
  const view = requestView(request);
  const features = view.features.length ? view.features.map((item) => `<span class="request-feature-chip">${esc(item)}</span>`).join("") : '<span class="request-feature-chip muted-chip">No especificadas</span>';
  $("[data-request-detail]").innerHTML = `<div class="dialog-title"><div><p class="admin-eyebrow">${esc(view.folio)}</p><h2>${esc(view.name)}</h2><p class="request-subtitle">${esc(view.eventLabel)} · ${esc(view.dateText)} · ${Number(view.guestCount || 0)} invitados</p></div><button type="button" data-request-close aria-label="Cerrar">×</button></div>
    <dl>
      <div><dt>Evento</dt><dd>${esc(view.eventLabel)}</dd></div>
      <div><dt>Fecha</dt><dd>${esc(view.dateText)}</dd></div>
      <div><dt>Invitados</dt><dd>${Number(view.guestCount || 0)}</dd></div>
      <div><dt>Estilo</dt><dd>${esc(view.style)}</dd></div>
      <div><dt>WhatsApp</dt><dd>${esc(view.phone)}</dd></div>
      <div><dt>Correo</dt><dd>${esc(view.email)}</dd></div>
      <div><dt>Ciudad</dt><dd>${esc(view.city)}</dd></div>
      <div><dt>Estatus</dt><dd>${esc(requestStatus(request.status))}</dd></div>
    </dl>
    <div class="request-copy-block"><strong>Detalles de la solicitud</strong><p>${esc(view.details)}</p></div>
    <div class="request-copy-block"><strong>Funciones solicitadas</strong><div class="request-feature-list">${features}</div></div>
    <div class="dialog-actions"><button type="button" class="ghost-button" data-request-contacted>Marcar contactada</button><button type="button" class="ghost-button" data-request-archive>Archivar</button><button type="button" class="primary-button" data-request-convert>Convertir en cliente</button></div>`;
  $("[data-request-close]").addEventListener("click", () => $("#request-dialog").close());
  $("[data-request-contacted]").addEventListener("click", () => updateRequest(request.id, "contacted"));
  $("[data-request-archive]").addEventListener("click", () => updateRequest(request.id, "archived"));
  $("[data-request-convert]").addEventListener("click", () => convertRequest(request));
  $("#request-dialog").showModal();
}

async function updateRequest(id, status) {
  try { await api.update("quote_requests", { status, updated_at: new Date().toISOString() }, { id }); $("#request-dialog").close(); await load(); }
  catch (error) { alert(errorMessage(error)); }
}

async function convertRequest(request) {
  try {
    const client = await api.rpc("convert_quote_to_client", { p_request_id: request.id });
    $("#request-dialog").close(); await load();
    openEvent({ clientId: client.id });
    const form = $("#event-form"); form.elements.name.value = `${request.event_type} de ${request.name}`;
    form.elements.event_date.value = request.event_date ? `${request.event_date}T12:00` : "";
    form.elements.slug.value = slugify(`${request.event_type}-${request.name}`);
    form.elements.description.value = request.details || "";
  } catch (error) { alert(errorMessage(error)); }
}

function openAuthDialog(mode) {
  const form = $("#auth-form"); form.reset(); form.elements.mode.value = mode; $("[data-auth-status]").textContent = "";
  const loginEmail = $("#login-form [name=email]").value;
  form.elements.email.value = loginEmail;
  const passwordLabel = $("[data-auth-password-label]");
  $("[data-auth-title]").textContent = "Establecer o recuperar contraseña";
  $("[data-auth-copy]").textContent = "Usa el correo de la cuenta que LN Studio creó para tu evento. Recibirás un enlace para establecer una contraseña nueva.";
  $("[data-auth-submit]").textContent = "Enviar enlace";
  passwordLabel.hidden = true;
  form.elements.password.required = false;
  $("#auth-dialog").showModal();
}

async function handleAuthDialog(event) {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-auth-status]"); status.textContent = "Procesando…"; setBusy(form, true);
  try {
    const mode = form.elements.mode.value;
    if (mode === "update-password") {
      await api.updatePassword(form.elements.password.value);
      status.textContent = "Contraseña actualizada. Ya puedes cerrar este cuadro y entrar normalmente.";
    } else {
      await api.sendPasswordRecovery(form.elements.email.value);
      status.textContent = "Si la cuenta ya fue creada por LN Studio, recibirás un enlace para establecer o recuperar la contraseña.";
    }
  } catch (error) { status.textContent = translateAuthError(error); }
  finally { setBusy(form, false); }
}

function openPasswordUpdate() {
  const form = $("#auth-form");
  form.reset();
  form.elements.mode.value = "update-password";
  $("[data-auth-title]").textContent = "Crear contraseña nueva";
  $("[data-auth-copy]").textContent = "Tu enlace fue validado. Escribe una contraseña de al menos 8 caracteres.";
  $("[data-auth-password-label]").hidden = false;
  form.elements.password.required = true;
  form.elements.email.required = false;
  form.elements.email.closest("label").hidden = true;
  $("[data-auth-submit]").textContent = "Guardar contraseña";
  $("[data-auth-status]").textContent = "";
  $("#auth-dialog").showModal();
}

function switchView(view) {
  const allowed = isOwner() || ["inicio", "eventos", "usuarios"].includes(view);
  if (!allowed) view = "inicio";
  $$('.owner-view').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  $$('.nav-item').forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const ownerNames = { inicio: ["Panel general", "Resumen"], eventos: ["Administración", "Eventos"], clientes: ["Administración", "Clientes"], solicitudes: ["Ventas", "Solicitudes"], plantillas: ["Diseño", "Plantillas"], usuarios: ["Seguridad", "Usuarios y accesos"] };
  const clientNames = { inicio: ["Centro de control", "Mi evento"], eventos: ["Mis celebraciones", "Eventos asignados"], usuarios: ["Accesos", "Equipo autorizado"] };
  const names = isOwner() ? ownerNames : clientNames;
  $("[data-section-kicker]").textContent = names[view]?.[0] || "LN Studio"; $("[data-section-title]").textContent = names[view]?.[1] || "Panel"; document.body.classList.remove("sidebar-open");
}

async function logout() { await api.signOut(); navigateTo("admin.html"); }
function isOwner() { return ["owner", "staff"].includes(state.profile?.global_role); }
function setText(selector, value) { const node = $(selector); if (node) node.textContent = String(value); }
function fillForm(form, data) { Object.entries(data).forEach(([key, value]) => { const field = form.elements[key]; if (!field || value === null || value === undefined) return; if (field.type === "checkbox") field.checked = Boolean(value); else field.value = value; }); }
function formObject(form, omit = []) { const object = Object.fromEntries(new FormData(form)); omit.forEach((key) => delete object[key]); return object; }
function stripUndefined(object) { Object.keys(object).forEach((key) => object[key] === undefined && delete object[key]); }
function setBusy(form, busy) { $$('button', form).forEach((field) => field.disabled = busy); form.setAttribute("aria-busy", String(busy)); }
function slugify(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70); }
function toLocalInput(value) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function formatDate(value) { if (!value) return "Fecha pendiente"; try { return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function formatRelative(value) { if (!value) return "Ahora"; const diff = Date.now() - new Date(value).getTime(); const minutes = Math.max(0, Math.floor(diff / 60000)); if (minutes < 1) return "Ahora"; if (minutes < 60) return `Hace ${minutes} min`; const hours = Math.floor(minutes / 60); if (hours < 24) return `Hace ${hours} h`; const days = Math.floor(hours / 24); return `Hace ${days} día${days === 1 ? "" : "s"}`; }
function eventTypeLabel(value) { return ({ anniversary: "Aniversario", wedding: "Boda", xv: "XV años", birthday: "Cumpleaños", kids: "Infantil", baptism: "Bautizo", baby_shower: "Baby shower", corporate: "Empresarial", other: "Celebración" })[value] || "Celebración"; }
function statusLabel(value) { return ({ draft: "Borrador", published: "Publicado", paused: "Pausado", finished: "Finalizado", archived: "Archivado" })[value] || value; }
function requestStatus(value) { return ({ new: "Nueva", contacted: "Contactada", converted: "Convertida", archived: "Archivada" })[value] || value; }
function firstFilled(...values) {
  for (const value of values) {
    if (value === 0 || value === false) return value;
    if (Array.isArray(value) && value.length) return value;
    if (value && String(value).trim() !== "") return value;
  }
  return "";
}
function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}
function requestEventLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Evento por definir";
  const normalized = raw.toLowerCase();
  const labels = {
    anniversary: "Aniversario",
    wedding: "Boda",
    xv: "XV años",
    birthday: "Cumpleaños",
    kids: "Fiesta infantil",
    baptism: "Bautizo",
    baby_shower: "Baby shower",
    corporate: "Empresarial",
    other: "Celebración"
  };
  return labels[normalized] || raw;
}
function requestView(request = {}) {
  const name = firstFilled(request.name, request.full_name, request.nombre, request.contact_name, "Solicitud sin nombre");
  const eventType = firstFilled(request.event_type, request.event_kind, request.event, request.event_name, request.evento, "Evento");
  const guestCountRaw = firstFilled(request.guest_count, request.invitados, request.guests_total, request.invited_count, 0);
  const guestCount = Number(guestCountRaw || 0);
  const phone = firstFilled(request.phone, request.whatsapp, request.telefono, request.celular, "—");
  const email = firstFilled(request.email, request.correo, "—");
  const style = firstFilled(request.style, request.estilo, request.theme, "Sin estilo definido");
  const city = firstFilled(request.city, request.ciudad, request.location_city, "No especificada");
  const details = firstFilled(request.details, request.descripcion, request.detalles, request.notes, "Sin detalles adicionales");
  const features = asArray(firstFilled(request.features, request.funciones, request.services, []));
  const folio = firstFilled(request.folio, `SOL-${String(request.id || "").slice(0, 8).toUpperCase()}`, "SOLICITUD");
  const eventDate = firstFilled(request.event_date, request.fecha_evento, request.fecha, request.date);
  const dateText = eventDate ? String(eventDate) : "Fecha por definir";
  return {
    name: String(name),
    eventLabel: requestEventLabel(eventType),
    dateText: String(dateText),
    guestCount,
    phone: String(phone),
    email: String(email),
    contact: String(firstFilled(phone, email, "Sin contacto")),
    style: String(style),
    city: String(city),
    details: String(details),
    features,
    folio: String(folio)
  };
}
function invitationStatusLabel(member) {
  if (!member.active || member.invitation_status === "revoked") return "Revocado";
  return ({ assigned: "Asignado", sent: "Invitación enviada", active: "Cuenta activa", error: "Error de envío" })[member.invitation_status] || (member.user_id ? "Cuenta vinculada" : "Asignado");
}
function invitationStatusClass(member) {
  if (!member.active || member.invitation_status === "revoked" || member.invitation_status === "error") return "status-paused";
  return member.invitation_status === "active" ? "status-published" : "status-draft";
}
function roleLabel(value) { return ({ client_admin: "Cliente administrador", event_staff: "Personal de acceso", viewer: "Solo consulta" })[value] || value; }
function globalRoleLabel(value) { return ({ owner: "Propietario LN Studio", staff: "Equipo LN Studio", client: "Cliente / evento" })[value] || value; }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "Ocurrió un error inesperado."; }
function translateAuthError(error) { const message = errorMessage(error); if (/invalid login credentials/i.test(message)) return "El correo o la contraseña no coinciden."; if (/email not confirmed/i.test(message)) return "Confirma el correo antes de entrar."; if (/user already registered/i.test(message)) return "Ese correo ya tiene cuenta. Usa recuperar contraseña."; return message; }
function showGlobal(message, type = "info") { const node = $("[data-global-status]"); node.hidden = false; node.dataset.type = type; node.textContent = message; }
function hideGlobal() { $("[data-global-status]").hidden = true; }
