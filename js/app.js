import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

export const SITE_NAME = "SESI SENAI Umuarama";
export const DEFAULT_HOME_BANNER = "uploads/banner.png";
export const DEFAULT_HOME_BANNER_ALT = "SESI SENAI Umuarama";

export const CRITERIA = [
  { id: "clareza", label: "Clareza" },
  { id: "inovacao", label: "Inovação" },
  { id: "apresentacao", label: "Qualidade da apresentação" },
  { id: "dominio", label: "Domínio do conteúdo" },
];

export const EVENT_TYPES = {
  projetos: {
    id: "projetos",
    label: "Projetos",
    singular: "projeto",
    plural: "projetos",
    register: "Cadastrar projeto",
    vote: "Avaliar projeto",
    empty: "Nenhum projeto cadastrado neste evento.",
    membersLabel: "Integrantes",
    addMember: "+ Adicionar integrante",
    titlePlaceholder: "Nome do projeto",
    voteHelp: "Notas de 0 a 10 em cada critério. A média entra no ranking da banca.",
    hasDraw: true,
    voteAccess: "alunos",
  },
  concurso: {
    id: "concurso",
    label: "Concurso",
    singular: "trabalho",
    plural: "trabalhos",
    register: "Inscrever trabalho",
    vote: "Votar no trabalho",
    empty: "Nenhum trabalho inscrito neste concurso.",
    membersLabel: "Autores",
    addMember: "+ Adicionar autor",
    titlePlaceholder: "Nome do trabalho",
    voteHelp: "Dê uma nota de 0 a 10. A média das notas do público define o ranking.",
    hasDraw: false,
    voteAccess: "qrcode",
  },
};

export const CONTEST_CRITERIA = [{ id: "geral", label: "Nota" }];

export const VOTE_ACCESS = {
  alunos: {
    id: "alunos",
    label: "Somente inscritos (nome da lista + PIN)",
  },
  qrcode: {
    id: "qrcode",
    label: "Público com QR Code no celular",
  },
  ambos: {
    id: "ambos",
    label: "Inscritos e público (QR Code + lista)",
  },
};

export function eventType(type) {
  return EVENT_TYPES[type] || EVENT_TYPES.projetos;
}

export function isContest(event) {
  return event?.type === "concurso";
}

export function voteCriteria(event) {
  return isContest(event) ? CONTEST_CRITERIA : CRITERIA;
}

export function lockedVoteAccess(type) {
  return eventType(type).voteAccess;
}

export function voteAccess(mode) {
  return VOTE_ACCESS[mode] || VOTE_ACCESS.alunos;
}

export function allowsQrVote(event) {
  return event?.voteAccess === "qrcode" || event?.voteAccess === "ambos";
}

export function allowsOpenName(event) {
  return event?.voteAccess === "qrcode" || event?.voteAccess === "ambos";
}

export function eventPublicUrl(eventId) {
  const page = window.location.pathname.replace(/[^/]+$/, "evento.html");
  return `${window.location.origin}${page}?id=${encodeURIComponent(eventId)}`;
}

export async function renderQrCode(canvas, url) {
  if (!canvas || !url) return;
  const mod = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
  const QRCode = mod.default || mod;
  await QRCode.toCanvas(canvas, url, {
    width: 220,
    margin: 1,
    color: { dark: "#003da5", light: "#ffffff" },
  });
}

