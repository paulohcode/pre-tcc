import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

export const CRITERIA = [
  { id: "clareza", label: "Clareza" },
  { id: "inovacao", label: "Inovação" },
  { id: "apresentacao", label: "Qualidade da apresentação" },
  { id: "dominio", label: "Domínio do conteúdo" },
];

export const DEFAULT_EVENT_TITLE = "Banca de TCC";

let app;
let db;
let auth;

export { isFirebaseConfigured };

export function getFirebase() {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
  return { app, db, auth };
}

export function slugifyName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function hashPin(name, pin) {
  const payload = `${slugifyName(name)}::${pin}`;
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatOrder(order) {
  if (!order) return "";
  return `${order}º a apresentar`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function showToast(message, type = "ok") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  const tone =
    type === "error"
      ? "border-red-400/30 bg-red-950/80 text-red-100"
      : "border-gold/30 bg-navy-800 text-stone-100";
  el.className = `toast-enter max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl ${tone}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export async function loadEventConfig() {
  const firebase = getFirebase();
  if (!firebase) {
    return { title: DEFAULT_EVENT_TITLE, votingOpen: false, orderDrawnAt: null };
  }
  const snap = await getDoc(doc(firebase.db, "config", "event"));
  if (!snap.exists()) {
    return { title: DEFAULT_EVENT_TITLE, votingOpen: false, orderDrawnAt: null };
  }
  const data = snap.data();
  return {
    title: data.title || DEFAULT_EVENT_TITLE,
    votingOpen: Boolean(data.votingOpen),
    orderDrawnAt: data.orderDrawnAt || null,
  };
}

export function applyEventTitle(title) {
  document.querySelectorAll("[data-event-title]").forEach((el) => {
    el.textContent = title || DEFAULT_EVENT_TITLE;
  });
}

export async function bootPage() {
  const banner = document.getElementById("firebase-banner");
  if (!isFirebaseConfigured() && banner) banner.classList.remove("hidden");

  try {
    const config = await loadEventConfig();
    applyEventTitle(config.title);
    return config;
  } catch (error) {
    console.error(error);
    applyEventTitle(DEFAULT_EVENT_TITLE);
    if (isFirebaseConfigured()) {
      showToast("Não foi possível conectar ao Firebase. Confira as chaves e as regras.", "error");
    }
    return { title: DEFAULT_EVENT_TITLE, votingOpen: false, orderDrawnAt: null };
  }
}

bootPage();
