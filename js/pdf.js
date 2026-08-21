import { cloudinaryCloudName, cloudinaryUploadPreset } from "./cloudinary-config.js";

const MAX_BYTES = 10 * 1024 * 1024;

export function emptyPdf() {
  return { pdfUrl: "", pdfName: "" };
}

export function isPdfUploadConfigured() {
  return (
    Boolean(cloudinaryCloudName) &&
    !String(cloudinaryCloudName).toUpperCase().includes("COLE") &&
    Boolean(cloudinaryUploadPreset) &&
    !String(cloudinaryUploadPreset).toUpperCase().includes("COLE")
  );
}

function isPdfFile(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

export function normalizePdfLink(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function uploadPdf(file) {
  if (!file) return emptyPdf();
  if (!isPdfFile(file)) {
    throw new Error("Envie um arquivo PDF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("O PDF deve ter no máximo 10 MB.");
  }
  if (!isPdfUploadConfigured()) {
    throw new Error("Para enviar o arquivo, configure o Cloudinary em js/cloudinary-config.js. Você também pode colar um link público do PDF.");
  }

  const body = new FormData();
  body.append("file", file, file.name || "trabalho.pdf");
  body.append("upload_preset", cloudinaryUploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`, {
    method: "POST",
    body,
  });
  const json = await response.json().catch(() => ({}));
  const pdfUrl = json.secure_url || json.url || "";
  if (!response.ok || !pdfUrl) {
    throw new Error(json.error?.message || "Não foi possível enviar o PDF.");
  }
  return { pdfUrl, pdfName: file.name || "trabalho.pdf" };
}

export function bindPdfField(fileInputId, options = {}) {
  const input = document.getElementById(fileInputId);
  const nameEl = document.getElementById(`${fileInputId}-name`);
  const removeBtn = document.getElementById(`${fileInputId}-remove`);
  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    if (nameEl) {
      nameEl.textContent = file.name;
      nameEl.classList.remove("hidden");
    }
    removeBtn?.classList.remove("hidden");
    input.dataset.removed = "0";
    const link = document.getElementById(options.linkInputId || "");
    if (link) link.value = "";
  });

  removeBtn?.addEventListener("click", async () => {
    if (options.confirmRemove && !(await options.confirmRemove())) return;
    input.value = "";
    input.dataset.removed = "1";
    if (nameEl) {
      nameEl.textContent = "";
      nameEl.classList.add("hidden");
    }
    removeBtn.classList.add("hidden");
    const link = document.getElementById(options.linkInputId || "");
    if (link) link.value = "";
    if (options.afterRemove) await options.afterRemove();
  });
}

export function setPdfPreview(fileInputId, pdf = emptyPdf()) {
  const input = document.getElementById(fileInputId);
  const nameEl = document.getElementById(`${fileInputId}-name`);
  const removeBtn = document.getElementById(`${fileInputId}-remove`);
  if (!input) return;
  input.value = "";
  input.dataset.removed = "0";
  if (pdf.pdfUrl) {
    if (nameEl) {
      nameEl.textContent = pdf.pdfName || "PDF anexado";
      nameEl.classList.remove("hidden");
    }
    removeBtn?.classList.remove("hidden");
  } else {
    if (nameEl) {
      nameEl.textContent = "";
      nameEl.classList.add("hidden");
    }
    removeBtn?.classList.add("hidden");
  }
}

export async function pdfFromField(fileInputId, current = emptyPdf(), linkInputId = "") {
  const input = document.getElementById(fileInputId);
  const file = input?.files?.[0];
  if (file) return uploadPdf(file);
  const link = normalizePdfLink(document.getElementById(linkInputId)?.value);
  if (link) return { pdfUrl: link, pdfName: current.pdfName || "PDF do trabalho" };
  if (input?.dataset.removed === "1") return emptyPdf();
  return {
    pdfUrl: current.pdfUrl || "",
    pdfName: current.pdfName || "",
  };
}
