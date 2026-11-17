import { PANEL_TYPES, TYPE_LABELS } from "../config.js";
import { state } from "../state.js";
import { dom } from "../dom.js";
import { pad2 } from "../utils/format.js";
import { isDirectVideoUrl, isEmbedVideo, toEmbedUrl } from "../media/embeds.js";
import { updateHud } from "../ui/hud.js";
import { emit } from "../events.js";

export function openPanel(pageIndex) {
  const page = state.targets[pageIndex];
  if (!page) return;
  state.panelPage = pageIndex;
  state.panelOpen = true;
  dom.panelTitle.textContent = page.label || "內容 " + pad2(pageIndex + 1);
  dom.panelKicker.textContent = TYPE_LABELS[page.contentType] + " · " + pad2(pageIndex + 1) + " / " + pad2(state.targets.length);
  dom.panelOpenExternal.href = page.contentType === "pdf" ? page.contentObjectUrl : (page.contentObjectUrl || page.url || "#");
  dom.panelBody.replaceChildren();

  if (page.contentType === "pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = page.contentObjectUrl;
    iframe.title = dom.panelTitle.textContent;
    dom.panelBody.appendChild(iframe);
  } else if (page.contentType === "webpage") {
    const iframe = document.createElement("iframe");
    iframe.src = page.url;
    iframe.title = dom.panelTitle.textContent;
    iframe.setAttribute("allow", "fullscreen; autoplay; clipboard-write");
    dom.panelBody.appendChild(iframe);
  } else if (page.contentType === "videoLink") {
    if (isDirectVideoUrl(page.url)) {
      const video = document.createElement("video");
      video.src = page.url;
      video.controls = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      dom.panelBody.appendChild(video);
    } else {
      const iframe = document.createElement("iframe");
      iframe.src = isEmbedVideo(page.url) ? toEmbedUrl(page.url) : page.url;
      iframe.title = dom.panelTitle.textContent;
      iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      dom.panelBody.appendChild(iframe);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.textContent = "這個內容類型目前不使用面板。";
    dom.panelBody.appendChild(empty);
  }

  dom.contentPanel.classList.add("open");
  dom.contentPanel.removeAttribute("aria-hidden");
  dom.contentPanel.removeAttribute("inert");
  document.body.classList.add("panel-open");
  dom.panelOpenBtn.hidden = true;
  updateHud();
}

export function closePanel() {
  state.panelOpen = false;
  dom.panelBody.replaceChildren();
  dom.contentPanel.classList.remove("open");
  dom.contentPanel.setAttribute("aria-hidden", "true");
  dom.contentPanel.setAttribute("inert", "");
  document.body.classList.remove("panel-open");
  updateHud();
}

export function initPanel() {
  dom.panelClose.addEventListener("click", closePanel);
  dom.panelOpenBtn.addEventListener("click", () => {
    if (!state.interactive) return;
    const page = state.targets[state.currentPage];
    if (page && PANEL_TYPES.has(page.contentType)) openPanel(state.currentPage);
  });
  dom.panelPrev.addEventListener("click", () => emit("page:request", state.currentPage - 1));
  dom.panelNext.addEventListener("click", () => emit("page:request", state.currentPage + 1));
}
