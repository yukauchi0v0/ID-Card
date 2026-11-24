/**
 * Supabase 連線設定。
 *
 * 這裡只能放「可以公開」的值：Project URL 與 publishable / anon key。
 * 絕對不要放 service_role key，那組金鑰能繞過所有權限，任何拿到它的人
 * 都能讀寫整份資料庫。
 *
 * 之後要搬到別的專案時，只需要換這個檔案，其他程式都從
 * `js/shared/supabase.js` 取得 client。
 */
export const SUPABASE_URL = "https://wvtkvtomfzhgmmlaxyuj.supabase.co";

// Publishable key：Supabase SDK 會自動帶上 Authorization header。
export const SUPABASE_KEY = "sb_publishable_xlh3Dj0Se4wcqSo5GA4dFQ_X34GUr4u";
