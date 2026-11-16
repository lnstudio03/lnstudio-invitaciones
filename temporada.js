const mexicoDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const seasons = {
  navidad: { id: "navidad", particles: ["❄", "❅", "❆", "✦"] },
  anoNuevo: { id: "ano-nuevo", particles: ["✦", "✧", "★", "✧"] },
  amor: { id: "amor", particles: ["♥", "♡", "✦", "♡"] },
  madres: { id: "madres", particles: ["✿", "❀", "✽", "❀"] },
  padres: { id: "padres", particles: ["★", "✦", "◇", "✧"] },
  independencia: { id: "independencia", particles: ["★", "✦", "●", "✧"] },
  muertos: { id: "muertos", particles: ["✿", "✺", "❁", "✽"] },
};

export function getSeasonForDate(date = new Date()) {
  const parts = Object.fromEntries(
    mexicoDate.formatToParts(date).map(({ type, value }) => [type, Number(value)])
  );
  const { year, month, day } = parts;

  if ((month === 12 && day >= 26) || (month === 1 && day <= 6)) return seasons.anoNuevo;
  if ((month === 11 && day >= 15) || (month === 12 && day <= 25)) return seasons.navidad;
  if (month === 2 && day <= 14) return seasons.amor;
  if (month === 5 && day <= 10) return seasons.madres;
  if (month === 6 && isFathersDayWeek(year, day)) return seasons.padres;
  if (month === 9 && day >= 10 && day <= 16) return seasons.independencia;
  if ((month === 10 && day >= 24) || (month === 11 && day <= 2)) return seasons.muertos;

  return null;
}

function isFathersDayWeek(year, day) {
  const firstSunday = 1 + ((7 - new Date(Date.UTC(year, 5, 1)).getUTCDay()) % 7);
  const thirdSunday = firstSunday + 14;
  return day >= thirdSunday - 3 && day <= thirdSunday + 1;
}

export function applySeasonalDecoration(date = new Date()) {
  const season = getSeasonForDate(date);
  const hero = document.querySelector("main > section:first-of-type, main.error-page, .invitation-page .invite-opening");
  if (!season || !hero || hero.querySelector(".seasonal-effects")) return;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./seasonal.css?v=4", import.meta.url).href;
  document.head.append(stylesheet);

  hero.classList.add("seasonal-host");
  hero.dataset.season = season.id;

  const effects = document.createElement("div");
  effects.className = "seasonal-effects";
  effects.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 8; index += 1) {
    const particle = document.createElement("span");
    particle.textContent = season.particles[index % season.particles.length];
    effects.append(particle);
  }
  hero.prepend(effects);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applySeasonalDecoration, { once: true });
} else {
  applySeasonalDecoration();
}
