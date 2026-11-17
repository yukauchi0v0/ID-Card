/**
 * 圖片與內容檔案的工具函式。
 *
 * 卡蓋圖在編譯前一定要先縮到合理尺寸：MindAR 對過大的圖不只慢，還可能
 * 讓手機記憶體爆掉。內容檔（照片/影片/PDF）只做型別與大小檢查，原檔
 * 保留，不重新編碼。
 */
import { MAX_TARGET_EDGE, CONTENT_FILE_LIMITS } from "../config.js";
import { pad2 } from "./format.js";

/**
 * 用 Image 解碼圖片；成功回傳已載入的 HTMLImageElement。
 *
 * @param {string} src object URL 或 data URL。
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片解碼失敗"));
    img.src = src;
  });
}

/**
 * 從檔名產生預設的 HUD 標題：去掉副檔名、把 _/- 換成空白、截到 40 字。
 *
 * @param {File} file
 * @param {number} index 從 0 開始，用於 fallback「卡蓋 01」。
 * @returns {string}
 */
export function defaultLabelFromFile(file, index) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "卡蓋 " + pad2(index + 1)).slice(0, 40);
}

/**
 * 把卡蓋圖縮到編譯尺寸，並鋪白底後轉成 PNG。
 *
 * 規則：
 * - 最長邊不超過 MAX_TARGET_EDGE（1024）。
 * - 短邊至少 256；太小的圖先放大，否則特徵點會太少。
 * - 透明背景鋪白，避免 PNG 的 alpha 在特徵提取時變成黑底。
 *
 * 回傳的是新的 Image（data URL），不是 canvas；呼叫端可直接交給
 * MindAR compileImageTargets。
 *
 * @param {HTMLImageElement} img
 * @returns {Promise<HTMLImageElement>}
 */
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

/** 回傳 `<input type=file accept>` 對應的 MIME/副檔名清單。 */
export function contentAccept(type) {
  if (type === "image") return "image/*";
  if (type === "video") return "video/*";
  if (type === "pdf") return "application/pdf,.pdf";
  return "";
}

/**
 * 檢查內容檔是否符合該型態。
 * 同時看 MIME 與副檔名：有些 Android 檔案選擇器會給空 MIME。
 *
 * @param {string} kind image/video/pdf
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedContentFile(kind, file) {
  if (kind === "image") return (file.type && file.type.startsWith("image/")) || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
  if (kind === "video") return (file.type && file.type.startsWith("video/")) || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  if (kind === "pdf") return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  return false;
}

/** 回傳該內容型態的檔案大小上限（bytes）；未知型態回 0（不限制）。 */
export function contentFileLimit(kind) {
  return CONTENT_FILE_LIMITS[kind] || 0;
}
