import { MAX_TARGET_EDGE, CONTENT_FILE_LIMITS } from "../config.js";
import { pad2 } from "./format.js";

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片解碼失敗"));
    img.src = src;
  });
}

export function defaultLabelFromFile(file, index) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "卡蓋 " + pad2(index + 1)).slice(0, 40);
}

export async function prepareImageForCompiler(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("圖片尺寸無效");

  let scale = Math.min(1, MAX_TARGET_EDGE / Math.max(w, h));
  const minEdge = Math.min(w, h) * scale;
  if (minEdge < 256) {
    scale *= 256 / minEdge;
    scale = Math.min(scale, MAX_TARGET_EDGE / Math.max(w, h));
  }

  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立 Canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 1;
  canvas.height = 1;
  return loadImage(dataUrl);
}

export function contentAccept(type) {
  if (type === "image") return "image/*";
  if (type === "video") return "video/*";
  if (type === "pdf") return "application/pdf,.pdf";
  return "";
}

export function isAllowedContentFile(kind, file) {
  if (kind === "image") return (file.type && file.type.startsWith("image/")) || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
  if (kind === "video") return (file.type && file.type.startsWith("video/")) || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  if (kind === "pdf") return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  return false;
}

export function contentFileLimit(kind) {
  return CONTENT_FILE_LIMITS[kind] || 0;
}
