/**
 * 影片網址的判斷與轉換。
 *
 * 製作端允許貼 YouTube/Vimeo 的一般分享網址；viewer 的內容面板需要的是
 * 可直接放進 iframe 的 embed 網址，所以在這裡集中處理，避免把解析邏輯
 * 散落到 UI 或面板程式碼。
 */

/**
 * 判斷是否為支援嵌入的影片平台。
 *
 * @param {string} url 使用者貼上的網址。
 * @returns {boolean}
 */
export function isEmbedVideo(url) {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

/**
 * 把分享網址轉成 embed 網址。
 *
 * 支援：
 * - `youtu.be/<id>`
 * - `youtube.com/watch?v=<id>`
 * - `youtube.com/shorts/<id>`
 * - `vimeo.com/<id>`
 *
 * 無法辨識或 URL 格式錯誤時原樣回傳，讓 iframe 自己顯示失敗，
 * 不在這裡丟錯中斷整個面板。
 *
 * @param {string} url 原始網址。
 * @returns {string} 可直接放進 iframe 的網址。
 */
export function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (/youtu\.be$/i.test(u.hostname)) return "https://www.youtube.com/embed/" + u.pathname.slice(1) + "?autoplay=1&playsinline=1&rel=0";
    if (/youtube\.com$/i.test(u.hostname) || /www\.youtube\.com$/i.test(u.hostname)) {
      if (u.searchParams.get("v")) return "https://www.youtube.com/embed/" + u.searchParams.get("v") + "?autoplay=1&playsinline=1&rel=0";
      const shorts = u.pathname.match(/\/shorts\/([^/]+)/);
      if (shorts) return "https://www.youtube.com/embed/" + shorts[1] + "?autoplay=1&playsinline=1&rel=0";
    }
    if (/vimeo\.com$/i.test(u.hostname) || /www\.vimeo\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/(\d+)/);
      if (m) return "https://player.vimeo.com/video/" + m[1] + "?autoplay=1";
    }
  } catch (err) { /* 不是合法 URL 時保留原字串，讓 iframe 顯示載入失敗 */ }
  return url;
}

/**
 * 判斷是否為可直接用 `<video>` 播放的檔案網址。
 * 只檢查副檔名，實際格式是否支援仍由瀏覽器決定。
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isDirectVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}
