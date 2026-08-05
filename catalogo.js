const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export async function initializeCatalog() {
  const grid = document.querySelector("#catalog-grid");
  if (!grid) return;

  const count = document.querySelector("[data-catalog-count]");
  const buttons = [...document.querySelectorAll(".filter-button")];

  try {
    const response = await fetch("catalogo.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No fue posible cargar el catálogo.");
    const invitations = await response.json();

    const render = (filter = "todos") => {
      const visible = filter === "todos"
        ? invitations
        : invitations.filter((item) => item.categoria === filter);

      if (count) count.textContent = String(visible.length);

      grid.innerHTML = visible.length
        ? visible.map((item) => createCard(item)).join("")
        : '<div class="catalog-empty"><h2>No hay modelos en esta categoría.</h2><p>Muy pronto agregaremos nuevas experiencias.</p></div>';
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        render(button.dataset.filter || "todos");
      });
    });

    render();
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<div class="catalog-empty"><h2>Catálogo no disponible</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function createCard(item) {
  const url = `invitacion.html?modelo=${encodeURIComponent(item.id)}`;
  const classes = "invitation-card is-featured";
  return `
    <article class="${classes}">
      <a class="invitation-visual" href="${url}" aria-label="Abrir invitación ${escapeHtml(item.nombre)}" style="--card-background:${escapeHtml(item.fondo)};--card-accent:${escapeHtml(item.acento)};--card-text:${escapeHtml(item.texto)}">
        <div class="phone-preview" aria-hidden="true">
          <div class="phone-screen">
            <small>${escapeHtml(item.categoriaTexto)}</small>
            <i></i>
            <strong>${escapeHtml(item.nombre)}</strong>
            <span>${escapeHtml(item.fecha)}</span>
          </div>
        </div>
      </a>
      <div class="invitation-info">
        <span class="card-badge">${escapeHtml(item.etiqueta)}</span>
        <h3>${escapeHtml(item.nombre)}</h3>
        <p>${escapeHtml(item.descripcion)}</p>
        <div class="invitation-meta"><span>Responsive</span><span>Cuenta regresiva</span><span>RSVP</span></div>
        <div class="card-actions">
          <a href="${url}">Abrir experiencia →</a>
          <a class="mini-link" href="cotizar.html?coleccion=${encodeURIComponent(item.nombre)}">Personalizar</a>
        </div>
      </div>
    </article>`;
}
