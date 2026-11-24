# 社群聯絡卡、儲存名片與分享 — 設計

日期：2026-11-25
狀態：已核准（使用者 m04684「照你說的來!…A:可以啊我同意。」）

## 為什麼要做

名片的主要目的是「增加社交率」：對方掃完、看完 AR 之後，要能**最短時間內**連上你。
Web Push 這條路在手機上不可靠（iOS 必須先「加到主畫面」才會收到通知，Android 要先按允許），
通知訪客的實際觸達率太低，而且需要另建推播伺服器。因此這一版先做三件事，都不需要伺服器：

1. 名片上直接放**社群聯絡按鈕**（點一下就到加好友頁 / 個人頁）。
2. **儲存名片**：一鍵下載 vCard，存進對方手機通訊錄。
3. **分享名片**：把這張名片的網址分享或複製給下一個人。

## 目標

- 製作端可以在「01 · 名片資訊」勾選平台（LINE、Instagram、Threads、Facebook、X、LinkedIn、GitHub、其他網站）並填入帳號或網址。
- 觀看端名片頁直接顯示按鈕：社群連結、撥號、寄 Email。
- 觀看端可以下載 vCard、可以分享/複製名片網址。
- 不需要資料庫或 Supabase 變更：`profile.links` 跟著 manifest 走。

## 非目標

- 不做 Web Push / 通知。
- 不做 QR 圖片產生（觀看端已有分享 URL）。
- 不做追蹤、統計（誰點了哪個連結）。

## 設計

### 資料

`profile.links: Array<{ platform: string, account: string }>`，加入既有 manifest 的 `profile`。
平台 id 固定八種：`line`、`instagram`、`threads`、`facebook`、`x`、`linkedin`、`github`、`custom`。

規則（`js/shared/social.js`，純函式、可單元測試）：

- `normalizeLinks`：非陣列 → `[]`；未知平台丟棄；空帳號丟棄；同平台只留第一筆；帳號上限 120 字元；最多 8 筆。
- `contactHref`：帳號若是安全的 `http(s)` 網址就直接使用；否則用平台前綴組出網址（`@linyi` → `https://instagram.com/linyi`）；`custom` 必須是完整網址。任何結果都再用 `isSafeHttpUrl` 驗一次，因此 `javascript:`、`data:` 不可能變成可點連結。
- `contactActions`：社群 → 撥號 → Email，最多 8 個按鈕。
- `toVCard`：vCard 3.0，`\r\n` 換行；`N`/`FN`/`TITLE`/`ORG`/`EMAIL`/`URL`/`X-SOCIALPROFILE` 全部做 vCard 轉義，避免姓名中的換行注入額外欄位。

### 製作端

`studio.html` 的「01 · 名片資訊」下方新增 `.links-editor`：8 列 checkbox + 帳號輸入框（未勾選時停用）。
`js/studio/links.js` 負責建立列與同步 `studioState.profile.links`；`renderProfile()` 一併呼叫 `renderLinks()`，
所以本機還原（IndexedDB）與雲端還原（`loadDraft`）都會自動帶回來。`buildCardManifest` 把
`normalizeLinks(profile.links)` 寫進 manifest。

### 觀看端

名片卡下方（AR 按鈕之前）新增：

- `#viewerContact`：`.viewer-contact-title`「看完之後，歡迎聯絡我」＋ 按鈕列。社群按鈕新視窗開啟（`noopener`），
  電話用 `tel:`、Email 用 `mailto:`。沒有可用動作時整個區塊隱藏。
- `#viewerActions`：「儲存名片」「分享名片」兩個按鈕。
- `#viewerShareStatus`：分享/下載結果的提示文字（`aria-live`）。

分享優先使用 `navigator.share`；不支援或被拒絕時改用 `navigator.clipboard.writeText`；再不行就把網址顯示成
可長按複製的文字。任何失敗都要有可見回饋，不能靜默失敗。

### 相容性

- 沒有 `profile.links` 的舊 manifest（雲端舊版本、`cards/<slug>/card.json` 靜態包）一律走 `normalizeLinks(undefined) → []`，
  觀看端只是少了社群按鈕。
- 不需要跑新的 SQL migration。
