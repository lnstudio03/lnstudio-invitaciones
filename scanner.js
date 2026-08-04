import { api, ApiError } from "./supabase.js";
const $ = (selector) => document.querySelector(selector);
let events = [], currentToken = null, currentData = null, stream = null, detector = null, scanning = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const session = await api.getSession(); if (!session) return location.replace("admin.html");
  bind();
  try {
    events = await api.select("events", { order: "event_date.asc" }) || [];
    const select = $("[data-event-select]");
    select.innerHTML = '<option value="">Selecciona un evento</option>' + events.map((event) => `<option value="${event.id}">${escapeHtml(event.name)}</option>`).join("");
    const requestedEvent = new URLSearchParams(location.search).get("event"); if (requestedEvent && events.some((event) => event.id === requestedEvent)) select.value = requestedEvent;
    const token = extractToken(new URLSearchParams(location.search).get("token") || ""); if (token) await lookup(token);
  } catch (error) { status(errorMessage(error)); }
}

function bind() {
  $("#manual-form").addEventListener("submit", async (event) => { event.preventDefault(); const token = extractToken(new FormData(event.currentTarget).get("token")); if (token) await lookup(token); });
  $("[data-start-camera]").addEventListener("click", startCamera);
  $("[data-stop-camera]").addEventListener("click", stopCamera);
  $("[data-approve]").addEventListener("click", () => processDecision("approved"));
  $("[data-reject]").addEventListener("click", () => processDecision("rejected"));
}

async function startCamera() {
  if (!("BarcodeDetector" in window)) return status("Este navegador no permite escanear directamente. Usa el campo manual o abre la página en Chrome Android actualizado.");
  if (!navigator.mediaDevices?.getUserMedia) return status("No se encontró acceso a la cámara. Usa el campo manual.");
  try {
    detector = new BarcodeDetector({ formats: ["qr_code"] });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const video = $("[data-video]"); video.srcObject = stream; video.hidden = false; $("[data-camera-placeholder]").hidden = true; await video.play();
    scanning = true; $("[data-stop-camera]").hidden = false; $("[data-start-camera]").hidden = true; status("Apunta la cámara al código QR."); scanFrame();
  } catch (error) { status(`No fue posible abrir la cámara: ${error.message}`); stopCamera(); }
}

async function scanFrame() {
  if (!scanning || !detector) return;
  try {
    const codes = await detector.detect($("[data-video]"));
    const raw = codes?.[0]?.rawValue;
    if (raw) { scanning = false; await lookup(extractToken(raw)); setTimeout(() => { if (stream) { scanning = true; scanFrame(); } }, 1800); return; }
  } catch { /* Se reintenta en el siguiente cuadro. */ }
  requestAnimationFrame(scanFrame);
}

function stopCamera() {
  scanning = false; stream?.getTracks().forEach((track) => track.stop()); stream = null;
  const video = $("[data-video]"); video.pause(); video.srcObject = null; video.hidden = true; $("[data-camera-placeholder]").hidden = false; $("[data-stop-camera]").hidden = true; $("[data-start-camera]").hidden = false;
}

async function lookup(token) {
  if (!token) return status("Escribe o escanea un token.");
  currentToken = token; currentData = null; status("Consultando pase…");
  try {
    const eventId = $("[data-event-select]").value || null;
    const result = await api.rpc("lookup_access_pass", { p_token: token, p_event_id: eventId });
    currentData = result;
    if (!result?.ok) return show(false, "Código no válido", result?.message || "No se encontró el pase.");
    const pass = result.pass; const remaining = Number(result.remaining || 0);
    $("[data-folio]").textContent = pass.folio; $("[data-remaining]").textContent = `${remaining} de ${pass.allowed_entries}`; $("[data-event-name]").textContent = result.event?.name || "—"; $("[data-phone]").textContent = result.guest?.phone || "—";
    const entries = $("[data-entries]"); entries.max = Math.max(remaining, 1); entries.value = Math.max(Math.min(remaining, 1), 1);
    const valid = pass.status === "active" && remaining > 0;
    show(valid, result.guest?.name || "Pase digital", pass.status === "completed" ? "Este pase ya fue utilizado por completo." : pass.status === "cancelled" ? "Este pase fue cancelado." : `${remaining} acceso(s) disponible(s).`);
  } catch (error) { show(false, "No fue posible validar", errorMessage(error)); }
}

function show(valid, title, message) {
  $("[data-result]").hidden = false; $("[data-result-state]").textContent = valid ? "Pase válido" : "Revisión requerida"; $("[data-result-title]").textContent = title; $("[data-result-message]").textContent = message; $("[data-approve]").disabled = !valid; status("");
}

async function processDecision(decision) {
  if (!currentToken) return;
  const button = decision === "approved" ? $("[data-approve]") : $("[data-reject]"); button.disabled = true; status("Registrando decisión…");
  try {
    const result = await api.rpc("process_checkin", { p_token: currentToken, p_entries: Number($("[data-entries]").value || 1), p_decision: decision, p_reason: $("[data-reason]").value || null, p_device: navigator.userAgent, p_event_id: $("[data-event-select]").value || null });
    status(result?.message || "Operación registrada."); await lookup(currentToken);
  } catch (error) { status(errorMessage(error)); button.disabled = false; }
}

function extractToken(value = "") { const text = String(value || "").trim(); if (!text) return ""; try { const url = new URL(text); return url.searchParams.get("token") || url.pathname.split("/").filter(Boolean).pop() || ""; } catch { return text.replace(/^.*token=/, "").split("&")[0]; } }
function status(message) { $("#scan-status").textContent = message; }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "Error inesperado."; }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
window.addEventListener("beforeunload", stopCamera);
