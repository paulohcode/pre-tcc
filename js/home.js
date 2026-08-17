import { isFirebaseConfigured, loadEvents, eventCardHtml } from "./app.js";

const loading = document.getElementById("events-loading");
const empty = document.getElementById("events-empty");
const grid = document.getElementById("events-grid");

async function loadHome() {
  if (!isFirebaseConfigured()) {
    loading.textContent = "Configure o Firebase para listar os eventos.";
    return;
  }

  const events = await loadEvents();
  loading.classList.add("hidden");

  if (!events.length) {
    empty.classList.remove("hidden");
    return;
  }

  grid.innerHTML = events.map(eventCardHtml).join("");
}

loadHome().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar os eventos.";
});
