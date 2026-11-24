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

/** Supabase 常見錯誤翻成看得懂的中文。 */
function friendlyAuthError(error) {
  const message = String((error && error.message) || "");
  const code = String((error && error.code) || "");
  if (/rate limit/i.test(message) || code === "over_email_send_rate_limit") {
    return "寄信太頻繁，暫時不能寄出登入連結。" +
      "Supabase 內建信箱每小時只能寄少量信件，請等一小時後再試，" +
      "或到 Supabase 的 Authentication → Users 手動寄一次，也可以改用自己的 SMTP。";
  }
  if (/signups not allowed|user not found/i.test(message)) {
    return "這個 email 還沒有帳號，而且目前不開放自動註冊。請改用管理員建立過的帳號。";
  }
  return message || "未知錯誤";
}

/**
 * 寄出登入連結。
 *
 * `shouldCreateUser` 預設為 true：第一次寄信的人自動建立帳號，
 * 不需要另外做註冊流程。若專案有 captcha 或關閉了註冊，可以傳 false
 * 只寄給已存在的帳號。
 *
 * @param {string} email
 * @param {{ shouldCreateUser?: boolean }} [options]
 */
export async function signInWithEmail(email, options = {}) {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: authRedirectUrl(),
      shouldCreateUser: options.shouldCreateUser !== false
    }
  });
  if (error) throw new Error("寄出登入連結失敗：" + friendlyAuthError(error));
}

/** 把 Supabase 的英文訊息整理成能直接顯示的中文。 */
export function describeAuthError(kind, error) {
  const message = String((error && error.message) || "");
  const code = String((error && error.code) || "");
  if (kind === "signin") {
    if (/invalid login credentials/i.test(message) || code === "invalid_credentials") {
      return "Email 或密碼不正確。還沒註冊過的話，請先按「還沒有帳號？註冊」。";
    }
    if (/email not confirmed/i.test(message)) {
      return "這個帳號還需要確認 email。請到信箱點開確認信，或用「忘記密碼／改用登入連結」。";
    }
  }
  if (kind === "signup") {
    if (/already registered|user already exists/i.test(message) || code === "user_already_exists") {
      return "這個 email 已經註冊過，請直接按「登入」。";
    }
    if (/password should be at least/i.test(message)) {
      return "密碼太短，至少要 8 碼。";
    }
    if (/rate limit/i.test(message)) {
      return "註冊太頻繁，請稍後再試。";
    }
  }
  return message || "未知錯誤";
}

/**
 * 以 email + 密碼登入。
 *
 * 這是主要登入方式：不寄信，所以不受 Supabase 內建信箱的速率限制。
 *
 * @param {string} email
 * @param {string} password
 */
export async function signInWithPassword(email, password) {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw new Error(describeAuthError("signin", error));
}

/**
 * 建立新帳號，成功後即為登入狀態。
 *
 * 專案若關閉了 email 確認，這裡會直接拿到 session；若仍要求確認，
 * Supabase 會回傳沒有 session 的 user，呼叫端要提示使用者去收信。
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>} 是否直接取得登入 session。
 */
export async function signUpWithPassword(email, password) {
  const client = getClient();
  if (!client) throw new Error(NO_CLOUD);
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  if (error) throw new Error(describeAuthError("signup", error));
  return Boolean(data && data.session);
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
