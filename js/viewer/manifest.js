/**
 * 讀取並驗證發布包裡的 `card.json`。
 *
 * 這是 viewer 唯一信任的資料來源；所有相對路徑（card.mind、media/）都
 * 以 manifest 的 URL 為基準解析，因此同一包資料放在任何網域/子目錄都
 * 能運作。這裡也會把不合法/缺檔的卡片早點擋下來，避免 AR 啟動到一半
 * 才失敗。
 */
import { CARD_H, DEFAULT_SETTINGS, MAX_TARGETS, TYPE_LABELS } from "../config.js";

/** 只接受字串，其他型別（null/數字/物件）一律視為空字串。 */
function text(value) {
  return typeof value === "string" ? value : "";
}

/**
 * 把原始 JSON 正規化成 viewer 內部使用的 manifest。
 *
 * @param {object} raw 從 card.json 解析出的物件。
 * @param {string} baseUrl card.json 的絕對 URL，用來解析相對路徑。
 * @returns {object} `{ version, slug, profile, settings, mindUrl, targets }`
 * @throws {Error} 格式錯誤、target 數量不對、缺 media 或網址无效時。
 */
export function normalizeManifest(raw, baseUrl) {
  if (!raw || typeof raw !== "object") throw new Error("card.json 格式不正確");
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) throw new Error("card.json 沒有卡面資料");
  if (raw.targets.length > MAX_TARGETS) throw new Error("card.json 超過 " + MAX_TARGETS + " 張卡面");

  const mindUrl = new URL(raw.mind || "card.mind", baseUrl).href;
  const targets = raw.targets.map((item, index) => {
    // 未知名稱的 contentType 一律當文字，避免舊版 manifest 讓 viewer 崩潰。
    const contentType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, item.contentType)
      ? item.contentType : "text";
    const page = {
      id: index + 1,
      label: text(item.label) || "內容 " + (index + 1),
      contentType,
      text: text(item.text),
      url: text(item.url),
      markerAspect: Number(item.markerAspect) > 0 ? Number(item.markerAspect) : CARD_H,
      contentObjectUrl: null,
      contentName: text(item.mediaName),
      contentMime: text(item.mediaMime)
    };
    if (item.media) page.contentObjectUrl = new URL(item.media, baseUrl).href;
    if (["image", "video", "pdf"].includes(contentType) && !page.contentObjectUrl) {
      throw new Error("第 " + (index + 1) + " 頁缺少 media");
    }
    if (["webpage", "videoLink"].includes(contentType) && !/^https?:\/\//i.test(page.url)) {
      throw new Error("第 " + (index + 1) + " 頁網址無效");
    }
    return page;
  });

  return {
    version: Number(raw.version) || 1,
    slug: text(raw.slug),
    profile: {
      name: text(raw.profile && raw.profile.name),
      title: text(raw.profile && raw.profile.title),
      company: text(raw.profile && raw.profile.company),
      phone: text(raw.profile && raw.profile.phone),
      email: text(raw.profile && raw.profile.email),
      website: text(raw.profile && raw.profile.website)
    },
    settings: Object.assign({}, DEFAULT_SETTINGS, raw.settings || {}),
    mindUrl,
    targets
  };
}

/**
 * 下載 card.json 並正規化。
 *
 * `cache: "no-store"` 是刻意的：發布後重新整理應該看到最新內容，不應
 * 被瀏覽器快取住舊檔。
 *
 * @param {string} url 可能是相對路徑（來自 ?card=）。
 * @returns {Promise<object>}
 */
export async function loadManifest(url) {
  const absolute = new URL(url, window.location.href);
  const response = await fetch(absolute, { cache: "no-store" });
  if (!response.ok) throw new Error("讀不到卡片資料（HTTP " + response.status + "）");
  const raw = await response.json();
  return normalizeManifest(raw, absolute.href);
}
