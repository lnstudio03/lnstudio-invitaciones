import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DEFAULT_ORDER = ["hero","countdown","details","gallery","rsvp"];
let eventData = null;
let token = null;
let passUrl = "";
let currentPass = null;
let currentGuestName = "";
let previewMode = false;
let previewEventId = null;

const DEFAULT_CONFIG = {
  colors:{ background:"#0d1420",background2:"#1b2537",text:"#ffffff",muted:"#b7c1d5",primary:"#8f7dff",secondary:"#ff7f91",overlay:45,mode:"gradient" },
  typography:{ heading:"Fraunces",body:"Manrope",headingSize:72,bodySize:18,headingWeight:700,align:"center",transform:"none" },
  countdown:{ style:"cards",font:"Manrope",showSeconds:true },
  media:{ backgroundImage:"",gallery:[],heroFit:"cover",showMusicButton:true },
  layers:[],
  customSections:[],
  animation:{ preset:"fade-up",ambient:"none",intensity:"medium",respectReducedMotion:true },
  content:{ kicker:"Invitación digital privada · LN Studio",rsvpTitle:"¿Nos acompañas?",rsvpCopy:"Confirma tu asistencia y recibe tu pase digital." },
  sections:{ order:[...DEFAULT_ORDER],enabled:{hero:true,countdown:true,details:true,gallery:true,rsvp:true} }
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const params = new URLSearchParams(location.search);
  token = params.get("token");
  previewEventId = params.get("id");
  previewMode = params.get("preview") === "1" && Boolean(previewEventId);
  bind();
  try {
    if (previewMode) {
      const user = await api.getUser();
      if (!user) return fail("Inicia sesión en LN Studio para abrir esta vista previa.");
      const rows = await api.select("events", { filters:{ id:previewEventId }, limit:1 });
      eventData = rows?.[0] || null;
      if (!eventData?.id) return fail("No tienes acceso a esta vista previa o el evento ya no existe.");
      document.body.classList.add("is-preview");
      const banner = $("[data-preview-banner]");
      if (banner) banner.hidden = false;
    } else {
      if (!token) return fail("Invitación no válida.");
      eventData = await api.rpc("get_public_event", { p_token:token }, { publicCall:true });
      if (!eventData?.id) return fail("Esta invitación todavía no está publicada o el enlace no es válido.");
      if (eventData.status === "finished" || (eventData.expires_at && new Date(eventData.expires_at) <= new Date())) {
        location.replace("evento-finalizado.html"); return;
      }
    }
    renderEvent();
  } catch (error) { fail(errorMessage(error)); }
}

function bind() {
  $("#rsvp-form").addEventListener("submit", submit);
  $$(`[name="attendance"]`).forEach((radio) => radio.addEventListener("change", togglePartyFields));
  $("[data-calendar]").addEventListener("click", downloadCalendar);
  $("[data-download-qr]").addEventListener("click", downloadQr);
  $("[data-copy-pass]").addEventListener("click", copyPass);
  $("[data-music-button]").addEventListener("click", toggleMusic);
}

function renderEvent() {
  const config = mergeConfig(eventData?.design_config);
  document.body.dataset.eventStatus = eventData.status || "draft";
  document.title = `${eventData.name} | Invitación`;
  applyVariables(config);
  applyTypographyDirectly(config);
  ensureSelectedFonts(config).then(() => applyTypographyDirectly(config)).catch(() => {});
  renderCustomSections(config.customSections);
  applyLayout(config);
  $("[data-name]").textContent = eventData.name;
  $("[data-description]").textContent = eventData.description || "";
  $("[data-kicker]").textContent = config.content.kicker;
  $("[data-date]").textContent = formatDate(eventData.event_date);
  $("[data-venue]").textContent = [eventData.venue_name,eventData.venue_address].filter(Boolean).join(" · ") || "Ubicación por confirmar";
  $("[data-rsvp-title]").textContent = config.content.rsvpTitle;
  $("[data-rsvp-copy]").textContent = config.content.rsvpCopy;
  const map = $("[data-map]");
  map.href = eventData.maps_url || "#";
  map.hidden = !eventData.maps_url;
  $("[data-dress-code]").textContent = eventData.dress_code ? `Código de vestimenta: ${eventData.dress_code}` : "";
  const refreshLogoCluster = () => updateEventLogoCluster();
  setEventImage($("[data-logo]"), eventData.logo_url, refreshLogoCluster, refreshLogoCluster);
  setEventImage($("[data-secondary-logo]"), eventData.secondary_logo_url, refreshLogoCluster, refreshLogoCluster);
  updateEventLogoCluster();
  setEventImage($("[data-hero-image]"), eventData.hero_image_url);
  renderFreeLayers(config.layers);
  renderGallery(config.media.gallery);
  configureMusic(config);
  const party = $("#rsvp-form [name=party_size]"); party.max = Number(eventData.max_companions || 0) + 1;
  $(".rsvp-submit small").textContent = eventData.qr_enabled ? "Generar pase digital" : "Registrar respuesta";
  if (!eventData.allow_general_rsvp) {
    $("[data-form-section]").innerHTML = '<p class="invite-kicker">Acceso individual</p><h2>Esta invitación requiere un enlace personal.</h2><p>Solicita tu enlace a los anfitriones.</p>';
  }
  startCountdown(config); initializeReveal(config);
}