export function normalizeEvent(id, data = {}) {
  const type = EVENT_TYPES[data.type] ? data.type : "projetos";
  return {
    id,
    title: data.title || "Evento",
    type,
    description: data.description || "",
    date: data.date || "",
    time: data.time || "",
    location: data.location || "",
    className: data.className || "",
    audience: data.audience || "",
    voteAccess: lockedVoteAccess(type),
    imageUrl: data.imageUrl || "",
    imageCardUrl: data.imageCardUrl || data.imageUrl || "",
    votingOpen: Boolean(data.votingOpen),
    orderDrawnAt: data.orderDrawnAt || null,
    podium: Array.isArray(data.podium) ? data.podium : [],
    createdAt: data.createdAt || null,
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

export function eventFacts(event) {
  return [
    event.date ? { label: "Data", value: formatEventDate(event.date) } : null,
    event.time ? { label: "Horário", value: formatEventTime(event.time) } : null,
    event.location ? { label: "Local", value: event.location } : null,
    event.className ? { label: "Turma", value: event.className } : null,
    event.audience ? { label: "Público-alvo", value: event.audience } : null,
  ].filter(Boolean);
}

export function sortProjects(projects) {
  const withOrder = projects.filter((p) => Number(p.order) > 0);
  if (!withOrder.length) {
    return [...projects].sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR"));
  }
  return [...projects].sort((a, b) => {
    const ao = Number(a.order) > 0 ? Number(a.order) : Number.POSITIVE_INFINITY;
    const bo = Number(b.order) > 0 ? Number(b.order) : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "pt-BR");
  });
}

export function formatOrder(order) {
  if (!order) return "";
  return `${order}º a apresentar`;
}

export function projectCardHtml(project, event) {
  const type = eventType(event?.type);
  const contest = isContest(event);
  const orderLabel = contest ? "" : formatOrder(project.order);
  const index = contest ? "" : project.order ? String(project.order).padStart(2, "0") : "—";
  const cover = eventCoverHtml(project, "event-cover", "card");
  return `
    <a href="projeto.html?id=${encodeURIComponent(project.id)}" class="card-link panel overflow-hidden">
      ${cover}
      <div class="p-5 sm:p-6">
      ${
        contest
          ? ""
          : `<div class="flex items-start justify-between gap-4 mb-3">
        <p class="text-blue font-semibold">${escapeHtml(index)}</p>
        ${orderLabel ? `<p class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(orderLabel)}</p>` : ""}
      </div>`
      }
      <h3 class="text-xl font-semibold mb-2">${escapeHtml(project.title)}</h3>
      <p class="text-sm text-slate-500 mb-3">${escapeHtml((project.students || []).join(" · "))}</p>
      <p class="text-slate-600 text-sm line-clamp-3">${escapeHtml(project.description)}</p>
      ${project.pdfUrl ? `<p class="text-xs font-semibold uppercase tracking-wide text-blue mt-3">PDF anexado</p>` : ""}
      <p class="text-blue text-sm font-medium mt-4">${escapeHtml(type.vote)} →</p>
      </div>
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
  el.className = `toast-enter max-w-sm px-4 py-3 text-sm shadow-lg ${type === "error" ? "toast-error" : "toast-ok"}`;
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

export function rankingRows(projects, votes, event) {
  const byProject = new Map(projects.map((project) => [project.id, []]));
  votes.forEach((vote) => {
    if (!byProject.has(vote.projectId)) byProject.set(vote.projectId, []);
    byProject.get(vote.projectId).push(vote);
  });
  const criteria = voteCriteria(event);
  return projects
    .map((project) => {
      const list = byProject.get(project.id) || [];
      const avg = list.length ? average(list.map((vote) => Number(vote.average) || 0)) : 0;
      const criteriaAvgs = criteria.map((item) => {
        const values = list.map((vote) => Number(vote.criteria?.[item.id]) || 0);
        return { id: item.id, label: item.label, avg: list.length ? average(values) : 0 };
      });
      return { project, count: list.length, avg, criteriaAvgs };
    })
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
}

export function podiumFromRanking(rows, limit = 3) {
  return rows
    .filter((row) => row.count > 0)
    .slice(0, limit)
    .map((row, index) => ({
      place: index + 1,
      id: row.project.id,
      title: row.project.title || "",
      students: row.project.students || [],
      imageUrl: row.project.imageCardUrl || row.project.imageUrl || "",
      avg: round1(row.avg),
      count: row.count,
    }));
}

export function normalizeSiteConfig(data = {}) {
  return {
    bannerUrl: data.bannerUrl || "",
    bannerCardUrl: data.bannerCardUrl || data.bannerUrl || "",
    bannerAlt: data.bannerAlt || DEFAULT_HOME_BANNER_ALT,
  };
}

export function homeBannerAssets(config = {}) {
  const normalized = normalizeSiteConfig(config);
  return {
    src: normalized.bannerUrl || DEFAULT_HOME_BANNER,
    cardSrc: normalized.bannerCardUrl || normalized.bannerUrl || DEFAULT_HOME_BANNER,
    alt: normalized.bannerAlt,
    custom: Boolean(normalized.bannerUrl),
  };
}

export async function loadSiteConfig() {
  const firebase = getFirebase();
  if (!firebase) return normalizeSiteConfig();
  try {
    const snap = await getDoc(doc(firebase.db, "config", "site"));
    return normalizeSiteConfig(snap.exists() ? snap.data() : {});
  } catch (error) {
    console.error(error);
    return normalizeSiteConfig();
  }
}

export async function loadEvents() {
  const firebase = getFirebase();
  if (!firebase) return [];
  const snap = await getDocs(collection(firebase.db, "events"));
  return snap.docs
    .map((item) => normalizeEvent(item.id, item.data()))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title, "pt-BR"));
}

export async function loadEvent(eventId) {
  const firebase = getFirebase();
  if (!firebase || !eventId) return null;
  const snap = await getDoc(doc(firebase.db, "events", eventId));
  if (!snap.exists()) return null;
  return normalizeEvent(snap.id, snap.data());
}

export async function loadEventProjects(eventId) {
  const firebase = getFirebase();
  if (!firebase || !eventId) return [];
  const snap = await getDocs(query(collection(firebase.db, "projects"), where("eventId", "==", eventId)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function eventCoverSrc(event, size = "full") {
  if (size === "card") return event.imageCardUrl || event.imageUrl || "";
  return event.imageUrl || event.imageCardUrl || "";
}

export function eventCoverHtml(event, className, size = "card") {
  const full = eventCoverSrc(event, "full");
  const card = eventCoverSrc(event, "card");
  const src = size === "card" ? card : full;
  if (!src) return "";
  const sizes = size === "card" ? "(max-width: 768px) 100vw, 560px" : "(max-width: 768px) 100vw, 1152px";
  const srcset = card && full && card !== full ? `${escapeHtml(card)} 960w, ${escapeHtml(full)} 1920w` : "";
  return `<img src="${escapeHtml(src)}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ""} alt="${escapeHtml(event.title)}" class="${className}" referrerpolicy="no-referrer" />`;
}

export function eventCardHtml(event) {
  const type = eventType(event.type);
  const date = formatEventDate(event.date) || "Data a definir";
  const audience = event.audience ? ` · ${event.audience}` : "";
  const cover = eventCoverHtml(event, "event-cover", "card");
  return `
    <a href="evento.html?id=${encodeURIComponent(event.id)}" class="card-link panel overflow-hidden">
      ${cover}
      <div class="p-5 sm:p-6">
        <span class="badge mb-4">${escapeHtml(type.label)}</span>
        <h2 class="text-xl sm:text-2xl font-semibold mb-2">${escapeHtml(event.title)}</h2>
        <p class="text-sm text-slate-500 mb-3">${escapeHtml(date)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}${escapeHtml(audience)}</p>
        <p class="text-slate-600 text-sm line-clamp-3">${escapeHtml(event.description || "Abra para ver os detalhes e as inscrições.")}</p>
      </div>
    </a>
  `;
}

export async function bootPage() {
  const banner = document.getElementById("firebase-banner");
  if (!isFirebaseConfigured() && banner) banner.classList.remove("hidden");
}

bootPage();
