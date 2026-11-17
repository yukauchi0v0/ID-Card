/**
 * 底部內容面板。
 *
 * 只有「不能在 3D 平面顯示」的內容型態會用到：PDF、互動網頁、影片連結。
 * 面板重用同一個 DOM，依型態換掉 body 內容；關閉時清空 iframe/video，
 * 避免媒體在背景繼續播放或佔用記憶體。
 */
import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { pad2 } from "../utils/format.js";
import { isDirectVideoUrl, isEmbedVideo, toEmbedUrl } from "../media/embeds.js";
import { updateHud } from "./hud.js";
import { emit } from "../events.js";

/**
 * 打開指定頁面的內容面板。
 *
 * iframe 沒有 sandbox，因為 PDF viewer 與部分互動網頁需要完整功能；
 * 發布端只接受 http(s) 網址，viewer 的 manifest 也會先驗證。
 *
 * @param {number} pageIndex
 */
export function openPanel(pageIndex) {
  const page = arState.targets[pageIndex];
  if (!page) return;
  arState.panelPage = pageIndex;
  arState.panelOpen = true;
  arDom.panelTitle.textContent = page.label || "內容 " + pad2(pageIndex + 1);
  arDom.panelKicker.textContent = TYPE_LABELS[page.contentType] + " · " + pad2(pageIndex + 1) + " / " + pad2(arState.targets.length);
  arDom.panelOpenExternal.href = page.contentType === "pdf" ? page.contentObjectUrl : (page.contentObjectUrl || page.url || "#");
  arDom.panelBody.replaceChildren();

  // 依內容型態建立不同的播放器/檢視器；每次先清空，避免舊 iframe
  // 還留在 DOM 裡繼續載入。
  if (page.contentType === "pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = page.contentObjectUrl;
    iframe.title = arDom.panelTitle.textContent;
    arDom.panelBody.appendChild(iframe);
  } else if (page.contentType === "webpage") {
    const iframe = document.createElement("iframe");
    iframe.src = page.url;
    iframe.title = arDom.panelTitle.textContent;
    iframe.setAttribute("allow", "fullscreen; autoplay; clipboard-write");
    arDom.panelBody.appendChild(iframe);
  } else if (page.contentType === "videoLink") {
    if (isDirectVideoUrl(page.url)) {
      const video = document.createElement("video");
      video.src = page.url;
      video.controls = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      arDom.panelBody.appendChild(video);
    } else {
      const iframe = document.createElement("iframe");
      iframe.src = isEmbedVideo(page.url) ? toEmbedUrl(page.url) : page.url;
      iframe.title = arDom.panelTitle.textContent;
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      arDom.panelBody.appendChild(iframe);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.textContent = "這個內容類型目前不使用面板。";
    arDom.panelBody.appendChild(empty);
  }

  // aria-hidden + inert：面板關閉時，鍵盤與螢幕閱讀器都不會進入
  // 仍在 DOM 裡的內容。
  arDom.contentPanel.classList.add("open");
  arDom.contentPanel.removeAttribute("aria-hidden");
  arDom.contentPanel.removeAttribute("inert");
  document.body.classList.add("panel-open");
  arDom.panelOpenBtn.hidden = true;
  updateHud();
}

/**
 * 關閉面板並清空內容。
 * `updateHud()` 會恢復「開啟內容面板」按鈕的可見性。
 */
export function closePanel() {
  arState.panelOpen = false;
  arDom.panelBody.replaceChildren();
  arDom.contentPanel.classList.remove("open");
  arDom.contentPanel.setAttribute("aria-hidden", "true");
  arDom.contentPanel.setAttribute("inert", "");
  document.body.classList.remove("panel-open");
  updateHud();
}

/**
 * 綁定面板的一次性事件；由 `initArUi()` 呼叫。
 * 上一頁/下一頁只發事件，讓 content.js 統一處理換頁與頁碼環繞。
 */
export function initPanel() {
  arDom.panelClose.addEventListener("click", closePanel);
  arDom.panelOpenBtn.addEventListener("click", () => {
    if (!arState.interactive) return;
    const page = arState.targets[arState.currentPage];
    if (page && PANEL_TYPES.has(page.contentType)) openPanel(arState.currentPage);
  });
  arDom.panelPrev.addEventListener("click", () => emit("page:request", arState.currentPage - 1));
  arDom.panelNext.addEventListener("click", () => emit("page:request", arState.currentPage + 1));
}
