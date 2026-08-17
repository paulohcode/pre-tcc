import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getFirebase, isFirebaseConfigured, showToast } from "./app.js";

const list = document.getElementById("students-list");
const form = document.getElementById("form-projeto");
const addBtn = document.getElementById("add-student");
const submitBtn = document.getElementById("submit-projeto");

function studentRow(canRemove) {
  const wrap = document.createElement("div");
  wrap.className = "flex gap-2";
  wrap.innerHTML = `
    <input
      type="text"
      required
      maxlength="80"
      class="student-name flex-1 bg-navy-950 border border-gold/20 px-4 py-3 outline-none focus:border-gold/50"
      placeholder="Nome e sobrenome"
    />
    ${
      canRemove
        ? '<button type="button" class="remove-student px-3 border border-gold/20 text-stone-400 hover:text-red-200 hover:border-red-400/30">✕</button>'
        : ""
    }
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
      extra.className =
        "remove-student px-3 border border-gold/20 text-stone-400 hover:text-red-200 hover:border-red-400/30";
      extra.textContent = "✕";
      extra.addEventListener("click", () => {
        row.remove();
        refreshRemoveButtons();
      });
      row.appendChild(extra);
    }
  });
}

list.appendChild(studentRow(false));

addBtn.addEventListener("click", () => {
  list.appendChild(studentRow(true));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isFirebaseConfigured()) {
    showToast("Configure o Firebase antes de cadastrar.", "error");
    return;
  }

  const firebase = getFirebase();
  if (!firebase) {
    showToast("Firebase não inicializou. Recarregue a página.", "error");
    return;
  }

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const students = [...list.querySelectorAll("input.student-name")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (!title || !description) {
    showToast("Preencha o nome e a descrição do projeto.", "error");
    return;
  }
  if (!students.length) {
    showToast("Informe pelo menos um integrante.", "error");
    return;
  }

  submitBtn.disabled = true;
  try {
    await addDoc(collection(firebase.db, "projects"), {
      title,
      description,
      students,
      order: null,
      createdAt: serverTimestamp(),
    });
    showToast("Projeto cadastrado.");
    window.location.href = "index.html#projetos";
  } catch (error) {
    console.error(error);
    showToast("Não foi possível cadastrar. Confira as regras do Firestore.", "error");
    submitBtn.disabled = false;
  }
});
