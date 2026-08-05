import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const eventId = new URLSearchParams(location.search).get("id");
const BUCKET = "invitation-assets";
const SECTION_LABELS = { hero:"Portada", countdown:"Cuenta regresiva", details:"Detalles", gallery:"Galería", rsvp:"Confirmación RSVP" };
const DEFAULT_ORDER = ["hero","countdown","details","gallery","rsvp"];
const DEFAULTS = {
  preset:"celebration",
  colors:{ background:"#0d1420", background2:"#1b2537", text:"#ffffff", muted:"#b7c1d5", primary:"#8f7dff", secondary:"#ff7f91", overlay:45, mode:"gradient" },
  typography:{ heading:"Fraunces", body:"Manrope", headingSize:64, bodySize:18, headingWeight:700, align:"center", transform:"none" },
  media:{ backgroundImage:"", gallery:[], heroFit:"cover", showMusicButton:true },
  animation:{ preset:"fade-up", ambient:"none", intensity:"medium", respectReducedMotion:true },
  content:{ kicker:"Invitación digital", rsvpTitle:"¿Nos acompañas?", rsvpCopy:"Confirma tu asistencia y recibe tu pase digital." },
  sections:{ order:[...DEFAULT_ORDER], enabled:{ hero:true,countdown:true,details:true,gallery:true,rsvp:true } }
};
const PRESETS = {
  celebration:{ primary:"#8f7dff",secondary:"#ff7f91",background:"#0d1420",background2:"#1b2537",text:"#ffffff",muted:"#b7c1d5",heading:"Fraunces",body:"Manrope",ambient:"sparkles" },
  kids:{ primary:"#38c6d1",secondary:"#f3c565",background:"#10212a",background2:"#243347",text:"#ffffff",muted:"#d4e3ea",heading:"Fredoka",body:"Nunito",ambient:"bubbles" },
  romantic:{ primary:"#c7789a",secondary:"#d8a06e",background:"#21151b",background2:"#34232a",text:"#fff9fb",muted:"#ddcbd2",heading:"Playfair Display",body:"Montserrat",ambient:"sparkles" },
  biker:{ primary:"#1748ff",secondary:"#ff0875",background:"#05070c",background2:"#15192a",text:"#ffffff",muted:"#c8cce0",heading:"Bebas Neue",body:"Montserrat",ambient:"neon" },
  corporate:{ primary:"#2774d8",secondary:"#40b8c4",background:"#0d1724",background2:"#182a3d",text:"#f6fbff",muted:"#b7c7d8",heading:"Montserrat",body:"Manrope",ambient:"none" },
  fantasy:{ primary:"#9b5de5",secondary:"#00d4b8",background:"#120e24",background2:"#25184a",text:"#ffffff",muted:"#d4cae9",heading:"Cinzel",body:"Poppins",ambient:"stars" }
};
let state = { user:null, profile:null, event:null, gallery:[], sections:[...DEFAULT_ORDER], enabled:{...DEFAULTS.sections.enabled}, uploading:0, localAssets:{} };
let previewMode = "mobile";
let previewResizeObserver = null;

window.addEventListener("DOMContentLoaded", init);

async function init() {
  bind();
  if (!eventId) return fail("Falta el identificador del evento.");
  try {
    const session = await api.getSession();
    if (!session) return location.replace(`admin.html?return=${encodeURIComponent(`disenador.html?id=${eventId}`)}`);
    state.user = await api.getUser();
    const [profiles, events] = await Promise.all([
      api.select("profiles", { filters:{ id:state.user.id }, limit:1 }),
      api.select("events", { filters:{ id:eventId }, limit:1 })
    ]);
    state.profile = profiles?.[0] || null;
    state.event = events?.[0] || null;
    if (!state.event) throw new Error("No tienes acceso a este evento o ya fue eliminado.");
    if (!["owner","staff"].includes(state.profile?.global_role)) throw new Error("El diseñador es exclusivo para la cuenta de LN Studio.");
    fill();
    renderSectionManager();
    renderGalleryManager();
    render();
    setupPreviewFitting();
    finishLoading();
    resetPreviewToTop();
    window.setTimeout(resetPreviewToTop, 80);
    window.setTimeout(resetPreviewToTop, 280);
    window.setTimeout(() => { fitPreviewTitle(); fitPreviewToVisibleArea(); }, 420);
  } catch (error) { fail(errorMessage(error)); }
}