function mergeConfig(value) {
  let source = value;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  source = source && typeof source === "object" ? source : {};
  return {
    ...DEFAULT_CONFIG,
    ...source,
    colors:{...DEFAULT_CONFIG.colors,...(source.colors||{})},
    typography:{...DEFAULT_CONFIG.typography,...(source.typography||{})},
    countdown:{...DEFAULT_CONFIG.countdown,...(source.countdown||{})},
    media:{...DEFAULT_CONFIG.media,...(source.media||{})},
    layers:normalizeFreeLayers(source.layers),
    customSections:normalizeCustomSections(source.customSections),
    animation:{...DEFAULT_CONFIG.animation,...(source.animation||{})},
    content:{...DEFAULT_CONFIG.content,...(source.content||{})},
    sections:{order:normalizeOrder(source.sections?.order),enabled:{...DEFAULT_CONFIG.sections.enabled,...(source.sections?.enabled||{})}}
  };
}
function normalizeOrder(order) { const clean=Array.isArray(order)?order.filter((item)=>DEFAULT_ORDER.includes(item)||/^custom:[a-z0-9-]{1,80}$/i.test(item)):[]; DEFAULT_ORDER.forEach((item)=>{if(!clean.includes(item))clean.push(item)}); return clean; }

function applyVariables(config) {
  const root = document.documentElement.style;
  root.setProperty("--invite-accent", safeColor(eventData.theme_primary || config.colors.primary, "#8f7dff"));
  root.setProperty("--invite-accent-two", safeColor(eventData.theme_secondary || config.colors.secondary, "#ff7f91"));
  root.setProperty("--invite-bg", safeColor(config.colors.background, "#0d1420"));
  root.setProperty("--invite-bg-two", safeColor(config.colors.background2, "#1b2537"));
  root.setProperty("--invite-text", safeColor(config.colors.text, "#ffffff"));
  root.setProperty("--invite-muted", safeColor(config.colors.muted, "#b7c1d5"));
  root.setProperty("--invite-overlay", String(Math.min(90,Math.max(0,Number(config.colors.overlay||45)))/100));
  root.setProperty("--invite-heading-font", `'${safeFont(config.typography.heading,"Fraunces")}'`);
  root.setProperty("--invite-body-font", `'${safeFont(config.typography.body,"Manrope")}'`);
  root.setProperty("--invite-countdown-font", `'${safeFont(config.countdown.font,"Manrope")}'`);
  root.setProperty("--invite-heading-size", `${Math.min(120,Math.max(36,Number(config.typography.headingSize||72)))}px`);
  root.setProperty("--invite-body-size", `${Math.min(28,Math.max(14,Number(config.typography.bodySize||18)))}px`);
  root.setProperty("--invite-heading-weight", String(config.typography.headingWeight||700));
  const align = ["left","center","right"].includes(config.typography.align)?config.typography.align:"center";
  root.setProperty("--invite-text-align", align);
  root.setProperty("--hero-align", align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center");
  root.setProperty("--invite-heading-transform", ["none","uppercase","capitalize"].includes(config.typography.transform)?config.typography.transform:"none");
  root.setProperty("--invite-hero-fit", ["cover","contain","scale-down"].includes(config.media.heroFit)?config.media.heroFit:"cover");
  const hero = $("[data-section=hero]");
  if (config.colors.mode === "image" && config.media.backgroundImage) hero.style.backgroundImage = `url("${cssUrl(config.media.backgroundImage)}")`;
  else if (config.colors.mode === "solid") hero.style.backgroundImage = "none", hero.style.backgroundColor = safeColor(config.colors.background,"#0d1420");
  else hero.style.backgroundImage = `linear-gradient(145deg,${safeColor(config.colors.background,"#0d1420")},${safeColor(config.colors.background2,"#1b2537")})`;
  document.body.classList.add(`animation-${safeAnimation(config.animation.preset)}`);
  document.body.classList.toggle("allow-motion", config.animation.respectReducedMotion === false);
  document.body.dataset.animationIntensity = config.animation.intensity || "medium";
  const ambient = $("[data-ambient]"); ambient.className = `event-ambient ${safeAmbient(config.animation.ambient)}`;
}

function applyLayout(config) {
  const shell = $("[data-event-shell]");
  config.sections.order.forEach((key) => { const node=$(`[data-section="${key}"]`); if(node)shell.insertBefore(node,$("[data-pass]")); });
  Object.entries(config.sections.enabled).forEach(([key,enabled])=>{const node=$(`[data-section="${key}"]`);if(node)node.hidden=!enabled});
  if (!config.media.gallery?.length && !config.layers.some((layer)=>layer.section==="gallery")) $("[data-section=gallery]").hidden = true;
}

function normalizeCustomSections(value){if(!Array.isArray(value))return[];return value.slice(0,12).map((item,index)=>({id:String(item?.id||`section-${index}`).replace(/[^a-z0-9-]/gi,"-").slice(0,80),type:["image","video","photo-text","quote","separator","itinerary"].includes(item?.type)?item.type:"quote",title:String(item?.title||"").slice(0,140),text:String(item?.text||"").slice(0,900),mediaUrl:String(item?.mediaUrl||"").slice(0,1800),caption:String(item?.caption||"").slice(0,220),items:Array.isArray(item?.items)?item.items.map((entry)=>String(entry).slice(0,120)).slice(0,8):[]}))}
function renderCustomSections(value){
  $$('[data-custom-section]').forEach((node)=>node.remove());const anchor=$("[data-pass]");
  normalizeCustomSections(value).forEach((section)=>{const node=document.createElement("section");node.className=`official-custom official-custom-${section.type} invite-animated`;node.dataset.section=`custom:${section.id}`;node.dataset.customSection=section.id;const media=safeAsset(section.mediaUrl);
    if(section.type==="video")node.innerHTML=`<p class="invite-kicker">Video</p><h2>${escapeAttr(section.title)}</h2>${media?`<video src="${escapeAttr(media)}" controls playsinline preload="metadata"></video>`:""}<p>${escapeAttr(section.text)}</p>`;
    else if(section.type==="image")node.innerHTML=`<p class="invite-kicker">Imagen destacada</p><h2>${escapeAttr(section.title)}</h2>${media?`<img src="${escapeAttr(media)}" alt="${escapeAttr(section.caption)}" loading="lazy">`:""}<p>${escapeAttr(section.caption)}</p>`;
    else if(section.type==="photo-text")node.innerHTML=`<div class="official-custom-split">${media?`<img src="${escapeAttr(media)}" alt="${escapeAttr(section.caption)}" loading="lazy">`:""}<div><p class="invite-kicker">Nuestra historia</p><h2>${escapeAttr(section.title)}</h2><p>${escapeAttr(section.text)}</p></div></div>`;
    else if(section.type==="quote")node.innerHTML=`<span class="official-quote-mark">“</span><blockquote>${escapeAttr(section.text)}</blockquote><h2>${escapeAttr(section.title)}</h2>`;
    else if(section.type==="separator")node.innerHTML=`<span class="official-separator-symbol">${escapeAttr(section.title||"✦")}</span><h2>${escapeAttr(section.text)}</h2>`;
    else {const items=section.items.map((item)=>{const parts=item.split("·");return `<li><strong>${escapeAttr(parts.shift()?.trim()||"")}</strong><span>${escapeAttr(parts.join("·").trim())}</span></li>`}).join("");node.innerHTML=`<p class="invite-kicker">Itinerario</p><h2>${escapeAttr(section.title)}</h2><ol class="official-itinerary">${items}</ol>`}
    anchor.parentElement.insertBefore(node,anchor);
  });
}

function renderGallery(gallery) {
  const list = Array.isArray(gallery)?gallery.filter(Boolean).slice(0,8):[];
  const root=$("[data-gallery]"); root.innerHTML=list.map((url,index)=>`<img src="${escapeAttr(safeAsset(url))}" alt="Fotografía ${index+1}" loading="lazy">`).join("");
  $("[data-section=gallery]").hidden = !list.length && !mergeConfig(eventData?.design_config).layers.some((layer)=>layer.section==="gallery");
}

function normalizeFreeLayers(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,30).map((item,index)=>({
    id:String(item?.id||`layer-${index}`).slice(0,80),section:(DEFAULT_ORDER.includes(item?.section)||/^custom:[a-z0-9-]{1,80}$/i.test(item?.section))?item.section:"hero",
    type:["text","image","emoji"].includes(item?.type)?item.type:"text",
    text:String(item?.text||"").slice(0,240),src:String(item?.src||"").slice(0,1500),
    x:clampLayer(item?.x,0,100,50),y:clampLayer(item?.y,0,100,30),width:clampLayer(item?.width,5,100,35),
    rotation:clampLayer(item?.rotation,-180,180,0),opacity:clampLayer(item?.opacity,10,100,100),
    fontSize:clampLayer(item?.fontSize,12,180,34),color:safeColor(item?.color||"#ffffff","#ffffff"),
    fontFamily:safeFont(item?.fontFamily||"Montserrat","Montserrat"),fontWeight:[400,500,600,700,800,900].includes(Number(item?.fontWeight))?Number(item.fontWeight):700
  })).filter((item)=>item.type!=="image"||safeAsset(item.src));
}
function clampLayer(value,min,max,fallback){const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback}
function renderFreeLayers(layers){
  $$("[data-free-layers]").forEach((root)=>root.remove());const roots={};
  $$('[data-section]').forEach((block)=>{const section=block.dataset.section;if(!section)return;const root=document.createElement("div");root.className="event-free-layers";root.dataset.freeLayers=section;root.setAttribute("aria-hidden","true");block.appendChild(root);roots[section]=root});
  normalizeFreeLayers(layers).forEach((layer,index)=>{const root=roots[layer.section]||roots.hero;if(!root)return;const node=document.createElement("div");node.className=`event-free-layer event-free-layer-${layer.type}`;node.style.left=`${layer.x}%`;node.style.top=`${layer.y}%`;node.style.width=`${layer.width}%`;node.style.opacity=String(layer.opacity/100);node.style.transform=`translate(-50%,-50%) rotate(${layer.rotation}deg)`;node.style.zIndex=String(20+index);
    if(layer.type==="image"){const image=document.createElement("img");image.src=safeAsset(layer.src);image.alt="";image.loading="eager";node.appendChild(image)}else{node.textContent=layer.text;node.style.fontSize=`clamp(12px,${layer.fontSize/7}vw,${layer.fontSize}px)`;node.style.color=layer.color;node.style.fontFamily=`'${layer.fontFamily}'`;node.style.fontWeight=String(layer.fontWeight)}root.appendChild(node)});
}

