/**
 * 卡蓋清單與內容編輯器。
 *
 * 這裡的 HTML 是用 template string 產生的；所有使用者輸入都必須先
 * `escapeHtml`，否則檔名/標題可以注入 markup。事件則用委派綁在
 * `#cards` 上，這樣每次 renderCards() 重建卡片時不必重新綁定。
 */
import { MAX_TARGETS, TYPE_LABELS } from "../../config.js";
import { studioState as state } from "../state.js";
import { studioDom as dom } from "../dom.js";
import { byteLabel, escapeHtml, pad2 } from "../../utils/format.js";
import {
  contentAccept,
  contentFileLimit,
  defaultLabelFromFile,
  isAllowedContentFile,
  loadImage,
  prepareImageForCompiler
} from "../../utils/files.js";
import { toast } from "../../shared/toast.js";
import { checkUpload } from "../cloud.js";
import { updateEnterButton } from "./enter-button.js";

/**
 * 依內容型態產生編輯器 HTML。
 * text 用 textarea；videoLink/webpage 用 URL；image/video/pdf 用檔案選擇。
 *
 * @param {object} target
 * @returns {string}
 */
function renderContentEditor(target) {
  if (target.contentType === "text") {
    return `
      <label class="field">
        <span>文字內容</span>
        <textarea data-field="text" maxlength="1200" rows="4"
          placeholder="姓名、職稱、技能、簡介……">${escapeHtml(target.text)}</textarea>
      </label>
      <p class="editor-note">文字會變成一張平面的資訊卡。</p>
    `;
  }

  if (target.contentType === "videoLink" || target.contentType === "webpage") {
    const isVideo = target.contentType === "videoLink";
    return `
      <label class="field">
        <span>${isVideo ? "影片網址" : "網頁網址"}</span>
        <input type="url" data-field="url" value="${escapeHtml(target.url)}"
          placeholder="${isVideo ? "https://youtu.be/… 或 https://…/video.mp4" : "https://example.com"}" />
      </label>
      <p class="editor-note">${isVideo ? "YouTube／Vimeo 會用下方互動面板播放；直接 MP4 連結也可以。" : "會用下方互動面板開啟；如果網站禁止嵌入，請按面板上的「另開」。"}</p>
    `;
  }

  const hasFile = Boolean(target.contentObjectUrl);
  const preview = hasFile && target.contentType === "image"
    ? `<div class="content-preview"><img src="${escapeHtml(target.contentObjectUrl)}" alt="內容照片預覽" /><span class="file-name">${escapeHtml(target.contentName)}</span></div>`
    : hasFile
      ? `<div class="content-preview"><span class="file-icon">${target.contentType === "pdf" ? "PDF" : "VIDEO"}</span><span class="file-name">${escapeHtml(target.contentName)} · ${byteLabel(target.contentSize)}</span></div>`
      : "";

  return `
    <div class="file-row">
      <label class="file-btn">
        <input type="file" data-content-file data-kind="${target.contentType}"
          accept="${contentAccept(target.contentType)}" hidden />
        ${hasFile ? "更換檔案" : "選擇檔案"}
      </label>
      <span class="file-name">${hasFile ? escapeHtml(target.contentName) + " · " + byteLabel(target.contentSize) : "尚未選擇檔案"}</span>
    </div>
    ${preview}
    <p class="editor-note">${
      target.contentType === "image"
        ? "照片會保持原本比例，不會被拉伸。"
        : target.contentType === "video"
          ? "MP4／WebM；進入 AR 後預設靜音播放，點右下角可以開聲音。"
          : "PDF 會用下方文件面板開啟；若手機不支援嵌入，請按「另開」。"
    }</p>
  `;
}

/**
 * 重畫整個卡蓋清單，並同步 badge、dropzone 與進入按鈕狀態。
 * 這個函式是 idempotent 的：任何 target 變更後都可以直接呼叫。
 */
