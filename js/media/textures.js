/**
 * AR 平面內容的材質產生與快取。
 *
 * 文字頁用 canvas 即時畫成 2:1 的卡片；照片與影片則轉成 Three.js 材質。
 * 每個 target 會把材質快取在自己的 `_textTexture` / `_imageTexture` /
 * `_videoTexture` 欄位，換頁時重複使用；離開 AR 時由
 * `disposePageCaches()` 統一釋放，避免 GPU 記憶體越用越多。
 *
 * 這個模組依賴 `window.AFRAME.THREE`，所以只能在 A-Frame 載入後執行。
 */
import {
  DEFAULT_TEXT,
  FONT_STACK,
  TEX_H,
  TEX_W,
  TEXT_PALETTES
} from "../config.js";
import { arState } from "../ar/state.js";
import { arDom } from "../ar/dom.js";
import { loadImage } from "../utils/files.js";
import { pad2 } from "../utils/format.js";
import { wrapCanvasText } from "../utils/canvas.js";

// 延後取得 THREE，避免 module 載入時 A-Frame 還不存在。
function three() {
  return window.AFRAME.THREE;
}

/**
 * 把文字頁畫成 1024×512 的卡片材質。
 * 第一次呼叫會建立並快取；之後同一頁直接回傳同一張 texture。
 *
 * @param {object} page target 物件，需有 label/text。
 * @param {number} index 頁碼索引（從 0 開始）。
 * @param {number} total 總頁數。
 * @returns {THREE.CanvasTexture}
 */
