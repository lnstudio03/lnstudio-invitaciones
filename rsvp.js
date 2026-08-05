import { api, ApiError } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DEFAULT_ORDER = ["hero","countdown","details","gallery","rsvp"];
let eventData = null;
let token = null;
let passUrl = "";

const DEFAULT_CONFIG = {
  colors:{ background:"#0d1420",background2:"#1b2537",text:"#ffffff",muted:"#b7c1d5",primary:"#8f7dff",secondary:"#ff7f91",overlay:45,mode:"gradient" },
  typography:{ heading:"Fraunces",body:"Manrope",headingSize:72,bodySize:18,headingWeight:700,align:"center",transform:"none" },
  media:{ backgroundImage:"",gallery:[],heroFit:"cover",showMusicButton:true },
  animation:{ preset:"fade-up",ambient:"none",intensity:"medium",respectReducedMotion:true },
  content:{ kicker:"Invitación digital privada · LN Studio",rsvpTitle:"¿Nos acompañas?",rsvpCopy:"Confirma tu asistencia y recibe tu pase digital." },
  sections:{ order:[...DEFAULT_ORDER],enabled:{hero:true,countdown:true,details:true,gallery:true,rsvp:true} }
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  token = new URLSearchParams(location.search).get("token");
  if (!token) return fail("Invitación no válida.");
  bind();
  try {
    eventData = await api.rpc("get_public_event", { p_token: token }, { publicCall:true });
    if (!eventData?.id) return fail("Esta invitación no está disponible.");
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
  const config = mergeConfig(eventData.design_config);
  document.title = `${eventData.name} | Invitación`;
  applyVariables(config);
  applyLayout(config);
  $("[data-name]").textContent = eventData.name;
  $("[data-description]").textContent = eventData.description || "";
  $("[data-kicker]").textContent = config.content.kicker;
  $("[data-date]").textContent = formatDate(eventData.event_date);
  $("[data-venue]").textContent = [eventData.venue_name,eventData.venue_address].filter(Boolean).join(" · ") || "Ubicación por confirmar";
  $("[data-rsvp-title]").textContent = config.content.rsvpTitle;
  $("[data-rsvp-copy]").textContent = config.content.rsvpCopy;
  const map = $("[data-map]"); map.href = eventData.maps_url || "#"; map.hidden = !eventData.maps_url;
  $("[data-dress-code]").textContent = eventData.dress_code ? `Código de vestimenta: ${eventData.dress_code}` : "";
  const logo = $("[data-logo]"); if (eventData.logo_url) { logo.src = safeAsset(eventData.logo_url); logo.hidden = false; }
  const secondary = $("[data-secondary-logo]"); if (eventData.secondary_logo_url) { secondary.src = safeAsset(eventData.secondary_logo_url); $("[data-brand-row]").hidden = false; }
  const heroImage = $("[data-hero-image]"); if (eventData.hero_image_url) { heroImage.src = safeAsset(eventData.hero_image_url); heroImage.hidden = false; }
  renderGallery(config.media.gallery);
  configureMusic(config);
  const party = $("#rsvp-form [name=party_size]"); party.max = Number(eventData.max_companions || 0) + 1;
  $(".rsvp-submit small").textContent = eventData.qr_enabled ? "Generar pase digital" : "Registrar respuesta";
  if (!eventData.allow_general_rsvp) {
    $("[data-form-section]").innerHTML = '<p class="invite-kicker">Acceso individual</p><h2>Esta invitación requiere un enlace personal.</h2><p>Solicita tu enlace a los anfitriones.</p>';
  }
  startCountdown(); initializeReveal(config);
}

function mergeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_CONFIG,
    ...source,
    colors:{...DEFAULT_CONFIG.colors,...(source.colors||{})},
    typography:{...DEFAULT_CONFIG.typography,...(source.typography||{})},
    media:{...DEFAULT_CONFIG.media,...(source.media||{})},
    animation:{...DEFAULT_CONFIG.animation,...(source.animation||{})},
    content:{...DEFAULT_CONFIG.content,...(source.content||{})},
    sections:{order:normalizeOrder(source.sections?.order),enabled:{...DEFAULT_CONFIG.sections.enabled,...(source.sections?.enabled||{})}}
  };
}
function normalizeOrder(order) { const clean=Array.isArray(order)?order.filter((item)=>DEFAULT_ORDER.includes(item)):[]; DEFAULT_ORDER.forEach((item)=>{if(!clean.includes(item))clean.push(item)}); return clean; }

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
  document.body.dataset.animationIntensity = config.animation.intensity || "medium";
  const ambient = $("[data-ambient]"); ambient.className = `event-ambient ${safeAmbient(config.animation.ambient)}`;
}

