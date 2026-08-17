import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getFirebase,
  isFirebaseConfigured,
  escapeHtml,
  formatOrder,
  loadEventConfig,
} from "./app.js";

const loading = document.getElementById("projetos-loading");
const empty = document.getElementById("projetos-empty");
const grid = document.getElementById("projetos-grid");
const orderStatus = document.getElementById("order-status");

function sortProjects(projects) {
  const drawn = projects.every((p) => typeof p.order === "number" && p.order > 0);
  if (drawn) return [...projects].sort((a, b) => a.order - b.order);
  return [...projects].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

function card(project) {
  const orderLabel = formatOrder(project.order);
  const index = project.order
    ? String(project.order).padStart(2, "0")
    : "—";
  return `
    <a href="projeto.html?id=${encodeURIComponent(project.id)}" class="card-glow panel program-card">
      <div class="flex items-start justify-between gap-4 mb-4">
        <p class="program-index">${escapeHtml(index)}</p>
        ${orderLabel ? `<p class="font-display text-[10px] uppercase tracking-[0.22em] text-gold/80 pt-1">${escapeHtml(orderLabel)}</p>` : ""}
      </div>
      <h2 class="font-serif text-3xl mb-2">${escapeHtml(project.title)}</h2>
      <p class="text-sm text-stone-400 mb-4">${escapeHtml((project.students || []).join(" · "))}</p>
      <p class="text-stone-500 text-sm line-clamp-3">${escapeHtml(project.description)}</p>
    </a>
  `;
}

async function loadProjects() {
  if (!isFirebaseConfigured()) {
    loading.textContent = "Configure o Firebase para ver os projetos.";
    return;
  }

  const firebase = getFirebase();
  const [config, snap] = await Promise.all([
    loadEventConfig(),
    getDocs(collection(firebase.db, "projects")),
  ]);

  const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  loading.classList.add("hidden");

  if (config.orderDrawnAt) {
    orderStatus.textContent = "Ordem das apresentações já sorteada.";
  } else {
    orderStatus.textContent = "A ordem ainda não foi sorteada pelo professor.";
  }

  if (!projects.length) {
    empty.classList.remove("hidden");
    return;
  }

  grid.innerHTML = sortProjects(projects).map(card).join("");
}

loadProjects().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar os projetos.";
});
