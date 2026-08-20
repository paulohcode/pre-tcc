import {
  isFirebaseConfigured,
  loadEvent,
  loadEventProjects,
  eventType,
  eventFacts,
  sortProjects,
  projectCardHtml,
  escapeHtml,
  allowsQrVote,
  eventPublicUrl,
  renderQrCode,
  isContest,
  eventCoverSrc,
} from "./app.js";

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

const loading = document.getElementById("evento-loading");
const missing = document.getElementById("evento-missing");
const content = document.getElementById("evento-content");
const entriesLoading = document.getElementById("projetos-loading");
const entriesEmpty = document.getElementById("projetos-empty");
const grid = document.getElementById("projetos-grid");

async function loadPage() {
  if (!eventId) {
    loading.classList.add("hidden");
    missing.classList.remove("hidden");
    return;
  }
  if (!isFirebaseConfigured()) {
    loading.textContent = "Configure o Firebase para abrir o evento.";
    return;
  }

  const event = await loadEvent(eventId);
  loading.classList.add("hidden");
  if (!event) {
    missing.classList.remove("hidden");
    return;
  }

  const type = eventType(event.type);
  document.title = `${event.title} — SESI SENAI Umuarama`;
  document.getElementById("evento-type").textContent = type.label;
  document.getElementById("evento-title").textContent = event.title;
  document.getElementById("evento-description").textContent =
    event.description || "Confira as inscrições deste evento.";
  document.getElementById("evento-register").textContent = type.register;
  document.getElementById("evento-register").href = `cadastrar.html?evento=${encodeURIComponent(event.id)}`;
  const cover = document.getElementById("evento-cover");
  const coverWrap = document.getElementById("evento-cover-wrap");
  const full = eventCoverSrc(event, "full");
  const card = eventCoverSrc(event, "card");
  if (full) {
    cover.referrerPolicy = "no-referrer";
    cover.src = full;
    cover.alt = event.title;
    if (card && card !== full) {
      cover.srcset = `${card} 960w, ${full} 1920w`;
      cover.sizes = "(max-width: 768px) 100vw, 1152px";
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
  document.getElementById("entries-title").textContent = type.plural.charAt(0).toUpperCase() + type.plural.slice(1);

  const facts = eventFacts(event);
  document.getElementById("evento-facts").innerHTML = facts
    .map(
      (item) => `
        <div class="panel p-5">
          <p class="kicker mb-2">${escapeHtml(item.label)}</p>
          <p class="font-semibold">${escapeHtml(item.value)}</p>
        </div>
      `
    )
    .join("");

  const qrPanel = document.getElementById("qr-panel");
  if (allowsQrVote(event)) {
    const url = eventPublicUrl(event.id);
    qrPanel.classList.remove("hidden");
    document.getElementById("evento-qr-url").textContent = url;
    renderQrCode(document.getElementById("evento-qr-canvas"), url).catch((error) => console.error(error));
  } else {
    qrPanel.classList.add("hidden");
  }

  content.classList.remove("hidden");

  const projects = await loadEventProjects(event.id);
  entriesLoading.classList.add("hidden");
  const orderStatus = document.getElementById("order-status");
  const drawn = !isContest(event) && Boolean(event.orderDrawnAt);
  if (isContest(event)) {
    orderStatus.textContent = "";
  } else {
    orderStatus.textContent = drawn
      ? "Listadas na ordem de apresentação."
      : "A ordem ainda não foi sorteada.";
  }

  if (!projects.length) {
    entriesEmpty.classList.remove("hidden");
    entriesEmpty.innerHTML = `${escapeHtml(type.empty)} <a class="text-blue hover:underline ml-1" href="cadastrar.html?evento=${encodeURIComponent(event.id)}">${escapeHtml(type.register)}</a>.`;
    return;
  }

  grid.className = drawn ? "grid gap-4" : "grid md:grid-cols-2 gap-5";
  grid.innerHTML = sortProjects(projects).map((project) => projectCardHtml(project, event)).join("");
}

loadPage().catch((error) => {
  console.error(error);
  loading.textContent = "Não foi possível carregar este evento.";
});