function bind() {
  $(`[data-save]`).addEventListener("click", save);
  $("#designer-form").addEventListener("input", (event) => {
    if (event.target.type === "file") return;
    render(); setStatus("Cambios sin guardar");
  });
  $$(`[data-preview-size]`).forEach((button) => button.addEventListener("click", () => {
    previewMode = button.dataset.previewSize === "desktop" ? "desktop" : "mobile";
    $("[data-preview-device]").className = `preview-device ${previewMode}`;
    $$(`[data-preview-size]`).forEach((item) => item.classList.toggle("active", item === button));
    resetPreviewToTop();
    fitPreviewTitle();
    requestAnimationFrame(fitPreviewToVisibleArea);
  }));
  $$(`[data-preset]`).forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  $$(`[data-upload]`).forEach((input) => input.addEventListener("change", () => handleUpload(input)));
  $$(`[data-remove-asset]`).forEach((button) => button.addEventListener("click", () => {
    const fieldName = button.dataset.removeAsset;
    const field = $("#designer-form").elements[fieldName];
    revokeLocalAsset(fieldName);
    if (field) field.value = "";
    syncAssetFeedback(fieldName, "", "empty");
    render(); resetPreviewToTop(); setStatus("Archivo quitado · cambios sin guardar");
  }));
  $("[data-fix-contrast]").addEventListener("click", fixContrast);
}

function setupPreviewFitting() {
  const area = $(".preview-area");
  if (!area) return;

  previewResizeObserver?.disconnect();
  if ("ResizeObserver" in window) {
    previewResizeObserver = new ResizeObserver(() => fitPreviewToVisibleArea());
    previewResizeObserver.observe(area);
  }

  window.addEventListener("resize", fitPreviewToVisibleArea, { passive:true });
  window.visualViewport?.addEventListener("resize", fitPreviewToVisibleArea, { passive:true });
  window.visualViewport?.addEventListener("scroll", fitPreviewToVisibleArea, { passive:true });

  requestAnimationFrame(() => requestAnimationFrame(fitPreviewToVisibleArea));
  document.fonts?.ready?.then(fitPreviewToVisibleArea).catch(() => {});
}

function fitPreviewToVisibleArea() {
  const area = $(".preview-area");
  const device = $("[data-preview-device]");
  if (!area || !device || window.innerWidth <= 980) {
    if (device) {
      device.style.removeProperty("width");
      device.style.removeProperty("height");
      device.style.removeProperty("position");
      device.style.removeProperty("left");
      device.style.removeProperty("top");
      device.style.removeProperty("margin");
      device.style.removeProperty("transform");
    }
    return;
  }

  const natural = previewMode === "desktop"
    ? { width:1180, height:760 }
    : { width:390, height:844 };
  const styles = getComputedStyle(area);
  const horizontalPadding = parseFloat(styles.paddingLeft || 0) + parseFloat(styles.paddingRight || 0);
  const verticalPadding = parseFloat(styles.paddingTop || 0) + parseFloat(styles.paddingBottom || 0);
  const availableWidth = Math.max(1, area.clientWidth - horizontalPadding - 8);
  const availableHeight = Math.max(1, area.clientHeight - verticalPadding - 8);
  const scale = Math.min(availableWidth / natural.width, availableHeight / natural.height, 1);

  device.style.width = `${natural.width}px`;
  device.style.height = `${natural.height}px`;
  device.style.position = "absolute";
  device.style.left = "50%";
  device.style.top = "50%";
  device.style.margin = "0";
  device.style.transform = `translate(-50%, -50%) scale(${Math.max(.2, scale)})`;
  device.style.transformOrigin = "center center";
  device.dataset.fitScale = scale.toFixed(3);
}

