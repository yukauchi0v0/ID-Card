/**
 * Supabase client 的唯一入口。
 *
 * `vendor/supabase.js` 是 UMD 版本，載入後掛在 `window.supabase`。
 * 這裡只建立一次 client 並重複使用，避免每個模組各自 new 一個、
 * 造成 session listener 重複註冊。
 *
 * 頁面若沒載入 bundle（例如舊的快取 HTML），`getClient()` 會回傳 null，
 * 呼叫端要自行處理「雲端功能暫時不可用」的情況，而不是直接爆掉。
 */
import { SUPABASE_KEY, SUPABASE_URL } from "../config.public.js";

let client = null;
// 舊的 magic link 連結格式不同，SDK 會嘗試交換失敗並印出網址錯誤；
// 我們自己處理錯誤訊息（見 cloud-ui.js），因此把這幾種 log 收掉。
let urlLogsSilenced = false;

/**
 * vendor bundle 是否已載入。
 * @returns {boolean}
 */
export function isCloudConfigured() {
  return Boolean(window.supabase && typeof window.supabase.createClient === "function");
}

/**
 * 取得（必要時建立）Supabase client。
 *
 * 使用 pkce 流程：magic link 回來時由 SDK 自動交換 token，
 * 不需要我們手動解析 URL fragment。
 *
 * @returns {object|null} client；bundle 未載入時為 null。
 */
export function getClient() {
  if (!isCloudConfigured()) return null;
  if (!client) {
    silenceUrlErrors();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        // 明確指定 storageKey：不同版本的 SDK 對「專案 ref」推導方式曾
        // 改過，固定成官方格式（sb-<project-ref>）才不會換版後讀不到
        // 舊的登入狀態，逼使用者重新登入。
        storageKey: storageKey(),
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        autoRefreshToken: true
      }
    });
  }
  return client;
}

/** 由專案 URL 推出 Supabase 慣用的 localStorage 鍵名。 */
function storageKey() {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  return "sb-" + ref + "-auth-token";
}

/**
 * 把 GoTrue 的 console.error 收掉。
 *
 * 只要網址上還帶著 `?code=` 或 `#access_token=`（例如使用者直接重新整理
 * 登入回來的網址、或連結已用過），SDK 就會嘗試交換並失敗，然後自己印出
 * 一整行英文錯誤。使用者看到的應該是 cloud-ui.js 寫在登入面板裡的中文
 * 說明，而不是 console 的紅字，所以這裡只過濾「網址參數相關」的訊息，
 * 其他錯誤照常顯示。
 */
function silenceUrlErrors() {
  if (urlLogsSilenced || typeof console === "undefined") return;
  urlLogsSilenced = true;
  const original = console.error;
  const patterns = [/code verifier/i, /auth code/i, /access_token/i, /PKCE/i, /\burl\b/i];
  console.error = function (...args) {
    const text = args
      .map((arg) => (typeof arg === "string" ? arg : arg && arg.message ? String(arg.message) : ""))
      .join(" ");
    if (patterns.some((pattern) => pattern.test(text))) return;
    original.apply(console, args);
  };
}