function applyLayout(config) {
  const shell = $("[data-event-shell]");
  config.sections.order.forEach((key) => { const node=$(`[data-section="${key}"]`); if(node)shell.insertBefore(node,$("[data-pass]")); });
  Object.entries(config.sections.enabled).forEach(([key,enabled])=>{const node=$(`[data-section="${key}"]`);if(node)node.hidden=!enabled});
  if (!config.media.gallery?.length) $("[data-section=gallery]").hidden = true;
}

function renderGallery(gallery) {
  const list = Array.isArray(gallery)?gallery.filter(Boolean).slice(0,8):[];
  const root=$("[data-gallery]"); root.innerHTML=list.map((url,index)=>`<img src="${escapeAttr(safeAsset(url))}" alt="Fotografía ${index+1}" loading="lazy">`).join("");
  $("[data-section=gallery]").hidden = !list.length;
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
  event.preventDefault(); const form=event.currentTarget; const status=$("#status"); if(!form.reportValidity())return;
  const submitButton=form.querySelector('button[type="submit"]'); submitButton.disabled=true; status.textContent="Registrando tu respuesta…";
  try {
    const data=new FormData(form);
    const result=await api.rpc("submit_public_rsvp",{p_token:token,p_name:data.get("name"),p_phone:data.get("phone"),p_email:data.get("email")||null,p_attendance:data.get("attendance"),p_party_size:Number(data.get("party_size")||1),p_guest_names:data.get("guest_names")||null,p_dietary:data.get("dietary")||null,p_message:data.get("message")||null},{publicCall:true});
    if(!result?.ok)throw new Error(result?.message||"No se pudo registrar la respuesta.");
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
  $("[data-download-qr]").hidden=false; $("[data-copy-pass]").hidden=false;
}
function downloadQr(){const canvas=$("#qr");if(canvas.hidden)return;const link=document.createElement("a");link.download=`pase-${$("[data-folio]").textContent||"ln-studio"}.png`;link.href=canvas.toDataURL("image/png");link.click()}
async function copyPass(){try{await navigator.clipboard.writeText(passUrl);$("[data-copy-pass]").textContent="Pase copiado"}catch{alert(passUrl)}}
function downloadCalendar(){if(!eventData?.event_date)return alert("La fecha todavía no está definida.");const start=new Date(eventData.event_date),end=new Date(start.getTime()+3*60*60*1000);const stamp=(date)=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const content=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LN Studio//Invitacion//ES","BEGIN:VEVENT",`UID:${eventData.id}@lnstudio`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${ics(eventData.name)}`,`LOCATION:${ics([eventData.venue_name,eventData.venue_address].filter(Boolean).join(", "))}`,`DESCRIPTION:${ics(eventData.description||"")}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");const blob=new Blob([content],{type:"text/calendar;charset=utf-8"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${eventData.name}.ics`;link.click();URL.revokeObjectURL(link.href)}
function startCountdown(){const node=$("[data-countdown]");if(!eventData.event_date){node.textContent="Fecha por confirmar.";return}const target=new Date(eventData.event_date).getTime();const update=()=>{const diff=target-Date.now();if(diff<=0){node.textContent="El gran momento ha llegado.";return}const days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),minutes=Math.floor(diff%3600000/60000);node.textContent=`${days} días · ${hours} horas · ${minutes} minutos`};update();setInterval(update,60000)}
function fail(message){$("[data-name]").textContent=message;$("[data-description]").textContent="Verifica que el enlace esté completo o consulta a los anfitriones.";$("[data-form-section]").hidden=true}
function safeAsset(value){const text=String(value||"").trim();if(/^(https?:|data:|blob:)/i.test(text))return text;return text.replace(/^\/+/,"")}
function safeColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||""))?value:fallback}
function safeFont(value,fallback){const allowed=["Fraunces","Playfair Display","Cinzel","Bebas Neue","Fredoka","Baloo 2","Montserrat","Poppins","Merriweather","Manrope","Nunito"];return allowed.includes(value)?value:fallback}
function safeAnimation(value){return ["fade-up","fade","zoom","slide-left","float","none"].includes(value)?value:"fade-up"}
function safeAmbient(value){return ["none","sparkles","bubbles","confetti","neon","stars"].includes(value)?value:"none"}
function cssUrl(value){return String(value||"").replace(/["'()\\]/g,"")}
function escapeAttr(value=""){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function formatDate(value){if(!value)return"Por confirmar";return new Intl.DateTimeFormat("es-MX",{dateStyle:"full",timeStyle:"short"}).format(new Date(value))}
function errorMessage(error){return error instanceof ApiError?error.message:error?.message||"No fue posible guardar la respuesta."}
function ics(value){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
