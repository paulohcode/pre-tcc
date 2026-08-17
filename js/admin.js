import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
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
  loadEvents,
  loadEvent,
  eventType,
  CRITERIA,
  average,
  round1,
  allowsQrVote,
  eventPublicUrl,
  renderQrCode,
} from "./app.js";

const loginSection = document.getElementById("admin-login");
const panelSection = document.getElementById("admin-panel");
const listView = document.getElementById("events-list-view");
const detailView = document.getElementById("event-detail-view");
const rankingEmpty = document.getElementById("ranking-empty");
const rankingTable = document.getElementById("ranking-table");
const rankingBody = document.getElementById("ranking-body");
const editPanel = document.getElementById("admin-edit");
const editStudentsList = document.getElementById("edit-students-list");
const editSaveBtn = document.getElementById("edit-save");

let projectsById = new Map();
let currentEventId = null;

function requireFirebase() {
  if (!isFirebaseConfigured()) {
    showToast("Configure o Firebase antes de usar a área interna.", "error");
    return null;
  }
  return getFirebase();
}

function eventFormPayload(prefix) {
  const titleId = prefix === "new" ? "new-title" : "event-title-input";
  const typeId = prefix === "new" ? "new-type" : "event-type-input";
  const classId = prefix === "new" ? "new-class" : "event-class-input";
  const dateId = prefix === "new" ? "new-date" : "event-date-input";
  const timeId = prefix === "new" ? "new-time" : "event-time-input";
  const locationId = prefix === "new" ? "new-location" : "event-location-input";
  const descriptionId = prefix === "new" ? "new-description" : "event-description-input";
  const audienceId = prefix === "new" ? "new-audience" : "event-audience-input";
  const voteAccessId = prefix === "new" ? "new-vote-access" : "event-vote-access-input";
  return {
    title: document.getElementById(titleId).value.trim(),
    type: document.getElementById(typeId).value,
    className: document.getElementById(classId).value.trim(),
    date: document.getElementById(dateId).value,
    time: document.getElementById(timeId).value,
    location: document.getElementById(locationId).value.trim(),
    description: document.getElementById(descriptionId).value.trim(),
    audience: document.getElementById(audienceId).value.trim(),
    voteAccess: document.getElementById(voteAccessId).value,
  };
}

function fillEventForm(event) {
  document.getElementById("event-id").value = event.id;
  document.getElementById("event-title-input").value = event.title || "";
  document.getElementById("event-type-input").value = event.type || "projetos";
  document.getElementById("event-class-input").value = event.className || "";
  document.getElementById("event-date-input").value = event.date || "";
  document.getElementById("event-time-input").value = event.time || "";
  document.getElementById("event-location-input").value = event.location || "";
  document.getElementById("event-description-input").value = event.description || "";
  document.getElementById("event-audience-input").value = event.audience || "";
  document.getElementById("event-vote-access-input").value = event.voteAccess || "alunos";
  document.getElementById("event-view-public").href = `evento.html?id=${encodeURIComponent(event.id)}`;
  document.getElementById("draw-status").textContent = event.orderDrawnAt
    ? "Ordem já sorteada. Você pode sortear de novo se precisar."
    : "Ainda não sorteada.";
  document.getElementById("voting-status").textContent = event.votingOpen ? "Aberta" : "Fechada";
  document.getElementById("btn-votacao").textContent = event.votingOpen ? "Fechar votação" : "Abrir votação";
  const type = eventType(event.type);
  document.getElementById("admin-entries-title").textContent = type.plural.charAt(0).toUpperCase() + type.plural.slice(1);
  renderEventQr(event);
}

async function renderEventQr(event) {
  const panel = document.getElementById("qr-panel");
  if (!allowsQrVote(event)) {
    panel.classList.add("hidden");
    return;
  }
  const url = eventPublicUrl(event.id);
  panel.classList.remove("hidden");
  document.getElementById("admin-qr-url").textContent = url;
  document.getElementById("admin-qr-open").href = url;
  try {
    await renderQrCode(document.getElementById("admin-qr-canvas"), url);
  } catch (error) {
    console.error(error);
  }
}

function showList() {
  currentEventId = null;
  const url = new URL(window.location.href);
  url.searchParams.delete("evento");
  window.history.replaceState({}, "", url);
  listView.classList.remove("hidden");
  detailView.classList.add("hidden");
}

function showDetail() {
  listView.classList.add("hidden");
  detailView.classList.remove("hidden");
}

