/**
 * Punto de entrada principal de LN Studio.
 */

import {
  initializeDemoActions,
  initializeLeadForm,
  initializeRevealAnimations,
  renderCollections,
  renderFaq,
  renderTestimonials
} from "./landing.js";
import { select, selectAll } from "./utils.js";

/** Inicializa cabecera, navegación y controles globales. */
function initializeNavigation() {
  const header = select(".site-header");
  const menuButton = select(".menu-toggle");
  const navigation = select(".main-nav");
  const backToTop = select(".back-to-top");

  const updateScrollState = () => {
    const hasScrolled = window.scrollY > 20;
    header?.classList.toggle("is-scrolled", hasScrolled);
    backToTop?.classList.toggle("is-visible", window.scrollY > 520);
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation?.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  selectAll("a", navigation || document).forEach((link) => {
    link.addEventListener("click", () => {
      menuButton?.setAttribute("aria-expanded", "false");
      navigation?.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    });
  });

  backToTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateScrollState, { passive: true });
  updateScrollState();
}

/** Ejecuta la aplicación cuando el DOM está disponible. */
async function initializeApplication() {
  initializeNavigation();
  initializeLeadForm();
  initializeDemoActions();

  await Promise.all([renderCollections(), renderTestimonials(), renderFaq()]);
  initializeRevealAnimations();

  const yearElement = select("#current-year");
  if (yearElement) yearElement.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", initializeApplication);
