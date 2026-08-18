import {
  isFirebaseConfigured,
  loadEvents,
  eventCardHtml,
  loadSiteConfig,
  homeBannerAssets,
} from "./app.js";

function fillSection(kind, events) {
  const loading = document.getElementById(`events-loading-${kind}`);
  const empty = document.getElementById(`events-empty-${kind}`);
  const grid = document.getElementById(`events-grid-${kind}`);
  loading.classList.add("hidden");
  if (!events.length) {
    empty.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = events.map(eventCardHtml).join("");
}

function applyHomeBanner(config) {
  const img = document.getElementById("home-banner");
  if (!img) return;
  const banner = homeBannerAssets(config);
  img.referrerPolicy = "no-referrer";
  img.alt = banner.alt;
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.onerror = () => {
    img.onerror = null;
    if (banner.custom) img.src = "uploads/banner.png";
  };
  img.src = banner.src;
}

async function loadHome() {
  if (!isFirebaseConfigured()) {
    document.getElementById("events-loading-projetos").textContent = "Configure o Firebase para listar os eventos.";
    document.getElementById("events-loading-concurso").textContent = "Configure o Firebase para listar os concursos.";
    return;
  }

  const [events, siteConfig] = await Promise.all([loadEvents(), loadSiteConfig()]);
  applyHomeBanner(siteConfig);
  fillSection(
    "projetos",
    events.filter((event) => event.type !== "concurso")
  );
  fillSection(
    "concurso",
    events.filter((event) => event.type === "concurso")
  );
}

loadHome().catch((error) => {
  console.error(error);
  document.getElementById("events-loading-projetos").textContent = "Não foi possível carregar os eventos.";
  document.getElementById("events-loading-concurso").textContent = "Não foi possível carregar os concursos.";
});
