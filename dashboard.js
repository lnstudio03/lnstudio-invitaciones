import { SUPABASE_CONFIG, getSupabaseClient, isSupabaseConfigured } from "./supabase.js";

const state = { records: [], filtered: [], client: null, mode: isSupabaseConfigured() ? "supabase" : "local" };
const labels = {
  "aniversario-fantasmas": "Aniversario Fantasmas",
  "boda-eternite": "Éternité",
  "boda-jardin-luz": "Jardín de Luz",
  "xv-eclat": "Éclat",
  "xv-celestial": "Celestial",
  "cumple-neon": "Neon Night",
  "bautizo-alba": "Alba",
  "baby-bloom": "Bloom",
  "corporativo-signature": "Signature",
  "corporativo-maison": "Maison"
};

document.addEventListener("DOMContentLoaded", initializeDashboard);

async function initializeDashboard() {
  configureLogin();
  document.querySelector("#admin-login-form")?.addEventListener("submit", handleLogin);
  document.querySelector("[data-logout]")?.addEventListener("click", logout);
  document.querySelector("[data-refresh]")?.addEventListener("click", loadRecords);
  document.querySelector("[data-export]")?.addEventListener("click", exportCsv);
  document.querySelector("[data-clear-local]")?.addEventListener("click", clearLocal);
  document.querySelectorAll("[data-search],[data-event-filter],[data-status-filter],[data-checkin-filter]").forEach((control) => control.addEventListener("input", applyFilters));

  if (state.mode === "supabase") {
    state.client = await getSupabaseClient();
    const { data } = await state.client.auth.getSession();
    if (data.session) await openDashboard();
  } else if (sessionStorage.getItem("lnstudio_admin_local") === "1") {
    await openDashboard();
  }
}

