import { isFirebaseConfigured, loadEvents, eventCardHtml } from "./app.js";

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

async function loadHome() {
  if (!isFirebaseConfigured()) {
    document.getElementById("events-loading-projetos").textContent = "Configure o Firebase para listar os eventos.";
    document.getElementById("events-loading-concurso").textContent = "Configure o Firebase para listar os concursos.";
    return;
  }

  const events = await loadEvents();
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
