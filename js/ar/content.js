/**
 * AR 內容的排版與換頁。
 *
 * 把「哪一頁要顯示什麼、放在卡片的哪個位置」集中在這裡：
 * - 平面內容（文字/照片/影片）貼在 3D 平面上。
 * - 面板內容（PDF/網頁/影片連結）不建材質，直接開底部面板。
 *
 * `renderActivePage()` 是非同步的（照片/影片要載入），所以用
 * `arState.renderToken` 避免快速換頁時舊內容覆蓋新內容。
 */
import { CARD_H, CARD_W, CARD_W_CM, PANEL_TYPES } from "../config.js";
import { arState } from "./state.js";
import { clamp } from "../utils/format.js";
import { getPageMedia, stopActiveVideo } from "../media/textures.js";
import { closePanel, openPanel } from "./panel.js";
import { updateHud } from "./hud.js";
import { toast } from "../shared/toast.js";
import { on } from "../events.js";

/**
 * 隱藏所有 target 的內容平面，但保留 anchor 給 MindAR 使用。
 * 換頁、targetLost、載入失敗時都先呼叫，避免上一個內容短暫閃現。
 */
export function hideAllRoots() {
  arState.cards.forEach((card) => {
    if (card.rootEl && card.rootEl.object3D) card.rootEl.object3D.visible = false;
    if (card.mediaEl) card.mediaEl.setAttribute("visible", false);
    if (card.frameEl) card.frameEl.setAttribute("visible", false);
  });
}

/**
 * 依內容比例與使用者設定，把內容平面放到卡片周圍。
 *
 * 基礎寬度 0.82、最高 0.58（世界單位）；超過高度就等比例縮回。
 * 位置以「卡片中心」為原點，再依 above/below/left/right 加上間距。
 *
 * @param {object} card scene.js 建立的 card 物件。
 * @param {object} page 目前的 target/內容資料。
 * @param {number} aspect 內容寬高比。
 */
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

  // MindAR 的 target 寬度固定是 1；卡片高度取決於卡蓋圖的比例。
  // viewer 沒有原始 <img>，所以優先讀 manifest 的 markerAspect。
  const markerAspect = Number(page.markerAspect) > 0 ? Number(page.markerAspect) : CARD_H;
  const halfMarkerHeight = Math.max(CARD_H / 2, markerAspect / 2);

  // above/below 用卡片半高 + 間距 + 內容半高；left/right 則用卡片半寬。
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

/**
 * 渲染目前頁面。
 *
 * 面板型內容直接開面板；平面內容則等待材質載入。token 在函式一開始就
 * 遞增，載入完成後若 token 已變（代表使用者又換頁或離開 AR），就放棄
 * 這次結果，避免 async race。
 */
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

/**
 * MindAR 找到某個卡蓋時呼叫。
 *
 * 一次只顯示一個 target 的內容：其他 anchor 會被隱藏，避免兩個卡蓋
 * 同時入鏡時內容疊在一起。`everFound` 用來讓 HUD 區分「還沒掃到」與
 * 「掃到後又離開」。
 */
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

/**
 * 卡蓋離開畫面時呼叫。
 *
 * 只處理「目前鎖定的那個 target」；其他 target 的 Lost 事件不應把畫面
 * 清掉。renderToken 遞增可讓仍在載入中的內容知道要放棄。
 */
export function handleTargetLost(index) {
  if (arState.activeTarget !== index) return;
  arState.interactive = false;
  arState.renderToken++;
  stopActiveVideo();
  hideAllRoots();
  updateHud();
}

/**
 * 切換到指定頁碼；超出範圍時環繞（-1 → 最後一頁）。
 * 只有卡蓋鎖定時才允許換頁，避免掃描中誤觸。
 */
export function goToPage(page) {
  if (!arState.interactive || !arState.targets.length) return;
  const total = arState.targets.length;
  arState.currentPage = ((page % total) + total) % total;
  renderActivePage();
  updateHud();
}

// HUD 圓點與面板箭頭只發出 `page:request`，不直接 import 這個模組，
// 否則 content ↔ hud/panel 會形成循環依賴。
on("page:request", (page) => goToPage(page));