export function renderCards() {
  dom.cards.innerHTML = state.targets.map((target, index) => {
    const typeOptions = Object.entries(TYPE_LABELS).map(([value, label]) =>
      `<option value="${value}"${target.contentType === value ? " selected" : ""}>${label}</option>`
    ).join("");

    return `
      <article class="target-card" data-id="${target.id}">
        <div class="target-top">
          <div class="thumb">
            <img src="${escapeHtml(target.previewUrl)}" alt="卡蓋圖案 ${index + 1} 預覽" />
            <span class="thumb-index">${pad2(index + 1)}</span>
          </div>
          <div class="target-fields">
            <label class="field">
              <span>名稱／HUD 標題</span>
              <input data-field="label" maxlength="40" value="${escapeHtml(target.label)}"
                placeholder="例如：個人資料 / 作品集" autocomplete="off" />
            </label>
            <label class="field">
              <span>內容類型</span>
              <select data-field="contentType">${typeOptions}</select>
            </label>
          </div>
          <button class="remove-btn" type="button" data-remove aria-label="移除第 ${index + 1} 個圖案">×</button>
        </div>
        <div class="content-editor">${renderContentEditor(target)}</div>
      </article>
    `;
  }).join("");

  dom.emptyHint.hidden = state.targets.length > 0;
  dom.countBadge.textContent = state.targets.length + " / " + MAX_TARGETS;
  dom.dropZone.classList.toggle("is-full", state.targets.length >= MAX_TARGETS);
  dom.fileInput.disabled = state.adding || state.restoring || state.targets.length >= MAX_TARGETS;
  updateEnterButton();
}

/** 用 data-id 找 target；id 可能是字串或數字，所以兩邊都轉字串比對。 */
function findTargetById(id) {
  return state.targets.find((target) => String(target.id) === String(id));
}

/**
 * 接收使用者選取/拖放的檔案，轉成卡蓋 target。
 *
 * 只接受圖片；最多 8 張。每張圖會先經過 `prepareImageForCompiler`
 * 縮到編譯尺寸，避免把 4000px 的手機照片直接丟進 MindAR。
 *
 * @param {FileList|File[]} fileList
 * @returns {Promise<void>}
 */
async function addFiles(fileList) {
  if (state.adding) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const images = files.filter((file) =>
    (file.type && file.type.startsWith("image/")) ||
    /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif)$/i.test(file.name)
  );
  if (images.length !== files.length) toast("已忽略非圖片檔案。");

  const remaining = MAX_TARGETS - state.targets.length;
  if (remaining <= 0) { toast("最多只能上傳 " + MAX_TARGETS + " 張卡蓋圖案。"); return; }
  const accepted = images.slice(0, remaining);
  if (images.length > remaining) toast("最多 " + MAX_TARGETS + " 張，本次先加入前 " + remaining + " 張。");
  if (!accepted.length) return;

  state.adding = true;
  dom.dropZone.classList.add("is-busy");
  dom.fileInput.disabled = true;
  updateEnterButton();

  let failed = 0;
  for (const file of accepted) {
    let previewUrl = null;
    try {
      previewUrl = URL.createObjectURL(file);
      const original = await loadImage(previewUrl);
      const prepared = await prepareImageForCompiler(original);
      state.targets.push({
        id: ++state.uid,
        file,
        previewUrl,
        img: prepared,
        label: defaultLabelFromFile(file, state.targets.length),
        contentType: "text",
        text: "",
        url: "",
        contentFile: null,
        contentObjectUrl: null,
        contentName: "",
        contentSize: 0,
        contentMime: ""
      });
    } catch (err) {
      failed++;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      console.error("[ID Card] 卡蓋圖案讀取失敗", file.name, err);
    }
  }

  state.adding = false;
  dom.dropZone.classList.remove("is-busy");
  dom.fileInput.disabled = false;
  dom.fileInput.value = "";
  renderCards();
  if (failed) toast(failed + " 張圖片讀取失敗，請換一張試試。");
}

