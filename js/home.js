import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getFirebase,
  isFirebaseConfigured,
  loadEventConfig,
  sortProjects,
  projectCardHtml,
} from "./app.js";

const loading = document.getElementById("projetos-loading");
const empty = document.getElementById("projetos-empty");
const grid = document.getElementById("projetos-grid");
const orderStatus = document.getElementById("order-status");
const factsEmpty = document.getElementById("event-facts-empty");

async function loadHome() {
  const config = await loadEventConfig();
  const hasFacts = Boolean(config.date || config.time || config.location || config.className);
  if (factsEmpty) factsEmpty.classList.toggle("hidden", hasFacts);

  if (!isFirebaseConfigured()) {
    loading.textContent = "Configure o Firebase para ver os projetos do evento.";
    return;
  }

  const firebase = getFirebase();
  const snap = await getDocs(collection(firebase.db, "projects"));
  const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  loading.classList.add("hidden");

  if (config.orderDrawnAt) {
    orderStatus.textContent = "Ordem das apresentações já sorteada.";
  } else {
    orderStatus.textContent = "A ordem ainda não foi sorteada.";
  }

  if (!projects.length) {
    empty.classList.remove("hidden");
    return;
  }

  grid.innerHTML = sortProjects(projects).map(projectCardHtml).join("");

  if (window.location.hash === "#projetos") {
    document.getElementById("projetos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

loadHome().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar o evento.";
});
