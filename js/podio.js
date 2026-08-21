import { isFirebaseConfigured, loadEvent } from "./app.js";

const params = new URLSearchParams(window.location.search);
const eventId = params.get("evento") || params.get("id");
const canvas = document.getElementById("champagne");
const ctx = canvas.getContext("2d");
const particles = [];
const colors = ["#fff8dc", "#f5d76e", "#ffe9a3", "#ffffff", "#f7e7a8"];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawn(x, y, burst = false) {
  const count = burst ? 18 : 3;
  for (let i = 0; i < count; i += 1) {
    const up = burst || Math.random() > 0.35;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (up ? 7 : 1.4),
      vy: up ? -3 - Math.random() * 9 : 1 + Math.random() * 3,
      g: 0.16 + Math.random() * 0.08,
      life: 70 + Math.random() * 80,
      size: 1.4 + Math.random() * 3.8,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function rain() {
  spawn(Math.random() * canvas.width, -8);
}

function sprayFromBottles() {
  const bottles = document.querySelectorAll(".is-first .champagne-bottle");
  if (bottles.length) {
    bottles.forEach((bottle) => {
      const box = bottle.getBoundingClientRect();
      spawn(box.left + box.width / 2, box.top, Math.random() > 0.62);
    });
    return;
  }
  const first = document.querySelector(".is-first");
  if (!first) return;
  const box = first.getBoundingClientRect();
  spawn(box.left + box.width * 0.18, box.top + 70, Math.random() > 0.7);
  spawn(box.right - box.width * 0.18, box.top + 70, Math.random() > 0.7);
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (Math.random() > 0.2) rain();
  if (Math.random() > 0.45) sprayFromBottles();
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const drop = particles[i];
    drop.vy += drop.g;
    drop.x += drop.vx;
    drop.y += drop.vy;
    drop.life -= 1;
    ctx.globalAlpha = Math.max(drop.life / 110, 0);
    ctx.fillStyle = drop.color;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y, drop.size * 0.55, drop.size, 0, 0, Math.PI * 2);
    ctx.fill();
    if (drop.life <= 0 || drop.y > canvas.height + 20) particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(tick);
}

function fillCard(slot, place) {
  const card = document.querySelector(`[data-slot="${slot}"]`);
  if (!card) return;
  if (!place) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  card.querySelector(".podium-name").textContent = place.title || "—";
  card.querySelector(".podium-team").textContent = (place.students || []).join(" · ");
  card.querySelector(".podium-score").textContent = `${Number(place.avg || 0).toFixed(1)} · ${place.count || 0} voto${place.count === 1 ? "" : "s"}`;
  const img = card.querySelector(".podium-photo");
  if (place.imageUrl) {
    img.referrerPolicy = "no-referrer";
    img.src = place.imageUrl;
    img.alt = place.title || "";
    img.style.display = "block";
  }
}

async function loadPodium() {
  if (!eventId || !isFirebaseConfigured()) {
    document.getElementById("podium-empty").classList.remove("hidden");
    return;
  }
  const event = await loadEvent(eventId);
  if (!event) {
    document.getElementById("podium-empty").textContent = "Evento não encontrado.";
    document.getElementById("podium-empty").classList.remove("hidden");
    return;
  }
  document.title = `Pódio — ${event.title}`;
  document.getElementById("podium-title").textContent = event.title;
  const places = event.podium || [];
  if (!places.length) {
    document.getElementById("podium-empty").classList.remove("hidden");
    return;
  }
  document.getElementById("podium-places").classList.remove("hidden");
  fillCard(1, places.find((item) => item.place === 1) || places[0]);
  fillCard(2, places.find((item) => item.place === 2) || places[1]);
  fillCard(3, places.find((item) => item.place === 3) || places[2]);
}

window.addEventListener("resize", resize);
resize();
tick();
loadPodium().catch((error) => {
  console.error(error);
  document.getElementById("podium-empty").textContent = "Não foi possível carregar o pódio.";
  document.getElementById("podium-empty").classList.remove("hidden");
});
