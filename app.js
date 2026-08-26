import { initializeCatalog } from "./catalogo.js";
import { api, ApiError } from "./supabase.js";

const LNStudio = {
  email: "lnstudio.eventos@gmail.com",
  init() { this.setupHeader(); this.setupMenu(); this.setupReveal(); this.setupYear(); initializeCatalog(); this.setupContactForm(); this.setupQuoteForm(); },

  setupHeader() { const header = document.querySelector(".site-header"); if (!header) return; const update = () => header.classList.toggle("scrolled", scrollY > 24); update(); addEventListener("scroll", update, { passive: true }); },
  setupMenu() { const button = document.querySelector(".menu-button"), nav = document.querySelector(".main-navigation"); if (!button || !nav) return; const close = () => { nav.classList.remove("open"); button.setAttribute("aria-expanded", "false"); document.body.classList.remove("menu-open"); }; button.addEventListener("click", () => { const open = nav.classList.toggle("open"); button.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("menu-open", open); }); nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close)); },
  setupReveal() { const items = document.querySelectorAll(".reveal"); if (!items.length) return; if (!("IntersectionObserver" in window)) return items.forEach((item) => item.classList.add("visible")); const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } }), { threshold: .12 }); items.forEach((item) => observer.observe(item)); },
  setupYear() { document.querySelectorAll("[data-current-year]").forEach((node) => node.textContent = new Date().getFullYear()); },

  setupContactForm() {
    const form = document.querySelector("#contact-form"); if (!form) return;
    form.addEventListener("submit", (event) => { event.preventDefault(); if (!form.reportValidity()) return; const data = new FormData(form); const subject = `Contacto LN Studio · ${data.get("evento")}`; const body = ["Hola LN Studio,", "", `Mi nombre es: ${data.get("nombre")}`, `Mi correo es: ${data.get("correo")}`, `Tipo de evento: ${data.get("evento")}`, "", "Mensaje:", data.get("mensaje")].join("\n"); location.href = `mailto:${this.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; });
  },

  setupQuoteForm() {
    const form = document.querySelector("#quote-form"); if (!form) return;
    const steps = [...form.querySelectorAll(".quote-step")], back = document.querySelector("#quote-back"), next = document.querySelector("#quote-next"), submit = document.querySelector("#quote-submit"), progress = document.querySelector("#quote-progress"), label = document.querySelector("#quote-step-label"), status = document.querySelector("#quote-status"), summary = document.querySelector("#quote-summary");
    let current = 0;
    const params = new URLSearchParams(location.search), collection = params.get("coleccion"), packageKey = params.get("paquete");
    if (collection && form.elements.detalles) form.elements.detalles.value = `Me interesa personalizar la colección: ${collection}.`;
    const packageValue = ({ basico:"Básico · desde $249", intermedio:"Intermedio · desde $300", premium:"Premium · desde $480" })[packageKey];
    if (packageValue) { const radio = [...form.elements.paquete].find((item) => item.value === packageValue); if (radio) radio.checked = true; }

    const show = (index) => {
      current = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => step.classList.toggle("active", stepIndex === current));
      back.hidden = current === 0; next.hidden = current === steps.length - 1; submit.hidden = current !== steps.length - 1;
      progress.style.width = `${((current + 1) / steps.length) * 100}%`; label.textContent = current === steps.length - 1 ? "Resumen final" : `Paso ${current + 1} de ${steps.length}`; status.textContent = "";
      if (current === steps.length - 1) renderSummary();
      document.querySelector(".quote-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const validateStep = () => {
      const controls = [...steps[current].querySelectorAll("input,select,textarea")].filter((control) => !control.disabled && control.type !== "hidden");
      for (const control of controls) { if (control.checkValidity()) continue; control.reportValidity(); return false; }
      return true;
    };

    const record = () => { const data = new FormData(form); return { evento: data.get("evento"), fecha: data.get("fecha"), invitados: Number(data.get("invitados") || 0), estilo: data.get("estilo"), funciones: data.getAll("funciones"), producto: data.get("producto"), paquete: data.get("paquete"), urgente: data.get("urgente") === "Sí", archivos: [...(form.elements.archivos?.files || [])], nombre: data.get("nombre"), correo: data.get("correo"), whatsapp: data.get("whatsapp"), ciudad: data.get("ciudad"), detalles: data.get("detalles") || "" }; };
    const renderSummary = () => { const item = record(); summary.innerHTML = `<dl class="quote-summary-grid"><div><dt>Evento</dt><dd>${escapeHtml(item.evento || "—")}</dd></div><div><dt>Fecha</dt><dd>${escapeHtml(item.fecha || "Por definir")}</dd></div><div><dt>Producto</dt><dd>${escapeHtml(item.producto || "—")}</dd></div><div><dt>Paquete</dt><dd>${escapeHtml(item.paquete || "—")}</dd></div><div><dt>Estilo</dt><dd>${escapeHtml(item.estilo || "—")}</dd></div><div><dt>Funciones</dt><dd>${escapeHtml(item.funciones.join(", ") || "Sin extras")}</dd></div><div><dt>Urgente</dt><dd>${item.urgente ? "Sí" : "No"}</dd></div><div><dt>Archivos</dt><dd>${item.archivos.length}</dd></div><div><dt>Contacto</dt><dd>${escapeHtml(item.nombre || "—")} · ${escapeHtml(item.whatsapp || "—")}</dd></div></dl>`; };

    next.addEventListener("click", () => { if (validateStep()) show(current + 1); }); back.addEventListener("click", () => show(current - 1));
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); if (current !== steps.length - 1) return; if (!form.reportValidity()) return;
      const item = record(); submit.disabled = true; back.disabled = true; status.textContent = "Registrando tu solicitud…";
      try {
        if (item.archivos.length > 5 || item.archivos.some((file) => file.size > 10 * 1024 * 1024)) throw new Error("Puedes adjuntar hasta 5 archivos de máximo 10 MB cada uno.");
        const result = await api.rpc("submit_quote_request_v2", { p_name: item.nombre, p_email: item.correo, p_phone: item.whatsapp, p_city: item.ciudad, p_event_type: item.evento, p_event_date: item.fecha || null, p_guest_count: item.invitados, p_style: item.estilo, p_features: item.funciones, p_details: item.detalles, p_product: item.producto, p_package: item.paquete, p_urgent: item.urgente }, { publicCall: true });
        if (!result?.ok) throw new Error(result?.message || "No fue posible registrar la solicitud.");
        for (const file of item.archivos) {
          const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90);
          const path = `${result.id}/${result.upload_token}/${crypto.randomUUID()}-${safeName}`;
          await api.uploadPublicFile("quote-attachments", path, file);
          await api.rpc("register_quote_attachment", { p_quote_id: result.id, p_upload_token: result.upload_token, p_path: path, p_name: file.name, p_type: file.type, p_size: file.size }, { publicCall: true });
        }
        localStorage.setItem("lnstudio-ultima-cotizacion", JSON.stringify({ ...item, folio: result.folio, creado: new Date().toISOString() }));
        const waText = encodeURIComponent(`Hola LN Studio, acabo de enviar la cotización ${result.folio}. Mi nombre es ${item.nombre} y me interesa ${item.producto} (${item.paquete}).`);
        form.innerHTML = `<div class="quote-success"><p class="eyebrow">Solicitud recibida</p><h2>Gracias por confiar en LN Studio.</h2><p>Tu folio es:</p><strong>${escapeHtml(result.folio)}</strong><p>Conserva este folio. Tus archivos quedaron vinculados de forma privada.</p><div class="quote-success-actions"><a class="button" target="_blank" rel="noopener" href="https://wa.me/525646131484?text=${waText}">Continuar por WhatsApp</a><a class="button button-ghost" href="index.html">Volver al inicio</a></div></div>`;
        progress.style.width = "100%"; label.textContent = "Solicitud completada";
      } catch (error) { status.textContent = errorMessage(error); submit.disabled = false; back.disabled = false; }
    });
    show(0);
  }
};

function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "No pudimos guardar la solicitud. Inténtalo nuevamente."; }
document.addEventListener("DOMContentLoaded", () => LNStudio.init());
