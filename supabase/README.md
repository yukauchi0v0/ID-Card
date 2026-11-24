# Supabase 設定（雲端存檔與短網址）

這個資料夾放的是「雲端存檔」需要的資料庫結構。製作端本身不需要後端也能用；
但要讓名片跨裝置保存、給對方一個短網址，就需要一個 Supabase 專案。

## 1. 建專案

1. 到 [supabase.com](https://supabase.com) 建一個免費專案。
2. 專案建好後，到 **Project Settings → API** 取得：
   - **Project URL**（例如 `https://xxxx.supabase.co`）
   - **Publishable key**（或舊版的 anon key）
3. 把這兩個值填到 `js/config.public.js`：

```js
export const SUPABASE_URL = "https://xxxx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_...";
```

這兩個值本來就會送到瀏覽器，可以公開。**不要**把 `service_role` key 放進來。

## 2. 建資料表與 Storage

1. Dashboard → **SQL Editor** → **New query**。
2. 把 `supabase/migrations/20261124_cloud_save.sql` 整份貼上，按 **Run**。
3. 成功後應該看到三張表（`profiles`、`cards`、`card_versions`）與一個
   bucket（`card-assets`）。

這份 migration 可以重複執行：全部使用 `if not exists` 與 `drop policy if exists`。

> `profiles`、`cards` 直接從 REST API 查詢會回 404，這是正常的：
> 資料表啟用了 RLS，匿名請求沒有權限，PostgREST 就不會暴露它。

## 3. 設登入（Email magic link）

Dashboard → **Authentication**：

- **Providers → Email**：開啟。
- **URL Configuration**：
  - **Site URL**：`https://<你的網域>/studio.html`
  - **Redirect URLs**：同一個網址。

登入不需要密碼：使用者在製作端填 email，按下「寄出登入連結」，
到信箱點開連結就會回到 `studio.html` 並自動登入。

Supabase 內建寄信服務有速率限制（免費方案每小時數封）。如果信件沒來：

- 先看垃圾信件匣。
- 仍收不到時，到 **Authentication → Users** 手動建立測試帳號，
  或改用自己的 SMTP（**Project Settings → Auth → SMTP Settings**）。

## 4. 資料結構

| 表 | 用途 |
| --- | --- |
| `profiles` | 每個帳號對應一個 `card_code`（8 碼短網址代碼）與顯示 ID。 |
| `cards` | 每個帳號一張草稿：名片資料、設定、卡蓋清單、`.mind` 路徑。 |
| `card_versions` | 每次發布時的快照；觀看端只會讀到最新一版。 |

Storage bucket `card-assets` 的路徑規則：

```
<user-id>/drafts/<card-id>/mind.mind       草稿用的辨識資料（只有本人可讀）
<user-id>/drafts/<card-id>/page-1.png      草稿用的內容檔（只有本人可讀）
<user-id>/published/<version-id>/card.mind 已發布的辨識資料（公開可讀）
<user-id>/published/<version-id>/page-1.png
```

觀看端只透過 `get_public_card(<code>)` 這個函式取得最新已發布的名片；
它不會列出使用者，也不會碰草稿。

## 5. 相關程式

| 檔案 | 說明 |
| --- | --- |
| `js/shared/supabase.js` | 建立 Supabase client（沒設定時回傳 null）。 |
| `js/studio/auth.js` | 寄出 magic link、取得 session、登出、監聽登入狀態。 |
| `js/studio/cloud.js` | 草稿存檔/載入、發布、上傳大小檢查。 |
| `js/studio/cloud-ui.js` | 製作端的帳號面板、存到雲端、發布流程。 |
| `js/viewer/manifest.js` | 觀看端以短代碼讀取已發布名片。 |