function setEventImage(image, value, onLoad = null, onError = null) {
  const url = safeAsset(value);
  if (!url) {
    image.hidden = true;
    image.dataset.assetReady = "false";
    image.removeAttribute("src");
    if (onError) onError();
    return;
  }
  image.hidden = false;
  image.dataset.assetReady = "false";
  image.onload = () => {
    image.hidden = false;
    image.dataset.assetReady = "true";
    if (onLoad) onLoad();
  };
  image.onerror = () => {
    image.hidden = true;
    image.dataset.assetReady = "false";
    if (onError) onError();
  };
  image.src = url;
}

function updateEventLogoCluster() {
  const cluster = $("[data-logo-cluster]");
  if (!cluster) return;
  const images = [$("[data-logo]"), $("[data-secondary-logo]")].filter((image) => image && !image.hidden && image.dataset.assetReady === "true");
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

function configureMusic(config) {
  const audio=$("[data-music]"); const button=$("[data-music-button]");
  if (!eventData.music_url || config.media.showMusicButton === false) { button.hidden=true; return; }
  audio.src=safeAsset(eventData.music_url); button.hidden=false;
}
async function toggleMusic() {
  const audio=$("[data-music]"); const button=$("[data-music-button]");
  try {
    if (audio.paused) { await audio.play(); button.classList.add("playing"); button.querySelector("b").textContent="Pausar música"; }
    else { audio.pause(); button.classList.remove("playing"); button.querySelector("b").textContent="Reproducir música"; }
  } catch { button.querySelector("b").textContent="Toca otra vez"; }
}

function initializeReveal(config) {
  const nodes=$$(".invite-animated");
  if (config.animation.preset === "none" || !("IntersectionObserver" in window)) { nodes.forEach((node)=>node.classList.add("visible")); return; }
  const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}}),{threshold:.12});
  nodes.forEach((node)=>observer.observe(node));
}

