const INVITATIONS = {
  "biker-rebel-neon": sample({
    emblem:"01", emblemLabel:"ANIVERSARIO", momentNumber:"01",
    theme: "fantasma", accent: "#1748ff", accentTwo: "#ff0875", background: "#030309",
    brand: "Riders United", title: "Noche de aniversario", subtitle: "Ruta, música y comunidad biker",
    date: "2026-09-19T18:00:00-06:00", fullDate: "Sábado 19 de septiembre de 2026", day: "19", month: "Septiembre", year: "2026", time: "6:00 p.m.",
    locationShort: "Garage Rebel", address: "Zona Metropolitana · Ubicación de muestra", purpose: "Aniversario biker", purposeCopy: "Una celebración ficticia creada para mostrar esta plantilla.",
    intro: "Motores, amistad y una comunidad que no deja de avanzar. Esta experiencia de muestra presenta una invitación con identidad biker.",
    statement: "Una ruta. Una hermandad. Una noche para recordar.",
    momentTitle: "La carretera nos reunió.", momentCopy: "Una invitación demostrativa con estilo rebelde, neón, cadenas y alto contraste.",
    launchTitle: "Enciende la noche.", launchCopy: "Música, exhibición y convivencia en un evento completamente ficticio.", launchTagline: "Riders United · Demo LN Studio."
  }),
  "boda-eternite": sample({
    emblem:"∞", emblemLabel:"JUNTOS", momentNumber:"&",
    theme: "gold", accent: "#d6ad61", accentTwo: "#f5e0a8", background: "#080706",
    brand: "Lucía & Nicolás", title: "Nuestra boda", subtitle: "Una historia para toda la vida",
    date: "2026-10-24T17:00:00-06:00", fullDate: "Sábado 24 de octubre de 2026", day: "24", month: "Octubre", year: "2026", time: "5:00 p.m.",
    locationShort: "Jardín Magnolia", address: "Ciudad de México", purpose: "Ceremonia y recepción", purposeCopy: "Acompáñanos a celebrar el inicio de nuestra vida juntos.",
    intro: "Hay momentos que cambian la historia. El nuestro comenzó cuando decidimos caminar juntos.", statement: "Dos vidas. Una promesa. Un mismo destino.",
    momentTitle: "El amor nos trajo hasta aquí.", momentCopy: "Queremos compartir este día con las personas que han formado parte de nuestro camino.",
    launchTitle: "Celebremos juntos.", launchCopy: "Música, cena y una noche preparada con todo nuestro cariño.", launchTagline: "El mejor recuerdo será tenerte con nosotros."
  }),
  "boda-jardin-luz": sample({ theme:"light",accent:"#8b634a",accentTwo:"#d9a58d",background:"#efe4d9",brand:"Sofía & Mateo",title:"Nos casamos",subtitle:"Bajo la luz de nuestro jardín",date:"2026-12-12T16:30:00-06:00",fullDate:"Sábado 12 de diciembre de 2026",day:"12",month:"Diciembre",year:"2026",time:"4:30 p.m.",locationShort:"Casa del Lago",address:"Estado de México",purpose:"Ceremonia al aire libre",purposeCopy:"Una tarde íntima entre flores, familia y amigos.",intro:"Nuestro amor floreció con el tiempo y hoy abre una nueva etapa.",statement:"Crecer juntos también es elegirnos cada día.",momentTitle:"Nuestra historia continúa.",momentCopy:"Será un honor compartir este momento contigo.",launchTitle:"Una tarde para recordar.",launchCopy:"Ceremonia, brindis y celebración bajo las luces del jardín.",launchTagline:"Tu presencia hará este día todavía más especial." }),
  "xv-eclat": sample({ theme:"violet",accent:"#f4d58d",accentTwo:"#d29cff",background:"#140c1d",brand:"Valentina",title:"Mis XV años",subtitle:"Una noche hecha para brillar",date:"2026-11-07T19:00:00-06:00",fullDate:"Sábado 7 de noviembre de 2026",day:"07",month:"Noviembre",year:"2026",time:"7:00 p.m.",locationShort:"Salón Éclat",address:"Ciudad de México",purpose:"Cena y celebración",purposeCopy:"Acompáñame a celebrar una noche inolvidable.",intro:"Hay noches que soñamos durante años. Esta es la mía y quiero vivirla contigo.",statement:"Quince años. Mil sueños. Una sola noche.",momentTitle:"Hoy comienza una nueva etapa.",momentCopy:"Gracias por acompañarme en este momento tan importante.",launchTitle:"La noche es nuestra.",launchCopy:"Cena, música, baile y muchas sorpresas.",launchTagline:"Dress to shine." }),
  "xv-celestial": sample({ theme:"blue",accent:"#b8ddff",accentTwo:"#8a7cff",background:"#07101d",brand:"Renata",title:"Mis XV",subtitle:"Una noche bajo las estrellas",date:"2026-11-21T18:30:00-06:00",fullDate:"Sábado 21 de noviembre de 2026",day:"21",month:"Noviembre",year:"2026",time:"6:30 p.m.",locationShort:"Terraza Celestial",address:"Estado de México",purpose:"Recepción nocturna",purposeCopy:"Celebremos juntos una noche llena de luz.",intro:"Cada estrella representa un deseo. Esta noche quiero compartirlos contigo.",statement:"El cielo será testigo de una noche irrepetible.",momentTitle:"Mi momento ha llegado.",momentCopy:"Acompáñame a celebrar los recuerdos que ya vivimos y los sueños que comienzan.",launchTitle:"Brillaremos juntos.",launchCopy:"Cena, vals y una pista lista para celebrar.",launchTagline:"Nos vemos bajo las estrellas." }),
  "cumple-neon": sample({ theme:"neon",accent:"#5fffe5",accentTwo:"#ff3f9b",background:"#08030e",brand:"Dani cumple 25",title:"Neon night",subtitle:"Una noche sin modo silencioso",date:"2026-09-05T20:00:00-06:00",fullDate:"Sábado 5 de septiembre de 2026",day:"05",month:"Septiembre",year:"2026",time:"8:00 p.m.",locationShort:"Distrito 25",address:"Ciudad de México",purpose:"Fiesta de cumpleaños",purposeCopy:"Música, luces y cero pretextos.",intro:"Cumplir años es obligatorio. Celebrarlo así es decisión nuestra.",statement:"Sube el volumen. Enciende la noche.",momentTitle:"25 vueltas al sol merecen una gran fiesta.",momentCopy:"Trae ganas de bailar y de crear recuerdos que quizá no podamos publicar.",launchTitle:"Nos vemos en la pista.",launchCopy:"DJ, bebidas y una noche de neón.",launchTagline:"Código de vestimenta: negro + algo brillante." }),
  "bautizo-alba": sample({ theme:"light",accent:"#785b39",accentTwo:"#b99c75",background:"#f3eee5",brand:"Emilia",title:"Mi bautizo",subtitle:"Un día lleno de luz y bendiciones",date:"2026-10-18T13:00:00-06:00",fullDate:"Domingo 18 de octubre de 2026",day:"18",month:"Octubre",year:"2026",time:"1:00 p.m.",locationShort:"Parroquia de la Sagrada Familia",address:"Estado de México",purpose:"Ceremonia y comida",purposeCopy:"Acompáñanos en este día especial.",intro:"Con mucha alegría compartimos contigo un momento lleno de amor y esperanza.",statement:"Una pequeña vida rodeada de grandes bendiciones.",momentTitle:"Celebremos a Emilia.",momentCopy:"Tu presencia será un regalo para nuestra familia.",launchTitle:"Después de la ceremonia.",launchCopy:"Compartiremos una comida familiar para agradecer este momento.",launchTagline:"Con cariño, la familia de Emilia." }),
  "baby-bloom": sample({ theme:"rose",accent:"#ffd9de",accentTwo:"#f3a7b6",background:"#43242e",brand:"Baby Mia",title:"Baby shower",subtitle:"Una dulce espera florece",date:"2026-09-13T14:00:00-06:00",fullDate:"Domingo 13 de septiembre de 2026",day:"13",month:"Septiembre",year:"2026",time:"2:00 p.m.",locationShort:"Casa Bloom",address:"Ciudad de México",purpose:"Baby shower",purposeCopy:"Celebremos juntos la llegada de Mia.",intro:"Cada día estamos más cerca de conocer al amor más pequeño y más grande de nuestra vida.",statement:"Una nueva historia está por florecer.",momentTitle:"Mia viene en camino.",momentCopy:"Queremos compartir contigo la emoción de esta dulce espera.",launchTitle:"Una tarde llena de cariño.",launchCopy:"Juegos, bocadillos y recuerdos para la futura mamá.",launchTagline:"Tu presencia es nuestro mejor regalo." }),
  "corporativo-signature": sample({ theme:"gold",accent:"#e8c270",accentTwo:"#ffffff",background:"#0b0b0b",brand:"Nexa Group",title:"Signature night",subtitle:"Presentación anual 2026",date:"2026-09-30T19:30:00-06:00",fullDate:"Miércoles 30 de septiembre de 2026",day:"30",month:"Septiembre",year:"2026",time:"7:30 p.m.",locationShort:"Foro Central",address:"Ciudad de México",purpose:"Presentación y networking",purposeCopy:"Resultados, visión y próximos pasos.",intro:"Las grandes transformaciones comienzan cuando una visión se convierte en acción.",statement:"Estrategia. Innovación. Futuro.",momentTitle:"Construimos el siguiente capítulo.",momentCopy:"Una experiencia para clientes, socios y líderes de nuestra comunidad.",launchTitle:"La visión toma forma.",launchCopy:"Presentación ejecutiva, cóctel y networking.",launchTagline:"Nexa Group · Forward together." }),
  "corporativo-maison": sample({ theme:"light",accent:"#5c4b36",accentTwo:"#aa8e68",background:"#ddd7ca",brand:"Maison Arquitectura",title:"Open studio",subtitle:"Espacios que comienzan una nueva conversación",date:"2026-10-15T18:00:00-06:00",fullDate:"Jueves 15 de octubre de 2026",day:"15",month:"Octubre",year:"2026",time:"6:00 p.m.",locationShort:"Maison Studio",address:"Ciudad de México",purpose:"Apertura de estudio",purposeCopy:"Recorrido, presentación y cóctel.",intro:"Un espacio puede transformar la manera en que vivimos, trabajamos y nos encontramos.",statement:"Materia. Luz. Propósito.",momentTitle:"Abrimos nuestras puertas.",momentCopy:"Conoce el estudio, nuestro proceso y los proyectos que definen esta nueva etapa.",launchTitle:"Una conversación sobre diseño.",launchCopy:"Recorrido guiado y encuentro con el equipo creativo.",launchTagline:"Maison Arquitectura · Open Studio 2026." }),
  "fiesta-nube": sample({stickerTheme:"cartoon",theme:"cartoon",accent:"#ffe45d",accentTwo:"#ff66b7",background:"#4d77e8",brand:"Mía cumple 6",title:"Fiesta en las nubes",subtitle:"Una aventura de colores está por comenzar",date:"2026-10-04T14:00:00-06:00",fullDate:"Domingo 4 de octubre de 2026",day:"04",month:"Octubre",year:"2026",time:"2:00 p.m.",locationShort:"Salón Arcoíris",address:"Estado de México",purpose:"Fiesta infantil",purposeCopy:"Juegos, pastel y una tarde llena de imaginación.",intro:"Las nubes se llenaron de confeti porque Mía está por celebrar.",statement:"Sonrisas, colores y una aventura para recordar.",momentTitle:"El cielo tiene fiesta.",momentCopy:"Ven con ganas de jugar, reír y crear recuerdos mágicos.",launchTitle:"¡Comienza la diversión!",launchCopy:"Habrá juegos, sorpresas, dulces y muchos stickers.",launchTagline:"Código de vestimenta: tu color favorito."}),
  "reino-del-dragon": sample({stickerTheme:"fantasy",theme:"fantasy",accent:"#ffca45",accentTwo:"#8c66ff",background:"#08162f",brand:"Leo cumple 8",title:"El Reino del Dragón",subtitle:"La aventura necesita un héroe más",date:"2026-10-18T15:00:00-06:00",fullDate:"Domingo 18 de octubre de 2026",day:"18",month:"Octubre",year:"2026",time:"3:00 p.m.",locationShort:"Fortaleza Lunar",address:"Ciudad de México",purpose:"Cumpleaños fantástico",purposeCopy:"Una misión animada con juegos y tesoros.",intro:"Una brújula mágica señaló tu nombre. El pequeño dragón te espera.",statement:"Todo gran reino comienza con una gran aventura.",momentTitle:"La misión está por comenzar.",momentCopy:"Reúne valor, trae tu imaginación y prepárate para descubrir el tesoro.",launchTitle:"Abre las puertas del reino.",launchCopy:"Retos, pastel y una aventura original para toda la familia.",launchTagline:"No olvides tu espíritu aventurero."}),
  "academia-nocturna": sample({stickerTheme:"gothic",theme:"gothic",accent:"#b36bd2",accentTwo:"#d8b566",background:"#070309",brand:"Isabela cumple 16",title:"Academia Nocturna",subtitle:"Una velada de secretos y sombras",date:"2026-10-31T19:00:00-06:00",fullDate:"Sábado 31 de octubre de 2026",day:"31",month:"Octubre",year:"2026",time:"7:00 p.m.",locationShort:"Salón Nevermore",address:"Ubicación de muestra",purpose:"Fiesta gótica",purposeCopy:"Cena, misterio y una celebración de academia oscura.",intro:"El cuervo dejó una invitación en tu ventana. La academia abre sus puertas por una noche.",statement:"Lo extraño no se esconde. Se celebra.",momentTitle:"Un misterio te espera.",momentCopy:"Viste de negro, guarda el secreto y prepárate para una noche fuera de lo común.",launchTitle:"Cuando el reloj marque siete.",launchCopy:"Comenzará una velada de música, acertijos y flores negras.",launchTagline:"Vestimenta: negro, morado y elegancia fúnebre."}),
  "xv-sticker-pop": sample({stickerTheme:"xv",theme:"violet",accent:"#eee0ff",accentTwo:"#d476e7",background:"#32114c",brand:"Samantha",title:"Mis XV Starlight",subtitle:"Brilla, sueña y celebra conmigo",date:"2026-11-14T18:30:00-06:00",fullDate:"Sábado 14 de noviembre de 2026",day:"14",month:"Noviembre",year:"2026",time:"6:30 p.m.",locationShort:"Salón Starlight",address:"Estado de México",purpose:"XV años",purposeCopy:"Vals, cena y una pista llena de luz.",intro:"Quince años de recuerdos se convierten en una noche que quiero compartir contigo.",statement:"Una noche. Quince sueños. Brillo infinito.",momentTitle:"Mi momento ha llegado.",momentCopy:"Acompáñame a celebrar esta nueva etapa entre mariposas, música y destellos.",launchTitle:"Nos vemos bajo las luces.",launchCopy:"Prepárate para el vals, la fiesta y muchas fotografías.",launchTagline:"Dress code: glam en tonos lila y plata."}),
  "boda-sticker-romance": sample({stickerTheme:"wedding",theme:"gold",accent:"#e0bd72",accentTwo:"#fff1d2",background:"#211610",brand:"Mariana & Diego",title:"Sí, aceptamos",subtitle:"Nuestra historia comienza un nuevo capítulo",date:"2026-11-28T17:00:00-06:00",fullDate:"Sábado 28 de noviembre de 2026",day:"28",month:"Noviembre",year:"2026",time:"5:00 p.m.",locationShort:"Hacienda Amour",address:"Estado de México",purpose:"Boda",purposeCopy:"Ceremonia, brindis y recepción.",intro:"Dos caminos se encontraron y hoy queremos celebrar el comienzo de una vida juntos.",statement:"Anillos, promesas y un amor para toda la vida.",momentTitle:"Queremos compartirlo contigo.",momentCopy:"Tu presencia será uno de los recuerdos más importantes de nuestro día.",launchTitle:"Brindemos por el amor.",launchCopy:"Ceremonia, cena y una noche preparada con todo nuestro cariño.",launchTagline:"Con amor, Mariana & Diego."})
};

