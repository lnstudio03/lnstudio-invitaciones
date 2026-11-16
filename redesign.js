const menu = document.querySelector(".menu");
const nav = document.querySelector("nav");

menu?.addEventListener("click", () => {
  const isOpen = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!isOpen));
  nav?.classList.toggle("open", !isOpen);
});

document.querySelectorAll("nav a").forEach((link) => {
  link.addEventListener("click", () => {
    nav?.classList.remove("open");
    menu?.setAttribute("aria-expanded", "false");
  });
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    }),
    { threshold: 0.1 }
  );
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const cardsContainer = document.querySelector(".cards");
const cards = [...document.querySelectorAll(".cards .card")];
const categoryButtons = [...document.querySelectorAll(".tabs button[data-filter]")];

if (cardsContainer && categoryButtons.length) {
  const emptyState = document.createElement("p");
  emptyState.className = "category-empty";
  emptyState.hidden = true;
  emptyState.textContent = "Aún no hay una muestra de esta categoría. Explora el catálogo completo.";
  const catalogLink = document.createElement("a");
  catalogLink.href = "catalogo.html";
  catalogLink.textContent = "Ver catálogo →";
  emptyState.append(" ", catalogLink);
  cardsContainer.after(emptyState);

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      let visibleCount = 0;

      categoryButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      cardsContainer.classList.toggle("is-filtered", filter !== "todos");
      const catalogFilter = filter === "infantil" ? "social" : filter;
      catalogLink.href = filter === "todos"
        ? "catalogo.html"
        : `catalogo.html?categoria=${encodeURIComponent(catalogFilter)}`;
      cards.forEach((card) => {
        const visible = filter === "todos" || card.dataset.categories?.split(" ").includes(filter);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      emptyState.hidden = filter === "todos" || visibleCount > 0;
    });
  });
}

const demoContent = {
  rsvp: {
    title: "Confirmaciones en tiempo real",
    metrics: [["CONFIRMADOS", "86", "personas"], ["PENDIENTES", "24", "respuestas"]],
    activity: ["Mariana confirmó 2 lugares", "Carlos confirmó su asistencia", "Fernanda agregó una nota"],
  },
  qr: {
    title: "Pases y acceso QR",
    metrics: [["PASES EMITIDOS", "86", "invitados"], ["ACCESOS REGISTRADOS", "24", "entradas"]],
    activity: ["Pase individual generado", "Acceso validado en la entrada", "Lista de invitados actualizada"],
  },
  panel: {
    title: "Controla tu evento desde cualquier lugar",
    metrics: [["INVITADOS", "86", "personas"], ["MESAS", "12", "asignadas"]],
    activity: ["Lista de invitados sincronizada", "Distribución de mesas actualizada", "Resumen del evento disponible"],
  },
  galeria: {
    title: "Galería y recuerdos",
    metrics: [["FOTOS", "86", "recuerdos"], ["ÁLBUMES", "3", "colecciones"]],
    activity: ["Nueva foto agregada a la galería", "Álbum compartido con invitados", "Recuerdos disponibles después del evento"],
  },
};

const demoButtons = [...document.querySelectorAll(".demo-list button[data-demo]")];
const dashboard = document.querySelector(".dash");

demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const content = demoContent[button.dataset.demo];
    if (!content || !dashboard) return;

    demoButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    dashboard.querySelector(".dashbody h3").textContent = content.title;
    dashboard.querySelectorAll(".metrics article").forEach((metric, index) => {
      const [label, value, detail] = content.metrics[index];
      metric.querySelector("small").textContent = label;
      metric.querySelector("b").textContent = value;
      metric.querySelector("span").textContent = detail;
    });
    dashboard.querySelector(".activity b").textContent = "Actividad reciente";
    dashboard.querySelectorAll(".activity p").forEach((item, index) => {
      item.textContent = `✓ ${content.activity[index]}`;
    });
  });
});