function fill() {
  const form = $("#designer-form");
  const config = mergeConfig(state.event.design_config);
  const baseFields = ["name","description","venue_name","venue_address","dress_code","logo_url","secondary_logo_url","hero_image_url","music_url"];
  baseFields.forEach((name) => { if (form.elements[name]) form.elements[name].value = state.event[name] || ""; });
  if (state.event.event_date) form.elements.event_date.value = toLocalInput(state.event.event_date);
  form.elements.kicker.value = config.content.kicker;
  form.elements.rsvp_title.value = config.content.rsvpTitle;
  form.elements.rsvp_copy.value = config.content.rsvpCopy;
  form.elements.theme_primary.value = safeColor(state.event.theme_primary || config.colors.primary, config.colors.primary);
  form.elements.theme_secondary.value = safeColor(state.event.theme_secondary || config.colors.secondary, config.colors.secondary);
  form.elements.background_color.value = safeColor(config.colors.background, DEFAULTS.colors.background);
  form.elements.background_color_two.value = safeColor(config.colors.background2, DEFAULTS.colors.background2);
  form.elements.text_color.value = safeColor(config.colors.text, DEFAULTS.colors.text);
  form.elements.muted_color.value = safeColor(config.colors.muted, DEFAULTS.colors.muted);
  form.elements.background_mode.value = config.colors.mode;
  form.elements.overlay_opacity.value = Number(config.colors.overlay ?? 45);
  form.elements.heading_font.value = config.typography.heading;
  form.elements.body_font.value = config.typography.body;
  form.elements.heading_size.value = Number(config.typography.headingSize || 64);
  form.elements.body_size.value = Number(config.typography.bodySize || 18);
  form.elements.heading_weight.value = String(config.typography.headingWeight || 700);
  form.elements.text_align.value = config.typography.align || "center";
  form.elements.heading_transform.value = config.typography.transform || "none";
  form.elements.background_image_url.value = config.media.backgroundImage || "";
  form.elements.hero_fit.value = config.media.heroFit || "cover";
  form.elements.show_music_button.checked = config.media.showMusicButton !== false;
  form.elements.animation_preset.value = config.animation.preset || "fade-up";
  form.elements.ambient_animation.value = config.animation.ambient || "none";
  form.elements.animation_intensity.value = config.animation.intensity || "medium";
  form.elements.respect_reduced_motion.checked = config.animation.respectReducedMotion !== false;
  state.gallery = Array.isArray(config.media.gallery) ? config.media.gallery.filter(Boolean).slice(0,8) : [];
  state.sections = normalizeOrder(config.sections.order);
  state.enabled = { ...DEFAULTS.sections.enabled, ...(config.sections.enabled || {}) };
  $("[data-event-title]").textContent = state.event.name;
  $(`[data-open-invitation]`).href = `evento.html?id=${encodeURIComponent(state.event.id)}&preview=1`;
  $(`[data-open-invitation]`).hidden = false;
  ["logo_url","secondary_logo_url","hero_image_url","background_image_url","music_url"].forEach((fieldName) => syncAssetFeedback(fieldName, form.elements[fieldName]?.value || "", form.elements[fieldName]?.value ? "saved" : "empty"));
}

function mergeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULTS,
    ...source,
    colors:{ ...DEFAULTS.colors, ...(source.colors || {}) },
    typography:{ ...DEFAULTS.typography, ...(source.typography || {}) },
    media:{ ...DEFAULTS.media, ...(source.media || {}) },
    animation:{ ...DEFAULTS.animation, ...(source.animation || {}) },
    content:{ ...DEFAULTS.content, ...(source.content || {}) },
    sections:{ order:normalizeOrder(source.sections?.order), enabled:{ ...DEFAULTS.sections.enabled, ...(source.sections?.enabled || {}) } }
  };
}

function normalizeOrder(order) {
  const clean = Array.isArray(order) ? order.filter((item) => DEFAULT_ORDER.includes(item)) : [];
  DEFAULT_ORDER.forEach((item) => { if (!clean.includes(item)) clean.push(item); });
  return clean;
}

function applyPreset(name) {
  const preset = PRESETS[name]; if (!preset) return;
  const form = $("#designer-form");
  form.elements.theme_primary.value = preset.primary;
  form.elements.theme_secondary.value = preset.secondary;
  form.elements.background_color.value = preset.background;
  form.elements.background_color_two.value = preset.background2;
  form.elements.text_color.value = preset.text;
  form.elements.muted_color.value = preset.muted;
  form.elements.heading_font.value = preset.heading;
  form.elements.body_font.value = preset.body;
  form.elements.ambient_animation.value = preset.ambient;
  render(); setStatus("Cambios sin guardar");
}

