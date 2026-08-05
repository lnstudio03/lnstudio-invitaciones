import { api, ApiError } from "./supabase.js";

const form = document.querySelector("#password-form");
const status = document.querySelector("[data-status]");
const copy = document.querySelector("[data-copy]");
const actions = document.querySelector("[data-actions]");
const eventId = new URLSearchParams(location.search).get("event");

init();

async function init() {
  try {
    const session = await api.getSession();
    if (!session) {
      copy.textContent = "El enlace no contiene una sesión válida o ya venció.";
      status.textContent = "Solicita a LN Studio que reenvíe la invitación de acceso.";
      return;
    }

    const user = await api.getUser();
    copy.textContent = `Enlace validado para ${user?.email || "tu correo"}. Elige una contraseña de al menos 8 caracteres.`;
    form.hidden = false;
    form.addEventListener("submit", savePassword);
  } catch (error) {
    status.textContent = errorMessage(error);
  }
}

async function savePassword(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const password = form.elements.password.value;
  const confirmation = form.elements.confirmation.value;
  if (password !== confirmation) {
    status.textContent = "Las contraseñas no coinciden.";
    return;
  }

  setBusy(true);
  status.dataset.success = "false";
  status.textContent = "Guardando contraseña y activando tu acceso…";

  try {
    await api.updatePassword(password);
    await api.rpc("complete_event_invitation", { p_event_id: eventId || null });
    status.dataset.success = "true";
    status.textContent = "Tu contraseña quedó creada y el acceso al evento está activo.";
    copy.textContent = "Ya puedes entrar al panel privado con el correo que recibió la invitación.";
    form.hidden = true;
    actions.hidden = false;
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  [...form.elements].forEach((field) => { field.disabled = busy; });
  form.setAttribute("aria-busy", String(busy));
}

function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  return error?.message || "No fue posible completar la activación.";
}