/* Emblemas semánticos: nunca se usa el día de la fecha como edad. */
const SAMPLE_EMBLEMS = {
  "biker-rebel-neon": { emblem:"01", emblemLabel:"ANIVERSARIO", momentNumber:"01" },
  "boda-eternite": { emblem:"∞", emblemLabel:"JUNTOS", momentNumber:"&" },
  "boda-jardin-luz": { emblem:"♥", emblemLabel:"NUESTRA HISTORIA", momentNumber:"&" },
  "xv-eclat": { emblem:"XV", emblemLabel:"AÑOS", momentNumber:"XV" },
  "xv-celestial": { emblem:"XV", emblemLabel:"AÑOS", momentNumber:"XV" },
  "cumple-neon": { emblem:"25", emblemLabel:"AÑOS", momentNumber:"25" },
  "bautizo-alba": { emblem:"✦", emblemLabel:"BAUTIZO", momentNumber:"✦" },
  "baby-bloom": { emblem:"♥", emblemLabel:"EN CAMINO", momentNumber:"♥" },
  "corporativo-signature": { emblem:"26", emblemLabel:"EDICIÓN", momentNumber:"26" },
  "corporativo-maison": { emblem:"26", emblemLabel:"APERTURA", momentNumber:"26" }
};
Object.entries(SAMPLE_EMBLEMS).forEach(([key, values]) => Object.assign(INVITATIONS[key], values));