async function handleUpload(input) {
  const role = input.dataset.upload;
  const files = [...(input.files || [])];
  if (!files.length) return;

  if (role === "gallery") {
    const remaining = Math.max(0, 8 - state.gallery.length);
    if (!remaining) { input.value = ""; return alert("La galería ya tiene 8 imágenes."); }
    for (const file of files.slice(0, remaining)) {
      try {
        const url = await uploadOne(file, "gallery");
        if (url) state.gallery.push(url);
      } catch (error) {
        setStatus(`No se pudo subir ${file.name}: ${errorMessage(error)}`);
        alert(errorMessage(error));
      }
    }
    renderGalleryManager(); render(); setStatus("Galería actualizada · guarda el diseño"); input.value = ""; return;
  }

  const fieldMap = { logo:"logo_url", "secondary-logo":"secondary_logo_url", hero:"hero_image_url", background:"background_image_url", music:"music_url" };
  const fieldName = fieldMap[role];
  const file = files[0];
  if (!fieldName || !file) { input.value = ""; return; }

  const field = $("#designer-form").elements[fieldName];
  const previousValue = field.value;
  revokeLocalAsset(fieldName);

  try {
    validateFile(file, role);
    const localUrl = URL.createObjectURL(file);
    state.localAssets[fieldName] = localUrl;
    field.value = localUrl;
    syncAssetFeedback(fieldName, localUrl, "uploading", `Vista previa local de ${file.name}. Subiendo…`);
    render(); resetPreviewToTop();

    const publicUrl = await uploadOne(file, role);
    await verifyPublicAsset(publicUrl, role);
    field.value = publicUrl;
    syncAssetFeedback(fieldName, publicUrl, "ready", `${file.name} subido correctamente. Presiona “Guardar diseño”.`);
    render(); resetPreviewToTop();
    setStatus(`${assetLabel(fieldName)} listo · falta guardar el diseño`);
    window.setTimeout(() => revokeLocalAsset(fieldName), 1500);
  } catch (error) {
    field.value = previousValue || "";
    syncAssetFeedback(fieldName, previousValue || "", "error", errorMessage(error));
    render(); resetPreviewToTop();
    setStatus(`Error al subir ${assetLabel(fieldName)}: ${errorMessage(error)}`);
    alert(`No se pudo subir el archivo.\n\n${errorMessage(error)}`);
  } finally {
    input.value = "";
  }
}

async function uploadOne(file, role) {
  validateFile(file, role);
  state.uploading += 1;
  setBusy(true);
  setStatus(`Subiendo ${file.name}…`);
  try {
    const ext = extensionFor(file);
    const safeRole = role.replace(/[^a-z0-9-]/gi, "-");
    const path = `${eventId}/${safeRole}-${Date.now()}-${randomToken()}.${ext}`;
    await api.uploadFile(BUCKET, path, file, { upsert:false, cacheControl:"31536000" });
    return api.getPublicFileUrl(BUCKET, path);
  } finally {
    state.uploading = Math.max(0, state.uploading - 1);
    setBusy(state.uploading > 0);
  }
}

function verifyPublicAsset(url, role) {
  return new Promise((resolve, reject) => {
    const isAudio = role === "music";
    const node = document.createElement(isAudio ? "audio" : "img");
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      node.removeAttribute("src");
      ok ? resolve(true) : reject(new Error("El archivo llegó a Storage, pero su URL pública no se puede abrir. Ejecuta la reparación de Storage incluida con esta versión."));
    };
    node.addEventListener(isAudio ? "loadedmetadata" : "load", () => done(true), { once:true });
    node.addEventListener("error", () => done(false), { once:true });
    const timer = window.setTimeout(() => done(false), 12000);
    node.src = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  });
}

