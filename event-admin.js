import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const state = { eventId: null, user: null, profile: null, event: null, client: null, rsvps: [], groups: [], members: [], passes: [], checkins: [], canAdmin: false, canScan: false, isOwner: false };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.eventId = new URLSearchParams(location.search).get("id");
  if (!state.eventId) return fail("Falta el identificador del evento.");
  const session = await api.getSession();
  if (!session) return location.replace("admin.html");
  state.user = await api.getUser();
  try { await api.rpc("complete_event_invitation", { p_event_id: state.eventId }); } catch { /* Compatible con bases anteriores a v4.2. */ }
  bind();
  await load();
}

function bind() {
  $("[data-logout]").addEventListener("click", async () => { await api.signOut(); location.replace("admin.html"); });
  $$('[data-tab]').forEach((button) => button.addEventListener("click", () => tab(button.dataset.tab)));
  $$('[data-close]').forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  $("[data-add-guest]").addEventListener("click", () => openGuest());
  $("[data-add-member]").addEventListener("click", () => openMember());
  $("#guest-form").addEventListener("submit", saveGuest);
  $("#member-form").addEventListener("submit", saveMember);
  $("#settings-form").addEventListener("submit", saveSettings);
  $("[data-rsvp-search]").addEventListener("input", renderRsvps);
  $("[data-rsvp-filter]").addEventListener("change", renderRsvps);
  $("[data-export]").addEventListener("click", exportCsv);
  $("[data-delete-event]").addEventListener("click", deleteEvent);
}

