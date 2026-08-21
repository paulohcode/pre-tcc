import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
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
  sortProjects,
  loadEvents,
  loadEvent,
  eventType,
  lockedVoteAccess,
  isContest,
  round1,
  rankingRows,
  podiumFromRanking,
  allowsQrVote,
  eventPublicUrl,
  renderQrCode,
  loadSiteConfig,
  DEFAULT_HOME_BANNER,
  DEFAULT_HOME_BANNER_ALT,
  homeBannerAssets,
} from "./app.js";
import { bindPhotoField, setPhotoPreview, imageFromField, emptyImages, uploadHomeBanner } from "./imgbb.js";
import { bindPdfField, setPdfPreview, pdfFromField, emptyPdf } from "./pdf.js";

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
let currentEventImages = emptyImages();
let currentProjectImages = emptyImages();
let currentProjectPdf = emptyPdf();
let currentSiteImages = emptyImages();
let currentKind = "projetos";

function adminTabKind(kind) {
  if (kind === "home" || kind === "concurso") return kind;
  return "projetos";
}

function requireFirebase() {
  if (!isFirebaseConfigured()) {
    showToast("Configure o Firebase antes de usar a área interna.", "error");
    return null;
  }
  return getFirebase();
}

function setAdminTab(kind, { updateUrl = true } = {}) {
  currentKind = adminTabKind(kind);
  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.adminTab === currentKind);
  });
  document.getElementById("tab-home").classList.toggle("hidden", currentKind !== "home");
  document.getElementById("tab-projetos").classList.toggle("hidden", currentKind !== "projetos");
  document.getElementById("tab-concurso").classList.toggle("hidden", currentKind !== "concurso");
  if (updateUrl && !currentEventId) {
    const url = new URL(window.location.href);
    url.searchParams.set("tipo", currentKind);
    window.history.replaceState({}, "", url);
  }
}

function payloadFromCreateForm(form, type) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") || "").trim(),
    type,
    className: String(data.get("className") || "").trim(),
    date: String(data.get("date") || ""),
    time: String(data.get("time") || ""),
    location: String(data.get("location") || "").trim(),
    description: String(data.get("description") || "").trim(),
    audience: String(data.get("audience") || "").trim(),
    voteAccess: lockedVoteAccess(type),
  };
}

function eventFormPayload() {
  const type = document.getElementById("event-type-input").value || "projetos";
  return {
    title: document.getElementById("event-title-input").value.trim(),
    type,
    className: document.getElementById("event-class-input").value.trim(),
    date: document.getElementById("event-date-input").value,
    time: document.getElementById("event-time-input").value,
    location: document.getElementById("event-location-input").value.trim(),
    description: document.getElementById("event-description-input").value.trim(),
    audience: document.getElementById("event-audience-input").value.trim(),
    voteAccess: lockedVoteAccess(type),
  };
}

function fillEventForm(event) {
  const type = eventType(event.type);
  const contest = isContest(event);
  document.getElementById("event-id").value = event.id;
  document.getElementById("event-type-input").value = event.type || "projetos";
  document.getElementById("event-title-input").value = event.title || "";
  document.getElementById("event-class-input").value = event.className || "";
  document.getElementById("event-date-input").value = event.date || "";
  document.getElementById("event-time-input").value = event.time || "";
  document.getElementById("event-location-input").value = event.location || "";
  document.getElementById("event-description-input").value = event.description || "";
  document.getElementById("event-audience-input").value = event.audience || "";
  document.getElementById("event-detail-heading").textContent = contest ? "Dados do concurso" : "Dados do evento de projetos";
  document.getElementById("event-type-label").textContent = contest
    ? "Tipo: concurso. Inscrições de trabalhos e ranking por nota popular."
    : "Tipo: projetos. Inscrições de equipes, sorteio da ordem e avaliação por critérios.";
  document.getElementById("vote-access-locked").textContent = contest
    ? "Votação: público pelo celular (QR Code)."
    : "Votação: somente alunos inscritos (nome da lista + PIN).";
  document.getElementById("event-class-wrap").classList.toggle("hidden", contest);
  document.getElementById("event-audience-wrap").classList.toggle("hidden", !contest);
  document.getElementById("draw-panel").classList.toggle("hidden", contest);
  document.getElementById("btn-back-events").textContent = contest ? "← Concursos" : "← Eventos de projetos";
  document.getElementById("admin-entries-help").textContent = contest
    ? "Trabalhos inscritos neste concurso."
    : "Projetos cadastrados neste evento.";
  document.getElementById("ranking-members-head").textContent = type.membersLabel;
  const scoreHead = document.getElementById("ranking-score-head");
  if (scoreHead) scoreHead.textContent = contest ? "Nota" : "Média";
  currentEventImages = {
    imageUrl: event.imageUrl || "",
    imageCardUrl: event.imageCardUrl || event.imageUrl || "",
  };
  setPhotoPreview("event-image", currentEventImages.imageUrl);
  document.getElementById("event-view-public").href = `evento.html?id=${encodeURIComponent(event.id)}`;
  document.getElementById("draw-status").textContent = event.orderDrawnAt
    ? "Ordem já sorteada. Você pode sortear de novo se precisar."
    : "Ainda não sorteada.";
  document.getElementById("voting-status").textContent = event.votingOpen ? "Aberta" : "Fechada";
  document.getElementById("btn-votacao").textContent = event.votingOpen ? "Fechar votação" : "Abrir votação";
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
  url.searchParams.set("tipo", currentKind);
  window.history.replaceState({}, "", url);
  document.getElementById("admin-tabs").classList.remove("hidden");
  listView.classList.remove("hidden");
  detailView.classList.add("hidden");
  setAdminTab(currentKind, { updateUrl: false });
}