function syncAssetFeedback(fieldName, url, stateName = "empty", message = "") {
  const root = $(`[data-asset-feedback="${fieldName}"]`);
  if (!root) return;
  root.dataset.state = stateName;
  const thumb = $(`[data-asset-thumb="${fieldName}"]`);
  const messageNode = $(`[data-asset-message="${fieldName}"]`);
  const isAudio = fieldName === "music_url";
  if (messageNode) messageNode.textContent = message || ({
    empty:"Sin archivo seleccionado.",
    saved:"Archivo guardado en el evento.",
    uploading:"Subiendo archivo…",
    ready:"Archivo listo. Presiona Guardar diseño.",
    error:"No se pudo cargar el archivo."
  })[stateName] || "";
  if (!thumb) return;
  thumb.hidden = !url;
  if (!url) { thumb.style.backgroundImage = ""; return; }
  if (isAudio) { thumb.textContent = "♪"; return; }
  thumb.style.backgroundImage = `url("${cssUrl(url)}")`;
}

function assetLabel(fieldName) {
  return ({ logo_url:"Logo principal", secondary_logo_url:"Logo secundario", hero_image_url:"Imagen principal", background_image_url:"Imagen de fondo", music_url:"Música" })[fieldName] || "Archivo";
}
function resetPreviewToTop() {
  const screen = $(`[data-preview-screen]`);
  if (!screen) return;
  screen.scrollTop = 0;
  screen.scrollLeft = 0;
  requestAnimationFrame(() => {
    screen.scrollTop = 0;
    screen.scrollLeft = 0;
  });
}
function fitPreviewTitle() {
  const title = $("[data-preview-name]");
  const hero = $("[data-preview-section=hero]");
  const sizeField = $("#designer-form")?.elements?.heading_size;
  if (!title || !hero) return;

  const configured = Math.max(28, Number(sizeField?.value || 64));
  const mobileMaximum = Math.min(configured, 58);
  const desktopMaximum = Math.min(configured, 104);
  let size = previewMode === "desktop" ? desktopMaximum : mobileMaximum;

  title.style.fontSize = `${size}px`;
  title.style.lineHeight = previewMode === "desktop" ? ".94" : ".98";
  title.classList.toggle("preview-title-long", title.textContent.trim().length > 58);
  title.classList.toggle("preview-title-very-long", title.textContent.trim().length > 90);

  // Ajusta por el espacio real, no solo por el número de caracteres.
  // La portada conserva fecha, lugar y botón visibles dentro de la primera pantalla.
  const minimum = previewMode === "desktop" ? 38 : 26;
  let attempts = 0;
  while (size > minimum && hero.scrollHeight > hero.clientHeight + 2 && attempts < 45) {
    size -= 2;
    title.style.fontSize = `${size}px`;
    attempts += 1;
  }

  // Segundo límite para títulos muy largos aunque el navegador tarde en medir fuentes.
  const textLength = String(title.textContent || "").trim().length;
  const characterCap = previewMode === "desktop"
    ? (textLength > 110 ? 52 : textLength > 82 ? 62 : textLength > 58 ? 74 : desktopMaximum)
    : (textLength > 110 ? 28 : textLength > 82 ? 32 : textLength > 58 ? 38 : mobileMaximum);
  if (size > characterCap) {
    size = characterCap;
    title.style.fontSize = `${size}px`;
  }
}

function revokeLocalAsset(fieldName) {
  const value = state.localAssets[fieldName];
  if (value) URL.revokeObjectURL(value);
  delete state.localAssets[fieldName];
}

function validateFile(file, role) {
  const imageTypes = ["image/png","image/jpeg","image/webp","image/gif"];
  const audioTypes = ["audio/mpeg","audio/mp3","audio/wav","audio/x-wav","audio/ogg"];
  if (role === "music") {
    if (!audioTypes.includes(file.type)) throw new Error("La música debe ser MP3, WAV u OGG.");
    if (file.size > 15 * 1024 * 1024) throw new Error("La música supera el límite de 15 MB.");
  } else {
    if (!imageTypes.includes(file.type)) throw new Error("La imagen debe ser PNG, JPG, WEBP o GIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera el límite de 8 MB.");
  }
}