async function load() {
  setStatus("Cargando evento…", "loading");
  try {
    const [profiles, events, rsvps, groups, members, passes, checkins] = await Promise.all([
      api.select("profiles", { filters: { id: state.user.id }, limit: 1 }),
      api.select("events", { filters: { id: state.eventId }, limit: 1 }),
      api.select("rsvp_responses", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("guest_groups", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("event_members", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("access_passes", { filters: { event_id: state.eventId }, order: "created_at.desc" }),
      api.select("checkins", { filters: { event_id: state.eventId }, order: "created_at.desc" })
    ]);
    state.profile = profiles?.[0] || null;
    state.event = events?.[0] || null;
    if (!state.event) throw new Error("No tienes acceso a este evento o ya no existe.");
    state.rsvps = rsvps || []; state.groups = groups || []; state.members = members || []; state.passes = passes || []; state.checkins = checkins || [];
    if (state.event.client_id) state.client = (await api.select("clients", { filters: { id: state.event.client_id }, limit: 1 }))?.[0] || null;
    const ownMembership = state.members.find((member) => member.user_id === state.user.id || member.email?.toLowerCase() === state.user.email?.toLowerCase());
    const globalAdmin = ["owner", "staff"].includes(state.profile?.global_role);
    state.isOwner = globalAdmin;
    state.canAdmin = globalAdmin || ownMembership?.role === "client_admin";
    state.canScan = globalAdmin || ["client_admin", "event_staff"].includes(ownMembership?.role);
    render();
    const requestedTab = new URLSearchParams(location.search).get("tab");
    if (requestedTab && ["overview", "rsvp", "guests", "checkins", "members", "settings"].includes(requestedTab)) tab(requestedTab);
    setStatus("", "info");
  } catch (error) { fail(errorMessage(error)); }
}

function render() {
  $("[data-client]").textContent = state.client?.business_name || "Evento privado";
  $("[data-title]").textContent = state.event.name;
  $("[data-meta]").textContent = formatDate(state.event.event_date);
  $("[data-open]").href = `evento.html?token=${encodeURIComponent(state.event.private_token)}`;
  $("[data-scan]").href = `scanner.html?event=${encodeURIComponent(state.eventId)}`;
  $("[data-delete-zone]").hidden = !state.isOwner;
  $("[data-delete-event]").hidden = !state.isOwner;
  $("[data-scan]").hidden = !state.canScan;
  $("[data-add-guest]").hidden = !state.canAdmin;
  $("[data-add-member]").hidden = !state.isOwner;
  $("#settings-form").querySelectorAll("input,select,textarea,button").forEach((field) => field.disabled = !state.canAdmin);

  const confirmed = state.rsvps.filter((item) => item.attendance === "confirmed").reduce((sum, item) => sum + Number(item.party_size || 0), 0);
  const checked = state.checkins.filter((item) => item.decision === "approved").reduce((sum, item) => sum + Number(item.entries || 0), 0);
  setText("[data-rsvp]", state.rsvps.length); setText("[data-confirmed]", confirmed); setText("[data-checkin]", checked); setText("[data-pending]", state.groups.filter((group) => group.status === "pending").length);

  renderRsvps(); renderGuests(); renderMembers(); renderCheckins(); renderLatest(); fillSettings();
}

function renderRsvps() {
  const query = ($("[data-rsvp-search]").value || "").trim().toLowerCase();
  const filter = $("[data-rsvp-filter]").value;
  const passMap = new Map(state.passes.map((pass) => [pass.rsvp_id, pass]));
  const rows = state.rsvps.filter((rsvp) => {
    const pass = passMap.get(rsvp.id);
    const haystack = `${rsvp.respondent_name} ${rsvp.phone || ""} ${pass?.folio || ""}`.toLowerCase();
    return (filter === "all" || rsvp.attendance === filter) && (!query || haystack.includes(query));
  });
  $("[data-rsvp-body]").innerHTML = rows.map((rsvp) => {
    const pass = passMap.get(rsvp.id);
    return `<tr><td><b>${esc(rsvp.respondent_name)}</b><small>${esc(rsvp.phone || rsvp.email || "")}</small></td><td>${rsvp.attendance === "confirmed" ? "Confirmado" : "No asistirá"}</td><td>${Number(rsvp.party_size || 0)}</td><td>${esc(pass?.folio || "—")}</td><td>${pass ? `${Number(pass.used_entries || 0)}/${Number(pass.allowed_entries || 0)}` : "—"}</td><td>${state.canAdmin ? `<button type="button" class="delete-button" data-delete-rsvp="${rsvp.id}">×</button>` : ""}</td></tr>`;
  }).join("");
  $("[data-rsvp-empty]").hidden = rows.length > 0;
  $$('[data-delete-rsvp]').forEach((button) => button.addEventListener("click", () => deleteRsvp(button.dataset.deleteRsvp)));
}

function renderGuests() {
  $("[data-guests-body]").innerHTML = state.groups.map((group) => `<tr><td><b>${esc(group.display_name)}</b><small>${statusLabel(group.status)}</small></td><td>${esc(group.phone || group.email || "—")}</td><td>${Number(group.allowed_entries || 1)}</td><td>${esc(group.table_name || "—")}</td><td>${esc(group.invitation_code)}</td><td>${state.canAdmin ? `<button type="button" data-edit-guest="${group.id}">Editar</button>` : ""}</td></tr>`).join("");
  $("[data-guests-empty]").hidden = state.groups.length > 0;
  $$('[data-edit-guest]').forEach((button) => button.addEventListener("click", () => openGuest(button.dataset.editGuest)));
}

function renderMembers() {
  $("[data-members-body]").innerHTML = state.members.map((member) => `<tr>
    <td>${esc(member.email)}</td>
    <td>${roleLabel(member.role)}</td>
    <td><span class="status-pill ${invitationStatusClass(member)}">${invitationStatusLabel(member)}</span></td>
    <td>${state.isOwner ? `<button type="button" data-edit-member="${member.id}">Editar</button>${member.invitation_status !== "active" && member.invitation_status !== "revoked" ? `<button type="button" data-resend-member="${member.id}">Reenviar</button>` : ""}${member.invitation_status !== "revoked" ? `<button type="button" class="danger-link" data-revoke-member="${member.id}">Revocar</button>` : ""}` : ""}</td>
  </tr>`).join("");
  $("[data-members-empty]").hidden = state.members.length > 0;
  $$('[data-edit-member]').forEach((button) => button.addEventListener("click", () => openMember(button.dataset.editMember)));
  $$('[data-resend-member]').forEach((button) => button.addEventListener("click", () => resendMember(button.dataset.resendMember)));
  $$('[data-revoke-member]').forEach((button) => button.addEventListener("click", () => revokeMember(button.dataset.revokeMember)));
}

function renderCheckins() {
  const passMap = new Map(state.passes.map((pass) => [pass.id, pass]));
  $("[data-checkins-body]").innerHTML = state.checkins.map((item) => `<tr><td>${formatDate(item.created_at)}</td><td>${esc(passMap.get(item.pass_id)?.folio || "—")}</td><td>${item.decision === "approved" ? "Aprobado" : item.decision === "rejected" ? "Rechazado" : "Revertido"}</td><td>${Number(item.entries || 0)}</td><td>${esc(item.reason || "—")}</td></tr>`).join("");
  $("[data-checkins-empty]").hidden = state.checkins.length > 0;
}

function renderLatest() {
  const passMap = new Map(state.passes.map((pass) => [pass.id, pass]));
  $("[data-latest-checkins]").innerHTML = state.checkins.slice(0, 5).map((item) => `<article class="member-row"><div><strong>${esc(passMap.get(item.pass_id)?.folio || "Pase")}</strong><small>${formatDate(item.created_at)}</small></div><span>${item.decision === "approved" ? `${item.entries} acceso(s)` : "Rechazado"}</span></article>`).join("") || '<div class="empty-state">Todavía no hay accesos.</div>';
}

function fillSettings() {
  const form = $("#settings-form");
  const fields = ["name", "status", "template_key", "venue_name", "venue_address", "maps_url", "description", "dress_code", "max_companions", "logo_url", "secondary_logo_url", "hero_image_url", "music_url", "theme_primary", "theme_secondary"];
  fields.forEach((name) => { if (form.elements[name]) form.elements[name].value = state.event[name] ?? ""; });
  form.elements.event_date.value = state.event.event_date ? toLocalInput(state.event.event_date) : "";
  form.elements.allow_general_rsvp.value = String(Boolean(state.event.allow_general_rsvp));
  form.elements.qr_enabled.value = String(Boolean(state.event.qr_enabled));
}

function tab(name) { $$('[data-tab]').forEach((button) => button.classList.toggle("active", button.dataset.tab === name)); $$('[data-panel]').forEach((panel) => panel.hidden = panel.dataset.panel !== name); }

function openGuest(id = null) {
  const form = $("#guest-form"); form.reset(); form.elements.id.value = ""; form.elements.allowed_entries.value = "1"; $("[data-guest-status]").textContent = "";
  const group = id ? state.groups.find((item) => item.id === id) : null; $("[data-guest-title]").textContent = group ? "Editar grupo" : "Nuevo grupo";
  if (group) fillForm(form, group); $("#guest-dialog").showModal();
}

async function saveGuest(event) {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const status = $("[data-guest-status]"); status.textContent = "Guardando…"; setBusy(form, true);
  try {
    const id = form.elements.id.value; const values = Object.fromEntries(new FormData(form)); delete values.id;
    values.event_id = state.eventId; values.allowed_entries = Number(values.allowed_entries || 1); values.email = values.email ? values.email.toLowerCase().trim() : null;
    if (id) await api.update("guest_groups", values, { id }); else await api.insert("guest_groups", values);
    $("#guest-dialog").close(); await load();
  } catch (error) { status.textContent = errorMessage(error); } finally { setBusy(form, false); }
}

function openMember(id = null) {
  if (!state.isOwner) return;
  const form = $("#member-form");
  form.reset();
  form.elements.id.value = "";
  form.elements.active.checked = true;
  if (form.elements.send_invite) form.elements.send_invite.checked = true;
  $("[data-member-status]").textContent = "";
  const member = id ? state.members.find((item) => item.id === id) : null;
  if (member) {
    fillForm(form, member);
    form.elements.active.checked = member.active;
    if (form.elements.send_invite) form.elements.send_invite.checked = member.invitation_status !== "active";
  }
  $("#member-dialog").showModal();
}

async function saveMember(event) {
  event.preventDefault();
  if (!state.isOwner) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = $("[data-member-status]");
  const email = form.elements.email.value.trim().toLowerCase();
  const role = form.elements.role.value;
  const sendInvite = Boolean(form.elements.send_invite?.checked);
  status.textContent = sendInvite ? "Enviando invitación…" : "Guardando acceso…";
  setBusy(form, true);
  try {
    if (sendInvite) {
      const result = await api.invokeFunction("invitar-usuario-evento", {
        action: form.elements.id.value ? "resend" : "invite",
        event_id: state.eventId,
        email,
        role
      });
      status.textContent = result.message || "Invitación enviada.";
    } else {
      await api.rpc("upsert_event_member", {
        p_event_id: state.eventId,
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
  if (!member || !state.isOwner) return;
  setStatus(`Reenviando acceso a ${member.email}…`, "loading");
  try {
    const result = await api.invokeFunction("invitar-usuario-evento", {
      action: "resend",
      event_id: state.eventId,
      email: member.email,
      role: member.role
    });
    await load();
    setStatus(result.message || "Invitación reenviada.", "info");
  } catch (error) {
    setStatus(`No fue posible reenviar: ${errorMessage(error)}`, "error");
  }
}

async function revokeMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member || !state.isOwner) return;
  if (!confirm(`¿Revocar el acceso de ${member.email}? La cuenta seguirá existiendo, pero no podrá ver este evento.`)) return;
  setStatus(`Revocando acceso de ${member.email}…`, "loading");
  try {
    await api.invokeFunction("invitar-usuario-evento", { action: "revoke", member_id: member.id });
    await load();
    setStatus("Acceso revocado.", "info");
  } catch (error) {
    setStatus(`No fue posible revocar: ${errorMessage(error)}`, "error");
  }
}

async function saveSettings(event) {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const status = $("[data-settings-status]"); status.textContent = "Guardando…"; setBusy(form, true);
  try {
    const values = Object.fromEntries(new FormData(form));
    values.event_date = values.event_date ? new Date(values.event_date).toISOString() : null;
    values.max_companions = Number(values.max_companions || 0); values.allow_general_rsvp = values.allow_general_rsvp === "true"; values.qr_enabled = values.qr_enabled === "true";
    await api.update("events", values, { id: state.eventId }); status.textContent = "Cambios guardados."; await load(); tab("settings");
  } catch (error) { status.textContent = errorMessage(error); } finally { setBusy(form, false); }
}

async function deleteEvent() {
  if (!state.isOwner || !state.event) return;
  const answer = prompt(`Eliminará permanentemente “${state.event.name}”, incluyendo invitados, confirmaciones, pases QR y accesos. El registro del cliente se conservará.\n\nEscribe ELIMINAR para continuar:`);
  if (answer !== "ELIMINAR") return;
  setStatus("Eliminando evento…", "loading");
  try {
    await api.remove("events", { id: state.eventId });
    location.replace("admin.html?view=eventos");
  } catch (error) {
    setStatus(`No fue posible eliminar el evento: ${errorMessage(error)}`, "error");
  }
}

async function deleteRsvp(id) {
  if (!confirm("¿Eliminar esta confirmación y su pase QR?")) return;
  try { await api.remove("rsvp_responses", { id }); await load(); tab("rsvp"); } catch (error) { alert(errorMessage(error)); }
}

function exportCsv() {
  if (!state.rsvps.length) return alert("Todavía no hay confirmaciones para exportar.");
  const passMap = new Map(state.passes.map((pass) => [pass.rsvp_id, pass]));
  const rows = [["Nombre", "Teléfono", "Correo", "Respuesta", "Personas", "Acompañantes", "Folio", "Usados", "Autorizados", "Fecha"]];
  state.rsvps.forEach((item) => { const pass = passMap.get(item.id); rows.push([item.respondent_name, item.phone, item.email, item.attendance, item.party_size, item.guest_names, pass?.folio, pass?.used_entries, pass?.allowed_entries, item.created_at]); });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n"); const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${slugify(state.event.name)}-invitados.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function fail(message) { setStatus(message, "error"); }
function setStatus(message, type) { const node = $("[data-page-status]"); node.hidden = !message; node.dataset.type = type; node.textContent = message; }
function setText(selector, value) { $(selector).textContent = String(value); }
function fillForm(form, data) { Object.entries(data).forEach(([key, value]) => { const field = form.elements[key]; if (!field || value == null) return; if (field.type === "checkbox") field.checked = Boolean(value); else field.value = value; }); }
function setBusy(form, busy) { $$('button', form).forEach((field) => field.disabled = busy); form.setAttribute('aria-busy', String(busy)); }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "Ocurrió un error inesperado."; }
function formatDate(value) { if (!value) return "Fecha pendiente"; try { return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function toLocalInput(value) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function statusLabel(value) { return ({ pending: "Pendiente", confirmed: "Confirmado", declined: "No asistirá", cancelled: "Cancelado" })[value] || value; }
function invitationStatusLabel(member) {
  if (!member.active || member.invitation_status === "revoked") return "Revocado";
  return ({ assigned: "Asignado", sent: "Invitación enviada", active: "Cuenta activa", error: "Error de envío" })[member.invitation_status] || (member.user_id ? "Cuenta vinculada" : "Asignado");
}
function invitationStatusClass(member) {
  if (!member.active || member.invitation_status === "revoked" || member.invitation_status === "error") return "status-paused";
  return member.invitation_status === "active" ? "status-published" : "status-draft";
}
function roleLabel(value) { return ({ client_admin: "Cliente administrador", event_staff: "Personal de acceso", viewer: "Solo lectura" })[value] || value; }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function slugify(value) { return String(value || "evento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
