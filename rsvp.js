import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
let eventData = null;
let token = null;
let passUrl = "";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  token = new URLSearchParams(location.search).get("token");
  if (!token) return fail("Invitación no válida.");
  bind();
  try {
    eventData = await api.rpc("get_public_event", { p_token: token }, { publicCall: true });
    if (!eventData?.id) return fail("Esta invitación no está disponible.");
    renderEvent();
  } catch (error) { fail(errorMessage(error)); }
}

function bind() {
  $("#rsvp-form").addEventListener("submit", submit);
  document.querySelectorAll('[name="attendance"]').forEach((radio) => radio.addEventListener("change", togglePartyFields));
  $("[data-calendar]").addEventListener("click", downloadCalendar);
  $("[data-download-qr]").addEventListener("click", downloadQr);
  $("[data-copy-pass]").addEventListener("click", copyPass);
}

function renderEvent() {
  document.title = `${eventData.name} | Invitación`;
  const accent = visibleAccent(eventData.theme_secondary, "#67e8f9");
  const accentTwo = visibleAccent(eventData.theme_primary, "#ff4d9d");
  document.documentElement.style.setProperty("--invite-accent", accent);
  document.documentElement.style.setProperty("--invite-accent-two", accentTwo);
  $("[data-name]").textContent = eventData.name;
  $("[data-description]").textContent = eventData.description || "";
  $("[data-date]").textContent = formatDate(eventData.event_date);
  $("[data-venue]").textContent = [eventData.venue_name, eventData.venue_address].filter(Boolean).join(" · ") || "Ubicación por confirmar";
  const map = $("[data-map]"); map.href = eventData.maps_url || "#"; map.hidden = !eventData.maps_url;
  $("[data-dress-code]").textContent = eventData.dress_code ? `Código de vestimenta: ${eventData.dress_code}` : "";
  const logo = $("[data-logo]"); if (eventData.logo_url) { logo.src = safeAsset(eventData.logo_url); logo.hidden = false; }
  const secondary = $("[data-secondary-logo]"); if (eventData.secondary_logo_url) { secondary.src = safeAsset(eventData.secondary_logo_url); $("[data-brand-row]").hidden = false; }
  const party = $("#rsvp-form [name=party_size]"); party.max = Number(eventData.max_companions || 0) + 1;
  $(".rsvp-submit small").textContent = eventData.qr_enabled ? "Generar pase digital" : "Registrar respuesta";
  if (!eventData.allow_general_rsvp) {
    $("[data-form-section]").innerHTML = '<p class="invite-kicker">Acceso individual</p><h2>Esta invitación requiere un enlace personal.</h2><p>Solicita tu enlace a los anfitriones.</p>';
  }
  startCountdown();
}

function togglePartyFields() {
  const confirmed = $("[name=attendance]:checked").value === "confirmed";
  document.querySelectorAll("[data-party-fields]").forEach((node) => node.hidden = !confirmed);
  $("[name=party_size]").required = confirmed;
}

async function submit(event) {
  event.preventDefault(); const form = event.currentTarget; const status = $("#status");
  if (!form.reportValidity()) return;
  const submitButton = form.querySelector('button[type="submit"]'); submitButton.disabled = true; status.textContent = "Registrando tu respuesta…";
  try {
    const data = new FormData(form);
    const result = await api.rpc("submit_public_rsvp", {
      p_token: token,
      p_name: data.get("name"), p_phone: data.get("phone"), p_email: data.get("email") || null,
      p_attendance: data.get("attendance"), p_party_size: Number(data.get("party_size") || 1),
      p_guest_names: data.get("guest_names") || null, p_dietary: data.get("dietary") || null, p_message: data.get("message") || null
    }, { publicCall: true });
    if (!result?.ok) throw new Error(result?.message || "No se pudo registrar la respuesta.");
    $("[data-form-section]").hidden = true; $("[data-pass]").hidden = false;
    if (result.pass) renderPass(result.pass);
    else {
      $("[data-pass-title]").textContent = "Respuesta registrada";
      $("[data-pass-copy]").textContent = "Gracias por avisar a los anfitriones.";
      $("[data-folio]").textContent = result.rsvp.id.slice(0, 8).toUpperCase();
      $("[data-capacity]").textContent = "";
    }
    $("[data-pass]").scrollIntoView({ behavior: "smooth" });
  } catch (error) { status.textContent = errorMessage(error); submitButton.disabled = false; }
}

function renderPass(pass) {
  const origin = location.origin && location.origin !== "null" ? location.origin : "https://lnstudio-invitaciones.pages.dev";
  passUrl = `${origin}/scanner.html?token=${encodeURIComponent(pass.token)}`;
  const canvas = $("#qr");
  window.LNQRCode.toCanvas(canvas, passUrl, { width: 300, margin: 4, level: "M" });
  canvas.hidden = false; $("[data-folio]").textContent = pass.folio; $("[data-capacity]").textContent = `Accesos autorizados: ${pass.allowed_entries}`;
  $("[data-download-qr]").hidden = false; $("[data-copy-pass]").hidden = false;
}

function downloadQr() {
  const canvas = $("#qr"); if (canvas.hidden) return;
  const link = document.createElement("a"); link.download = `pase-${$("[data-folio]").textContent || "ln-studio"}.png`; link.href = canvas.toDataURL("image/png"); link.click();
}
async function copyPass() { try { await navigator.clipboard.writeText(passUrl); $("[data-copy-pass]").textContent = "Pase copiado"; } catch { alert(passUrl); } }

function downloadCalendar() {
  if (!eventData?.event_date) return alert("La fecha todavía no está definida.");
  const start = new Date(eventData.event_date); const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LN Studio//Invitacion//ES", "BEGIN:VEVENT", `UID:${eventData.id}@lnstudio`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${ics(eventData.name)}`, `LOCATION:${ics([eventData.venue_name, eventData.venue_address].filter(Boolean).join(", "))}`, `DESCRIPTION:${ics(eventData.description || "")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${eventData.name}.ics`; link.click(); URL.revokeObjectURL(link.href);
}

function startCountdown() {
  const node = $("[data-countdown]"); if (!eventData.event_date) { node.textContent = "Fecha por confirmar."; return; }
  const target = new Date(eventData.event_date).getTime();
  const update = () => { const diff = target - Date.now(); if (diff <= 0) { node.textContent = "El gran momento ha llegado."; return; } const days = Math.floor(diff / 86400000); const hours = Math.floor(diff % 86400000 / 3600000); const minutes = Math.floor(diff % 3600000 / 60000); node.textContent = `${days} días · ${hours} horas · ${minutes} minutos`; };
  update(); setInterval(update, 60000);
}

function fail(message) { $("[data-name]").textContent = message; $("[data-description]").textContent = "Verifica que el enlace esté completo o consulta a los anfitriones."; $("[data-form-section]").hidden = true; }
function safeAsset(value) { const text = String(value || "").trim(); if (/^(https?:|data:|blob:)/i.test(text)) return text; return text.replace(/^\/+/, ""); }
function formatDate(value) { if (!value) return "Por confirmar"; return new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeStyle: "short" }).format(new Date(value)); }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "No fue posible guardar la respuesta."; }
function ics(value) { return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }


function visibleAccent(value, fallback) {
  const color = String(value || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(color)) return fallback;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.22 ? fallback : color;
}