function togglePartyFields() {
  const confirmed=$("[name=attendance]:checked").value === "confirmed";
  $$(`[data-party-fields]`).forEach((node)=>node.hidden=!confirmed); $("[name=party_size]").required=confirmed;
}

async function submit(event) {
  event.preventDefault(); const form=event.currentTarget; const status=$("#status");
  if (previewMode) {
    status.textContent = "Esta es una vista previa. Publica el evento y abre el enlace público para registrar confirmaciones reales.";
    return;
  }
  if(!form.reportValidity())return;
  const submitButton=form.querySelector('button[type="submit"]'); submitButton.disabled=true; status.textContent="Registrando tu respuesta…";
  try {
    const data=new FormData(form);
    const result=await api.rpc("submit_public_rsvp",{p_token:token,p_name:data.get("name"),p_phone:data.get("phone"),p_email:data.get("email")||null,p_attendance:data.get("attendance"),p_party_size:Number(data.get("party_size")||1),p_guest_names:data.get("guest_names")||null,p_dietary:data.get("dietary")||null,p_message:data.get("message")||null},{publicCall:true});
    if(!result?.ok)throw new Error(result?.message||"No se pudo registrar la respuesta.");
    currentGuestName = String(data.get("name") || result?.rsvp?.respondent_name || "").trim();
    $("[data-form-section]").hidden=true; $("[data-pass]").hidden=false;
    if(result.pass)renderPass(result.pass); else {$("[data-pass-title]").textContent="Respuesta registrada";$("[data-pass-copy]").textContent="Gracias por avisar a los anfitriones.";$("[data-folio]").textContent=result.rsvp.id.slice(0,8).toUpperCase();$("[data-capacity]").textContent=""}
    $("[data-pass]").scrollIntoView({behavior:"smooth"});
  } catch(error) { status.textContent=errorMessage(error); submitButton.disabled=false; }
}

