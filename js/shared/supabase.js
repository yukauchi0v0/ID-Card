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
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        autoRefreshToken: true
      }
    });
  }
  return client;
}