function showDetail() {
  document.getElementById("admin-tabs").classList.add("hidden");
  listView.classList.add("hidden");
  detailView.classList.remove("hidden");
}

function renderKindList(rootId, events) {
  const root = document.getElementById(rootId);
  if (!events.length) {
    root.innerHTML = `<p class="text-slate-500 text-sm">Nenhum cadastro nesta área.</p>`;
    return;
  }
  root.innerHTML = events
    .map((event) => {
      const type = eventType(event.type);
      return `
        <div class="panel p-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            ${
              event.imageUrl
                ? `<img src="${escapeHtml(event.imageCardUrl || event.imageUrl)}" alt="" class="event-thumb" />`
                : ""
            }
            <div class="min-w-0">
              <p class="font-semibold">${escapeHtml(event.title)}</p>
              <p class="text-sm text-slate-500">${escapeHtml(type.label)}${event.date ? ` · ${escapeHtml(event.date)}` : ""}</p>
            </div>
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

async function loadEventList() {
  const events = await loadEvents();
  renderKindList(
    "admin-events-projetos",
    events.filter((event) => event.type !== "concurso")
  );
  renderKindList(
    "admin-events-concurso",
    events.filter((event) => event.type === "concurso")
  );
}

function fillHomeBannerForm(config) {
  const banner = homeBannerAssets(config);
  currentSiteImages = {
    imageUrl: config.bannerUrl || "",
    imageCardUrl: config.bannerCardUrl || config.bannerUrl || "",
  };
  document.getElementById("site-banner-alt").value = banner.alt;
  setPhotoPreview("site-banner", banner.src);
  const removeBtn = document.getElementById("site-banner-remove");
  if (removeBtn) removeBtn.classList.toggle("hidden", !banner.custom);
}

async function loadHomeBannerForm() {
  fillHomeBannerForm(await loadSiteConfig());
}

async function saveSiteBanner(payload) {
  const firebase = requireFirebase();
  if (!firebase) return;
  await setDoc(doc(firebase.db, "config", "site"), payload, { merge: true });
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
  currentKind = event.type === "concurso" ? "concurso" : "projetos";
  const url = new URL(window.location.href);
  url.searchParams.set("evento", id);
  url.searchParams.set("tipo", currentKind);
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
  renderRanking(projects, votes, event);
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
  currentProjectImages = emptyImages();
  currentProjectPdf = emptyPdf();
  setPhotoPreview("edit-project-image", "");
  setPdfPreview("edit-project-pdf");
  const pdfLink = document.getElementById("edit-project-pdf-link");
  if (pdfLink) pdfLink.value = "";
}

function openEdit(project) {
  const type = eventType(document.getElementById("event-type-input").value);
  document.getElementById("edit-members-label").textContent = type.membersLabel;
  document.getElementById("edit-add-student").textContent = type.addMember;
  document.getElementById("edit-project-id").value = project.id;
  document.getElementById("edit-title").value = project.title || "";
  document.getElementById("edit-description").value = project.description || "";
  document.getElementById("edit-view-public").href = `projeto.html?id=${encodeURIComponent(project.id)}`;
  currentProjectImages = {
    imageUrl: project.imageUrl || "",
    imageCardUrl: project.imageCardUrl || project.imageUrl || "",
  };
  setPhotoPreview("edit-project-image", currentProjectImages.imageUrl);
  currentProjectPdf = {
    pdfUrl: project.pdfUrl || "",
    pdfName: project.pdfName || "",
  };
  setPdfPreview("edit-project-pdf", currentProjectPdf);
  const pdfLink = document.getElementById("edit-project-pdf-link");
  if (pdfLink) pdfLink.value = currentProjectPdf.pdfUrl || "";
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

  const sorted = sortProjects(projects);

  root.innerHTML = sorted
    .map(
      (project) => `
        <div class="border border-slate-200 px-4 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0 flex-1">
              ${
                project.imageUrl
                  ? `<img src="${escapeHtml(project.imageCardUrl || project.imageUrl)}" alt="" class="event-thumb" />`
                  : ""
              }
              <div class="min-w-0">
                <p class="font-medium">${!isContest(event) && project.order ? `${escapeHtml(formatOrder(project.order))} · ` : ""}${escapeHtml(project.title)}</p>
                <p class="text-sm text-slate-500 mt-1">${escapeHtml((project.students || []).join(" · ") || `Sem ${type.membersLabel.toLowerCase()}`)}</p>
              </div>
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

function renderRanking(projects, votes, event) {
  const rows = rankingRows(projects, votes, event);
  const podiumBtn = document.getElementById("btn-podio");
  const hasScores = rows.some((row) => row.count > 0);
  podiumBtn.classList.toggle("hidden", !hasScores);

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
            <p class="text-xs text-slate-400">${row.criteriaAvgs.length > 1 ? row.criteriaAvgs.map((c) => `${c.label}: ${round1(c.avg).toFixed(1)}`).join(" · ") : ""}</p>
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

document.getElementById("form-new-projetos").addEventListener("submit", (event) => submitNewEvent(event, "projetos"));
document.getElementById("form-new-concurso").addEventListener("submit", (event) => submitNewEvent(event, "concurso"));
document.getElementById("form-home-banner").addEventListener("submit", async (event) => {
  event.preventDefault();
  const firebase = requireFirebase();
  if (!firebase) return;
  const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const images = await imageFromField("site-banner", currentSiteImages, uploadHomeBanner);
    const bannerAlt = document.getElementById("site-banner-alt").value.trim() || DEFAULT_HOME_BANNER_ALT;
    await saveSiteBanner({
      bannerUrl: images.imageUrl || "",
      bannerCardUrl: images.imageCardUrl || "",
      bannerAlt,
    });
    showToast("Banner da página principal salvo.");
    fillHomeBannerForm({
      bannerUrl: images.imageUrl || "",
      bannerCardUrl: images.imageCardUrl || "",
      bannerAlt,
    });
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar o banner.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

async function submitNewEvent(event, type) {
  event.preventDefault();
  const firebase = getFirebase();
  const payload = payloadFromCreateForm(event.target, type);
  const submitBtn = event.target.querySelector("button[type=submit]");
  if (!payload.title) {
    showToast(type === "concurso" ? "Informe o nome do concurso." : "Informe o nome do evento.", "error");
    return;
  }
  submitBtn.disabled = true;
  try {
    Object.assign(payload, await imageFromField(type === "concurso" ? "new-concurso-image" : "new-projetos-image"));
    const ref = await addDoc(collection(firebase.db, "events"), {
      ...payload,
      votingOpen: false,
      orderDrawnAt: null,
      createdAt: serverTimestamp(),
    });
    showToast(type === "concurso" ? "Concurso publicado." : "Evento publicado.");
    event.target.reset();
    setPhotoPreview(type === "concurso" ? "new-concurso-image" : "new-projetos-image", "");
    await openEvent(ref.id);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível cadastrar. Publique as regras do Firestore.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

document.getElementById("form-evento").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentEventId) return;
  const firebase = getFirebase();
  const payload = eventFormPayload();
  const submitBtn = event.target.querySelector("button[type=submit]");
  if (!payload.title) {
    showToast("Informe o nome do evento.", "error");
    return;
  }
  submitBtn.disabled = true;
  try {
    Object.assign(payload, await imageFromField("event-image", currentEventImages));
    await updateDoc(doc(firebase.db, "events", currentEventId), payload);
    currentEventImages = {
      imageUrl: payload.imageUrl || "",
      imageCardUrl: payload.imageCardUrl || payload.imageUrl || "",
    };
    setPhotoPreview("event-image", currentEventImages.imageUrl);
    showToast("Evento salvo.");
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar o evento.", "error");
  } finally {
    submitBtn.disabled = false;
  }
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

document.getElementById("btn-podio").addEventListener("click", async () => {
  if (!currentEventId) return;
  const firebase = requireFirebase();
  if (!firebase) return;
  try {
    const event = await loadEvent(currentEventId);
    const [projectsSnap, votesSnap] = await Promise.all([
      getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", currentEventId))),
      getDocs(query(collection(firebase.db, "votes"), where("eventId", "==", currentEventId))),
    ]);
    const projects = projectsSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const votes = votesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const podium = podiumFromRanking(rankingRows(projects, votes, event));
    if (!podium.length) {
      showToast("Ainda não há pontuação para montar o pódio.", "error");
      return;
    }
    await updateDoc(doc(firebase.db, "events", currentEventId), { podium });
    window.open(`podio.html?evento=${encodeURIComponent(currentEventId)}`, "_blank", "noopener");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível gerar o pódio.", "error");
  }
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
    const images = await imageFromField("edit-project-image", currentProjectImages);
    const pdf = await pdfFromField("edit-project-pdf", currentProjectPdf, "edit-project-pdf-link");
    await updateDoc(doc(getFirebase().db, "projects", id), {
      title,
      description,
      students,
      ...images,
      ...pdf,
    });
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

bindPhotoField("new-projetos-image");
bindPhotoField("new-concurso-image");
bindPhotoField("site-banner", {
  confirmRemove: () => {
    if (currentSiteImages.imageUrl) {
      return confirm("Excluir o banner cadastrado? A página principal volta ao banner padrão.");
    }
    return true;
  },
  afterRemove: async () => {
    if (currentSiteImages.imageUrl) {
      try {
        await saveSiteBanner({ bannerUrl: "", bannerCardUrl: "" });
        currentSiteImages = emptyImages();
        showToast("Banner restaurado para o padrão.");
      } catch (error) {
        console.error(error);
        showToast("Não foi possível excluir o banner.", "error");
        return;
      }
    }
    setPhotoPreview("site-banner", DEFAULT_HOME_BANNER);
    document.getElementById("site-banner-remove")?.classList.add("hidden");
  },
});
bindPhotoField("event-image", {
  confirmRemove: () => {
    if (currentEventId && currentEventImages.imageUrl) return confirm("Excluir a imagem deste evento?");
    return true;
  },
  afterRemove: async () => {
    if (!currentEventId || !currentEventImages.imageUrl) return;
    try {
      await updateDoc(doc(getFirebase().db, "events", currentEventId), { imageUrl: "", imageCardUrl: "" });
      currentEventImages = emptyImages();
      showToast("Imagem excluída.");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível excluir a imagem.", "error");
    }
  },
});
bindPhotoField("edit-project-image", {
  confirmRemove: () => {
    const id = document.getElementById("edit-project-id").value;
    if (id && currentProjectImages.imageUrl) return confirm("Excluir a imagem desta inscrição?");
    return true;
  },
  afterRemove: async () => {
    const id = document.getElementById("edit-project-id").value;
    if (!id || !currentProjectImages.imageUrl) return;
    try {
      await updateDoc(doc(getFirebase().db, "projects", id), { imageUrl: "", imageCardUrl: "" });
      currentProjectImages = emptyImages();
      const project = projectsById.get(id);
      if (project) {
        project.imageUrl = "";
        project.imageCardUrl = "";
      }
      showToast("Imagem excluída.");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível excluir a imagem.", "error");
    }
  },
});

bindPdfField("edit-project-pdf", {
  linkInputId: "edit-project-pdf-link",
  confirmRemove: () => {
    const id = document.getElementById("edit-project-id").value;
    if (id && currentProjectPdf.pdfUrl) return confirm("Excluir o PDF desta inscrição?");
    return true;
  },
  afterRemove: async () => {
    const id = document.getElementById("edit-project-id").value;
    if (!id || !currentProjectPdf.pdfUrl) return;
    try {
      await updateDoc(doc(getFirebase().db, "projects", id), { pdfUrl: "", pdfName: "" });
      currentProjectPdf = emptyPdf();
      const project = projectsById.get(id);
      if (project) {
        project.pdfUrl = "";
        project.pdfName = "";
      }
      showToast("PDF excluído.");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível excluir o PDF.", "error");
    }
  },
});
  btn.addEventListener("click", () => {
    if (currentEventId) return;
    setAdminTab(btn.dataset.adminTab);
  });
});

const firebase = requireFirebase();
if (firebase) {
  onAuthStateChanged(firebase.auth, async (user) => {
    if (user) {
      loginSection.classList.add("hidden");
      panelSection.classList.remove("hidden");
      try {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("evento");
        const requestedKind = params.get("tipo");
        if (requestedKind) setAdminTab(requestedKind, { updateUrl: false });
        await Promise.all([loadEventList(), loadHomeBannerForm()]);
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