function sample(data) {
  return {
    official: false, kicker: "Invitación de muestra", emblem: "✦", emblemLabel: "EVENTO", momentNumber:"✦",
    map: "https://www.google.com/maps", rsvpTitle: "Confirma tu asistencia.", rsvpCopy: "Este formulario demuestra cómo tus invitados pueden registrar su respuesta.", closeCopy: "Gracias por recorrer esta experiencia de muestra creada por LN Studio.", ...data
  };
}

const state = { model: "boda-eternite", data: null };

document.addEventListener("DOMContentLoaded", initializeInvitation);

async function initializeInvitation() {
  state.model = new URLSearchParams(location.search).get("modelo") || "boda-eternite";
  state.data = INVITATIONS[state.model] || INVITATIONS["boda-eternite"];
  document.body.dataset.model = state.model;
  applyInvitation(state.data);
  initializeReveal();
  initializeProgress();
  initializeCountdown(state.data.date);
  initializeRsvp();
  initializeShare();
  initializeCalendar();
}

function applyInvitation(data) {
  document.documentElement.style.setProperty("--invite-accent", data.accent);
  document.documentElement.style.setProperty("--invite-accent-two", data.accentTwo);
  document.documentElement.style.setProperty("--invite-bg", data.background);
  document.body.classList.toggle("theme-light", data.theme === "light");
  document.body.dataset.stickerTheme = data.stickerTheme || "";

  const values = {
    kicker:data.kicker, brand:data.brand, title:data.title, subtitle:data.subtitle, emblem:data.emblem, emblemLabel:data.emblemLabel, momentNumber:data.momentNumber,
    day:data.day, month:data.month, year:data.year, intro:data.intro, statement:data.statement,
    fullDate:data.fullDate, time:data.time, locationShort:data.locationShort, address:data.address,
    purpose:data.purpose, purposeCopy:data.purposeCopy, momentTitle:data.momentTitle, momentCopy:data.momentCopy,
    launchTitle:data.launchTitle, launchCopy:data.launchCopy, launchTagline:data.launchTagline,
    rsvpTitle:data.rsvpTitle, rsvpCopy:data.rsvpCopy, closeCopy:data.closeCopy, closeBrand:data.brand
  };
  Object.entries(values).forEach(([key,value]) => setText(`[data-${toKebab(key)}]`, value));
  const slug = document.querySelector("[data-event-slug]");
  if (slug) slug.value = state.model;
  const mapLink = document.querySelector("[data-map-link]");
  if (mapLink) mapLink.href = data.map;
  document.title = `${data.title} · ${data.brand}`;
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${data.title} · ${data.brand}`);
}

function setText(selector, value) { const node = document.querySelector(selector); if (node && value) node.textContent = value; }
function toKebab(value) { return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); }

function initializeReveal() {
  const elements = document.querySelectorAll(".invite-reveal");
  if (!("IntersectionObserver" in window)) { elements.forEach((el) => el.classList.add("visible")); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible"); observer.unobserve(entry.target);
  }), { threshold: .13 });
  elements.forEach((el) => observer.observe(el));
}

function initializeProgress() {
  const bar = document.querySelector(".invite-progress span");
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
  };
  update(); addEventListener("scroll", update, { passive:true });
}

function initializeCountdown(dateString) {
  const target = new Date(dateString).getTime();
  const nodes = {
    days:document.querySelector("[data-days]"), hours:document.querySelector("[data-hours]"),
    minutes:document.querySelector("[data-minutes]"), seconds:document.querySelector("[data-seconds]")
  };
  const tick = () => {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      Object.values(nodes).forEach((node) => { if (node) node.textContent = "00"; });
      document.querySelector("[data-event-started]")?.removeAttribute("hidden");
      return;
    }
    nodes.days.textContent = pad(Math.floor(remaining / 86400000));
    nodes.hours.textContent = pad(Math.floor((remaining % 86400000) / 3600000));
    nodes.minutes.textContent = pad(Math.floor((remaining % 3600000) / 60000));
    nodes.seconds.textContent = pad(Math.floor((remaining % 60000) / 1000));
  };
  tick(); setInterval(tick,1000);
}
function pad(number) { return String(number).padStart(2,"0"); }

function initializeRsvp() {
  const form = document.querySelector("#rsvp-form");
  const status = document.querySelector("#rsvp-status");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true; status.textContent = "Registrando tu respuesta…";

    const data = new FormData(form);
    const record = {
      event_slug: state.model,
      name: clean(data.get("name"),100),
      phone: clean(data.get("phone"),20),
      attendance: data.get("attendance"),
      guests_count: Number(data.get("guests_count") || 0),
      guest_names: clean(data.get("guest_names"),220),
      message: clean(data.get("message"),400),
      checked_in: false,
      created_at: new Date().toISOString()
    };

    try {
      const result = await saveRsvp(record);
      showSuccess(result.reference, record.attendance);
      form.reset();
    } catch (error) {
      console.error(error);
      status.textContent = "No pudimos registrar la respuesta. Revisa tu conexión e inténtalo nuevamente.";
    } finally {
      button.disabled = false;
    }
  });
}

async function saveRsvp(record) {
  // Las invitaciones del catálogo son muestras ficticias y no escriben en la base real.
  const reference = createReference(state.model);
  const key = "lnstudio_demo_rsvps";
  const records = JSON.parse(localStorage.getItem(key) || "[]");
  records.push({ id: crypto.randomUUID?.() || String(Date.now()), ...record, reference_code: reference });
  localStorage.setItem(key, JSON.stringify(records.slice(-20)));
  return { reference, mode: "demo" };
}

function createReference(model) {
  const prefix = "DEMO";
  const time = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2,5).toUpperCase();
  return `${prefix}-${time}${random}`;
}

function showSuccess(reference, attendance) {
  document.querySelector("[data-reference]").textContent = reference;
  setText("[data-success-title]", attendance === "confirmado" ? "¡Nos vemos en la celebración!" : "Gracias por responder.");
  setText("[data-success-copy]", attendance === "confirmado" ? "Tu asistencia y acompañantes quedaron registrados." : "Lamentamos que no puedas acompañarnos. Tu respuesta quedó registrada.");
  const success = document.querySelector("[data-success]");
  success.hidden = false;
  success.scrollIntoView({ behavior:"smooth",block:"center" });
}

function clean(value,max) { return String(value || "").trim().slice(0,max); }

function initializeShare() {
  document.querySelectorAll("[data-share]").forEach((button) => button.addEventListener("click", async () => {
    const shareData = { title:document.title, text:`${state.data.title} · ${state.data.brand}`, url:location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(location.href); temporaryText(button,"Liga copiada"); }
    } catch (error) { if (error.name !== "AbortError") console.error(error); }
  }));
}

function temporaryText(button,text) { const original=button.textContent; button.textContent=text; setTimeout(()=>button.textContent=original,1800); }

function initializeCalendar() {
  document.querySelector("[data-calendar]")?.addEventListener("click", () => {
    const start = new Date(state.data.date);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const format = (date) => date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z/,"Z");
    const content = [
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LN Studio//Invitaciones//ES","BEGIN:VEVENT",
      `UID:${state.model}-${Date.now()}@lnstudio`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(start)}`, `DTEND:${format(end)}`,
      `SUMMARY:${escapeIcs(`${state.data.title} · ${state.data.brand}`)}`, `LOCATION:${escapeIcs(state.data.address)}`,
      `DESCRIPTION:${escapeIcs(state.data.purposeCopy)}`, "END:VEVENT","END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([content],{type:"text/calendar;charset=utf-8"});
    const link = document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`${state.model}.ics`; link.click(); URL.revokeObjectURL(link.href);
  });
}
function escapeIcs(value) { return String(value).replaceAll("\\","\\\\").replaceAll(",","\\,").replaceAll(";","\\;").replaceAll("\n","\\n"); }