function renderPass(pass) {
  const origin=location.origin&&location.origin!=="null"?location.origin:"https://lnstudio-invitaciones.pages.dev";
  passUrl=`${origin}/scanner.html?event=${encodeURIComponent(eventData.id)}&token=${encodeURIComponent(pass.token)}`;
  const canvas=$("#qr"); window.LNQRCode.toCanvas(canvas,passUrl,{width:300,margin:4,level:"M"});
  canvas.hidden=false; $("[data-folio]").textContent=pass.folio; $("[data-capacity]").textContent=`Accesos autorizados: ${pass.allowed_entries}`;
  $("[data-download-qr]").hidden=false; $("[data-download-qr]").textContent="Guardar pase"; $("[data-copy-pass]").hidden=false; currentPass = pass;
}

async function downloadQr(){
  const qrCanvas = $("#qr");
  if(qrCanvas.hidden) return;
  try {
    const card = await buildPassCard(qrCanvas);
    const link = document.createElement("a");
    link.download = `pase-${$("[data-folio]").textContent || "ln-studio"}.png`;
    link.href = card.toDataURL("image/png");
    link.click();
  } catch (error) {
    const fallback = document.createElement("a");
    fallback.download = `pase-${$("[data-folio]").textContent || "ln-studio"}.png`;
    fallback.href = qrCanvas.toDataURL("image/png");
    fallback.click();
  }
}

