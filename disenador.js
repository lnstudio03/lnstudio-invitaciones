import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const eventId = new URLSearchParams(location.search).get("id");
let state = { user: null, profile: null, event: null, member: null, canEdit: false };

window.addEventListener("DOMContentLoaded", init);

async function init() {
  bind();
  if (!eventId) return fail("Falta el identificador del evento.");
  try {
    const session = await api.getSession();
    if (!session) return location.replace(`admin.html?return=${encodeURIComponent(`disenador.html?id=${eventId}`)}`);
    state.user = await api.getUser();
    const [profiles, events, members] = await Promise.all([
      api.select("profiles", { filters: { id: state.user.id }, limit: 1 }),
      api.select("events", { filters: { id: eventId }, limit: 1 }),
      api.select("event_members", { filters: { event_id: eventId } })
    ]);
    state.profile = profiles?.[0] || null;
    state.event = events?.[0] || null;
    state.member = (members || []).find((item) => item.user_id === state.user.id || item.email?.toLowerCase() === state.user.email?.toLowerCase()) || null;
    state.canEdit = ["owner", "staff"].includes(state.profile?.global_role) || (state.member?.active && state.member.role === "client_admin");
    if (!state.event) throw new Error("No tienes acceso a este evento o ya fue eliminado.");
    if (!state.canEdit) throw new Error("Tu cuenta puede consultar el evento, pero no modificar su diseño.");
    fill();
    render();
  } catch (error) { fail(errorMessage(error)); }
}

function bind() {
  $("[data-save]").addEventListener("click", save);
  $("#designer-form").addEventListener("input", () => { render(); setStatus("Cambios sin guardar"); });
  $$('[data-preview-size]').forEach((button) => button.addEventListener("click", () => {
    $("[data-preview-device]").className = `preview-device ${button.dataset.previewSize}`;
    $$('[data-preview-size]').forEach((item) => item.classList.toggle("active", item === button));
  }));
  $$('[data-palette]').forEach((button) => button.addEventListener("click", () => {
    const [primary, secondary] = button.dataset.palette.split(",");
    const form = $("#designer-form"); form.elements.theme_primary.value = primary; form.elements.theme_secondary.value = secondary;
    render(); setStatus("Cambios sin guardar");
  }));
}

function fill() {
  const form = $("#designer-form");
  const fields = ["name","description","venue_name","venue_address","dress_code","theme_primary","theme_secondary","template_key","logo_url","secondary_logo_url","hero_image_url","music_url"];
  fields.forEach((name) => { if (form.elements[name]) form.elements[name].value = state.event[name] || ""; });
  form.elements.theme_primary.value = safeColor(state.event.theme_primary, "#7357e7");
  form.elements.theme_secondary.value = safeColor(state.event.theme_secondary, "#ff6d7a");
  if (state.event.event_date) form.elements.event_date.value = toLocalInput(state.event.event_date);
  $("[data-event-title]").textContent = state.event.name;
  if (state.event.private_token) $("[data-open-invitation]").href = `evento.html?token=${encodeURIComponent(state.event.private_token)}`;
  else $("[data-open-invitation]").hidden = true;
}

function render() {
  const data = Object.fromEntries(new FormData($("#designer-form")));
  const primary = safeColor(data.theme_primary, "#7357e7");
  const secondary = safeColor(data.theme_secondary, "#ff6d7a");
  const screen = $("[data-preview-screen]");
  screen.style.setProperty("--primary", primary); screen.style.setProperty("--secondary", secondary);
  $("[data-preview-name]").textContent = data.name || "Tu evento";
  $("[data-preview-description]").textContent = data.description || "Una celebración especial está por comenzar.";
  $("[data-preview-date]").textContent = data.event_date ? formatDate(data.event_date) : "Fecha pendiente";
  $("[data-preview-venue]").textContent = data.venue_name || data.venue_address || "Lugar pendiente";
  $("[data-preview-kicker]").textContent = data.template_key ? `Estilo ${data.template_key}` : "Invitación digital";
  const logo = $("[data-preview-logo]");
  if (data.logo_url) { logo.src = safeAsset(data.logo_url); logo.hidden = false; }
  else logo.hidden = true;
}

async function save() {
  const form = $("#designer-form"); if (!form.reportValidity()) return;
  setBusy(true); setStatus("Guardando…");
  try {
    const data = Object.fromEntries(new FormData(form));
    const values = {
      name:data.name.trim(), description:data.description || null,
      event_date:data.event_date ? new Date(data.event_date).toISOString() : null,
      venue_name:data.venue_name || null, venue_address:data.venue_address || null,
      dress_code:data.dress_code || null, theme_primary:data.theme_primary,
      theme_secondary:data.theme_secondary, template_key:data.template_key || null,
      logo_url:data.logo_url || null, secondary_logo_url:data.secondary_logo_url || null,
      hero_image_url:data.hero_image_url || null, music_url:data.music_url || null,
      updated_at:new Date().toISOString()
    };
    await api.update("events", values, { id:eventId });
    state.event = { ...state.event, ...values };
    $("[data-event-title]").textContent = values.name;
    setStatus("Diseño guardado", true);
  } catch (error) { setStatus(errorMessage(error)); }
  finally { setBusy(false); }
}

function setBusy(busy) { $("[data-save]").disabled = busy; $("#designer-form").setAttribute("aria-busy", String(busy)); }
function setStatus(message, success = false) { const node = $("[data-status]"); node.textContent = message; node.dataset.success = String(success); }
function fail(message) { const node = $("[data-error]"); node.hidden = false; node.textContent = message; $(".designer-layout").hidden = true; }
function safeColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback; }
function safeAsset(value) { const text = String(value || "").trim(); if (/^(https?:|data:|blob:)/i.test(text)) return text; return text.replace(/^\/+/, ""); }
function toLocalInput(value) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
function formatDate(value) { try { return new Intl.DateTimeFormat("es-MX", { dateStyle:"long", timeStyle:"short" }).format(new Date(value)); } catch { return value; } }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "No fue posible completar la operación."; }