/** 清掉某個 target 的內容檔與 object URL；切換型態或移除卡片時使用。 */
function clearTargetContentFile(target) {
  if (target.contentObjectUrl) URL.revokeObjectURL(target.contentObjectUrl);
  target.contentObjectUrl = null;
  target.contentFile = null;
  target.contentName = "";
  target.contentSize = 0;
  target.contentMime = "";
}

/**
 * 驗證並設定單一 target 的內容檔。
 * 先清舊檔再設新檔，確保切換檔案時不會留下舊的 object URL。
 *
 * @param {object} target
 * @param {string} kind image/video/pdf
 * @param {File|undefined} file
 */
function chooseContentFile(target, kind, file) {
  if (!file) return;
  if (!isAllowedContentFile(kind, file)) { toast("這個檔案類型不符合。"); return; }
  const max = contentFileLimit(kind);
  if (max && file.size > max) { toast("檔案太大，建議小於 " + byteLabel(max) + "。", 5200); return; }
  // 雲端上傳上限比本機編譯上限更嚴；先在這裡擋，免得對方上傳、
  // 編譯完才在存檔時失敗。
  const cloudKind = kind === "image" ? "photo" : kind;
  if (cloudKind === "photo" || cloudKind === "video" || cloudKind === "pdf") {
    const used = state.targets.reduce((sum, item) => sum + (item.contentSize || 0), 0);
    const check = checkUpload(cloudKind, file, used);
    if (!check.ok) { toast(check.message, 6000); return; }
  }
  clearTargetContentFile(target);
  target.contentFile = file;
  target.contentObjectUrl = URL.createObjectURL(file);
  target.contentName = file.name;
  target.contentSize = file.size;
  target.contentMime = file.type || (kind === "pdf" ? "application/pdf" : kind);
  renderCards();
}

/**
 * 綁定上傳、內容編輯、移除與拖放事件；由 initApp() 呼叫一次。
 * 因為卡片是動態重建的，這裡全部使用事件委派。
 */
export function initTargets() {
  dom.fileInput.addEventListener("change", () => addFiles(dom.fileInput.files));

  dom.cards.addEventListener("input", (event) => {
    const field = event.target.getAttribute("data-field");
    if (!field || field === "contentType") return;
    const cardEl = event.target.closest(".target-card");
    if (!cardEl) return;
    const target = findTargetById(cardEl.dataset.id);
    if (!target) return;
    target[field] = event.target.value;
    updateEnterButton();
  });

  dom.cards.addEventListener("change", (event) => {
    const cardEl = event.target.closest(".target-card");
    if (!cardEl) return;
    const target = findTargetById(cardEl.dataset.id);
    if (!target) return;

    if (event.target.getAttribute("data-field") === "contentType") {
      const nextType = event.target.value;
      if ((target.contentType === "video" || target.contentType === "image" || target.contentType === "pdf") &&
          nextType !== target.contentType) {
        clearTargetContentFile(target);
      }
      target.contentType = nextType;
      renderCards();
      return;
    }

    if (event.target.hasAttribute("data-content-file")) {
      chooseContentFile(target, event.target.getAttribute("data-kind"), event.target.files && event.target.files[0]);
    }
  });

  dom.cards.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-remove]");
    if (!removeBtn || state.adding) return;
    const cardEl = removeBtn.closest(".target-card");
    if (!cardEl) return;
    const index = state.targets.findIndex((target) => String(target.id) === String(cardEl.dataset.id));
    if (index === -1) return;
    const [removed] = state.targets.splice(index, 1);
    if (removed) {
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      clearTargetContentFile(removed);
    }
    renderCards();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (state.targets.length < MAX_TARGETS && !state.adding) dom.dropZone.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropZone.classList.remove("drag");
    });
  });
  dom.dropZone.addEventListener("drop", (event) => {
    if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
  });
}