async function loadEventList() {
  const root = document.getElementById("admin-events");
  const events = await loadEvents();
  if (!events.length) {
    root.innerHTML = '<p class="text-slate-500 text-sm">Nenhum evento cadastrado.</p>';
    return;
  }
  root.innerHTML = events
    .map((event) => {
      const type = eventType(event.type);
      return `
        <div class="panel p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-semibold">${escapeHtml(event.title)}</p>
            <p class="text-sm text-slate-500">${escapeHtml(type.label)}${event.date ? ` · ${escapeHtml(event.date)}` : ""}</p>
          </div>
          <div class="flex gap-3">
            <button type="button" data-open="${escapeHtml(event.id)}" class="text-sm text-blue hover:underline">Gerenciar</button>
            <button type="button" data-delete-event="${escapeHtml(event.id)}" class="text-sm text-slate-400 hover:text-red-600">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openEvent(btn.dataset.open));
  });
  root.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEvent(btn.dataset.deleteEvent));
  });
}

async function deleteEvent(id) {
  if (!confirm("Excluir este evento e as inscrições dele?")) return;
  const firebase = getFirebase();
  try {
    const snap = await getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", id)));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    await deleteDoc(doc(firebase.db, "events", id));
    showToast("Evento excluído.");
    showList();
    await loadEventList();
  } catch (error) {
    console.error(error);
    showToast("Não foi possível excluir o evento.", "error");
  }
}

async function openEvent(id) {
  const event = await loadEvent(id);
  if (!event) {
    showToast("Evento não encontrado.", "error");
    return;
  }
  currentEventId = id;
  const url = new URL(window.location.href);
  url.searchParams.set("evento", id);
  window.history.replaceState({}, "", url);
  fillEventForm(event);
  showDetail();
  await loadAdminData();
}

async function loadAdminData() {
  const firebase = requireFirebase();
  if (!firebase || !currentEventId) return;

  const event = await loadEvent(currentEventId);
  if (!event) return;
  fillEventForm(event);

  const [projectsSnap, votesSnap] = await Promise.all([
    getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", currentEventId))),
    getDocs(query(collection(firebase.db, "votes"), where("eventId", "==", currentEventId))),
  ]);

  const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const votes = votesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProjects(projects, event);
  renderRanking(projects, votes);
}

function editStudentRow(name = "", canRemove = false) {
  const wrap = document.createElement("div");
  wrap.className = "flex gap-2";
  wrap.innerHTML = `
    <input type="text" required maxlength="80" class="edit-student-name field flex-1" placeholder="Nome e sobrenome" />
    ${canRemove ? '<button type="button" class="remove-student px-3 border border-slate-200 text-slate-500 hover:text-red-600">✕</button>' : ""}
  `;
  wrap.querySelector("input.edit-student-name").value = name;
  const remove = wrap.querySelector(".remove-student");
  if (remove) {
    remove.addEventListener("click", () => {
      wrap.remove();
      refreshEditRemoveButtons();
    });
  }
  return wrap;
}

function refreshEditRemoveButtons() {
  const rows = [...editStudentsList.children];
  rows.forEach((row) => {
    const btn = row.querySelector(".remove-student");
    if (rows.length === 1 && btn) btn.remove();
    if (rows.length > 1 && !btn) {
      const extra = document.createElement("button");
      extra.type = "button";
      extra.className = "remove-student px-3 border border-slate-200 text-slate-500 hover:text-red-600";
      extra.textContent = "✕";
      extra.addEventListener("click", () => {
        row.remove();
        refreshEditRemoveButtons();
      });
      row.appendChild(extra);
    }
  });
}

function closeEdit() {
  editPanel.classList.add("hidden");
  document.getElementById("edit-project-id").value = "";
  document.getElementById("form-edit-projeto").reset();
  editStudentsList.innerHTML = "";
}

function openEdit(project) {
  document.getElementById("edit-project-id").value = project.id;
  document.getElementById("edit-title").value = project.title || "";
  document.getElementById("edit-description").value = project.description || "";
  document.getElementById("edit-view-public").href = `projeto.html?id=${encodeURIComponent(project.id)}`;
  const students = (project.students || []).map((name) => String(name).trim()).filter(Boolean);
  editStudentsList.innerHTML = "";
  (students.length ? students : [""]).forEach((name, index, list) => {
    editStudentsList.appendChild(editStudentRow(name, list.length > 1));
  });
  refreshEditRemoveButtons();
  editPanel.classList.remove("hidden");
  editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderProjects(projects, event) {
  const root = document.getElementById("admin-projects");
  projectsById = new Map(projects.map((project) => [project.id, project]));
  const type = eventType(event.type);

  if (!projects.length) {
    closeEdit();
    root.innerHTML = `<p class="text-slate-500 text-sm">Nenhum ${escapeHtml(type.singular)} cadastrado.</p>`;
    return;
  }

  const sorted = [...projects].sort((a, b) => {
    if (a.order && b.order) return a.order - b.order;
    return (a.title || "").localeCompare(b.title || "", "pt-BR");
  });

  root.innerHTML = sorted
    .map(
      (project) => `
        <div class="border border-slate-200 px-4 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="font-medium">${project.order ? `${escapeHtml(formatOrder(project.order))} · ` : ""}${escapeHtml(project.title)}</p>
              <p class="text-sm text-slate-500 mt-1">${escapeHtml((project.students || []).join(" · ") || "Sem integrantes")}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <button type="button" data-edit="${escapeHtml(project.id)}" class="text-sm text-blue hover:underline">Editar</button>
              <button type="button" data-delete="${escapeHtml(project.id)}" class="text-sm text-slate-400 hover:text-red-600">Excluir</button>
            </div>
          </div>
        </div>
      `
    )
    .join("");

  root.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const project = projectsById.get(btn.dataset.edit);
      if (project) openEdit(project);
    });
  });
  root.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta inscrição?")) return;
      try {
        await deleteDoc(doc(getFirebase().db, "projects", btn.dataset.delete));
        if (document.getElementById("edit-project-id").value === btn.dataset.delete) closeEdit();
        showToast("Inscrição excluída.");
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
        <tr class="border-b border-slate-100">
          <td class="py-3 pr-3">${index + 1}º</td>
          <td class="py-3 pr-3">
            <p>${escapeHtml(row.project.title)}</p>
            <p class="text-xs text-slate-400">${row.criteriaAvgs.map((c) => `${c.label}: ${round1(c.avg).toFixed(1)}`).join(" · ")}</p>
          </td>
          <td class="py-3 pr-3 text-slate-500">${escapeHtml((row.project.students || []).join(", "))}</td>
          <td class="py-3 pr-3 text-blue font-semibold">${row.count ? round1(row.avg).toFixed(1) : "—"}</td>
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
  try {
    await signInWithEmailAndPassword(
      firebase.auth,
      document.getElementById("admin-email").value.trim(),
      document.getElementById("admin-password").value
    );
  } catch (error) {
    console.error(error);
    showToast("Login inválido. Confira e-mail, senha e o Authentication no Firebase.", "error");
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  const firebase = getFirebase();
  if (firebase) await signOut(firebase.auth);
});

document.getElementById("form-novo-evento").addEventListener("submit", async (event) => {
  event.preventDefault();
  const firebase = getFirebase();
  const payload = eventFormPayload("new");
  if (!payload.title) {
    showToast("Informe o nome do evento.", "error");
    return;
  }
  try {
    const ref = await addDoc(collection(firebase.db, "events"), {
      ...payload,
      votingOpen: false,
      orderDrawnAt: null,
      createdAt: serverTimestamp(),
    });
    showToast("Evento publicado.");
    event.target.reset();
    await openEvent(ref.id);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível cadastrar o evento. Publique as regras do Firestore.", "error");
  }
});

document.getElementById("form-evento").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentEventId) return;
  const firebase = getFirebase();
  const payload = eventFormPayload("edit");
  if (!payload.title) {
    showToast("Informe o nome do evento.", "error");
    return;
  }
  await updateDoc(doc(firebase.db, "events", currentEventId), payload);
  showToast("Evento salvo.");
  await loadAdminData();
});

document.getElementById("btn-back-events").addEventListener("click", async () => {
  showList();
  await loadEventList();
});

document.getElementById("btn-sortear").addEventListener("click", async () => {
  const firebase = getFirebase();
  const snap = await getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", currentEventId)));
  if (snap.docs.length < 2) {
    showToast("Cadastre pelo menos duas inscrições para sortear.", "error");
    return;
  }
  if (!confirm("Sortear (ou re-sortear) a ordem das apresentações?")) return;
  const shuffled = shuffle(snap.docs);
  await Promise.all(shuffled.map((item, index) => updateDoc(item.ref, { order: index + 1 })));
  await updateDoc(doc(firebase.db, "events", currentEventId), { orderDrawnAt: serverTimestamp() });
  showToast("Ordem sorteada.");
  await loadAdminData();
});

document.getElementById("btn-votacao").addEventListener("click", async () => {
  const event = await loadEvent(currentEventId);
  await updateDoc(doc(getFirebase().db, "events", currentEventId), { votingOpen: !event.votingOpen });
  showToast(event.votingOpen ? "Votação fechada." : "Votação aberta.");
  await loadAdminData();
});

document.getElementById("edit-add-student").addEventListener("click", () => {
  editStudentsList.appendChild(editStudentRow("", true));
  refreshEditRemoveButtons();
});
document.getElementById("edit-cancel").addEventListener("click", () => closeEdit());

document.getElementById("btn-copy-qr").addEventListener("click", async () => {
  const url = document.getElementById("admin-qr-url").textContent;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copiado.");
  } catch {
    showToast("Copie o link manualmente.", "error");
  }
});

document.getElementById("form-edit-projeto").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("edit-project-id").value;
  const title = document.getElementById("edit-title").value.trim();
  const description = document.getElementById("edit-description").value.trim();
  const students = [...editStudentsList.querySelectorAll("input.edit-student-name")]
    .map((input) => input.value.trim())
    .filter(Boolean);
  if (!id || !title || !description || !students.length) {
    showToast("Preencha nome, descrição e integrantes.", "error");
    return;
  }
  editSaveBtn.disabled = true;
  try {
    await updateDoc(doc(getFirebase().db, "projects", id), { title, description, students });
    showToast("Inscrição atualizada.");
    closeEdit();
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast("Não foi possível salvar.", "error");
  } finally {
    editSaveBtn.disabled = false;
  }
});

const firebase = requireFirebase();
if (firebase) {
  onAuthStateChanged(firebase.auth, async (user) => {
    if (user) {
      loginSection.classList.add("hidden");
      panelSection.classList.remove("hidden");
      try {
        const requested = new URLSearchParams(window.location.search).get("evento");
        await loadEventList();
        if (requested) await openEvent(requested);
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
