import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getFirebase,
  isFirebaseConfigured,
  escapeHtml,
  formatOrder,
  loadEvent,
  eventType,
  voteCriteria,
  average,
  round1,
  showToast,
  slugifyName,
  allowsOpenName,
  eventCoverSrc,
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
const voterInput = document.getElementById("voter-name-input");
const registeredNames = [];

let currentProject = null;
let currentEvent = null;

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
  const items = voteCriteria(currentEvent);
  criteriaFields.innerHTML = items.map(
    (item) => `
      <label class="block">
        <div class="flex items-center justify-between text-sm mb-2">
          <span>${escapeHtml(item.label)}</span>
          <span data-val="${item.id}" class="text-blue font-medium">5</span>
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
  const scores = Object.values(currentScores());
  const label = scores.length === 1 ? "Nota deste voto" : "Média deste voto";
  document.getElementById("vote-preview-label").textContent = `${label}:`;
  votePreview.textContent = round1(average(scores)).toFixed(1);
}

function currentVoterName() {
  if (allowsOpenName(currentEvent)) {
    return (voterInput?.value || "").trim();
  }
  return (voterSelect?.value || "").trim();
}

function setupVoteAccessUi() {
  const open = allowsOpenName(currentEvent);
  document.getElementById("voter-select-wrap").classList.toggle("hidden", open);
  document.getElementById("voter-input-wrap").classList.toggle("hidden", !open);
  const hint = document.getElementById("vote-access-hint");
  if (currentEvent?.voteAccess === "qrcode") {
    hint.textContent = "Votação aberta ao público. Informe seu nome e um PIN de 4 dígitos.";
  } else if (currentEvent?.voteAccess === "ambos") {
    hint.textContent = "Alunos da lista ou visitantes podem votar. Use o mesmo nome e PIN se já tiver votado em outro trabalho.";
  } else {
    hint.textContent = "Somente integrantes cadastrados neste evento podem votar.";
  }
}

async function showVoteUi() {
  hideVotePanels();
  if (!currentEvent?.votingOpen) {
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
    loading.textContent = "Configure o Firebase para abrir a inscrição.";
    return;
  }

  const firebase = getFirebase();
  const projectSnap = await getDoc(doc(firebase.db, "projects", projectId));
  loading.classList.add("hidden");
  if (!projectSnap.exists()) {
    missing.classList.remove("hidden");
    return;
  }

  currentProject = { id: projectSnap.id, ...projectSnap.data() };
  currentEvent = await loadEvent(currentProject.eventId);
  const type = eventType(currentEvent?.type);

  document.title = `${currentProject.title} — SESI SENAI Umuarama`;
  document.getElementById("projeto-order").textContent = currentEvent?.type === "concurso" ? "" : formatOrder(currentProject.order);
  document.getElementById("projeto-title").textContent = currentProject.title;
  document.getElementById("projeto-students").textContent = (currentProject.students || []).join(" · ");
  document.getElementById("projeto-description").textContent = currentProject.description;
  const cover = document.getElementById("projeto-cover");
  const coverWrap = document.getElementById("projeto-cover-wrap");
  const full = eventCoverSrc(currentProject, "full");
  const card = eventCoverSrc(currentProject, "card");
  if (full) {
    cover.referrerPolicy = "no-referrer";
    cover.src = full;
    cover.alt = currentProject.title;
    if (card && card !== full) {
      cover.srcset = `${card} 960w, ${full} 1920w`;
      cover.sizes = "(max-width: 768px) 100vw, 640px";
    } else {
      cover.removeAttribute("srcset");
      cover.removeAttribute("sizes");
    }
    coverWrap.classList.remove("hidden");
  } else {
    cover.removeAttribute("src");
    cover.removeAttribute("srcset");
    cover.removeAttribute("sizes");
    coverWrap.classList.add("hidden");
  }
  document.getElementById("vote-title").textContent = type.vote;
  document.getElementById("vote-help").textContent = type.voteHelp;
  if (currentEvent) {
    document.getElementById("back-evento").href = `evento.html?id=${encodeURIComponent(currentEvent.id)}`;
  }
  content.classList.remove("hidden");

  const eventProjects = currentProject.eventId
    ? (await getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", currentProject.eventId)))).docs.map((d) => d.data())
    : [];
  const names = uniqueStudentNames(eventProjects);
  registeredNames.splice(0, registeredNames.length, ...names);
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    voterSelect.appendChild(option);
    const hint = document.createElement("option");
    hint.value = name;
    document.getElementById("voter-name-list").appendChild(hint);
  });

  setupVoteAccessUi();
  await showVoteUi();
}

formIdent.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = currentVoterName();
  if (!allowsOpenName(currentEvent)) {
    const allowed = registeredNames.some((item) => slugifyName(item) === slugifyName(name));
    if (!allowed) {
      showToast("Selecione um nome da lista de inscritos deste evento.", "error");
      return;
    }
  }
  try {
    await identifyStudent(name, document.getElementById("voter-pin").value.trim());
    await showVoteUi();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível identificar o votante.", "error");
  }
});

formVoto.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getStudentSession();
  const firebase = getFirebase();
  if (!session || !firebase || !currentEvent) return;

  if (isTeamMember(currentProject, session.name)) {
    showToast("Você não pode votar na própria inscrição.", "error");
    return;
  }
  if (await hasVoted(session.voterId, currentProject.id)) {
    showToast("Você já votou nesta inscrição.", "error");
    hideVotePanels();
    voteDone.classList.remove("hidden");
    return;
  }

  const scores = currentScores();
  const avg = round1(average(Object.values(scores)));
  const submitBtn = document.getElementById("submit-voto");
  submitBtn.disabled = true;

  try {
    await setDoc(doc(firebase.db, "votes", `${session.voterId}_${currentProject.id}`), {
      projectId: currentProject.id,
      eventId: currentEvent.id,
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
  await showVoteUi();
});

loadPage().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar esta inscrição.";
});