function configureLogin() {
  const copy = document.querySelector("[data-login-copy]");
  const email = document.querySelector("[data-email-field]");
  const passwordLabel = document.querySelector("[data-password-label]");
  if (state.mode === "supabase") {
    copy.textContent = "Inicia sesión con la cuenta administrativa configurada en Supabase.";
    email.hidden = false;
    email.querySelector("input").required = true;
    passwordLabel.firstChild.textContent = "Contraseña";
    document.querySelector("[data-clear-local]").hidden = true;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#login-status");
  const data = new FormData(form);
  status.textContent = "Verificando acceso…";

  try {
    if (state.mode === "local") {
      if (data.get("password") !== SUPABASE_CONFIG.localAdminPin) throw new Error("PIN incorrecto.");
      sessionStorage.setItem("lnstudio_admin_local","1");
    } else {
      const { error } = await state.client.auth.signInWithPassword({ email:String(data.get("email")||"").trim(),password:String(data.get("password")||"") });
      if (error) throw error;
    }
    status.textContent = "";
    await openDashboard();
  } catch (error) {
    status.textContent = error.message || "No fue posible iniciar sesión.";
  }
}

async function openDashboard() {
  document.querySelector("[data-login-view]").hidden = true;
  document.querySelector("[data-admin-view]").hidden = false;
  document.querySelector("[data-mode]").textContent = state.mode === "supabase" ? "Supabase conectado" : "Modo local";
  document.querySelector("[data-storage-note]").textContent = state.mode === "supabase"
    ? "Los datos están centralizados en Supabase y disponibles para usuarios administradores."
    : "Los datos están guardados únicamente en este navegador. Conecta Supabase para centralizarlos.";
  await loadRecords();
  if (state.mode === "supabase") initializeRealtime();
}

async function loadRecords() {
  try {
    if (state.mode === "supabase") {
      const { data,error } = await state.client.from("rsvps").select("*").order("created_at",{ascending:false});
      if (error) throw error;
      state.records = data || [];
    } else {
      state.records = JSON.parse(localStorage.getItem("lnstudio_rsvps") || "[]").sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    }
    populateEventFilter();
    applyFilters();
  } catch (error) {
    console.error(error);
    alert("No fue posible cargar las confirmaciones.");
  }
}

function populateEventFilter() {
  const select = document.querySelector("[data-event-filter]");
  const current = select.value;
  const slugs = [...new Set(state.records.map((item) => item.event_slug).filter(Boolean))];
  select.innerHTML = '<option value="todos">Todos los eventos</option>' + slugs.map((slug) => `<option value="${escapeHtml(slug)}">${escapeHtml(labels[slug] || slug)}</option>`).join("");
  select.value = [...select.options].some((option) => option.value === current) ? current : "todos";
}

function applyFilters() {
  const query = document.querySelector("[data-search]").value.trim().toLowerCase();
  const event = document.querySelector("[data-event-filter]").value;
  const status = document.querySelector("[data-status-filter]").value;
  const checkin = document.querySelector("[data-checkin-filter]").value;

  state.filtered = state.records.filter((record) => {
    const haystack = `${record.name||""} ${record.phone||""} ${record.id||""} ${record.guest_names||""}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (event === "todos" || record.event_slug === event)
      && (status === "todos" || record.attendance === status)
      && (checkin === "todos" || (checkin === "registrado" ? record.checked_in : !record.checked_in));
  });
  renderTable();
  renderMetrics();
}

function renderMetrics() {
  const records = state.filtered;
  const confirmed = records.filter((item) => item.attendance === "confirmado");
  const guestTotal = confirmed.reduce((sum,item) => sum + 1 + Number(item.guests_count||0),0);
  const checkedIn = confirmed.filter((item) => item.checked_in).reduce((sum,item) => sum + 1 + Number(item.guests_count||0),0);
  setMetric("total",records.length);
  setMetric("guests",guestTotal);
  setMetric("declined",records.filter((item) => item.attendance === "no_asiste").length);
  setMetric("checkin",checkedIn);
}
function setMetric(name,value){ document.querySelector(`[data-metric-${name}]`).textContent=String(value); }

function renderTable() {
  const body = document.querySelector("[data-table-body]");
  const empty = document.querySelector("[data-empty]");
  empty.hidden = state.filtered.length > 0;
  body.innerHTML = state.filtered.map((record) => {
    const confirmed = record.attendance === "confirmado";
    const folio = record.reference_code || `${record.event_slug === "aniversario-fantasmas" ? "AF" : "RSVP"}-${String(record.id).padStart(4,"0")}`;
    return `<tr>
      <td><div class="guest-name"><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(labels[record.event_slug]||record.event_slug||"Evento")} · ${folio}</small><small>${formatDate(record.created_at)}</small></div></td>
      <td><span class="status-pill ${confirmed ? "status-confirmed" : "status-declined"}">${confirmed ? "Confirmado" : "No asistirá"}</span></td>
      <td><div class="guest-companions"><strong>${Number(record.guests_count||0)}</strong><small>${escapeHtml(record.guest_names||"Sin nombres registrados")}</small></div></td>
      <td><div class="guest-contact"><strong>${escapeHtml(record.phone||"—")}</strong><small>${escapeHtml(record.message||"Sin mensaje")}</small></div></td>
      <td>${confirmed ? `<button class="checkin-button ${record.checked_in ? "checked" : ""}" data-checkin-id="${record.id}">${record.checked_in ? "✓ Registrado" : "Marcar llegada"}</button>` : "—"}</td>
      <td><div class="row-actions"><button class="delete-button" data-delete-id="${record.id}" aria-label="Eliminar registro">×</button></div></td>
    </tr>`;
  }).join("");

  body.querySelectorAll("[data-checkin-id]").forEach((button) => button.addEventListener("click",() => toggleCheckin(button.dataset.checkinId)));
  body.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click",() => deleteRecord(button.dataset.deleteId)));
}

async function toggleCheckin(id) {
  const record = state.records.find((item) => String(item.id) === String(id));
  if (!record) return;
  const checked = !record.checked_in;
  if (state.mode === "supabase") {
    const { error } = await state.client.from("rsvps").update({ checked_in:checked,checked_in_at:checked ? new Date().toISOString() : null }).eq("id",id);
    if (error) return alert("No fue posible actualizar el check-in.");
  } else {
    record.checked_in=checked; record.checked_in_at=checked ? new Date().toISOString() : null; saveLocal();
  }
  await loadRecords();
}

async function deleteRecord(id) {
  if (!confirm("¿Eliminar esta respuesta de asistencia?")) return;
  if (state.mode === "supabase") {
    const { error } = await state.client.from("rsvps").delete().eq("id",id);
    if (error) return alert("No fue posible eliminar el registro.");
  } else {
    state.records = state.records.filter((item) => String(item.id) !== String(id)); saveLocal();
  }
  await loadRecords();
}

function saveLocal(){ localStorage.setItem("lnstudio_rsvps",JSON.stringify(state.records)); }

function exportCsv() {
  if (!state.filtered.length) return alert("No hay datos para exportar.");
  const rows = [["Folio","Evento","Nombre","WhatsApp","Respuesta","Acompañantes","Nombres acompañantes","Mensaje","Check-in","Fecha de respuesta"]];
  state.filtered.forEach((record) => rows.push([
    record.reference_code || `${record.event_slug === "aniversario-fantasmas" ? "AF" : "RSVP"}-${String(record.id).padStart(4,"0")}`,
    labels[record.event_slug]||record.event_slug, record.name, record.phone,
    record.attendance === "confirmado" ? "Confirmado" : "No asistirá", record.guests_count||0,
    record.guest_names||"", record.message||"", record.checked_in ? "Sí" : "No", record.created_at
  ]));
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`asistencia-ln-studio-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(link.href);
}
function csvCell(value){ return `"${String(value??"").replaceAll('"','""')}"`; }

function clearLocal() {
  if (state.mode !== "local") return;
  if (!confirm("Esto eliminará todas las respuestas guardadas en este navegador. ¿Continuar?")) return;
  localStorage.removeItem("lnstudio_rsvps"); loadRecords();
}

async function logout() {
  if (state.mode === "supabase") await state.client.auth.signOut();
  sessionStorage.removeItem("lnstudio_admin_local");
  location.reload();
}

function initializeRealtime() {
  state.client.channel("lnstudio-rsvps-admin").on("postgres_changes",{event:"*",schema:"public",table:"rsvps"},loadRecords).subscribe();
}
function formatDate(value){ if(!value)return"";return new Intl.DateTimeFormat("es-MX",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); }
function escapeHtml(value=""){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
