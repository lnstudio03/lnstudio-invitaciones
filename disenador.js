import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const eventId = new URLSearchParams(location.search).get("id");
const BUCKET = "invitation-assets";
const SECTION_LABELS = { hero:"Portada", countdown:"Cuenta regresiva", details:"Detalles", gallery:"Galería", rsvp:"Confirmación RSVP" };
const DEFAULT_ORDER = ["hero","countdown","details","gallery","rsvp"];
const CUSTOM_TYPES = { image:"Imagen destacada", video:"Video", "photo-text":"Foto + texto", quote:"Pensamiento", separator:"Separador", itinerary:"Itinerario" };
const DEFAULTS = {
  preset:"celebration",
  colors:{ background:"#0d1420", background2:"#1b2537", text:"#ffffff", muted:"#b7c1d5", primary:"#8f7dff", secondary:"#ff7f91", overlay:45, mode:"gradient" },
  typography:{ heading:"Fraunces", body:"Manrope", headingSize:64, bodySize:18, headingWeight:700, align:"center", transform:"none" },
  countdown:{ style:"cards", font:"Manrope", showSeconds:true },
  media:{
    backgroundImage:"", backgroundVideo:"", backgroundPositionX:50, backgroundPositionY:50,
    backgroundVideoFit:"cover", backgroundVideoStart:0, backgroundVideoEnd:0,
    backgroundVideoAutoplay:true, backgroundVideoLoop:true, backgroundVideoMuted:true,
    gallery:[], heroFit:"cover", showMusicButton:true
  },
  layers:[],
  customSections:[],
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
let state = { user:null, profile:null, event:null, gallery:[], layers:[], customSections:[], selectedLayerId:null, sections:[...DEFAULT_ORDER], enabled:{...DEFAULTS.sections.enabled}, uploading:0, localAssets:{} };
let previewMode = "mobile";
let previewResizeObserver = null;
let previewCountdownTimer = null;
let exactPreviewReady = false;

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
    renderLayerManager();
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
    previewMode = ["desktop","landscape"].includes(button.dataset.previewSize) ? button.dataset.previewSize : "mobile";
    $("[data-preview-device]").className = `preview-device ${previewMode}`;
    $$(`[data-preview-size]`).forEach((item) => item.classList.toggle("active", item === button));
    resetPreviewToTop();
    fitPreviewTitle();
    requestAnimationFrame(fitPreviewToVisibleArea);
    syncExactPreview();
  }));
  $$(`[data-preset]`).forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  $$(`[data-upload]`).forEach((input) => input.addEventListener("change", () => handleUpload(input)));
  $$(`[data-remove-asset]`).forEach((button) => button.addEventListener("click", () => {
    const fieldName = button.dataset.removeAsset;
    const field = $("#designer-form").elements[fieldName];
    revokeLocalAsset(fieldName);
    if (field) field.value = "";
    if (fieldName === "background_video_url" && $("#designer-form").elements.background_mode.value === "video") $("#designer-form").elements.background_mode.value = "gradient";
    if (fieldName === "background_image_url" && $("#designer-form").elements.background_mode.value === "image") $("#designer-form").elements.background_mode.value = "gradient";
    syncAssetFeedback(fieldName, "", "empty");
    render(); resetPreviewToTop(); setStatus("Archivo quitado · cambios sin guardar");
  }));
  $("[data-fix-contrast]").addEventListener("click", fixContrast);
  $("[data-replay-animation]")?.addEventListener("click", replayPreviewAnimation);
  $$(`[data-add-custom-section]`).forEach((button) => button.addEventListener("click", () => addCustomSection(button.dataset.addCustomSection)));
  $("[data-section-manager]")?.addEventListener("input", handleCustomSectionInput);
  $("[data-section-manager]")?.addEventListener("change", handleCustomSectionChange);
  $("[data-section-manager]")?.addEventListener("click", handleCustomSectionClick);
  $("[data-add-text-layer]")?.addEventListener("click", () => addLayer({ section:"hero", type:"text", text:"Nuevo texto", x:50, y:28, width:48, rotation:0, opacity:100, fontSize:34, color:"#ffffff", fontFamily:"Montserrat", fontWeight:700 }));
  $$("[data-add-emoji]").forEach((button) => button.addEventListener("click", () => addLayer({ section:"hero", type:"emoji", text:button.dataset.addEmoji, x:50, y:24, width:18, rotation:0, opacity:100, fontSize:64, color:"#ffffff", fontFamily:"Manrope", fontWeight:700 })));
  $("[data-layer-upload]")?.addEventListener("change", (event) => handleLayerUpload(event.currentTarget));
  $("[data-layer-list]")?.addEventListener("click", handleLayerListClick);
  $("[data-layer-inspector]")?.addEventListener("input", handleLayerInspectorInput);
  $("[data-layer-inspector]")?.addEventListener("click", handleLayerInspectorClick);
  const exactFrame = $("[data-exact-preview-frame]");
  exactFrame?.addEventListener("load", () => { exactPreviewReady = true; syncExactPreview(); });
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== exactFrame?.contentWindow) return;
    if (event.data?.type === "lnstudio:designer-preview-ready") { exactPreviewReady = true; syncExactPreview(); }
  });
}

function replayPreviewAnimation(){
  const screen=$("[data-preview-screen]"),preset=$("#designer-form").elements.animation_preset.value;
  if (screen) { screen.classList.remove(`animation-${preset}`);void screen.offsetWidth;screen.classList.add(`animation-${preset}`);screen.scrollTo({top:0,behavior:"smooth"}); }
  const frame=$("[data-exact-preview-frame]");
  frame?.contentWindow?.postMessage({type:"lnstudio:designer-preview-replay"}, location.origin);
  setStatus("Reproduciendo animación");
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
    ? { width:1440, height:900 }
    : previewMode === "landscape"
      ? { width:844, height:390 }
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
  form.elements.background_mode.value = ["gradient","solid","image","video"].includes(config.colors.mode) ? config.colors.mode : "gradient";
  form.elements.overlay_opacity.value = Number(config.colors.overlay ?? 45);
  form.elements.heading_font.value = config.typography.heading;
  form.elements.body_font.value = config.typography.body;
  form.elements.heading_size.value = Number(config.typography.headingSize || 64);
  form.elements.body_size.value = Number(config.typography.bodySize || 18);
  form.elements.heading_weight.value = String(config.typography.headingWeight || 700);
  form.elements.text_align.value = ["left","center","right"].includes(config.typography.align) ? config.typography.align : "center";
  form.elements.heading_transform.value = config.typography.transform || "none";
  form.elements.countdown_style.value = config.countdown.style || "cards";
  form.elements.countdown_font.value = config.countdown.font || "Manrope";
  form.elements.countdown_seconds.checked = config.countdown.showSeconds !== false;
  form.elements.background_image_url.value = config.media.backgroundImage || "";
  form.elements.background_video_url.value = config.media.backgroundVideo || "";
  form.elements.background_position_x.value = Number(config.media.backgroundPositionX ?? 50);
  form.elements.background_position_y.value = Number(config.media.backgroundPositionY ?? 50);
  form.elements.background_video_fit.value = ["cover","contain"].includes(config.media.backgroundVideoFit) ? config.media.backgroundVideoFit : "cover";
  form.elements.background_video_start.value = Number(config.media.backgroundVideoStart || 0);
  form.elements.background_video_end.value = Number(config.media.backgroundVideoEnd || 0);
  form.elements.background_video_autoplay.checked = config.media.backgroundVideoAutoplay !== false;
  form.elements.background_video_loop.checked = config.media.backgroundVideoLoop !== false;
  form.elements.background_video_muted.checked = config.media.backgroundVideoMuted !== false;
  form.elements.hero_fit.value = ["cover","contain","scale-down"].includes(config.media.heroFit) ? config.media.heroFit : (config.media.heroFit === "center" ? "scale-down" : "cover");
  form.elements.show_music_button.checked = config.media.showMusicButton !== false;
  form.elements.animation_preset.value = config.animation.preset || "fade-up";
  form.elements.ambient_animation.value = config.animation.ambient || "none";
  form.elements.animation_intensity.value = config.animation.intensity || "medium";
  form.elements.respect_reduced_motion.checked = config.animation.respectReducedMotion !== false;
  state.gallery = Array.isArray(config.media.gallery) ? config.media.gallery.filter(Boolean).slice(0,8) : [];
  state.layers = normalizeLayers(config.layers);
  state.customSections = normalizeCustomSections(config.customSections);
  state.selectedLayerId = state.layers[0]?.id || null;
  state.sections = normalizeOrder(config.sections.order);
  state.enabled = { ...DEFAULTS.sections.enabled, ...(config.sections.enabled || {}) };
  $("[data-event-title]").textContent = state.event.name;
  $(`[data-open-invitation]`).href = `evento.html?id=${encodeURIComponent(state.event.id)}&preview=1`;
  $(`[data-open-invitation]`).hidden = false;
  ["logo_url","secondary_logo_url","hero_image_url","background_image_url","background_video_url","music_url"].forEach((fieldName) => syncAssetFeedback(fieldName, form.elements[fieldName]?.value || "", form.elements[fieldName]?.value ? "saved" : "empty"));
}

function mergeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULTS,
    ...source,
    colors:{ ...DEFAULTS.colors, ...(source.colors || {}) },
    typography:{ ...DEFAULTS.typography, ...(source.typography || {}) },
    countdown:{ ...DEFAULTS.countdown, ...(source.countdown || {}) },
    media:{ ...DEFAULTS.media, ...(source.media || {}) },
    layers:normalizeLayers(source.layers),
    customSections:normalizeCustomSections(source.customSections),
    animation:{ ...DEFAULTS.animation, ...(source.animation || {}) },
    content:{ ...DEFAULTS.content, ...(source.content || {}) },
    sections:{ order:normalizeOrder(source.sections?.order), enabled:{ ...DEFAULTS.sections.enabled, ...(source.sections?.enabled || {}) } }
  };
}

function normalizeOrder(order) {
  const clean = Array.isArray(order) ? order.filter((item) => DEFAULT_ORDER.includes(item) || /^custom:[a-z0-9-]{1,80}$/i.test(item)) : [];
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

  const fieldMap = { logo:"logo_url", "secondary-logo":"secondary_logo_url", hero:"hero_image_url", background:"background_image_url", "background-video":"background_video_url", music:"music_url" };
  const fieldName = fieldMap[role];
  const file = files[0];
  if (!fieldName || !file) { input.value = ""; return; }

  const field = $("#designer-form").elements[fieldName];
  const previousValue = field.value;
  revokeLocalAsset(fieldName);

  try {
    validateFile(file, role);
    if (role === "background-video") await probeVideoFile(file);
    const localUrl = URL.createObjectURL(file);
    state.localAssets[fieldName] = localUrl;
    field.value = localUrl;
    if (role === "background-video") $("#designer-form").elements.background_mode.value = "video";
    if (role === "background") $("#designer-form").elements.background_mode.value = "image";
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

async function handleLayerUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    validateFile(file, "layer");
    const url = await uploadOne(file, "layer");
    await verifyPublicAsset(url, "layer");
    addLayer({ section:"hero", type:"image", src:url, name:file.name, x:50, y:25, width:34, rotation:0, opacity:100, fontSize:32, color:"#ffffff", fontFamily:"Manrope", fontWeight:700 });
    setStatus("Foto o sticker agregado · falta guardar el diseño");
  } catch (error) {
    setStatus(`No se pudo agregar la capa: ${errorMessage(error)}`);
    alert(errorMessage(error));
  } finally { input.value = ""; }
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
    const uploadBody = normalizeUploadMime(file, ext);
    await api.uploadFile(BUCKET, path, uploadBody, { upsert:false, cacheControl:"31536000" });
    return api.getPublicFileUrl(BUCKET, path);
  } finally {
    state.uploading = Math.max(0, state.uploading - 1);
    setBusy(state.uploading > 0);
  }
}

