import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getFirebase,
  isFirebaseConfigured,
  escapeHtml,
  formatOrder,
  loadEventConfig,
  CRITERIA,
  average,
  round1,
  showToast,
  slugifyName,
} from "./app.js";
import {
  getStudentSession,
  identifyStudent,
  clearStudentSession,
  isTeamMember,
  hasVoted,
} from "./auth-aluno.js";

const params = new URLSearchParams(window.location.search);
const projectId = params.get("id");

const loading = document.getElementById("projeto-loading");
const missing = document.getElementById("projeto-missing");
const content = document.getElementById("projeto-content");
const formIdent = document.getElementById("form-ident");
const formVoto = document.getElementById("form-voto");
const voteClosed = document.getElementById("vote-closed");
const voteOwn = document.getElementById("vote-own");
const voteDone = document.getElementById("vote-done");
const criteriaFields = document.getElementById("criteria-fields");
const votePreview = document.getElementById("vote-preview");
const voterSelect = document.getElementById("voter-name");

let currentProject = null;

function hideVotePanels() {
  [formIdent, formVoto, voteClosed, voteOwn, voteDone].forEach((el) => el.classList.add("hidden"));
}

function uniqueStudentNames(projects) {
  const map = new Map();
  projects.forEach((project) => {
    (project.students || []).forEach((name) => {
      const key = slugifyName(name);
      if (key && !map.has(key)) map.set(key, name.trim());
    });
  });
  return [...map.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function renderCriteria() {
  criteriaFields.innerHTML = CRITERIA.map(
    (item) => `
      <label class="block">
        <div class="flex items-center justify-between text-sm mb-2">
          <span>${escapeHtml(item.label)}</span>
          <span data-val="${item.id}" class="text-gold font-medium">5</span>
        </div>
        <input type="range" min="0" max="10" step="1" value="5" data-criteria="${item.id}" />
      </label>
    `
  ).join("");

  criteriaFields.querySelectorAll("input[type=range]").forEach((input) => {
    input.addEventListener("input", () => {
      criteriaFields.querySelector(`[data-val="${input.dataset.criteria}"]`).textContent = input.value;
      updatePreview();
    });
  });
  updatePreview();
}

function currentScores() {
  const scores = {};
  criteriaFields.querySelectorAll("input[type=range]").forEach((input) => {
    scores[input.dataset.criteria] = Number(input.value);
  });
  return scores;
}

function updatePreview() {
  const scores = currentScores();
  votePreview.textContent = round1(average(Object.values(scores))).toFixed(1);
}

async function showVoteUi(config) {
  hideVotePanels();

  if (!config.votingOpen) {
    voteClosed.classList.remove("hidden");
    return;
  }

  const session = getStudentSession();
  if (!session) {
    formIdent.classList.remove("hidden");
    return;
  }

  if (isTeamMember(currentProject, session.name)) {
    voteOwn.classList.remove("hidden");
    return;
  }

  if (await hasVoted(session.voterId, currentProject.id)) {
    voteDone.classList.remove("hidden");
    return;
  }

  document.getElementById("voter-session").textContent = `Votando como ${session.name}`;
  renderCriteria();
  formVoto.classList.remove("hidden");
}

async function loadPage() {
  if (!projectId) {
    loading.classList.add("hidden");
    missing.classList.remove("hidden");
    return;
  }
  if (!isFirebaseConfigured()) {
    loading.textContent = "Configure o Firebase para abrir o projeto.";
    return;
  }

  const firebase = getFirebase();
  const [config, projectSnap, projectsSnap] = await Promise.all([
    loadEventConfig(),
    getDoc(doc(firebase.db, "projects", projectId)),
    getDocs(collection(firebase.db, "projects")),
  ]);

  loading.classList.add("hidden");
  if (!projectSnap.exists()) {
    missing.classList.remove("hidden");
    return;
  }

  currentProject = { id: projectSnap.id, ...projectSnap.data() };
  document.title = `${currentProject.title} — Banca de TCC`;
  document.getElementById("projeto-order").textContent = formatOrder(currentProject.order);
  document.getElementById("projeto-title").textContent = currentProject.title;
  document.getElementById("projeto-students").textContent = (currentProject.students || []).join(" · ");
  document.getElementById("projeto-description").textContent = currentProject.description;
  content.classList.remove("hidden");

  const names = uniqueStudentNames(projectsSnap.docs.map((d) => d.data()));
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    voterSelect.appendChild(option);
  });

  await showVoteUi(config);
}

formIdent.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = voterSelect.value;
  const pin = document.getElementById("voter-pin").value.trim();
  try {
    await identifyStudent(name, pin);
    const config = await loadEventConfig();
    await showVoteUi(config);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível identificar o aluno.", "error");
  }
});

formVoto.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getStudentSession();
  const firebase = getFirebase();
  if (!session || !firebase) return;

  if (isTeamMember(currentProject, session.name)) {
    showToast("Você não pode votar no próprio projeto.", "error");
    return;
  }
  if (await hasVoted(session.voterId, currentProject.id)) {
    showToast("Você já votou neste projeto.", "error");
    hideVotePanels();
    voteDone.classList.remove("hidden");
    return;
  }

  const scores = currentScores();
  const avg = round1(average(Object.values(scores)));
  const voteId = `${session.voterId}_${currentProject.id}`;
  const submitBtn = document.getElementById("submit-voto");
  submitBtn.disabled = true;

  try {
    await setDoc(doc(firebase.db, "votes", voteId), {
      projectId: currentProject.id,
      voterId: session.voterId,
      voterName: session.name,
      criteria: scores,
      average: avg,
      createdAt: serverTimestamp(),
    });
    showToast("Voto registrado.");
    hideVotePanels();
    voteDone.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível registrar o voto. Ele pode já existir.", "error");
    submitBtn.disabled = false;
  }
});

document.getElementById("logout-aluno").addEventListener("click", async () => {
  clearStudentSession();
  const config = await loadEventConfig();
  await showVoteUi(config);
});

loadPage().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar este projeto.";
});