async function buildPassCard(qrCanvas) {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 2100;
  const ctx = canvas.getContext("2d");

  const accent = getCssVariable("--invite-accent", "#8f7dff");
  const accentTwo = getCssVariable("--invite-accent-two", "#ff7f91");
  const bg = getCssVariable("--invite-bg", "#0d1420");
  const bgTwo = getCssVariable("--invite-bg-two", "#1b2537");
  const text = getCssVariable("--invite-text", "#ffffff");
  const muted = getCssVariable("--invite-muted", "#b7c1d5");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, bg);
  gradient.addColorStop(.64, bgTwo);
  gradient.addColorStop(1, accentTwo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = .13;
  drawGlow(ctx, 220, 260, 320, accent);
  drawGlow(ctx, 1180, 380, 280, accentTwo);
  drawGlow(ctx, 1050, 1840, 360, accent);
  ctx.globalAlpha = 1;

  const hero = await loadImageSafe(eventData?.hero_image_url);
  if (hero) {
    ctx.save();
    ctx.globalAlpha = .10;
    drawCoverImage(ctx, hero, 72, 72, 1256, 560, 38);
    ctx.restore();
  }

  roundRect(ctx, 86, 86, 1228, 1928, 44);
  ctx.fillStyle = "rgba(7,10,18,.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const logo = await loadImageSafe(eventData?.logo_url);
  if (logo) drawContainImage(ctx, logo, 120, 120, 210, 120);

  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = '800 32px Manrope, Inter, Arial, sans-serif';
  ctx.fillText('PASE DIGITAL · LN STUDIO', canvas.width / 2, 172);

  const eventName = String(eventData?.name || 'Tu evento').trim();
  const titleFontSize = eventName.length > 115 ? 62 : eventName.length > 80 ? 70 : eventName.length > 52 ? 78 : 90;
  const titleLineHeight = Math.round(titleFontSize * 1.08);
  ctx.font = `700 ${titleFontSize}px Fraunces, Cormorant Garamond, Georgia, serif`;
  ctx.fillStyle = text;
  let y = 292;
  const titleResult = drawTextBlock(ctx, eventName, 150, y, 1100, titleLineHeight, 4, "left");
  y = titleResult.bottom + 46;

  const dateText = formatDate(eventData?.event_date);
  const venueText = [eventData?.venue_name, eventData?.venue_address].filter(Boolean).join(' · ') || 'Ubicación por confirmar';

  y = drawInfoCard(ctx, {
    x: 140, y, width: 1120,
    label: 'FECHA', value: dateText,
    accent, text, muted,
    valueFont: 32,
    maxLines: 2
  }) + 18;

  y = drawInfoCard(ctx, {
    x: 140, y, width: 1120,
    label: 'LUGAR', value: venueText,
    accent, text, muted,
    valueFont: 30,
    maxLines: 3
  }) + 34;

  if (currentGuestName) {
    ctx.fillStyle = muted;
    ctx.font = '700 24px Manrope, Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PASE PARA', canvas.width / 2, y);
    y += 42;
    ctx.fillStyle = text;
    ctx.font = '700 38px Manrope, Inter, Arial, sans-serif';
    const guest = drawTextBlock(ctx, currentGuestName, 220, y, 960, 44, 2, 'center');
    y = guest.bottom + 38;
  }

  const qrBoxSize = 530;
  const qrBoxX = (canvas.width - qrBoxSize) / 2;
  const qrBoxY = y;
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = 30;
  ctx.drawImage(qrCanvas, qrBoxX + 38, qrBoxY + 38, qrBoxSize - 76, qrBoxSize - 76);
  ctx.shadowBlur = 0;

  y = qrBoxY + qrBoxSize + 62;
  roundRect(ctx, 240, y, 920, 112, 24);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.stroke();
  ctx.fillStyle = '#e7ecfb';
  ctx.font = '700 38px Manrope, Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Folio: ${$("[data-folio]").textContent || ''}`, canvas.width / 2, y + 70);

  y += 168;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 39px Manrope, Inter, Arial, sans-serif';
  ctx.fillText(`Accesos autorizados: ${currentPass?.allowed_entries || 1}`, canvas.width / 2, y);

  y += 64;
  ctx.fillStyle = muted;
  ctx.font = '500 29px Manrope, Inter, Arial, sans-serif';
  ctx.fillText('Presenta este pase al llegar al evento.', canvas.width / 2, y);

  y += 104;
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath();
  ctx.moveTo(230, y);
  ctx.lineTo(1170, y);
  ctx.stroke();

  y += 72;
  ctx.fillStyle = accent;
  ctx.font = '800 27px Manrope, Inter, Arial, sans-serif';
  ctx.fillText('INVITACIÓN PERSONALIZADA', canvas.width / 2, y);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Manrope, Inter, Arial, sans-serif';
  ctx.fillText('Creada con LN Studio', canvas.width / 2, y + 50);

  return canvas;
}

function getCssVariable(name, fallback = '') {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function getWrappedLines(ctx, text, maxWidth, maxLines = 4) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  let consumed = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
      consumed += 1;
    } else {
      lines.push(line);
      line = word;
      consumed += 1;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trim();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4, align = 'left') {
  const lines = getWrappedLines(ctx, text, maxWidth, maxLines);
  ctx.textAlign = align;
  const drawX = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
  lines.forEach((line, index) => ctx.fillText(line, drawX, y + index * lineHeight));
  ctx.textAlign = 'center';
  return {
    lines,
    bottom: y + Math.max(lines.length, 1) * lineHeight
  };
}

