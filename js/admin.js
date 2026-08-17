import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirebase,
  isFirebaseConfigured,
  showToast,
  escapeHtml,
  formatOrder,
  shuffle,
  loadEventConfig,
  applyEventTitle,
  DEFAULT_EVENT_TITLE,
  CRITERIA,
  average,
  round1,
} from "./app.js";

const loginSection = document.getElementById("admin-login");
const panelSection = document.getElementById("admin-panel");
const rankingEmpty = document.getElementById("ranking-empty");
const rankingTable = document.getElementById("ranking-table");
const rankingBody = document.getElementById("ranking-body");

function requireFirebase() {
  if (!isFirebaseConfigured()) {
    showToast("Configure o Firebase antes de usar a área do professor.", "error");
    return null;
  }
  return getFirebase();
}

async function ensureEventConfig(db, patch = {}) {
  const current = await loadEventConfig();
  const next = {
    title: current.title || DEFAULT_EVENT_TITLE,
    votingOpen: Boolean(current.votingOpen),
    orderDrawnAt: current.orderDrawnAt || null,
    ...patch,
  };
  await setDoc(doc(db, "config", "event"), next, { merge: true });
  applyEventTitle(next.title);
  return next;
}

function renderStatus(config) {
  document.getElementById("event-title-input").value = config.title || DEFAULT_EVENT_TITLE;
  document.getElementById("draw-status").textContent = config.orderDrawnAt
    ? "Ordem já sorteada. Você pode sortear de novo se precisar."
    : "Ainda não sorteada.";
  document.getElementById("voting-status").textContent = config.votingOpen ? "Aberta para os alunos" : "Fechada";
  document.getElementById("btn-votacao").textContent = config.votingOpen ? "Fechar votação" : "Abrir votação";
}

function medal(index) {
  return `${index + 1}º`;
}

async function loadAdminData() {
  const firebase = requireFirebase();
  if (!firebase) return;

  const config = await ensureEventConfig(firebase.db);
  renderStatus(config);

  const [projectsSnap, votesSnap] = await Promise.all([
    getDocs(collection(firebase.db, "projects")),
    getDocs(collection(firebase.db, "votes")),
  ]);

  const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const votes = votesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderProjects(projects);
  renderRanking(projects, votes);
}

function renderProjects(projects) {
  const root = document.getElementById("admin-projects");
  if (!projects.length) {
    root.innerHTML = '<p class="text-stone-400 text-sm">Nenhum projeto cadastrado.</p>';
    return;
  }

  const sorted = [...projects].sort((a, b) => {
    if (a.order && b.order) return a.order - b.order;
    return (a.title || "").localeCompare(b.title || "", "pt-BR");
  });

  root.innerHTML = sorted
    .map(
      (project) => `
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
          <div>
            <p class="font-medium">${project.order ? `${escapeHtml(formatOrder(project.order))} · ` : ""}${escapeHtml(project.title)}</p>
            <p class="text-sm text-stone-500">${escapeHtml((project.students || []).join(" · "))}</p>
          </div>
          <button data-delete="${escapeHtml(project.id)}" class="text-xs text-stone-500 hover:text-red-200">Excluir</button>
        </div>
      `
    )
    .join("");

  root.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este projeto?")) return;
      const firebase = getFirebase();
      try {
        await deleteDoc(doc(firebase.db, "projects", btn.dataset.delete));
        showToast("Projeto excluído.");
        await loadAdminData();
      } catch (error) {
        console.error(error);
        showToast("Não foi possível excluir.", "error");
      }
    });
  });
}

