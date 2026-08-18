import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getFirebase,
  isFirebaseConfigured,
  showToast,
  loadEvent,
  eventType,
} from "./app.js";

const params = new URLSearchParams(window.location.search);
const eventId = params.get("evento");

const list = document.getElementById("students-list");
const form = document.getElementById("form-projeto");
const addBtn = document.getElementById("add-student");
const submitBtn = document.getElementById("submit-projeto");
const missing = document.getElementById("missing-event");

function studentRow(canRemove) {
  const wrap = document.createElement("div");
  wrap.className = "flex gap-2";
  wrap.innerHTML = `
    <input type="text" required maxlength="80" class="student-name field flex-1" placeholder="Nome e sobrenome" />
    ${canRemove ? '<button type="button" class="remove-student px-3 border border-slate-200 text-slate-500 hover:text-red-600">✕</button>' : ""}
  `;
  const remove = wrap.querySelector(".remove-student");
  if (remove) {
    remove.addEventListener("click", () => {
      wrap.remove();
      refreshRemoveButtons();
    });
  }
  return wrap;
}

function refreshRemoveButtons() {
  const rows = [...list.children];
  rows.forEach((row, index) => {
    const btn = row.querySelector(".remove-student");
    if (rows.length === 1 && btn) btn.remove();
    if (rows.length > 1 && !btn && index > 0) {
      const extra = document.createElement("button");
      extra.type = "button";
      extra.className = "remove-student px-3 border border-slate-200 text-slate-500 hover:text-red-600";
      extra.textContent = "✕";
      extra.addEventListener("click", () => {
        row.remove();
        refreshRemoveButtons();
      });
      row.appendChild(extra);
    }
  });
}

async function setup() {
  if (!eventId) {
    form.classList.add("hidden");
    missing.classList.remove("hidden");
    return;
  }

  const event = await loadEvent(eventId);
  if (!event) {
    form.classList.add("hidden");
    missing.classList.remove("hidden");
    missing.textContent = "Evento não encontrado.";
    return;
  }

  const type = eventType(event.type);
  document.title = `${type.register} — ${event.title}`;
  document.getElementById("page-title").textContent = type.register;
  document.getElementById("page-lead").textContent =
    event.type === "concurso"
      ? `Inscrição no concurso ${event.title}. Informe os autores com nome e sobrenome.`
      : `Inscrição em ${event.title}. Inclua todos os integrantes da equipe com nome e sobrenome.`;
  document.getElementById("members-label").textContent = type.membersLabel;
  document.getElementById("add-student").textContent = type.addMember;
  document.getElementById("title").placeholder = type.titlePlaceholder;
  document.getElementById("title-label").textContent = event.type === "concurso" ? "Nome do trabalho" : "Nome do projeto";
  document.getElementById("back-evento").href = `evento.html?id=${encodeURIComponent(event.id)}`;
  submitBtn.textContent = type.register;
}

list.appendChild(studentRow(false));
addBtn.addEventListener("click", () => list.appendChild(studentRow(true)));
setup().catch((error) => {
  console.error(error);
  form.classList.add("hidden");
  missing.classList.remove("hidden");
  missing.textContent = "Não foi possível abrir o cadastro deste evento.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!eventId) {
    showToast("Abra o cadastro a partir de um evento.", "error");
    return;
  }
  if (!isFirebaseConfigured()) {
    showToast("Configure o Firebase antes de cadastrar.", "error");
    return;
  }

  const firebase = getFirebase();
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const students = [...list.querySelectorAll("input.student-name")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (!title || !description) {
    showToast("Preencha o nome e a descrição.", "error");
    return;
  }
  if (!students.length) {
    showToast("Informe pelo menos um integrante.", "error");
    return;
  }

  submitBtn.disabled = true;
  try {
    await addDoc(collection(firebase.db, "projects"), {
      eventId,
      title,
      description,
      students,
      order: null,
      createdAt: serverTimestamp(),
    });
    showToast("Inscrição publicada.");
    window.location.href = `evento.html?id=${encodeURIComponent(eventId)}`;
  } catch (error) {
    console.error(error);
    showToast("Não foi possível cadastrar. Confira as regras do Firestore.", "error");
    submitBtn.disabled = false;
  }
});
