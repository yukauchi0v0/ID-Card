import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { arState } from "./state.js";
import { arDom } from "./dom.js";
import { pad2 } from "../utils/format.js";
import { isDirectVideoUrl, isEmbedVideo, toEmbedUrl } from "../media/embeds.js";
import { updateHud } from "./hud.js";
import { emit } from "../events.js";

export function openPanel(pageIndex) {
  const page = arState.targets[pageIndex];
  if (!page) return;
  arState.panelPage = pageIndex;
  arState.panelOpen = true;
  arDom.panelTitle.textContent = page.label || "內容 " + pad2(pageIndex + 1);
  arDom.panelKicker.textContent = TYPE_LABELS[page.contentType] + " · " + pad2(pageIndex + 1) + " / " + pad2(arState.targets.length);
  arDom.panelOpenExternal.href = page.contentType === "pdf" ? page.contentObjectUrl : (page.contentObjectUrl || page.url || "#");
  arDom.panelBody.replaceChildren();

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

  arDom.contentPanel.classList.add("open");
  arDom.contentPanel.removeAttribute("aria-hidden");
  arDom.contentPanel.removeAttribute("inert");
  document.body.classList.add("panel-open");
  arDom.panelOpenBtn.hidden = true;
  updateHud();
}

export function closePanel() {
  arState.panelOpen = false;
  arDom.panelBody.replaceChildren();
  arDom.contentPanel.classList.remove("open");
  arDom.contentPanel.setAttribute("aria-hidden", "true");
  arDom.contentPanel.setAttribute("inert", "");
  document.body.classList.remove("panel-open");
  updateHud();
}

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