function extensionFor(file) {
  const map = { "image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif","audio/mpeg":"mp3","audio/mp3":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/ogg":"ogg" };
  return map[file.type] || "bin";
}
function randomToken() { return Math.random().toString(36).slice(2,8); }

function renderSectionManager() {
  const root = $("[data-section-manager]");
  root.innerHTML = state.sections.map((key, index) => `<div class="section-row">
    <input type="checkbox" data-section-toggle="${key}" ${state.enabled[key] !== false ? "checked" : ""} aria-label="Mostrar ${SECTION_LABELS[key]}">
    <strong>${SECTION_LABELS[key]}</strong>
    <div class="section-move"><button type="button" data-move-section="${key}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move-section="${key}" data-direction="1" ${index === state.sections.length - 1 ? "disabled" : ""}>↓</button></div>
  </div>`).join("");
  $$(`[data-section-toggle]`, root).forEach((input) => input.addEventListener("change", () => { state.enabled[input.dataset.sectionToggle] = input.checked; render(); setStatus("Cambios sin guardar"); }));
  $$(`[data-move-section]`, root).forEach((button) => button.addEventListener("click", () => moveSection(button.dataset.moveSection, Number(button.dataset.direction))));
}

function moveSection(key, direction) {
  const index = state.sections.indexOf(key); const target = index + direction;
  if (index < 0 || target < 0 || target >= state.sections.length) return;
  [state.sections[index], state.sections[target]] = [state.sections[target], state.sections[index]];
  renderSectionManager(); render(); setStatus("Cambios sin guardar");
}

function renderGalleryManager() {
  const root = $("[data-gallery-manager]");
  if (!state.gallery.length) { root.innerHTML = '<div class="gallery-empty">Todavía no hay fotografías.</div>'; return; }
  root.innerHTML = state.gallery.map((url, index) => `<div class="gallery-item"><img src="${escapeAttr(url)}" alt="Foto ${index + 1}"><button type="button" data-remove-gallery="${index}" aria-label="Quitar foto">×</button></div>`).join("");
  $$(`[data-remove-gallery]`, root).forEach((button) => button.addEventListener("click", () => {
    state.gallery.splice(Number(button.dataset.removeGallery), 1); renderGalleryManager(); render(); setStatus("Cambios sin guardar");
  }));
}

function formData() {
  const form = $("#designer-form");
  return Object.fromEntries(new FormData(form));
}

function buildConfig(data) {
  return {
    version:1,
    preset:"custom",
    colors:{
      primary:safeColor(data.theme_primary, DEFAULTS.colors.primary), secondary:safeColor(data.theme_secondary, DEFAULTS.colors.secondary),
      background:safeColor(data.background_color, DEFAULTS.colors.background), background2:safeColor(data.background_color_two, DEFAULTS.colors.background2),
      text:safeColor(data.text_color, DEFAULTS.colors.text), muted:safeColor(data.muted_color, DEFAULTS.colors.muted),
      overlay:Number(data.overlay_opacity || 45), mode:data.background_mode || "gradient"
    },
    typography:{ heading:data.heading_font || "Fraunces", body:data.body_font || "Manrope", headingSize:Number(data.heading_size || 64), bodySize:Number(data.body_size || 18), headingWeight:Number(data.heading_weight || 700), align:data.text_align || "center", transform:data.heading_transform || "none" },
    media:{ backgroundImage:data.background_image_url || "", gallery:[...state.gallery], heroFit:data.hero_fit || "cover", showMusicButton:$("#designer-form").elements.show_music_button.checked },
    animation:{ preset:data.animation_preset || "fade-up", ambient:data.ambient_animation || "none", intensity:data.animation_intensity || "medium", respectReducedMotion:$("#designer-form").elements.respect_reduced_motion.checked },
    content:{ kicker:data.kicker || "Invitación digital", rsvpTitle:data.rsvp_title || "¿Nos acompañas?", rsvpCopy:data.rsvp_copy || "Confirma tu asistencia y recibe tu pase digital." },
    sections:{ order:[...state.sections], enabled:{...state.enabled} }
  };
}

function render() {
  const data = formData(); const config = buildConfig(data); const screen = $("[data-preview-screen]");
  screen.style.setProperty("--primary", config.colors.primary); screen.style.setProperty("--secondary", config.colors.secondary);
  screen.style.setProperty("--bg", config.colors.background); screen.style.setProperty("--bg2", config.colors.background2);
  screen.style.setProperty("--text", config.colors.text); screen.style.setProperty("--muted", config.colors.muted);
  screen.style.setProperty("--overlay", String(config.colors.overlay / 100)); screen.style.setProperty("--heading-font", `'${config.typography.heading}'`);
  screen.style.setProperty("--body-font", `'${config.typography.body}'`); screen.style.setProperty("--heading-size", `${config.typography.headingSize}px`);
  screen.style.setProperty("--body-size", `${config.typography.bodySize}px`); screen.style.setProperty("--heading-weight", config.typography.headingWeight);
  screen.style.setProperty("--text-align", config.typography.align); screen.style.setProperty("--preview-align", config.typography.align === "left" ? "flex-start" : config.typography.align === "right" ? "flex-end" : "center"); screen.style.setProperty("--heading-transform", config.typography.transform); screen.style.setProperty("--hero-fit", config.media.heroFit);
  screen.className = `preview-screen animation-${config.animation.preset}`;
  screen.dataset.intensity = config.animation.intensity;
  const ambient = $("[data-preview-ambient]"); ambient.className = `preview-ambient ${config.animation.ambient}`;
  const hero = $("[data-preview-section=hero]");
  if (config.colors.mode === "solid") hero.style.backgroundImage = "none", hero.style.backgroundColor = config.colors.background;
  else if (config.colors.mode === "image" && config.media.backgroundImage) hero.style.backgroundImage = `url("${cssUrl(config.media.backgroundImage)}")`;
  else hero.style.backgroundImage = `linear-gradient(145deg,${config.colors.background},${config.colors.background2})`;
  $("[data-preview-kicker]").textContent = config.content.kicker;
  $("[data-preview-name]").textContent = data.name || "Tu evento";
  fitPreviewTitle();
  $("[data-preview-description]").textContent = data.description || "Una celebración especial está por comenzar.";
  $("[data-preview-date]").textContent = data.event_date ? formatDate(data.event_date) : "Fecha pendiente";
  $("[data-preview-venue]").textContent = data.venue_name || data.venue_address || "Lugar pendiente";
  $("[data-preview-dress-code]").textContent = data.dress_code ? `Código de vestimenta: ${data.dress_code}` : "";
  $("[data-preview-rsvp-title]").textContent = config.content.rsvpTitle;
  $("[data-preview-rsvp-copy]").textContent = config.content.rsvpCopy;
  setPreviewImage($("[data-preview-logo]"), data.logo_url, "logo_url");
  setPreviewImage($("[data-preview-hero-image]"), data.hero_image_url, "hero_image_url");
  setPreviewImage($("[data-preview-secondary-logo]"), data.secondary_logo_url, "secondary_logo_url");
  const gallery = $("[data-preview-gallery]"); gallery.innerHTML = state.gallery.length ? state.gallery.slice(0,6).map((url) => `<img src="${escapeAttr(url)}" alt="">`).join("") : '<div class="gallery-placeholder">Las fotografías aparecerán aquí.</div>';
  state.sections.forEach((key) => { const node = $(`[data-preview-section="${key}"]`); if (node) screen.appendChild(node); });
  Object.entries(state.enabled).forEach(([key, enabled]) => { const node = $(`[data-preview-section="${key}"]`); if (node) node.hidden = !enabled; });
  $("[data-overlay-output]").textContent = `${config.colors.overlay}%`; $("[data-heading-size-output]").textContent = `${config.typography.headingSize} px`; $("[data-body-size-output]").textContent = `${config.typography.bodySize} px`;
  renderContrast(config.colors.text, config.colors.background);
  requestAnimationFrame(() => {
    fitPreviewTitle();
    fitPreviewToVisibleArea();
  });
}

function setPreviewImage(image, value, fieldName) {
  const url = safeAsset(value);
  if (!url) { image.hidden = true; image.removeAttribute("src"); return; }
  image.hidden = false;
  image.classList.add("asset-loading");
  image.onload = () => { image.classList.remove("asset-loading","asset-error"); requestAnimationFrame(fitPreviewTitle); };
  image.onerror = () => {
    image.classList.remove("asset-loading"); image.classList.add("asset-error");
    syncAssetFeedback(fieldName, value, "error", "La URL existe, pero la imagen no pudo mostrarse. Revisa Storage y vuelve a subirla.");
  };
  image.src = url;
}

async function save() {
  const form = $("#designer-form"); if (!form.reportValidity()) return;
  if (state.uploading) return alert("Espera a que terminen las cargas.");
  setBusy(true); setStatus("Guardando diseño…");
  try {
    const data = formData(); const config = buildConfig(data);
    const payload = {
      name:data.name.trim(), description:data.description || null,
      event_date:data.event_date ? new Date(data.event_date).toISOString() : null,
      venue_name:data.venue_name || null, venue_address:data.venue_address || null, dress_code:data.dress_code || null,
      theme_primary:data.theme_primary, theme_secondary:data.theme_secondary,
      logo_url:data.logo_url || null, secondary_logo_url:data.secondary_logo_url || null,
      hero_image_url:data.hero_image_url || null, music_url:data.music_url || null,
      design_config:config
    };
    await api.rpc("update_event_design", { p_event_id:eventId, p_payload:payload });
    state.event = { ...state.event, ...payload };
    $("[data-event-title]").textContent = payload.name;
    ["logo_url","secondary_logo_url","hero_image_url","background_image_url","music_url"].forEach((fieldName) => {
      const value = $("#designer-form").elements[fieldName]?.value || "";
      syncAssetFeedback(fieldName, value, value ? "saved" : "empty", value ? "Archivo guardado en la invitación." : "Sin archivo seleccionado.");
    });
    setStatus("Diseño guardado", true);
  } catch (error) { setStatus(errorMessage(error)); }
  finally { setBusy(false); }
}

function fixContrast() {
  const form = $("#designer-form");
  const background = safeColor(form.elements.background_color.value, DEFAULTS.colors.background);
  const whiteRatio = contrastRatio("#ffffff", background);
  const darkRatio = contrastRatio("#10131d", background);
  form.elements.text_color.value = whiteRatio >= darkRatio ? "#ffffff" : "#10131d";
  form.elements.muted_color.value = whiteRatio >= darkRatio ? "#c5cee0" : "#394157";
  render(); setStatus("Contraste ajustado · cambios sin guardar");
}
function renderContrast(foreground, background) {
  const ratio = contrastRatio(foreground, background); const node = $("[data-contrast]");
  const good = ratio >= 4.5; node.dataset.level = good ? "good" : "warn";
  node.querySelector("span").textContent = `${ratio.toFixed(2)}:1 · ${good ? "Lectura adecuada" : "Contraste bajo"}`;
}
function contrastRatio(a,b) { const l1=luminance(a),l2=luminance(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
function luminance(hex) { const rgb=[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16)/255).map((c)=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; }
function setBusy(busy) { $("[data-save]").disabled = busy; $("#designer-form").setAttribute("aria-busy", String(busy)); }
function setStatus(message, success=false) { const node=$("[data-status]"); node.textContent=message; node.dataset.success=String(success); }
function finishLoading() {
  const loading = $("[data-designer-loading]");
  const layout = $("[data-designer-layout]");
  if (loading) loading.hidden = true;
  document.body.classList.remove("designer-is-loading");
  if (layout) layout.setAttribute("aria-busy", "false");
  document.fonts?.ready?.then(() => {
    fitPreviewTitle();
    fitPreviewToVisibleArea();
    resetPreviewToTop();
  }).catch(() => {});
}
function fail(message) { const loading=$("[data-designer-loading]"); if(loading) loading.hidden=true; document.body.classList.remove("designer-is-loading"); const node=$("[data-error]"); node.hidden=false; node.textContent=message; $(".designer-layout").hidden=true; }
function safeColor(value,fallback) { return /^#[0-9a-f]{6}$/i.test(String(value||"")) ? value : fallback; }
function safeAsset(value) { const text=String(value||"").trim(); if (/^(https?:|data:|blob:)/i.test(text)) return text; return text.replace(/^\/+/,""); }
function cssUrl(value) { return String(value||"").replace(/["'()\\]/g, ""); }
function escapeAttr(value="") { return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }
function toLocalInput(value) { const date=new Date(value); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function formatDate(value) { try { return new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeStyle:"short"}).format(new Date(value)); } catch { return value; } }
function errorMessage(error) { return error instanceof ApiError ? error.message : error?.message || "No fue posible completar la operación."; }
