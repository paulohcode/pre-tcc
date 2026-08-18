import { imgbbApiKey } from "./imgbb-config.js";

const MAX_BYTES = 5 * 1024 * 1024;

export function isImgbbConfigured() {
  return Boolean(imgbbApiKey && !String(imgbbApiKey).toLowerCase().includes("cole"));
}

export async function uploadToImgbb(file) {
  if (!file) return "";
  if (!isImgbbConfigured()) {
    throw new Error("Configure a chave do ImgBB em js/imgbb-config.js");
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem (JPG, PNG ou WEBP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const body = new FormData();
  body.append("key", imgbbApiKey);
  body.append("image", file);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });
  const json = await response.json().catch(() => ({}));
  const url = json?.data?.display_url || json?.data?.url;
  if (!response.ok || !json?.success || !url) {
    throw new Error(json?.error?.message || "Não foi possível enviar a imagem.");
  }
  return url;
}
