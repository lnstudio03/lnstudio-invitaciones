import { initializeCatalog } from "./catalogo.js";

const LNStudio = {
  email: "lnstudio.eventos@gmail.com",

  init() {
    this.setupHeader();
    this.setupMenu();
    this.setupReveal();
    this.setupYear();
    initializeCatalog();
    this.setupContactForm();
    this.setupQuoteForm();
  },

  setupHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const update = () => header.classList.toggle("scrolled", window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
  },

  setupMenu() {
    const button = document.querySelector(".menu-button");
    const nav = document.querySelector(".main-navigation");
    if (!button || !nav) return;
    const close = () => {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    };
    button.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  },

  setupReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
  },

  setupYear() {
    document.querySelectorAll("[data-current-year]").forEach((node) => {
      node.textContent = new Date().getFullYear();
    });
  },

  setupContactForm() {
    const form = document.querySelector("#contact-form");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const subject = `Contacto LN Studio · ${data.get("evento")}`;
      const body = [
        "Hola LN Studio,", "", `Mi nombre es: ${data.get("nombre")}`,
        `Mi correo es: ${data.get("correo")}`, `Tipo de evento: ${data.get("evento")}`,
        "", "Mensaje:", data.get("mensaje")
      ].join("\n");
      window.location.href = `mailto:${this.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  },

  setupQuoteForm() {
    const form = document.querySelector("#quote-form");
    if (!form) return;
    const steps = [...form.querySelectorAll(".quote-step")];
    const back = document.querySelector("#quote-back");
    const next = document.querySelector("#quote-next");
    const submit = document.querySelector("#quote-submit");
    const progress = document.querySelector("#quote-progress");
    const label = document.querySelector("#quote-step-label");
    const status = document.querySelector("#quote-status");
    let current = 0;

    const collection = new URLSearchParams(location.search).get("coleccion");
    if (collection) {
      const details = form.querySelector("[name='detalles']");
      if (details) details.value = `Me interesa personalizar la colección: ${collection}.`;
    }

    const show = (index) => {
      steps.forEach((step, stepIndex) => step.classList.toggle("active", stepIndex === index));
      back.hidden = index === 0;
      next.hidden = index === steps.length - 1;
      submit.hidden = index !== steps.length - 1;
      progress.style.width = `${((index + 1) / steps.length) * 100}%`;
      label.textContent = `Paso ${index + 1} de ${steps.length}`;
      status.textContent = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const validateCurrent = () => {
      const controls = [...steps[current].querySelectorAll("input, select, textarea")];
      for (const control of controls) {
        if (control.checkValidity()) continue;
        control.reportValidity();
        return false;
      }
      return true;
    };

    next.addEventListener("click", () => { if (validateCurrent()) show(++current); });
    back.addEventListener("click", () => show(--current));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const record = {
        evento: data.get("evento"), fecha: data.get("fecha"), invitados: data.get("invitados"),
        estilo: data.get("estilo"), funciones: data.getAll("funciones"), nombre: data.get("nombre"),
        correo: data.get("correo"), whatsapp: data.get("whatsapp"), ciudad: data.get("ciudad"),
        detalles: data.get("detalles"), creado: new Date().toISOString()
      };
      localStorage.setItem("lnstudio-ultima-cotizacion", JSON.stringify(record));
      const body = [
        "Hola LN Studio,", "", "Deseo solicitar una cotización:", "",
        `Nombre: ${record.nombre}`, `Correo: ${record.correo}`, `WhatsApp: ${record.whatsapp}`,
        `Ciudad: ${record.ciudad}`, `Evento: ${record.evento}`, `Fecha: ${record.fecha}`,
        `Invitados aproximados: ${record.invitados}`, `Estilo: ${record.estilo}`,
        `Funciones: ${record.funciones.length ? record.funciones.join(", ") : "Por definir"}`,
        "", `Detalles: ${record.detalles || "Sin detalles adicionales"}`
      ].join("\n");
      status.textContent = "Solicitud preparada. Se abrirá tu aplicación de correo.";
      setTimeout(() => {
        location.href = `mailto:${this.email}?subject=${encodeURIComponent(`Solicitud de cotización · ${record.evento} · ${record.nombre}`)}&body=${encodeURIComponent(body)}`;
      }, 300);
    });

    show(0);
  }
};

document.addEventListener("DOMContentLoaded", () => LNStudio.init());
