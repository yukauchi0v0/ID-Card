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

function three() {
  return window.AFRAME.THREE;
}

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

export function getPageMedia(page, index, total) {
  if (page.contentType === "text") {
    return Promise.resolve({ texture: makeTextTexture(page, index, total), aspect: 2 });
  }
  if (page.contentType === "image") return ensureImage(page);
  if (page.contentType === "video") return ensureVideo(page);
  return Promise.reject(new Error("此內容類型不使用 3D 平面"));
}

export function stopActiveVideo() {
  if (arState.activeVideo) {
    try { arState.activeVideo.pause(); } catch (err) { /* noop */ }
    arState.activeVideo = null;
  }
  arDom.videoSoundBtn.hidden = true;
}

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