function verifyPublicAsset(url, role) {
  return new Promise((resolve, reject) => {
    const isAudio = role === "music";
    const isVideo = role === "custom-video" || role === "background-video";
    const node = document.createElement(isAudio ? "audio" : isVideo ? "video" : "img");
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      node.removeAttribute("src");
      ok ? resolve(true) : reject(new Error("El archivo llegó a Storage, pero su URL pública no se puede abrir. Ejecuta la reparación de Storage incluida con esta versión."));
    };
    node.addEventListener(isAudio || isVideo ? "loadedmetadata" : "load", () => done(true), { once:true });
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
  const isVideo = fieldName === "background_video_url";
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
  if (isAudio) { thumb.textContent = "♪"; thumb.style.backgroundImage = ""; return; }
  if (isVideo) { thumb.textContent = "▶"; thumb.style.backgroundImage = ""; return; }
  thumb.style.backgroundImage = `url("${cssUrl(url)}")`;
}

function assetLabel(fieldName) {
  return ({ logo_url:"Logo principal", secondary_logo_url:"Logo secundario", hero_image_url:"Imagen principal", background_image_url:"Imagen de fondo", background_video_url:"Video de fondo", music_url:"Música" })[fieldName] || "Archivo";
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
  const mobileMaximum = Math.min(configured, 72);
  const landscapeMaximum = Math.min(configured, 64);
  const desktopMaximum = Math.min(configured, 180);
  let size = previewMode === "desktop" ? desktopMaximum : previewMode === "landscape" ? landscapeMaximum : mobileMaximum;

  title.style.fontSize = `${size}px`;
  title.style.lineHeight = previewMode === "desktop" ? ".94" : previewMode === "landscape" ? ".92" : ".98";
  title.classList.toggle("preview-title-long", title.textContent.trim().length > 58);
  title.classList.toggle("preview-title-very-long", title.textContent.trim().length > 90);

  // Ajusta por el espacio real, no solo por el número de caracteres.
  // La portada conserva fecha, lugar y botón visibles dentro de la primera pantalla.
  const minimum = previewMode === "desktop" ? 38 : previewMode === "landscape" ? 22 : 26;
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
    : previewMode === "landscape"
      ? (textLength > 110 ? 22 : textLength > 82 ? 26 : textLength > 58 ? 31 : landscapeMaximum)
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
  const videoTypes = ["video/mp4","video/webm","video/ogg","video/x-m4v","video/quicktime"];
  const ext = String(file?.name || "").toLowerCase().split(".").pop();
  const videoExtensions = ["mp4","webm","ogv","ogg","m4v","mov"];
  if (role === "music") {
    if (!audioTypes.includes(file.type)) throw new Error("La música debe ser MP3, WAV u OGG.");
    if (file.size > 15 * 1024 * 1024) throw new Error("La música supera el límite de 15 MB.");
  } else if (role === "custom-video" || role === "background-video") {
    if (!videoTypes.includes(file.type) && !videoExtensions.includes(ext)) throw new Error("El video debe ser MP4, WebM, OGV, M4V o MOV.");
    if (file.size > 80 * 1024 * 1024) throw new Error("El video supera el límite de 80 MB. Para archivos mayores usa YouTube o una URL pública directa.");
  } else {
    if (!imageTypes.includes(file.type)) throw new Error("La imagen debe ser PNG, JPG, WEBP o GIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera el límite de 8 MB.");
  }
}

function extensionFor(file) {
  const map = { "image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif","audio/mpeg":"mp3","audio/mp3":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/ogg":"ogg","video/mp4":"mp4","video/webm":"webm","video/ogg":"ogv","video/x-m4v":"m4v","video/quicktime":"mov" };
  const byName=String(file?.name||"").toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  return map[file.type] || byName || "bin";
}

function probeVideoFile(file) {
  return new Promise((resolve,reject)=>{
    const video=document.createElement("video");
    const url=URL.createObjectURL(file);
    let settled=false;
    const cleanup=()=>{window.clearTimeout(timer);video.pause();video.removeAttribute("src");try{video.load()}catch{}URL.revokeObjectURL(url)};
    const done=(ok,message="")=>{if(settled)return;settled=true;const duration=Number(video.duration||0);cleanup();ok?resolve({duration}):reject(new Error(message||"El navegador no puede reproducir este archivo de video."))};
    video.preload="metadata";video.muted=true;video.playsInline=true;
    video.addEventListener("loadedmetadata",()=>done(Number.isFinite(video.duration)&&video.duration>0,"El archivo no contiene una duración de video válida."),{once:true});
    video.addEventListener("error",()=>done(false,"El archivo usa un formato o códec que Chrome no puede reproducir. Usa MP4 con video H.264 + audio AAC, WebM, o pega un enlace de YouTube."),{once:true});
    const timer=window.setTimeout(()=>done(false,"El navegador tardó demasiado en leer el video. Prueba MP4 H.264/AAC o WebM."),10000);
    video.src=url;video.load();
  });
}

function parseYouTubeId(value){
  const text=String(value||"").trim();
  if(!text)return"";
  try{
    const url=new URL(text,location.href),host=url.hostname.replace(/^www\./,"").toLowerCase();
    if(host==="youtu.be") return (url.pathname.split("/").filter(Boolean)[0]||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,20);
    if(host.endsWith("youtube.com")){
      if(url.pathname==="/watch") return (url.searchParams.get("v")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,20);
      const parts=url.pathname.split("/").filter(Boolean);
      if(["embed","shorts","live"].includes(parts[0])) return (parts[1]||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,20);
    }
  }catch{}
  return"";
}
function isDirectVideoUrl(value){const text=String(value||"").trim();if(/^(blob:|data:video\/)/i.test(text))return true;try{const u=new URL(text,location.href);return /\.(mp4|webm|ogv|ogg|m4v|mov)$/i.test(u.pathname)}catch{return false}}
function isRecognizedVideoSource(value){return Boolean(parseYouTubeId(value)||isDirectVideoUrl(value))}
function describeVideoSource(value){const yt=parseYouTubeId(value);if(yt)return"Enlace de YouTube reconocido. Se mostrará como reproductor integrado.";if(isDirectVideoUrl(value))return"Video directo reconocido. Se reproducirá con el reproductor HTML5.";return"Este enlace no parece ser un video directo ni un enlace de YouTube. Usa YouTube o una URL que termine en .mp4, .webm, .ogv, .m4v o .mov."}
function buildYouTubeEmbed(section){const id=parseYouTubeId(section.mediaUrl);if(!id)return"";const params=new URLSearchParams({playsinline:"1",rel:"0",modestbranding:"1",controls:section.videoControls?"1":"0",autoplay:section.videoAutoplay?"1":"0",mute:(section.videoAutoplay||section.videoMuted)?"1":"0"});const start=Math.max(0,Math.floor(Number(section.videoStart)||0)),end=Math.max(0,Math.floor(Number(section.videoEnd)||0));if(start)params.set("start",String(start));if(end>start)params.set("end",String(end));if(section.videoLoop){params.set("loop","1");params.set("playlist",id)}return`https://www.youtube.com/embed/${id}?${params.toString()}`}

function normalizeUploadMime(file, ext) {
  const mimeByExt={mp4:"video/mp4",webm:"video/webm",ogv:"video/ogg",ogg:file.type?.startsWith("audio/")?"audio/ogg":"video/ogg",m4v:"video/x-m4v",mov:"video/quicktime",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",mp3:"audio/mpeg",wav:"audio/wav"};
  const mime=file.type || mimeByExt[String(ext||"").toLowerCase()] || "application/octet-stream";
  if(file.type===mime)return file;
  try{return file.slice(0,file.size,mime)}catch{return file}
}

function randomToken() { return Math.random().toString(36).slice(2,8); }

function normalizeCustomSections(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,12).map((item,index) => ({
    id:String(item?.id || `section-${index}`).replace(/[^a-z0-9-]/gi,"-").slice(0,80),
    type:CUSTOM_TYPES[item?.type] ? item.type : "quote",
    title:String(item?.title || "").slice(0,140),
    text:String(item?.text || "").slice(0,900),
    mediaUrl:String(item?.mediaUrl || "").slice(0,1800),
    caption:String(item?.caption || "").slice(0,220),
    videoStart:clampNumber(item?.videoStart,0,3600,0),
    videoEnd:clampNumber(item?.videoEnd,0,3600,0),
    videoAutoplay:item?.videoAutoplay === true,
    videoLoop:item?.videoLoop === true,
    videoMuted:item?.videoAutoplay === true ? true : item?.videoMuted !== false,
    videoControls:item?.videoControls !== false,
    videoFit:["cover","contain"].includes(item?.videoFit) ? item.videoFit : "cover",
    items:Array.isArray(item?.items) ? item.items.map((entry)=>String(entry).slice(0,120)).slice(0,8) : []
  }));
}

function customKey(id) { return `custom:${id}`; }
function addCustomSection(type) {
  if (!CUSTOM_TYPES[type]) return;
  if (state.customSections.length >= 12) return alert("Puedes agregar hasta 12 secciones especiales.");
  const id=`section-${Date.now().toString(36)}-${randomToken()}`;
  const defaults={
    image:{title:"Un momento para recordar",text:"",caption:"Nuestra historia en una imagen."},
    video:{title:"Revive este momento",text:"Presiona reproducir para verlo.",caption:""},
    "photo-text":{title:"Nuestra historia",text:"Cada momento nos trajo hasta aquí.",caption:""},
    quote:{title:"Un pensamiento especial",text:"Hay momentos que se quedan para siempre en el corazón.",caption:""},
    separator:{title:"✦",text:"Celebremos juntos",caption:""},
    itinerary:{title:"Itinerario",text:"",caption:"",items:["18:00 · Recepción","19:00 · Ceremonia","20:00 · Celebración"]}
  }[type];
  state.customSections.push({
    id,type,mediaUrl:"",items:[],videoStart:0,videoEnd:0,videoAutoplay:false,
    videoLoop:false,videoMuted:true,videoControls:true,videoFit:"cover",...defaults
  });
  const key=customKey(id); state.sections.push(key); state.enabled[key]=true;
  renderSectionManager(); render(); setStatus("Sección agregada · cambios sin guardar");
}

function customSectionEditor(section,key,index) {
  const accepts=section.type === "video" ? "video/mp4,video/webm,video/ogg,video/x-m4v,video/quicktime,.mp4,.webm,.ogv,.ogg,.m4v,.mov" : "image/png,image/jpeg,image/webp,image/gif";
  const videoControls = section.type === "video" ? `<div class="custom-video-controls">
    <div class="form-pair"><label>Inicio (s)<input type="number" min="0" max="3600" step="0.5" data-custom-field="videoStart" data-custom-id="${section.id}" value="${section.videoStart}"></label><label>Fin (s)<input type="number" min="0" max="3600" step="0.5" data-custom-field="videoEnd" data-custom-id="${section.id}" value="${section.videoEnd}" placeholder="0 = final"></label></div>
    <label>Ajuste<select data-custom-field="videoFit" data-custom-id="${section.id}"><option value="cover"${section.videoFit==="cover"?" selected":""}>Cubrir</option><option value="contain"${section.videoFit==="contain"?" selected":""}>Completo</option></select></label>
    <div class="video-options"><label class="toggle-line"><input type="checkbox" data-custom-field="videoAutoplay" data-custom-id="${section.id}" ${section.videoAutoplay?"checked":""}> Autoplay</label><label class="toggle-line"><input type="checkbox" data-custom-field="videoLoop" data-custom-id="${section.id}" ${section.videoLoop?"checked":""}> Repetir</label><label class="toggle-line"><input type="checkbox" data-custom-field="videoMuted" data-custom-id="${section.id}" ${section.videoMuted?"checked":""}> Sin sonido</label><label class="toggle-line"><input type="checkbox" data-custom-field="videoControls" data-custom-id="${section.id}" ${section.videoControls?"checked":""}> Controles</label></div>
  </div>` : "";
  const videoHelp = section.type === "video" ? `<div class="custom-media-help">Puedes subir MP4, WebM, OGV/M4V/MOV compatibles con el navegador, pegar una URL directa de video o pegar un enlace normal de YouTube. Los enlaces de YouTube se convierten automáticamente a reproductor.</div><div class="custom-video-state" data-state="${escapeAttr(section._videoStateType || "idle")}">${escapeAttr(section._videoState || (section.mediaUrl ? describeVideoSource(section.mediaUrl) : "Sin video seleccionado."))}</div>` : "";
  const mediaField=["image","video","photo-text"].includes(section.type) ? `<label>Archivo o enlace<input data-custom-field="mediaUrl" data-custom-id="${section.id}" value="${escapeAttr(section.mediaUrl)}" placeholder="${section.type === "video" ? "YouTube o URL directa .mp4/.webm" : "Pega una URL o sube un archivo"}"></label>${videoHelp}<label class="custom-upload${section._videoUploading ? " is-uploading" : ""}">Subir ${section.type === "video" ? "video" : "foto"}<input type="file" data-custom-upload="${section.id}" accept="${accepts}"></label>${section.mediaUrl ? `<button type="button" class="danger-link" data-clear-custom-media="${section.id}">Quitar archivo</button>` : ""}${videoControls}` : "";
  const textLabel=section.type === "itinerary" ? "Horario (una actividad por línea)" : section.type === "quote" ? "Pensamiento o frase" : "Texto";
  const textValue=section.type === "itinerary" ? section.items.join("\n") : section.text;
  return `<div class="section-row custom-section-row" data-custom-card="${section.id}">
    <input type="checkbox" data-section-toggle="${key}" ${state.enabled[key] !== false ? "checked" : ""} aria-label="Mostrar ${CUSTOM_TYPES[section.type]}">
    <div class="custom-section-main"><strong>${CUSTOM_TYPES[section.type]}</strong><small>Bloque prediseñado</small><details><summary>Editar contenido</summary><label>Título<input data-custom-field="title" data-custom-id="${section.id}" maxlength="140" value="${escapeAttr(section.title)}"></label><label>${textLabel}<textarea data-custom-field="${section.type === "itinerary" ? "items" : "text"}" data-custom-id="${section.id}" rows="3">${escapeAttr(textValue)}</textarea></label>${mediaField}<label>Pie de foto<input data-custom-field="caption" data-custom-id="${section.id}" maxlength="220" value="${escapeAttr(section.caption)}"></label></details></div>
    <div class="section-move"><button type="button" data-move-section="${key}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move-section="${key}" data-direction="1" ${index === state.sections.length-1 ? "disabled" : ""}>↓</button><button type="button" class="delete-section" data-delete-custom-section="${section.id}" title="Eliminar sección">×</button></div>
  </div>`;
}

function renderSectionManager() {
  const root = $("[data-section-manager]");
  state.sections = state.sections.filter((key)=>DEFAULT_ORDER.includes(key) || state.customSections.some((section)=>customKey(section.id)===key));
  DEFAULT_ORDER.forEach((key)=>{if(!state.sections.includes(key))state.sections.push(key)});
  root.innerHTML = state.sections.map((key, index) => {
    if (key.startsWith("custom:")) { const custom=state.customSections.find((section)=>customKey(section.id)===key); return custom ? customSectionEditor(custom,key,index) : ""; }
    return `<div class="section-row">
    <input type="checkbox" data-section-toggle="${key}" ${state.enabled[key] !== false ? "checked" : ""} aria-label="Mostrar ${SECTION_LABELS[key]}">
    <strong>${SECTION_LABELS[key]}</strong>
    <div class="section-move"><button type="button" data-move-section="${key}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move-section="${key}" data-direction="1" ${index === state.sections.length - 1 ? "disabled" : ""}>↓</button></div>
  </div>`;}).join("");
  $$(`[data-section-toggle]`, root).forEach((input) => input.addEventListener("change", () => { state.enabled[input.dataset.sectionToggle] = input.checked; render(); setStatus("Cambios sin guardar"); }));
  $$(`[data-move-section]`, root).forEach((button) => button.addEventListener("click", () => moveSection(button.dataset.moveSection, Number(button.dataset.direction))));
}

function handleCustomSectionInput(event) {
  const field=event.target.dataset.customField, id=event.target.dataset.customId;
  if(!field || !id) return; const section=state.customSections.find((item)=>item.id===id); if(!section)return;
  if (field === "items") section[field] = event.target.value.split("\n").map((item)=>item.trim()).filter(Boolean).slice(0,8);
  else if (["videoStart","videoEnd"].includes(field)) section[field] = clampNumber(event.target.value,0,3600,0);
  else if (["videoAutoplay","videoLoop","videoMuted","videoControls"].includes(field)) section[field] = Boolean(event.target.checked);
  else section[field] = event.target.value;
  if (field === "mediaUrl" && section.type === "video") {
    section._videoState = section.mediaUrl ? describeVideoSource(section.mediaUrl) : "Sin video seleccionado.";
    section._videoStateType = section.mediaUrl ? (isRecognizedVideoSource(section.mediaUrl) ? "ready" : "error") : "idle";
    const stateBox=$(`[data-custom-card="${id}"] .custom-video-state`, $(`[data-section-manager]`));
    if(stateBox){stateBox.textContent=section._videoState;stateBox.dataset.state=section._videoStateType}
  }
  if (section.videoAutoplay) {
    section.videoMuted = true;
    const mutedControl = $(`[data-custom-field="videoMuted"][data-custom-id="${id}"]`, $("[data-section-manager]"));
    if (mutedControl) mutedControl.checked = true;
  }
  render(); setStatus("Cambios sin guardar");
}
function handleCustomSectionChange(event) {
  const id=event.target.dataset.customUpload; if(!id || !event.target.files?.[0])return;
  uploadCustomSectionMedia(id,event.target);
}
function handleCustomSectionClick(event) {
  const deleteButton=event.target.closest("[data-delete-custom-section]");
  if(deleteButton){deleteCustomSection(deleteButton.dataset.deleteCustomSection);return}
  const clearButton=event.target.closest("[data-clear-custom-media]");
  if(clearButton){const section=state.customSections.find((item)=>item.id===clearButton.dataset.clearCustomMedia);if(section){section.mediaUrl="";section._videoState="Sin video seleccionado.";section._videoStateType="idle";renderSectionManager();render();setStatus("Archivo quitado · cambios sin guardar")}}
}
async function uploadCustomSectionMedia(id,input){
  const section=state.customSections.find((item)=>item.id===id),file=input.files?.[0];
  if(!section||!file)return;
  const role=section.type === "video" ? "custom-video" : "custom-image";
  const previous=section.mediaUrl || "";
  let localUrl="";
  try{
    validateFile(file,role);
    section._videoUploading=true;
    section._videoState=`Comprobando ${file.name}…`;
    section._videoStateType="idle";
    renderSectionManager();
    if(section.type === "video") await probeVideoFile(file);
    localUrl=URL.createObjectURL(file);
    section.mediaUrl=localUrl;
    section._videoState=`Vista previa local correcta. Subiendo ${file.name}…`;
    section._videoStateType="ready";
    renderSectionManager();render();
    const url=await uploadOne(file,role);
    await verifyPublicAsset(url,role);
    section.mediaUrl=url;
    section._videoState=`${file.name} listo y reproducible. Presiona “Guardar diseño”.`;
    section._videoStateType="ready";
    setStatus("Video listo · falta guardar el diseño");
  }catch(error){
    section.mediaUrl=previous;
    section._videoState=errorMessage(error);
    section._videoStateType="error";
    setStatus(`No se pudo usar el video: ${errorMessage(error)}`);
    alert(`No se pudo usar el video.\n\n${errorMessage(error)}`);
  }finally{
    section._videoUploading=false;
    if(localUrl) URL.revokeObjectURL(localUrl);
    renderSectionManager();render();
    input.value="";
  }
}
function deleteCustomSection(id){
  const section=state.customSections.find((item)=>item.id===id);if(!section)return;
  if(!confirm(`¿Eliminar la sección “${section.title || CUSTOM_TYPES[section.type]}”?`))return;
  const key=customKey(id);state.customSections=state.customSections.filter((item)=>item.id!==id);state.sections=state.sections.filter((item)=>item!==key);delete state.enabled[key];
  state.layers=state.layers.filter((layer)=>layer.section!==key);renderSectionManager();renderLayerManager();render();setStatus("Sección eliminada · cambios sin guardar");
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
    version:2,
    preset:"custom",
    colors:{
      primary:safeColor(data.theme_primary, DEFAULTS.colors.primary), secondary:safeColor(data.theme_secondary, DEFAULTS.colors.secondary),
      background:safeColor(data.background_color, DEFAULTS.colors.background), background2:safeColor(data.background_color_two, DEFAULTS.colors.background2),
      text:safeColor(data.text_color, DEFAULTS.colors.text), muted:safeColor(data.muted_color, DEFAULTS.colors.muted),
      overlay:clampNumber(data.overlay_opacity,0,90,45), mode:["gradient","solid","image","video"].includes(data.background_mode) ? data.background_mode : "gradient"
    },
    typography:{ heading:data.heading_font || "Fraunces", body:data.body_font || "Manrope", headingSize:clampNumber(data.heading_size,24,200,64), bodySize:clampNumber(data.body_size,12,48,18), headingWeight:Number(data.heading_weight || 700), align:data.text_align || "center", transform:data.heading_transform || "none" },
    countdown:{ style:data.countdown_style || "cards", font:data.countdown_font || "Manrope", showSeconds:$("#designer-form").elements.countdown_seconds.checked },
    media:{
      backgroundImage:data.background_image_url || "",
      backgroundVideo:data.background_video_url || "",
      backgroundPositionX:clampNumber(data.background_position_x,0,100,50),
      backgroundPositionY:clampNumber(data.background_position_y,0,100,50),
      backgroundVideoFit:["cover","contain"].includes(data.background_video_fit) ? data.background_video_fit : "cover",
      backgroundVideoStart:clampNumber(data.background_video_start,0,3600,0),
      backgroundVideoEnd:clampNumber(data.background_video_end,0,3600,0),
      backgroundVideoAutoplay:$("#designer-form").elements.background_video_autoplay.checked,
      backgroundVideoLoop:$("#designer-form").elements.background_video_loop.checked,
      backgroundVideoMuted:$("#designer-form").elements.background_video_autoplay.checked ? true : $("#designer-form").elements.background_video_muted.checked,
      gallery:[...state.gallery], heroFit:["cover","contain","scale-down"].includes(data.hero_fit) ? data.hero_fit : "cover", showMusicButton:$("#designer-form").elements.show_music_button.checked
    },
    layers:normalizeLayers(state.layers),
    customSections:normalizeCustomSections(state.customSections),
    animation:{ preset:data.animation_preset || "fade-up", ambient:data.ambient_animation || "none", intensity:data.animation_intensity || "medium", respectReducedMotion:$("#designer-form").elements.respect_reduced_motion.checked },
    content:{ kicker:data.kicker || "Invitación digital", rsvpTitle:data.rsvp_title || "¿Nos acompañas?", rsvpCopy:data.rsvp_copy || "Confirma tu asistencia y recibe tu pase digital." },
    sections:{ order:[...state.sections], enabled:{...state.enabled} }
  };
}

function exactPreviewEventPayload() {
  if (!state.event) return null;
  const data = formData();
  const config = buildConfig(data);
  return {
    ...state.event,
    name: data.name || "Tu evento",
    description: data.description || "",
    event_date: data.event_date || null,
    venue_name: data.venue_name || "",
    venue_address: data.venue_address || "",
    dress_code: data.dress_code || "",
    logo_url: data.logo_url || "",
    secondary_logo_url: data.secondary_logo_url || "",
    hero_image_url: data.hero_image_url || "",
    music_url: data.music_url || "",
    maps_url: state.event.maps_url || "",
    theme_primary: data.theme_primary || config.colors.primary,
    theme_secondary: data.theme_secondary || config.colors.secondary,
    design_config: config
  };
}

function syncExactPreview() {
  const frame = $("[data-exact-preview-frame]");
  if (!frame?.contentWindow || !state.event) return;
  const payload = exactPreviewEventPayload();
  if (!payload) return;
  try {
    frame.contentWindow.postMessage({type:"lnstudio:designer-preview", event:payload, mode:previewMode}, location.origin);
  } catch (error) {
    console.warn("No se pudo sincronizar la vista previa exacta", error);
  }
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
  screen.style.setProperty("--countdown-font", `'${config.countdown.font}'`);
  screen.className = `preview-screen animation-${config.animation.preset}`;
  screen.dataset.intensity = config.animation.intensity;
  const ambient = $("[data-preview-ambient]"); ambient.className = `preview-ambient ${config.animation.ambient}`;
  const hero = $("[data-preview-section=hero]");
  hero.style.backgroundPosition = `${config.media.backgroundPositionX}% ${config.media.backgroundPositionY}%`;
  if (config.colors.mode === "solid") hero.style.backgroundImage = "none", hero.style.backgroundColor = config.colors.background;
  else if (config.colors.mode === "image" && config.media.backgroundImage) hero.style.backgroundImage = `url("${cssUrl(config.media.backgroundImage)}")`;
  else hero.style.backgroundImage = `linear-gradient(145deg,${config.colors.background},${config.colors.background2})`;
  configurePreviewBackgroundVideo(config);
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
  setPreviewImage($("[data-preview-secondary-logo]"), data.secondary_logo_url, "secondary_logo_url");
  updatePreviewLogoCluster();
  setPreviewImage($("[data-preview-hero-image]"), data.hero_image_url, "hero_image_url");
  renderPreviewCustomSections(config.customSections);
  renderPreviewLayers(config.layers);
  renderPreviewCountdown(config, data.event_date);
  const gallery = $("[data-preview-gallery]"); gallery.innerHTML = state.gallery.length ? state.gallery.slice(0,6).map((url) => `<img src="${escapeAttr(url)}" alt="">`).join("") : '<div class="gallery-placeholder">Las fotografías aparecerán aquí.</div>';
  state.sections.forEach((key) => { const node = $(`[data-preview-section="${key}"]`); if (node) screen.appendChild(node); });
  Object.entries(state.enabled).forEach(([key, enabled]) => { const node = $(`[data-preview-section="${key}"]`); if (node) node.hidden = !enabled; });
  $("[data-overlay-output]").textContent = `${config.colors.overlay}%`; $("[data-heading-size-output]").textContent = `${config.typography.headingSize} px`; $("[data-body-size-output]").textContent = `${config.typography.bodySize} px`;
  $("[data-bg-x-output]").textContent = `${config.media.backgroundPositionX}%`; $("[data-bg-y-output]").textContent = `${config.media.backgroundPositionY}%`;
  renderContrast(config.colors.text, config.colors.background);
  syncExactPreview();
  requestAnimationFrame(() => {
    fitPreviewTitle();
    fitPreviewToVisibleArea();
  });
}

function customSectionMarkup(section) {
  const media=safeAsset(section.mediaUrl), title=escapeAttr(section.title), text=escapeAttr(section.text), caption=escapeAttr(section.caption);
  if(section.type==="video") {
    let player='<div class="custom-media-placeholder">Sube un video o pega un enlace de YouTube.</div>';
    const youtube=buildYouTubeEmbed(section);
    if(youtube) player=`<div class="video-embed-shell"><iframe src="${escapeAttr(youtube)}" title="${title||"Video"}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    else if(media && isDirectVideoUrl(media)) { const attrs=`${section.videoControls?" controls":""}${section.videoMuted?" muted":""}${section.videoAutoplay?" autoplay":""} playsinline preload="metadata" data-video-start="${section.videoStart}" data-video-end="${section.videoEnd}" data-video-loop="${section.videoLoop?"1":"0"}" style="object-fit:${section.videoFit}"`;player=`<video src="${escapeAttr(media)}"${attrs}></video>`; }
    else if(media) player='<div class="video-source-error">El enlace no es reproducible directamente. Usa YouTube o una URL directa de video (.mp4/.webm/.ogv/.m4v/.mov).</div>';
    return `<p>Video</p><h3>${title}</h3>${player}<span>${text}</span>`;
  }
  if(section.type==="image") return `<p>Imagen destacada</p><h3>${title}</h3>${media?`<img src="${escapeAttr(media)}" alt="${caption}" loading="lazy">`:'<div class="custom-media-placeholder">Agrega una fotografía.</div>'}<span>${caption}</span>`;
  if(section.type==="photo-text") return `<div class="custom-split">${media?`<img src="${escapeAttr(media)}" alt="${caption}" loading="lazy">`:'<div class="custom-media-placeholder">Agrega una fotografía.</div>'}<div><p>Nuestra historia</p><h3>${title}</h3><span>${text}</span></div></div>`;
  if(section.type==="quote") return `<span class="custom-quote-mark">“</span><blockquote>${text}</blockquote><h3>${title}</h3>`;
  if(section.type==="separator") return `<span class="custom-separator-symbol">${title||"✦"}</span><h3>${text}</h3>`;
  const items=section.items.map((item)=>{const parts=item.split("·");return `<li><strong>${escapeAttr(parts.shift()?.trim()||"")}</strong><span>${escapeAttr(parts.join("·").trim())}</span></li>`}).join("");
  return `<p>Itinerario</p><h3>${title}</h3><ol class="custom-itinerary">${items}</ol>`;
}
function renderPreviewCustomSections(sections){
  $$('[data-preview-custom]').forEach((node)=>node.remove());
  normalizeCustomSections(sections).forEach((section)=>{const node=document.createElement("section");node.className=`preview-block preview-custom preview-custom-${section.type}`;node.dataset.previewSection=customKey(section.id);node.dataset.previewCustom=section.id;node.innerHTML=customSectionMarkup(section);$("[data-preview-screen]").appendChild(node)});
  configureRangedVideos($("[data-preview-screen]"));
}


function configurePreviewBackgroundVideo(config) {
  const video = $("[data-preview-background-video]");
  if (!video) return;
  const url = safeAsset(config.media.backgroundVideo);
  const shouldShow = config.colors.mode === "video" && Boolean(url);
  video.hidden = !shouldShow;
  if (!shouldShow) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    return;
  }
  if (video.dataset.src !== url) {
    video.dataset.src = url;
    video.src = url;
  }
  video.muted = config.media.backgroundVideoAutoplay ? true : config.media.backgroundVideoMuted !== false;
  video.loop = false;
  video.autoplay = config.media.backgroundVideoAutoplay !== false;
  video.style.objectFit = config.media.backgroundVideoFit || "cover";
  video.style.objectPosition = `${config.media.backgroundPositionX}% ${config.media.backgroundPositionY}%`;
  video.dataset.videoStart = String(config.media.backgroundVideoStart || 0);
  video.dataset.videoEnd = String(config.media.backgroundVideoEnd || 0);
  video.dataset.videoLoop = config.media.backgroundVideoLoop !== false ? "1" : "0";
  configureRangedVideo(video);
  if (video.autoplay) video.play().catch(() => {});
}

function configureRangedVideos(root=document) {
  root.querySelectorAll("video[data-video-start]").forEach(configureRangedVideo);
}
function configureRangedVideo(video) {
  const start = clampNumber(video.dataset.videoStart,0,3600,0);
  const end = clampNumber(video.dataset.videoEnd,0,3600,0);
  const loopRange = video.dataset.videoLoop === "1";
  video.onloadedmetadata = () => {
    const safeStart = Math.min(start, Math.max(0, (video.duration || start) - .05));
    if (safeStart > 0 && Math.abs(video.currentTime - safeStart) > .2) {
      try { video.currentTime = safeStart; } catch {}
    }
    if (video.autoplay) video.play().catch(() => {});
  };
  video.ontimeupdate = () => {
    if (end > start && video.currentTime >= end - .05) {
      if (loopRange) {
        try { video.currentTime = start; } catch {}
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };
  video.onended = () => {
    if (loopRange && !(end > start)) {
      try { video.currentTime = start; } catch {}
      video.play().catch(() => {});
    }
  };
}

function renderPreviewCountdown(config, value) {
  const section = $("[data-preview-section=countdown]");
  const display = $("[data-preview-countdown-display]");
  const secondsWrap = $("[data-preview-countdown-seconds-wrap]");
  const message = $("[data-preview-countdown-message]");
  if (!section || !display) return;
  section.className = `preview-block preview-countdown countdown-style-${config.countdown.style || "cards"}`;
  section.classList.toggle("countdown-no-seconds", config.countdown.showSeconds === false);
  display.style.fontFamily = `'${config.countdown.font || "Manrope"}'`;
  secondsWrap.hidden = config.countdown.showSeconds === false;
  window.clearInterval(previewCountdownTimer);
  const update = () => {
    const target = value ? new Date(value).getTime() : NaN;
    let days = 12, hours = 8, minutes = 24, seconds = 36;
    if (Number.isFinite(target)) {
      const diff = Math.max(0, target - Date.now());
      days = Math.floor(diff / 86400000);
      hours = Math.floor(diff % 86400000 / 3600000);
      minutes = Math.floor(diff % 3600000 / 60000);
      seconds = Math.floor(diff % 60000 / 1000);
      message.textContent = diff <= 0 ? "El gran momento ha llegado" : "Falta muy poco";
    } else {
      message.textContent = "Falta muy poco";
    }
    $("[data-preview-countdown-days]").textContent = String(days).padStart(2,"0");
    $("[data-preview-countdown-hours]").textContent = String(hours).padStart(2,"0");
    $("[data-preview-countdown-minutes]").textContent = String(minutes).padStart(2,"0");
    $("[data-preview-countdown-seconds]").textContent = String(seconds).padStart(2,"0");
  };
  update();
  if (config.countdown.showSeconds !== false) previewCountdownTimer = window.setInterval(update,1000);
}

function setPreviewImage(image, value, fieldName) {
  const url = safeAsset(value);
  const isLogo = fieldName === "logo_url" || fieldName === "secondary_logo_url";
  if (!url) {
    image.hidden = true;
    image.dataset.assetReady = "false";
    image.removeAttribute("src");
    if (isLogo) updatePreviewLogoCluster();
    return;
  }
  image.hidden = false;
  image.dataset.assetReady = "false";
  image.classList.add("asset-loading");
  image.onload = () => {
    image.dataset.assetReady = "true";
    image.classList.remove("asset-loading","asset-error");
    if (isLogo) updatePreviewLogoCluster();
    requestAnimationFrame(() => { fitPreviewTitle(); fitPreviewToVisibleArea(); });
  };
  image.onerror = () => {
    image.dataset.assetReady = "false";
    image.hidden = true;
    image.classList.remove("asset-loading"); image.classList.add("asset-error");
    if (isLogo) updatePreviewLogoCluster();
    syncAssetFeedback(fieldName, value, "error", "La URL existe, pero la imagen no pudo mostrarse. Revisa Storage y vuelve a subirla.");
  };
  image.src = url;
}

function updatePreviewLogoCluster() {
  const cluster = $("[data-preview-logo-cluster]");
  if (!cluster) return;
  const images = [$("[data-preview-logo]"), $("[data-preview-secondary-logo]")].filter((image) => image && !image.hidden && image.dataset.assetReady === "true");
  cluster.classList.remove("logo-count-0", "logo-count-1", "logo-count-2", "logo-layout-row", "logo-layout-stacked");
  cluster.classList.add(`logo-count-${images.length}`);
  cluster.hidden = images.length === 0;
  if (!images.length) return;
  if (images.length === 1) {
    cluster.classList.add("logo-layout-row");
    return;
  }
  const ratios = images.map((image) => image.naturalWidth / Math.max(1, image.naturalHeight));
  const bothVeryWide = ratios.every((ratio) => ratio > 2.25);
  const combinedWidth = ratios.reduce((sum, ratio) => sum + ratio, 0);
  cluster.classList.add(bothVeryWide || combinedWidth > 6.2 ? "logo-layout-stacked" : "logo-layout-row");
}

function normalizeLayers(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,30).map((item, index) => {
    const type = ["text","image","emoji"].includes(item?.type) ? item.type : "text";
    return {
      id:String(item?.id || `layer-${Date.now()}-${index}`).slice(0,80), type,
      section:(DEFAULT_ORDER.includes(item?.section) || /^custom:[a-z0-9-]{1,80}$/i.test(item?.section)) ? item.section : "hero",
      text:String(item?.text || (type === "text" ? "Texto" : "")).slice(0,240),
      src:type === "image" ? String(item?.src || "").slice(0,1500) : "",
      name:String(item?.name || "").slice(0,120),
      x:clampNumber(item?.x,0,100,50), y:clampNumber(item?.y,0,100,30),
      width:clampNumber(item?.width,5,100,type === "image" ? 34 : 42),
      rotation:clampNumber(item?.rotation,-180,180,0), opacity:clampNumber(item?.opacity,10,100,100),
      fontSize:clampNumber(item?.fontSize,12,180,type === "emoji" ? 64 : 34),
      color:safeColor(item?.color || "#ffffff","#ffffff"),
      fontFamily:String(item?.fontFamily || "Montserrat").slice(0,60),
      fontWeight:[400,500,600,700,800,900].includes(Number(item?.fontWeight)) ? Number(item.fontWeight) : 700
    };
  }).filter((item) => item.type !== "image" || item.src);
}

function clampNumber(value,min,max,fallback) { const number=Number(value); return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback; }
function selectedLayer() { return state.layers.find((item) => item.id === state.selectedLayerId) || null; }
function makeLayerId() { return `layer-${Date.now().toString(36)}-${randomToken()}`; }

function addLayer(layer) {
  if (state.layers.length >= 30) return alert("La portada admite hasta 30 capas libres.");
  const normalized = normalizeLayers([{ id:makeLayerId(), ...layer }])[0];
  if (!normalized) return;
  state.layers.push(normalized); state.selectedLayerId = normalized.id;
  renderLayerManager(); render(); setStatus("Capa agregada · cambios sin guardar");
}

function renderLayerManager() {
  const list = $("[data-layer-list]"); const inspector = $("[data-layer-inspector]");
  if (!list || !inspector) return;
  if (!state.layers.length) list.innerHTML = '<div class="layer-empty">Agrega texto, una fotografía o un sticker.</div>';
  else list.innerHTML = [...state.layers].reverse().map((layer,index) => {
    const label = layer.type === "image" ? (layer.name || "Imagen") : (layer.text || "Texto");
    const sectionLabel=SECTION_LABELS[layer.section] || CUSTOM_TYPES[state.customSections.find((item)=>customKey(item.id)===layer.section)?.type] || "Portada";
    return `<button type="button" class="layer-list-item${layer.id===state.selectedLayerId?" selected":""}" data-select-layer="${escapeAttr(layer.id)}"><span>${layer.type === "image" ? "▣" : layer.type === "emoji" ? "★" : "T"}</span><strong>${escapeAttr(label.slice(0,32))}<em>${escapeAttr(sectionLabel)}</em></strong><small>${state.layers.length-index}</small></button>`;
  }).join("");
  const layer = selectedLayer(); inspector.hidden = !layer;
  if (!layer) { inspector.innerHTML=""; return; }
  const textControl = layer.type === "image" ? "" : `<label>Contenido<textarea data-layer-prop="text" rows="2" maxlength="240">${escapeAttr(layer.text)}</textarea></label>`;
  const customOptions=state.customSections.map((item)=>`<option value="${customKey(item.id)}">${escapeAttr(CUSTOM_TYPES[item.type])}: ${escapeAttr(item.title||"Sin título")}</option>`).join("");
  inspector.innerHTML = `<strong>Editar capa seleccionada</strong><label>Sección<select data-layer-prop="section"><option value="hero">Portada</option><option value="countdown">Cuenta regresiva</option><option value="details">Detalles</option><option value="gallery">Galería</option><option value="rsvp">Confirmación RSVP</option>${customOptions}</select></label>${textControl}
    <div class="form-pair"><label>Posición X<input data-layer-prop="x" type="range" min="0" max="100" value="${layer.x}"></label><label>Posición Y<input data-layer-prop="y" type="range" min="0" max="100" value="${layer.y}"></label></div>
    <label>Ancho<input data-layer-prop="width" type="range" min="5" max="100" value="${layer.width}"></label>
    <div class="form-pair"><label>Rotación<input data-layer-prop="rotation" type="range" min="-180" max="180" value="${layer.rotation}"></label><label>Opacidad<input data-layer-prop="opacity" type="range" min="10" max="100" value="${layer.opacity}"></label></div>
    ${layer.type === "image" ? "" : `<div class="form-pair"><label>Tamaño<input data-layer-prop="fontSize" type="range" min="12" max="180" value="${layer.fontSize}"></label><label>Color<input data-layer-prop="color" type="color" value="${layer.color}"></label></div><label>Tipografía<select data-layer-prop="fontFamily"><option>Montserrat</option><option>Fraunces</option><option>Playfair Display</option><option>Great Vibes</option><option>Fredoka</option><option>Bebas Neue</option><option>Cinzel</option><option>Manrope</option></select></label>`}
    <div class="layer-actions"><button type="button" data-layer-action="back">Enviar atrás</button><button type="button" data-layer-action="front">Traer al frente</button><button type="button" data-layer-action="duplicate">Duplicar</button><button type="button" data-layer-action="delete" class="danger">Eliminar</button></div>`;
  const section = inspector.querySelector('[data-layer-prop="section"]'); if (section) section.value = layer.section;
  const font = inspector.querySelector('[data-layer-prop="fontFamily"]'); if (font) font.value = layer.fontFamily;
}

function handleLayerListClick(event) {
  const button = event.target.closest("[data-select-layer]"); if (!button) return;
  state.selectedLayerId = button.dataset.selectLayer; renderLayerManager(); renderPreviewLayers(state.layers);
}
function handleLayerInspectorInput(event) {
  const key = event.target.dataset.layerProp; const layer = selectedLayer(); if (!key || !layer) return;
  const numeric = ["x","y","width","rotation","opacity","fontSize"].includes(key);
  layer[key] = numeric ? Number(event.target.value) : event.target.value;
  if (key === "section") {
    state.enabled[layer.section] = true;
    renderSectionManager();
    renderLayerManager();
  }
  renderPreviewLayers(state.layers); setStatus("Cambios sin guardar");
}
function handleLayerInspectorClick(event) {
  const action = event.target.dataset.layerAction; const layer = selectedLayer(); if (!action || !layer) return;
  const index = state.layers.indexOf(layer);
  if (action === "delete") { state.layers.splice(index,1); state.selectedLayerId=state.layers.at(-1)?.id||null; }
  if (action === "front" && index < state.layers.length-1) { state.layers.splice(index,1); state.layers.push(layer); }
  if (action === "back" && index > 0) { state.layers.splice(index,1); state.layers.unshift(layer); }
  if (action === "duplicate") { const copy={...layer,id:makeLayerId(),x:clampNumber(layer.x+4,0,100,50),y:clampNumber(layer.y+4,0,100,30)}; state.layers.push(copy); state.selectedLayerId=copy.id; }
  renderLayerManager(); render(); setStatus("Cambios sin guardar");
}

function renderPreviewLayers(layers) {
  $$("[data-preview-layer-stage]").forEach((stage) => stage.remove());
  const stages = {};
  state.sections.forEach((section) => {
    const block = $(`[data-preview-section="${section}"]`); if (!block) return;
    const stage = document.createElement("div"); stage.className="free-layer-stage"; stage.dataset.previewLayerStage=section; block.appendChild(stage); stages[section]=stage;
  });
  normalizeLayers(layers).forEach((layer,index) => {
    const stage = stages[layer.section] || stages.hero; if (!stage) return;
    const node=document.createElement("div"); node.className=`free-layer free-layer-${layer.type}${layer.id===state.selectedLayerId?" selected":""}`;
    node.dataset.layerId=layer.id; node.dataset.sectionLabel=SECTION_LABELS[layer.section] || "Portada"; node.style.left=`${layer.x}%`; node.style.top=`${layer.y}%`; node.style.width=`${layer.width}%`; node.style.opacity=String(layer.opacity/100); node.style.transform=`translate(-50%,-50%) rotate(${layer.rotation}deg)`; node.style.zIndex=String(20+index);
    if (layer.type === "image") { const image=document.createElement("img"); image.src=layer.src; image.alt=""; node.appendChild(image); }
    else { node.textContent=layer.text; node.style.fontSize=`${layer.fontSize}px`; node.style.color=layer.color; node.style.fontFamily=`'${layer.fontFamily}'`; node.style.fontWeight=String(layer.fontWeight); }
    node.addEventListener("pointerdown", beginLayerDrag); stage.appendChild(node);
  });
}

function beginLayerDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault(); const node=event.currentTarget; const stage=node.parentElement; const layer=state.layers.find((item)=>item.id===node.dataset.layerId); if(!layer)return;
  state.selectedLayerId=layer.id; renderLayerManager(); node.classList.add("selected","dragging"); node.setPointerCapture?.(event.pointerId);
  const move=(moveEvent)=>{const rect=stage.getBoundingClientRect();layer.x=clampNumber(((moveEvent.clientX-rect.left)/rect.width)*100,0,100,50);layer.y=clampNumber(((moveEvent.clientY-rect.top)/rect.height)*100,0,100,30);node.style.left=`${layer.x}%`;node.style.top=`${layer.y}%`;};
  const end=()=>{node.classList.remove("dragging");node.removeEventListener("pointermove",move);node.removeEventListener("pointerup",end);node.removeEventListener("pointercancel",end);renderLayerManager();setStatus("Capa movida · cambios sin guardar");};
  node.addEventListener("pointermove",move);node.addEventListener("pointerup",end);node.addEventListener("pointercancel",end);
}

async function save() {
  const form = $("#designer-form"); if (!form.reportValidity()) return;
  if (state.uploading) return alert("Espera a que terminen las cargas.");
  setBusy(true); setStatus("Guardando diseño…");
  try {
    const data = formData(); const config = buildConfig(data); const previousAssets=collectDesignAssets(state.event,mergeConfig(state.event.design_config));
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
    const nextAssets=collectDesignAssets(payload,config);const obsolete=[...previousAssets].filter((url)=>!nextAssets.has(url)).map(storagePathFromUrl).filter(Boolean);
    if(obsolete.length) try{await api.removeFile(BUCKET,obsolete)}catch(error){console.warn("No fue posible limpiar algunos archivos anteriores.",error)}
    state.event = { ...state.event, ...payload };
    $("[data-event-title]").textContent = payload.name;
    ["logo_url","secondary_logo_url","hero_image_url","background_image_url","background_video_url","music_url"].forEach((fieldName) => {
      const value = $("#designer-form").elements[fieldName]?.value || "";
      syncAssetFeedback(fieldName, value, value ? "saved" : "empty", value ? "Archivo guardado en la invitación." : "Sin archivo seleccionado.");
    });
    setStatus("Diseño guardado", true);
  } catch (error) { setStatus(errorMessage(error)); }
  finally { setBusy(false); }
}

function collectDesignAssets(event,config){
  return new Set([event?.logo_url,event?.secondary_logo_url,event?.hero_image_url,event?.music_url,config?.media?.backgroundImage,config?.media?.backgroundVideo,...(config?.media?.gallery||[]),...(config?.layers||[]).map((item)=>item.src),...(config?.customSections||[]).map((item)=>item.mediaUrl)].filter((url)=>/^https?:/i.test(String(url||""))));
}
function storagePathFromUrl(value){
  try{const url=new URL(value),marker=`/storage/v1/object/public/${BUCKET}/`,index=url.pathname.indexOf(marker);return index>=0?decodeURIComponent(url.pathname.slice(index+marker.length)):""}catch{return""}
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

// LN Studio v4.9.0 · motor de video: validación de códec, YouTube, rangos y subida comprobada.
