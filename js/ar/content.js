import { CARD_H, CARD_W, CARD_W_CM, PANEL_TYPES } from "../config.js";
import { arState } from "./state.js";
import { clamp } from "../utils/format.js";
import { getPageMedia, stopActiveVideo } from "../media/textures.js";
import { closePanel, openPanel } from "./panel.js";
import { updateHud } from "./hud.js";
import { toast } from "../shared/toast.js";
import { on } from "../events.js";

export function hideAllRoots() {
  arState.cards.forEach((card) => {
    if (card.rootEl && card.rootEl.object3D) card.rootEl.object3D.visible = false;
    if (card.mediaEl) card.mediaEl.setAttribute("visible", false);
    if (card.frameEl) card.frameEl.setAttribute("visible", false);
  });
}

export function layoutCard(card, page, aspect) {
  const s = arState.settings;
  let width = 0.82;
  let height = width / (aspect || 1);
  if (height > 0.58) {
    height = 0.58;
    width = height * aspect;
  }
  width *= s.scale;
  height *= s.scale;

  const gap = s.gapCm / CARD_W_CM;
  let x = s.offsetXCm / CARD_W_CM;
  let y = s.offsetYCm / CARD_W_CM;
  const z = 0.012;

  // MindAR target width is 1; height follows the card-cover image aspect.
  // Use the manifest's markerAspect so viewer cards without an <img> work.
  const markerAspect = Number(page.markerAspect) > 0 ? Number(page.markerAspect) : CARD_H;
  const halfMarkerHeight = Math.max(CARD_H / 2, markerAspect / 2);

  if (s.position === "above") y += halfMarkerHeight + gap + height / 2;
  else if (s.position === "below") y -= halfMarkerHeight + gap + height / 2;
  else if (s.position === "left") x -= CARD_W / 2 + gap + width / 2;
  else if (s.position === "right") x += CARD_W / 2 + gap + width / 2;

  card.rootEl.setAttribute("position", x + " " + y + " " + z);
  card.mediaEl.setAttribute("width", width);
  card.mediaEl.setAttribute("height", height);
  card.frameEl.setAttribute("width", width + 0.026);
  card.frameEl.setAttribute("height", height + 0.026);
  card.currentSize = { width, height };
}

export async function renderActivePage() {
  const page = arState.targets[arState.currentPage];
  const card = arState.activeCard;
  const token = ++arState.renderToken;
  stopActiveVideo();
  hideAllRoots();

  if (!page || !card) return;

  if (PANEL_TYPES.has(page.contentType)) {
    openPanel(arState.currentPage);
    updateHud();
    return;
  }

  closePanel();
  try {
    const media = await getPageMedia(page, arState.currentPage, arState.targets.length);
    if (token !== arState.renderToken || arState.sceneEl === null) return;
    card.currentMedia = media;
    layoutCard(card, page, media.aspect);
    if (card.mediaMesh) {
      card.mediaMesh.material.map = media.texture;
      card.mediaMesh.material.needsUpdate = true;
    }
    card.mediaEl.setAttribute("visible", true);
    card.frameEl.setAttribute("visible", page.contentType === "image" || page.contentType === "video");
    card.rootEl.object3D.visible = true;
    if (page.contentType === "video" && page._video) {
      arState.activeVideo = page._video;
      page._video.muted = arState.videoMuted;
      page._video.play().catch(() => {
        toast("影片已載入；如果沒有自動播放，請點右下角的聲音按鈕。", 4200);
      });
    }
    updateHud();
  } catch (err) {
    console.error("[ID Card] 內容載入失敗", err);
    if (token !== arState.renderToken) return;
    toast("這一頁的內容載入失敗：" + (err.message || "請確認檔案格式。"), 5600);
    hideAllRoots();
    updateHud();
  }
}

export function handleTargetFound(index) {
  if (arState.sceneEl === null) return;
  arState.activeTarget = index;
  arState.activeCard = arState.cards[index] || null;
  arState.currentPage = clamp(index, 0, arState.targets.length - 1);
  arState.interactive = true;
  arState.everFound = true;
  arState.cards.forEach((card, cardIndex) => {
    if (cardIndex !== index && card.anchorEl && card.anchorEl.object3D) card.anchorEl.object3D.visible = false;
  });
  renderActivePage();
  updateHud();
}

export function handleTargetLost(index) {
  if (arState.activeTarget !== index) return;
  arState.interactive = false;
  arState.renderToken++;
  stopActiveVideo();
  hideAllRoots();
  updateHud();
}

export function goToPage(page) {
  if (!arState.interactive || !arState.targets.length) return;
  const total = arState.targets.length;
  arState.currentPage = ((page % total) + total) % total;
  renderActivePage();
  updateHud();
}

// Navigation is requested by HUD dots and panel arrows without importing
// this module (which would create a cycle).
on("page:request", (page) => goToPage(page));
