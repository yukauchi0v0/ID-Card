/**
 * 把製作端的編輯狀態轉成 viewer 讀的 `card.json`。
 *
 * manifest 是兩端唯一的契約：viewer 不需要知道 studio 的 File/Blob、
 * 也不需要原始卡蓋圖，只要這份 JSON 加上同層的 card.mind 與 media/。
 * 改動欄位時要同步檢查 `js/viewer/manifest.js` 的 normalize。
 */
import { CARD_H, DEFAULT_SETTINGS } from "../config.js";
import { slugify } from "../utils/slug.js";
import { normalizeLinks } from "../shared/social.js";

/**
 * 取得卡蓋圖的寬高比（height / width）。
 * 優先使用 target 上已算好的 markerAspect；沒有原始 img 時退回標準卡片比例。
 *
 * @param {object} target
 * @returns {number}
 */
export function markerAspect(target) {
  if (Number(target.markerAspect) > 0) return Number(target.markerAspect);
  const img = target.img;
  if (img && img.width) return (img.height || 1) / img.width;
  return CARD_H;
}

/**
 * 建立發布用 manifest。
 *
 * @param {object} options
 * @param {object} options.profile 名片資料（name/title/company/phone/email/website/slug/links）。
 * @param {Array<object>} options.targets 卡蓋與內容。
 * @param {object} options.settings AR 顯示設定。
 * @param {Array<string|undefined>} [options.mediaPaths] 與 targets 同索引的 media 相對路徑。
 * @returns {object} 可直接 JSON.stringify 的 manifest。
 */
export function buildCardManifest({ profile, targets, settings, mediaPaths = [] }) {
  const slug = slugify(profile.slug || profile.name);
  return {
    version: 1,
    slug,
    profile: {
      name: profile.name || "",
      title: profile.title || "",
      company: profile.company || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || "",
      // 社群聯絡方式只留已知平台與非空帳號；觀看端會再驗證一次網址。
      links: normalizeLinks(profile.links)
    },
    settings: Object.assign({}, DEFAULT_SETTINGS, settings || {}),
    mind: "card.mind",
    targets: targets.map((target, index) => {
      const page = {
        label: target.label || "內容 " + (index + 1),
        contentType: target.contentType,
        text: target.text || "",
        url: target.url || "",
        markerAspect: markerAspect(target)
      };
      // 只有檔案型內容（image/video/pdf）才會有 media；文字與連結不需要。
      if (mediaPaths[index]) {
        page.media = mediaPaths[index];
        page.mediaName = target.contentName || "";
        page.mediaMime = target.contentMime || "";
      }
      return page;
    })
  };
}
