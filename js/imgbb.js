import { imgbbApiKey } from "./imgbb-config.js";

const MAX_BYTES = 5 * 1024 * 1024;
const BANNER = { width: 1920, height: 1080 };
const CARD = { width: 960, height: 540 };
const HOME_BANNER = { width: 1980, height: 400 };
const HOME_BANNER_CARD = { width: 990, height: 200 };

export function isImgbbConfigured() {
  return Boolean(imgbbApiKey && !String(imgbbApiKey).toLowerCase().includes("cole"));
}

export function emptyImages() {
  return { imageUrl: "", imageCardUrl: "" };
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function drawFitted(source, width, height, fit = "contain") {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const scale =
    fit === "cover"
      ? Math.max(width / source.width, height / source.height)
      : Math.min(width / source.width, height / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  return canvas;
}

function canvasToJpeg(canvas, name, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível gerar a imagem."));
          return;
        }
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality
    );
  });
}

function pickImgbbUrl(data = {}) {
  const candidates = [data.image?.url, data.display_url, data.medium?.url, data.url]
    .map((url) => String(url || "").trim())
    .filter((url) => /^https?:\/\//i.test(url));
  return (
    candidates.find((url) => url.includes("i.ibb.co")) ||
    candidates.find((url) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) ||
    candidates.find((url) => !url.includes("ibb.co/")) ||
    candidates[0] ||
    ""
  );
}

async function postToImgbb(file) {
  const body = new FormData();
  body.append("key", imgbbApiKey);
  body.append("image", file, file.name || "image.jpg");
  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });
  const json = await response.json().catch(() => ({}));
  const url = pickImgbbUrl(json?.data);
  if (!response.ok || !json?.success || !url) {
    throw new Error(json?.error?.message || "Não foi possível enviar a imagem.");
  }
  return url;
}

async function uploadFitted(file, full, card, fit, names) {
  if (!file) return emptyImages();
  if (!isImgbbConfigured()) {
    throw new Error("Configure a chave do ImgBB em js/imgbb-config.js");
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem (JPG, PNG ou WEBP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const source = await loadImageFile(file);
  const [fullFile, cardFile] = await Promise.all([
    canvasToJpeg(drawFitted(source, full.width, full.height, fit), names.full, 0.86),
    canvasToJpeg(drawFitted(source, card.width, card.height, fit), names.card, 0.82),
  ]);
  const [imageUrl, imageCardUrl] = await Promise.all([postToImgbb(fullFile), postToImgbb(cardFile)]);
  return { imageUrl, imageCardUrl };
}

export async function uploadToImgbb(file) {
  return uploadFitted(file, BANNER, CARD, "contain", { full: "capa.jpg", card: "capa-card.jpg" });
}

export async function uploadHomeBanner(file) {
  return uploadFitted(file, HOME_BANNER, HOME_BANNER_CARD, "cover", {
    full: "banner.jpg",
    card: "banner-card.jpg",
  });
}

export function bindPhotoField(inputId, options = {}) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(`${inputId}-preview`);
  const removeBtn = document.getElementById(`${inputId}-remove`);
  if (!input || !preview) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    preview.referrerPolicy = "no-referrer";
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    if (removeBtn) removeBtn.classList.remove("hidden");
    input.dataset.removed = "0";
  });

  removeBtn?.addEventListener("click", async () => {
    if (options.confirmRemove && !(await options.confirmRemove())) return;
    input.value = "";
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    removeBtn.classList.add("hidden");
    input.dataset.removed = "1";
    if (options.afterRemove) await options.afterRemove();
  });
}

export function setPhotoPreview(inputId, url) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(`${inputId}-preview`);
  const removeBtn = document.getElementById(`${inputId}-remove`);
  if (!input || !preview) return;
  input.value = "";
  input.dataset.removed = "0";
  preview.referrerPolicy = "no-referrer";
  if (url) {
    preview.src = url;
    preview.classList.remove("hidden");
    removeBtn?.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    removeBtn?.classList.add("hidden");
  }
}

export async function imageFromField(inputId, current = emptyImages(), upload = uploadToImgbb) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  if (file) return upload(file);
  if (input?.dataset.removed === "1") return emptyImages();
  return {
    imageUrl: current.imageUrl || "",
    imageCardUrl: current.imageCardUrl || current.imageUrl || "",
  };
}