function drawInfoCard(ctx, { x, y, width, label, value, accent, text, muted, valueFont = 30, maxLines = 2 }) {
  ctx.font = `700 ${valueFont}px Manrope, Inter, Arial, sans-serif`;
  const lines = getWrappedLines(ctx, value, width - 70, maxLines);
  const lineHeight = Math.round(valueFont * 1.34);
  const height = 54 + Math.max(lines.length, 1) * lineHeight + 28;

  roundRect(ctx, x, y, width, height, 24);
  ctx.fillStyle = 'rgba(255,255,255,.055)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = '800 22px Manrope, Inter, Arial, sans-serif';
  ctx.fillText(label, x + 34, y + 34);

  ctx.fillStyle = text;
  ctx.font = `700 ${valueFont}px Manrope, Inter, Arial, sans-serif`;
  lines.forEach((line, index) => ctx.fillText(line, x + 34, y + 78 + index * lineHeight));
  ctx.textAlign = 'center';
  return y + height;
}

async function loadImageSafe(src) {
  const url = safeAsset(src);
  if (!url) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function drawContainImage(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawCoverImage(ctx, image, x, y, width, height, radius = 0) {
  const ratio = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.save();
  if (radius) { roundRect(ctx, x, y, width, height, radius); ctx.clip(); }
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawGlow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
async function copyPass(){try{await navigator.clipboard.writeText(passUrl);$("[data-copy-pass]").textContent="Pase copiado"}catch{alert(passUrl)}}
function downloadCalendar(){if(!eventData?.event_date)return alert("La fecha todavía no está definida.");const start=new Date(eventData.event_date),end=new Date(start.getTime()+3*60*60*1000);const stamp=(date)=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const content=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LN Studio//Invitacion//ES","BEGIN:VEVENT",`UID:${eventData.id}@lnstudio`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${ics(eventData.name)}`,`LOCATION:${ics([eventData.venue_name,eventData.venue_address].filter(Boolean).join(", "))}`,`DESCRIPTION:${ics(eventData.description||"")}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");const blob=new Blob([content],{type:"text/calendar;charset=utf-8"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${eventData.name}.ics`;link.click();URL.revokeObjectURL(link.href)}
function startCountdown(config){
  const section=$("[data-section=countdown]");
  const display=$("[data-countdown-display]");
  const message=$("[data-countdown-message]");
  const secondsWrap=$("[data-countdown-seconds-wrap]");
  if(!section||!display||!message)return;
  ["cards","minimal","circles","inline","neon","flip"].forEach((style)=>section.classList.remove(`countdown-style-${style}`));
  section.classList.add(`countdown-style-${safeCountdownStyle(config.countdown.style)}`);
  section.classList.toggle("countdown-no-seconds",config.countdown.showSeconds===false);
  display.style.fontFamily=`'${safeFont(config.countdown.font,"Manrope")}'`;
  secondsWrap.hidden=config.countdown.showSeconds===false;
  const target=eventData.event_date?new Date(eventData.event_date).getTime():NaN;
  const setValue=(selector,value)=>{const node=$(selector);if(node)node.textContent=String(value).padStart(2,"0")};
  const update=()=>{
    if(!Number.isFinite(target)){
      display.hidden=true;
      message.hidden=false;
      message.textContent="Fecha por confirmar.";
      return;
    }
    const diff=target-Date.now();
    if(diff<=0){
      display.hidden=true;
      message.hidden=false;
      message.textContent="El gran momento ha llegado.";
      return;
    }
    display.hidden=false;
    message.hidden=true;
    setValue("[data-countdown-days]",Math.floor(diff/86400000));
    setValue("[data-countdown-hours]",Math.floor(diff%86400000/3600000));
    setValue("[data-countdown-minutes]",Math.floor(diff%3600000/60000));
    setValue("[data-countdown-seconds]",Math.floor(diff%60000/1000));
  };
  update();
  window.setInterval(update,config.countdown.showSeconds===false?60000:1000);
}
function fail(message){$("[data-name]").textContent=message;$("[data-description]").textContent="Verifica que el enlace esté completo o consulta a los anfitriones.";$("[data-form-section]").hidden=true}
function safeAsset(value){const text=String(value||"").trim();if(/^(https?:|data:|blob:)/i.test(text))return text;return text.replace(/^\/+/,"")}
function safeColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||""))?value:fallback}
const FONT_SPECS = {
  "Fraunces":"Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,800",
  "Playfair Display":"Playfair+Display:wght@500;600;700;800",
  "DM Serif Display":"DM+Serif+Display",
  "Cormorant Garamond":"Cormorant+Garamond:wght@500;600;700",
  "Cinzel":"Cinzel:wght@500;600;700;800",
  "Abril Fatface":"Abril+Fatface",
  "Merriweather":"Merriweather:wght@400;700",
  "Fredoka":"Fredoka:wght@400;500;600;700",
  "Baloo 2":"Baloo+2:wght@500;600;700;800",
  "Lilita One":"Lilita+One",
  "Luckiest Guy":"Luckiest+Guy",
  "Bangers":"Bangers",
  "Lobster":"Lobster",
  "Pacifico":"Pacifico",
  "Montserrat":"Montserrat:wght@400;500;600;700;800",
  "Poppins":"Poppins:wght@400;500;600;700;800",
  "Raleway":"Raleway:wght@400;500;600;700;800",
  "Rubik":"Rubik:wght@400;500;600;700;800",
  "Oswald":"Oswald:wght@400;500;600;700",
  "Anton":"Anton",
  "Bebas Neue":"Bebas+Neue",
  "Dancing Script":"Dancing+Script:wght@500;600;700",
  "Great Vibes":"Great+Vibes",
  "Satisfy":"Satisfy",
  "Permanent Marker":"Permanent+Marker",
  "Manrope":"Manrope:wght@400;500;600;700;800",
  "Nunito":"Nunito:wght@400;600;700;800",
  "Quicksand":"Quicksand:wght@400;500;600;700"
};

function safeFont(value,fallback){
  const normalized=String(value||"").trim().replace(/^['"]|['"]$/g,"");
  const match=Object.keys(FONT_SPECS).find((font)=>font.toLowerCase()===normalized.toLowerCase());
  return match||fallback;
}

function applyTypographyDirectly(config){
  const heading=safeFont(config?.typography?.heading,"Fraunces");
  const body=safeFont(config?.typography?.body,"Manrope");
  const countdown=safeFont(config?.countdown?.font,"Manrope");
  document.documentElement.dataset.headingFont=heading;
  document.documentElement.dataset.bodyFont=body;
  document.documentElement.dataset.countdownFont=countdown;

  document.querySelectorAll(".official-hero h1,.official-message h2,.official-details h2,.official-gallery h2,.official-custom h2,.official-custom blockquote,.rsvp-section>h2,.invite-success h2,.invite-close p").forEach((node)=>{
    node.style.setProperty("font-family",`'${heading}', serif`,"important");
  });
  document.querySelectorAll(".official-event,.official-event button,.official-event input,.official-event textarea,.official-event select,.official-event a,.official-subtitle,.event-facts,.rsvp-copy,.rsvp-form").forEach((node)=>{
    node.style.setProperty("font-family",`'${body}', sans-serif`,"important");
  });
  document.querySelectorAll(".countdown-display,.countdown-display strong").forEach((node)=>{
    node.style.setProperty("font-family",`'${countdown}', sans-serif`,"important");
  });
}

async function ensureSelectedFonts(config){
  const fonts=[
    safeFont(config?.typography?.heading,"Fraunces"),
    safeFont(config?.typography?.body,"Manrope"),
    safeFont(config?.countdown?.font,"Manrope")
  ].filter((font,index,array)=>array.indexOf(font)===index);
  const specs=fonts.map((font)=>FONT_SPECS[font]).filter(Boolean);
  if(specs.length){
    const id="ln-selected-fonts";
    let link=document.getElementById(id);
    const href=`https://fonts.googleapis.com/css2?${specs.map((spec)=>`family=${spec}`).join("&")}&display=swap`;
    if(!link){
      link=document.createElement("link"); link.id=id; link.rel="stylesheet"; document.head.appendChild(link);
    }
    if(link.href!==href) link.href=href;
  }
  if(!document.fonts) return;
  await Promise.all(fonts.map((font)=>Promise.allSettled([
    document.fonts.load(`500 32px "${font}"`),
    document.fonts.load(`700 32px "${font}"`),
    document.fonts.load(`800 32px "${font}"`)
  ])));
  await document.fonts.ready;
}
function safeCountdownStyle(value){return ["cards","minimal","circles","inline","neon","flip"].includes(value)?value:"cards"}
function safeAnimation(value){return ["fade-up","fade","zoom","slide-left","float","none"].includes(value)?value:"fade-up"}
function safeAmbient(value){return ["none","sparkles","bubbles","confetti","neon","stars"].includes(value)?value:"none"}
function cssUrl(value){return String(value||"").replace(/["'()\\]/g,"")}
function escapeAttr(value=""){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function formatDate(value){if(!value)return"Por confirmar";const date=new Date(value);if(!Number.isFinite(date.getTime()))return"Por confirmar";return new Intl.DateTimeFormat("es-MX",{dateStyle:"full",timeStyle:"short"}).format(date)}
function errorMessage(error){return error instanceof ApiError?error.message:error?.message||"No fue posible guardar la respuesta."}
function ics(value){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