export function makeTextTexture(page, index, total) {
  if (page._textTexture) return page._textTexture;
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立文字紋理");

  const palette = TEXT_PALETTES[index % TEXT_PALETTES.length];
  const title = (page.label || "").trim() || "ID Card";
  const body = (page.text || "").trim() || DEFAULT_TEXT;

  // 底色與右上角柔光：讓白底卡片在鏡頭畫面裡仍有一點層次。
  ctx.fillStyle = "#f6f6f6";
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const glow = ctx.createRadialGradient(TEX_W * 0.9, 0, 10, TEX_W * 0.9, 0, TEX_W * 0.8);
  glow.addColorStop(0, palette.accent + "88");
  glow.addColorStop(0.5, "rgba(255,255,255,0)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.fillStyle = palette.soft;
  ctx.beginPath();
  ctx.arc(TEX_W - 110, 80, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(31,47,47,.13)";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, TEX_W - 44, TEX_H - 44);

  // 卡片固定標頭。
  ctx.fillStyle = "#1f2f2f";
  ctx.font = "800 24px " + FONT_STACK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ID CARD", 64, 86);

  ctx.fillStyle = "rgba(31,47,47,.48)";
  ctx.font = "600 20px " + FONT_STACK;
  ctx.textAlign = "right";
  ctx.fillText("SCAN · VIEW", TEX_W - 64, 86);
  ctx.textAlign = "left";

  // 標題先降字級，真的放不下才截斷並加省略號。
  let titleSize = 58;
  ctx.font = "800 " + titleSize + "px " + FONT_STACK;
  while (titleSize > 34 && ctx.measureText(title).width > TEX_W - 128) {
    titleSize -= 2;
    ctx.font = "800 " + titleSize + "px " + FONT_STACK;
  }
  let titleText = title;
  while (titleText.length > 1 && ctx.measureText(titleText + "…").width > TEX_W - 128) {
    titleText = titleText.slice(0, -1);
  }
  if (titleText !== title) titleText += "…";
  ctx.fillStyle = "#1f2f2f";
  ctx.fillText(titleText, 64, 164);

  ctx.fillStyle = palette.accent;
  ctx.fillRect(64, 188, 116, 6);

  // 內文：先從 32px 往下試，找到能在 200px 高度內放完的字級；
  // 若最小字級仍放不下，就截斷最後一行。
  let bodySize = 32;
  let lineHeight = 46;
  let lines = [];
  const maxBodyHeight = 200;
  for (; bodySize >= 22; bodySize -= 2) {
    lineHeight = Math.round(bodySize * 1.42);
    ctx.font = "400 " + bodySize + "px " + FONT_STACK;
    lines = wrapCanvasText(ctx, body, TEX_W - 128);
    if (lines.length * lineHeight <= maxBodyHeight) break;
  }
  const maxLines = Math.max(1, Math.floor(maxBodyHeight / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > TEX_W - 128) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  ctx.fillStyle = "rgba(31,47,47,.76)";
  ctx.font = "400 " + bodySize + "px " + FONT_STACK;
  lines.forEach((line, i) => ctx.fillText(line, 64, 240 + i * lineHeight));

  // 底部頁碼與提示。
  ctx.strokeStyle = "rgba(31,47,47,.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 456);
  ctx.lineTo(TEX_W - 64, 456);
  ctx.stroke();

  ctx.fillStyle = "rgba(31,47,47,.5)";
  ctx.font = "600 19px " + FONT_STACK;
  ctx.fillText(total > 1 ? "左右滑動切換" : "ID CARD", 64, 486);
  ctx.textAlign = "right";
  ctx.fillStyle = "#1f2f2f";
  ctx.font = "800 28px " + FONT_STACK;
  ctx.fillText(pad2(index + 1) + " / " + pad2(total), TEX_W - 64, 487);
  ctx.textAlign = "left";

  const THREE = three();
  const texture = new THREE.CanvasTexture(canvas);
  // 新版 Three.js 用 colorSpace，舊版用 encoding；兩個分支都保留，
  // 才不會因 CDN 版本不同而讓顏色偏暗。
  if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  page._textTexture = texture;
  page._aspect = 2;
  return texture;
}

/**
 * 載入照片並建立材質；同一個 target 只會載入一次。
 *
 * @param {object} page
 * @returns {Promise<{texture: THREE.Texture, aspect: number}>}
 */
export function ensureImage(page) {
  if (page._imageTexture) return Promise.resolve({ texture: page._imageTexture, aspect: page._aspect });
  if (page._imagePromise) return page._imagePromise;
  page._imagePromise = loadImage(page.contentObjectUrl).then((img) => {
    const THREE = three();
    const texture = new THREE.Texture(img);
    if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    page._imageTexture = texture;
    page._aspect = img.naturalWidth / img.naturalHeight;
    return { texture, aspect: page._aspect };
  });
  return page._imagePromise;
}

/**
 * 建立隱藏影片與 VideoTexture；載入失敗時會清掉 video 並 reject。
 *
 * 影片元素必須放進 DOM 才能在某些行動瀏覽器解碼，所以設成
 * 1×1、透明、不可點，並固定在畫面外。
 *
 * @param {object} page
 * @returns {Promise<{texture: THREE.VideoTexture, aspect: number}>}
 */
export function ensureVideo(page) {
  if (page._videoTexture) return Promise.resolve({ texture: page._videoTexture, aspect: page._aspect });
  if (page._videoPromise) return page._videoPromise;
  page._videoPromise = new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = page.contentObjectUrl;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";
    // 影片必須在 DOM 裡才能在一些行動瀏覽器解碼；把它藏在畫面外，
    // 不影響版面，也不會被使用者看到。
    video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    const fail = (err) => {
      try { video.remove(); } catch (e) { /* noop */ }
      reject(err || new Error("影片載入失敗"));
    };
    video.addEventListener("error", () => fail(video.error || new Error("影片格式不支援")));
    video.addEventListener("loadedmetadata", () => {
      const THREE = three();
      const texture = new THREE.VideoTexture(video);
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      // 影片每一幀都在變，不需要 mipmap。
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      page._video = video;
      page._videoTexture = texture;
      page._aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      resolve({ texture, aspect: page._aspect });
    }, { once: true });
    video.load();
  });
  return page._videoPromise;
}

/**
 * 依 contentType 取得平面內容的材質；面板型內容不走這條路。
 *
 * @param {object} page
 * @param {number} index
 * @param {number} total
 * @returns {Promise<{texture: THREE.Texture, aspect: number}>}
 */
export function getPageMedia(page, index, total) {
  if (page.contentType === "text") {
    return Promise.resolve({ texture: makeTextTexture(page, index, total), aspect: 2 });
  }
  if (page.contentType === "image") return ensureImage(page);
  if (page.contentType === "video") return ensureVideo(page);
  return Promise.reject(new Error("此內容類型不使用 3D 平面"));
}

/**
 * 暫停目前播放中的影片，並隱藏聲音按鈕。
 * 換頁、關面板、離開 AR 時都會呼叫。
 */
export function stopActiveVideo() {
  if (arState.activeVideo) {
    try { arState.activeVideo.pause(); } catch (err) { /* noop */ }
    arState.activeVideo = null;
  }
  arDom.videoSoundBtn.hidden = true;
}

/**
 * 釋放所有 target 的快取材質與隱藏影片。
 *
 * `texture.dispose()` 只釋放 GPU 資源，不會自動清掉 JS 參照；所以這裡
 * 也把 `_textTexture` 等欄位設回 null，否則下一次 startAr 會拿到已
 * 銷毀的材質。
 *
 * @param {Array<object>} [targets] 預設為目前 arState.targets。
 */
export function disposePageCaches(targets = arState.targets) {
  targets.forEach((target) => {
    [target._textTexture, target._imageTexture, target._videoTexture].forEach((texture) => {
      if (texture) { try { texture.dispose(); } catch (err) { /* noop */ } }
    });
    if (target._video) {
      try { target._video.pause(); } catch (err) { /* noop */ }
      try { target._video.remove(); } catch (err) { /* noop */ }
    }
    target._textTexture = null;
    target._imageTexture = null;
    target._imagePromise = null;
    target._videoTexture = null;
    target._videoPromise = null;
    target._video = null;
    target._aspect = null;
  });
  arState.activeVideo = null;
}
