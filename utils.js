/**
 * Utilidades generales de LN Studio.
 */

/**
 * Selecciona un elemento del DOM.
 * @param {string} selector Selector CSS.
 * @param {ParentNode} context Contexto opcional de búsqueda.
 * @returns {Element|null}
 */
export function select(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Selecciona varios elementos del DOM y devuelve un arreglo real.
 * @param {string} selector Selector CSS.
 * @param {ParentNode} context Contexto opcional de búsqueda.
 * @returns {Element[]}
 */
export function selectAll(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Obtiene información JSON mediante fetch con control de errores.
 * @param {string} url Ruta del archivo JSON.
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No fue posible cargar ${url}. Código: ${response.status}`);
  }

  return response.json();
}

/**
 * Escapa texto antes de insertarlo como HTML.
 * @param {string} value Texto original.
 * @returns {string}
 */
export function escapeHtml(value) {
  const temporaryElement = document.createElement("div");
  temporaryElement.textContent = String(value ?? "");
  return temporaryElement.innerHTML;
}

/**
 * Muestra una notificación temporal.
 * @param {string} message Mensaje para el usuario.
 * @param {number} duration Duración en milisegundos.
 */
export function showToast(message, duration = 2800) {
  const toast = select("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, duration);
}

showToast.timeoutId = 0;

/**
 * Convierte un objeto FormData a un objeto plano.
 * @param {FormData} formData Información del formulario.
 * @returns {Record<string, string|boolean>}
 */
export function formDataToObject(formData) {
  const result = {};

  for (const [key, value] of formData.entries()) {
    result[key] = typeof value === "string" ? value.trim() : value;
  }

  return result;
}
