/**
 * Funcionalidad exclusiva de la landing page de LN Studio.
 */

import { escapeHtml, fetchJson, formDataToObject, select, selectAll, showToast } from "./utils.js";

/** Inicializa las animaciones activadas por desplazamiento. */
export function initializeRevealAnimations() {
  const elements = selectAll(".reveal-up, .reveal-scale");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" }
  );

  elements.forEach((element) => observer.observe(element));
}

/** Carga y dibuja las colecciones iniciales del catálogo. */
export async function renderCollections() {
  const grid = select("#collection-grid");
  if (!grid) return;

  try {
    const data = await fetchJson("catalogo.json");
    const collections = Array.isArray(data.colecciones) ? data.colecciones.slice(0, 6) : [];

    grid.innerHTML = collections
      .map((collection) => `
        <article class="collection-card reveal-up" style="--collection-background: ${escapeHtml(collection.fondo)}">
          <span class="collection-label">${escapeHtml(collection.categoria)}</span>
          <div class="collection-content">
            <h3>${escapeHtml(collection.nombre)}</h3>
            <p>${escapeHtml(collection.descripcion)}</p>
          </div>
        </article>
      `)
      .join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = "<p>No fue posible cargar las colecciones en este momento.</p>";
  }
}

/** Carga y dibuja testimonios desde JSON. */
export async function renderTestimonials() {
  const grid = select("#testimonials-grid");
  if (!grid) return;

  try {
    const data = await fetchJson("testimonials.json");
    const testimonials = Array.isArray(data.testimonios) ? data.testimonios : [];

    grid.innerHTML = testimonials
      .map((testimonial) => `
        <article class="testimonial-card reveal-up">
          <div class="testimonial-stars" aria-label="5 de 5 estrellas">★★★★★</div>
          <blockquote>“${escapeHtml(testimonial.comentario)}”</blockquote>
          <div class="testimonial-author">
            <strong>${escapeHtml(testimonial.nombre)}</strong>
            <span>${escapeHtml(testimonial.evento)}</span>
          </div>
        </article>
      `)
      .join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = "<p>No fue posible cargar los testimonios en este momento.</p>";
  }
}

/** Carga y configura el acordeón de preguntas frecuentes. */
export async function renderFaq() {
  const list = select("#faq-list");
  if (!list) return;

  try {
    const data = await fetchJson("faq.json");
    const questions = Array.isArray(data.preguntas) ? data.preguntas : [];

    list.innerHTML = questions
      .map((item, index) => `
        <article class="accordion-item reveal-up">
          <h3>
            <button class="accordion-button" type="button" aria-expanded="false" aria-controls="faq-panel-${index}">
              <span>${escapeHtml(item.pregunta)}</span>
              <span class="accordion-icon" aria-hidden="true">+</span>
            </button>
          </h3>
          <div class="accordion-panel" id="faq-panel-${index}">
            <div><p>${escapeHtml(item.respuesta)}</p></div>
          </div>
        </article>
      `)
      .join("");

    selectAll(".accordion-button", list).forEach((button) => {
      button.addEventListener("click", () => {
        const panel = document.getElementById(button.getAttribute("aria-controls"));
        const isExpanded = button.getAttribute("aria-expanded") === "true";

        selectAll(".accordion-button", list).forEach((otherButton) => {
          otherButton.setAttribute("aria-expanded", "false");
          const otherPanel = document.getElementById(otherButton.getAttribute("aria-controls"));
          otherPanel?.classList.remove("is-open");
        });

        if (!isExpanded) {
          button.setAttribute("aria-expanded", "true");
          panel?.classList.add("is-open");
        }
      });
    });
  } catch (error) {
    console.error(error);
    list.innerHTML = "<p>No fue posible cargar las preguntas frecuentes.</p>";
  }
}

/** Valida el formulario y guarda temporalmente la solicitud en localStorage. */
export function initializeLeadForm() {
  const form = select("#lead-form");
  if (!(form instanceof HTMLFormElement)) return;

  const dateInput = select("#fecha", form);
  if (dateInput instanceof HTMLInputElement) {
    dateInput.min = new Date().toISOString().split("T")[0];
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const formData = new FormData(form);
    const lead = formDataToObject(formData);
    const errors = validateLead(lead);

    if (Object.keys(errors).length > 0) {
      displayFormErrors(form, errors);
      select("#form-status", form).textContent = "Revisa los campos marcados.";
      return;
    }

    const savedLeads = JSON.parse(localStorage.getItem("lnstudio_leads") || "[]");
    savedLeads.push({ ...lead, creado_en: new Date().toISOString() });
    localStorage.setItem("lnstudio_leads", JSON.stringify(savedLeads));

    form.reset();
    select("#form-status", form).textContent = "Solicitud registrada. Te contactaremos muy pronto.";
    showToast("Tu solicitud fue registrada correctamente.");
  });
}

/**
 * Valida la información del prospecto.
 * @param {Record<string, string|boolean>} lead Datos recibidos.
 * @returns {Record<string, string>}
 */
function validateLead(lead) {
  const errors = {};
  const phonePattern = /^[0-9+()\s-]{8,20}$/;

  if (!lead.nombre || String(lead.nombre).length < 2) {
    errors.nombre = "Escribe un nombre válido.";
  }

  if (!lead.telefono || !phonePattern.test(String(lead.telefono))) {
    errors.telefono = "Escribe un número de WhatsApp válido.";
  }

  if (!lead.evento) {
    errors.evento = "Selecciona el tipo de evento.";
  }

  if (!lead.fecha) {
    errors.fecha = "Selecciona la fecha del evento.";
  }

  if (!lead.privacidad) {
    errors.privacidad = "Debes aceptar el tratamiento de datos.";
  }

  return errors;
}

/** Limpia mensajes y estados visuales de error. */
function clearFormErrors(form) {
  selectAll(".field-group", form).forEach((group) => group.classList.remove("has-error"));
  selectAll(".field-error", form).forEach((element) => {
    element.textContent = "";
  });
}

/** Muestra errores junto a cada campo. */
function displayFormErrors(form, errors) {
  Object.entries(errors).forEach(([fieldName, message]) => {
    if (fieldName === "privacidad") {
      select(".checkbox-error", form).textContent = message;
      return;
    }

    const field = select(`[name="${fieldName}"]`, form);
    const group = field?.closest(".field-group");
    group?.classList.add("has-error");
    const errorElement = select(".field-error", group || form);
    if (errorElement) errorElement.textContent = message;
  });
}

/** Activa botones de demostración dentro de la maqueta. */
export function initializeDemoActions() {
  selectAll("[data-demo-toast]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast("Demostración: el RSVP completo se integrará en el módulo de invitaciones.");
    });
  });
}
