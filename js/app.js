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

export const EVENT_DEFAULTS = {
  title: DEFAULT_EVENT_TITLE,
  eyebrow: "Apresentação comercial de TCC",
  subtitle: "Simulação de banca para as equipes formandas",
  description:
    "Cadastre o projeto da equipe, acompanhe a ordem das apresentações e avalie os trabalhos da turma.",
  date: "",
  time: "",
  location: "",
  className: "",
  votingOpen: false,
  orderDrawnAt: null,
};

export function normalizeEventConfig(data = {}) {
  return {
    title: data.title || EVENT_DEFAULTS.title,
    eyebrow: data.eyebrow || EVENT_DEFAULTS.eyebrow,
    subtitle: data.subtitle || EVENT_DEFAULTS.subtitle,
    description: data.description || EVENT_DEFAULTS.description,
    date: data.date || "",
    time: data.time || "",
    location: data.location || "",
    className: data.className || "",
    votingOpen: Boolean(data.votingOpen),
    orderDrawnAt: data.orderDrawnAt || null,
  };
}

export function formatEventDate(iso) {
  if (!iso) return "";
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatEventTime(value) {
  if (!value) return "";
  return value.length === 5 ? `${value}h` : value;
}

export function sortProjects(projects) {
  const drawn = projects.every((p) => typeof p.order === "number" && p.order > 0);
  if (drawn) return [...projects].sort((a, b) => a.order - b.order);
  return [...projects].sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR"));
}

export function projectCardHtml(project) {
  const orderLabel = formatOrder(project.order);
  const index = project.order ? String(project.order).padStart(2, "0") : "—";
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
  if (!firebase) return normalizeEventConfig();
  const snap = await getDoc(doc(firebase.db, "config", "event"));
  if (!snap.exists()) return normalizeEventConfig();
  return normalizeEventConfig(snap.data());
}

export function applyEventTitle(title) {
  document.querySelectorAll("[data-event-title]").forEach((el) => {
    el.textContent = title || DEFAULT_EVENT_TITLE;
  });
}

export function applyEventConfig(config) {
  const event = normalizeEventConfig(config);
  applyEventTitle(event.title);

  const map = {
    "[data-event-eyebrow]": event.eyebrow,
    "[data-event-subtitle]": event.subtitle,
    "[data-event-description]": event.description,
    "[data-event-date]": formatEventDate(event.date),
    "[data-event-time]": formatEventTime(event.time),
    "[data-event-location]": event.location,
    "[data-event-class]": event.className,
  };

  Object.entries(map).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  });

  document.querySelectorAll("[data-requires]").forEach((el) => {
    const key = el.dataset.requires;
    const value = event[key];
    el.classList.toggle("hidden", !value);
  });

  if (document.body?.dataset.page === "home") {
    document.title = `${event.title} — Apresentações`;
  }
}

export async function bootPage() {
  const banner = document.getElementById("firebase-banner");
  if (!isFirebaseConfigured() && banner) banner.classList.remove("hidden");

  try {
    const config = await loadEventConfig();
    applyEventConfig(config);
    return config;
  } catch (error) {
    console.error(error);
    applyEventConfig(EVENT_DEFAULTS);
    if (isFirebaseConfigured()) {
      showToast("Não foi possível conectar ao Firebase. Confira as chaves e as regras.", "error");
    }
    return normalizeEventConfig();
  }
}

bootPage();