function renderRanking(projects, votes) {
  const byProject = new Map(projects.map((p) => [p.id, []]));
  votes.forEach((vote) => {
    if (!byProject.has(vote.projectId)) byProject.set(vote.projectId, []);
    byProject.get(vote.projectId).push(vote);
  });

  const rows = projects
    .map((project) => {
      const list = byProject.get(project.id) || [];
      const avg = list.length ? average(list.map((v) => Number(v.average) || 0)) : 0;
      const criteriaAvgs = CRITERIA.map((c) => {
        const values = list.map((v) => Number(v.criteria?.[c.id]) || 0);
        return { id: c.id, label: c.label, avg: list.length ? average(values) : 0 };
      });
      return { project, count: list.length, avg, criteriaAvgs };
    })
    .sort((a, b) => b.avg - a.avg || b.count - a.count);

  if (!votes.length) {
    rankingEmpty.classList.remove("hidden");
    rankingTable.classList.add("hidden");
    rankingEmpty.textContent = "Ainda não há votos.";
    return;
  }

  rankingEmpty.classList.add("hidden");
  rankingTable.classList.remove("hidden");
  rankingBody.innerHTML = rows
    .map(
      (row, index) => `
        <tr class="border-b border-white/5">
          <td class="py-3 pr-3">${medal(index)}</td>
          <td class="py-3 pr-3">
            <p>${escapeHtml(row.project.title)}</p>
            <p class="text-xs text-stone-500">${row.criteriaAvgs.map((c) => `${c.label}: ${round1(c.avg).toFixed(1)}`).join(" · ")}</p>
          </td>
          <td class="py-3 pr-3 text-stone-400">${escapeHtml((row.project.students || []).join(", "))}</td>
          <td class="py-3 pr-3 text-gold font-semibold">${row.count ? round1(row.avg).toFixed(1) : "—"}</td>
          <td class="py-3">${row.count}</td>
        </tr>
      `
    )
    .join("");
}

document.getElementById("form-login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const firebase = requireFirebase();
  if (!firebase) return;
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  try {
    await signInWithEmailAndPassword(firebase.auth, email, password);
  } catch (error) {
    console.error(error);
    showToast("Login inválido. Confira e-mail, senha e o Authentication no Firebase.", "error");
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  const firebase = getFirebase();
  if (firebase) await signOut(firebase.auth);
});

document.getElementById("form-event-title").addEventListener("submit", async (event) => {
  event.preventDefault();
  const firebase = getFirebase();
  const title = document.getElementById("event-title-input").value.trim() || DEFAULT_EVENT_TITLE;
  await ensureEventConfig(firebase.db, { title });
  showToast("Nome do evento salvo.");
});

document.getElementById("btn-sortear").addEventListener("click", async () => {
  const firebase = getFirebase();
  const snap = await getDocs(collection(firebase.db, "projects"));
  const projects = snap.docs;
  if (projects.length < 2) {
    showToast("Cadastre pelo menos dois projetos para sortear.", "error");
    return;
  }
  if (!confirm("Sortear (ou re-sortear) a ordem das apresentações?")) return;

  const shuffled = shuffle(projects);
  await Promise.all(
    shuffled.map((item, index) => updateDoc(item.ref, { order: index + 1 }))
  );
  await ensureEventConfig(firebase.db, { orderDrawnAt: serverTimestamp() });
  showToast("Ordem sorteada.");
  await loadAdminData();
});

document.getElementById("btn-votacao").addEventListener("click", async () => {
  const firebase = getFirebase();
  const config = await loadEventConfig();
  await ensureEventConfig(firebase.db, { votingOpen: !config.votingOpen });
  showToast(config.votingOpen ? "Votação fechada." : "Votação aberta.");
  await loadAdminData();
});

const firebase = requireFirebase();
if (firebase) {
  onAuthStateChanged(firebase.auth, async (user) => {
    if (user) {
      loginSection.classList.add("hidden");
      panelSection.classList.remove("hidden");
      try {
        await loadAdminData();
      } catch (error) {
        console.error(error);
        showToast("Não foi possível carregar o painel. Confira as regras do Firestore.", "error");
      }
    } else {
      loginSection.classList.remove("hidden");
      panelSection.classList.add("hidden");
    }
  });
}
