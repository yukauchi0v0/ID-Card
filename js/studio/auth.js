/**
 * 製作端的登入狀態（email magic link）。
 *
 * 這是 Supabase Auth 的薄包裝：畫面層只透過這裡取得「目前是誰」，
 * 不直接呼叫 SDK，之後要換登入方式時只需要改這個檔案。
 *
 * 未登入時所有函式回傳 null 或丟出可讀的中文錯誤，
 * 呼叫端負責顯示提示，而不是讓例外冒到 console。
 */
import { getClient } from "../shared/supabase.js";

const NO_CLOUD = "雲端服務未載入，請重新整理頁面。";

/**
 * 登入完成後要回到的網址。
 *
 * 必須去掉 query 與 hash：magic link 回來時 URL 上會帶 `?code=...`，
 * 若把整個網址當成 redirect 目標，下次寄信時就會把舊的 code 再帶一次。
 *
 * @param {string} [locationHref] 方便測試注入的完整網址。
 * @returns {string} 不含 query/hash 的絕對網址。
 */
export function authRedirectUrl(locationHref = window.location.href) {
  const url = new URL(locationHref);
  url.search = "";
  url.hash = "";
  return url.href;
}

/**
 * 取得目前的 session；未登入回傳 null。
 * @returns {Promise<{user: {id: string, email: string}}|null>}
 */
export async function getSession() {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error("讀取登入狀態失敗：" + error.message);
  return data.session || null;
}

/**
 * 寄出 magic link。
 *
 * `shouldCreateUser: true` 讓第一次寄信的人自動建立帳號，
 * 不需要另外做註冊流程。
 *
 * @param {string} email
 */
export async function signInWithEmail(email) {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: authRedirectUrl(),
      shouldCreateUser: true
    }
  });
  if (error) throw new Error("寄出登入連結失敗：" + error.message);
}

/**
 * 登出目前帳號。
 */
export async function signOut() {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { error } = await client.auth.signOut();
  if (error) throw new Error("登出失敗：" + error.message);
}

/**
 * 訂閱登入狀態變化（登入、登出、token 更新）。
 *
 * @param {(session: object|null) => void} handler
 * @returns {() => void} 取消訂閱。
 */
export function onAuthChange(handler) {
  const client = getClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    handler(session || null);
  });
  return () => {
    if (data && data.subscription) data.subscription.unsubscribe();
  };
}
