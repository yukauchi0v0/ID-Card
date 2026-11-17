import { CARD_H, DEFAULT_SETTINGS, MAX_TARGETS, TYPE_LABELS } from "../config.js";

function text(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeManifest(raw, baseUrl) {
  if (!raw || typeof raw !== "object") throw new Error("card.json 格式不正確");
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) throw new Error("card.json 沒有卡面資料");
  if (raw.targets.length > MAX_TARGETS) throw new Error("card.json 超過 " + MAX_TARGETS + " 張卡面");

  const mindUrl = new URL(raw.mind || "card.mind", baseUrl).href;
  const targets = raw.targets.map((item, index) => {
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

export async function loadManifest(url) {
  const absolute = new URL(url, window.location.href);
  const response = await fetch(absolute, { cache: "no-store" });
  if (!response.ok) throw new Error("讀不到卡片資料（HTTP " + response.status + "）");
  const raw = await response.json();
  return normalizeManifest(raw, absolute.href);
}
