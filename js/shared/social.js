/**
 * 名片上的社群聯絡方式：正規化、產生安全網址、組成 vCard。
 *
 * 這些函式刻意保持純函式（不碰 DOM），因為製作端、觀看端與 Node 測試
 * 都要用同一套規則。任何要放進 `href` 的網址都必須先經過
 * `isSafeHttpUrl()`，避免使用者貼上的 `javascript:` / `data:` 變成
 * 可點的連結；vCard 的文字也要轉義，避免姓名裡的換行被解讀成額外欄位。
 */
import { SOCIAL_PLATFORMS } from "../config.js";
import { isHttpUrl, normalizeHttpUrl } from "../utils/format.js";

// 單一帳號的長度上限；與製作端輸入框的 maxlength 一致。
const MAX_ACCOUNT = 120;
// 名片上最多顯示幾個聯絡按鈕（含電話與 Email）。
const MAX_ACTIONS = 8;

function platformById(id) {
  return SOCIAL_PLATFORMS.find((platform) => platform.id === id) || null;
}

/**
 * 判斷網址是否為安全的 http(s)。
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeHttpUrl(value) {
  return isHttpUrl(value);
}

/**
 * 把任意輸入正規化成清單。
 * 非陣列一律視為空；未知平台、空白帳號與重複平台都會被丟掉，
 * 這樣舊資料或手動改壞的 manifest 也不會讓觀看端炸掉。
 *
 * @param {unknown} value
 * @returns {Array<{ platform: string, account: string }>}
 */
export function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const links = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const platform = typeof item.platform === "string" ? item.platform : "";
    const account = typeof item.account === "string" ? item.account.trim() : "";
    if (!account || seen.has(platform) || !platformById(platform)) continue;
    // 壞掉的網址（javascript:、只有空白…）在這裡就丟掉，不寫進資料庫。
    const link = { platform, account: account.slice(0, MAX_ACCOUNT) };
    if (!isUsableLink(link)) continue;
    seen.add(platform);
    links.push(link);
    if (links.length >= MAX_ACTIONS) break;
  }
  return links;
}

/**
 * 取得某個平台要顯示的名稱；未知平台回空字串。
 *
 * @param {{ platform: string }} link
 * @returns {string}
 */
export function contactLabel(link) {
  const platform = platformById(link && link.platform);
  return platform ? platform.label : "";
}

/**
 * 把「帳號或網址」轉成可點擊的網址。
 * - 貼完整 http(s) 網址：直接使用。
 * - 只填帳號：用平台前綴組成網址（`@linyi` → `https://instagram.com/linyi`）。
 * - 其他網站（custom）必須是完整網址。
 *
 * @param {{ platform: string, account: string }} link
 * @returns {string} 不安全或無法組成時回空字串。
 */
export function contactHref(link) {
  if (!link) return "";
  const account = String(link.account || "").trim();
  if (!account) return "";
  // 帶 scheme 但不是 http(s) 的輸入（javascript:、data:、mailto: …）一律視為
  // 壞資料，連存進資料庫都不必：它不可能變成可點的安全連結。
  if (/^[a-z][a-z0-9+.\-]*:/i.test(account) && !isSafeHttpUrl(account)) return "";
  if (isSafeHttpUrl(account)) return new URL(account).href;
  const platform = platformById(link.platform);
  if (!platform || !platform.httpPrefix) return "";
  const handle = account.replace(/^@+/, "").replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-");
  if (!handle) return "";
  const href = platform.httpPrefix + encodeURIComponent(handle).replace(/%2F/gi, "/");
  return isSafeHttpUrl(href) ? href : "";
}

/**
 * 判斷一筆連結在名片上是否真的會產生按鈕。
 *
 * @param {unknown} link
 * @returns {boolean}
 */
export function isUsableLink(link) {
  return Boolean(link && contactHref(link));
}

/**
 * 名片上要顯示的聯絡按鈕：社群連結 → 電話 → Email，最多 8 個。
 *
 * @param {object} profile
 * @returns {Array<{ kind: "link"|"call"|"mail", href: string, label: string, external: boolean }>}
 */
export function contactActions(profile = {}) {
  const actions = [];
  normalizeLinks(profile.links).forEach((link) => {
    const href = contactHref(link);
    if (!href) return;
    actions.push({ kind: "link", href, label: contactLabel(link), external: true });
  });

  const phone = String(profile.phone || "").replace(/\s+/g, "");
  if (phone) actions.push({ kind: "call", href: "tel:" + phone, label: "撥號", external: false });

  const email = String(profile.email || "").trim();
  if (email) actions.push({ kind: "mail", href: "mailto:" + email, label: "寄 Email", external: false });

  return actions.slice(0, MAX_ACTIONS);
}

/**
 * vCard 3.0 的文字转義：反斜線、換行、逗號與分號。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeVCard(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * 下載用的檔名：去掉作業系統不允許的字元。
 *
 * @param {unknown} name
 * @returns {string} 例如 `林一.vcf`
 */
export function vCardFileName(name) {
  const base = String(name || "").trim() || "id-card";
  const safe = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (safe || "id-card") + ".vcf";
}

/**
 * 產生 vCard 3.0 內容（每行以 \r\n 結尾）。
 * `FN` 優先使用姓名，沒有姓名時用公司，兩者皆空才用 `ID Card`；
 * 社群連結以 `X-SOCIALPROFILE` 附上，讓支援的通訊錄 App 能顯示成社群帳號。
 *
 * @param {object} profile
 * @returns {string}
 */
export function toVCard(profile = {}) {
  const name = String(profile.name || "").trim();
  const company = String(profile.company || "").trim();
  const display = name || company || "ID Card";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:" + escapeVCard(name),
    "FN:" + escapeVCard(display)
  ];

  const title = String(profile.title || "").trim();
  if (title) lines.push("TITLE:" + escapeVCard(title));
  if (company) lines.push("ORG:" + escapeVCard(company));

  const phone = String(profile.phone || "").replace(/[^\d+()\-]/g, "");
  if (phone) lines.push("TEL;TYPE=CELL:" + phone);

  const email = String(profile.email || "").trim();
  if (email) lines.push("EMAIL;TYPE=INTERNET:" + escapeVCard(email));

  // 網站欄位常常只填 `example.com`；補成 https 後才放進 vCard，
  // 否則通訊錄 App 會顯示一個點不開的網址。
  const website = normalizeHttpUrl(profile.website);
  if (website) lines.push("URL:" + escapeVCard(website));

  normalizeLinks(profile.links).forEach((link) => {
    const href = contactHref(link);
    if (href) lines.push("X-SOCIALPROFILE;TYPE=" + link.platform + ":" + escapeVCard(href));
  });

  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}
