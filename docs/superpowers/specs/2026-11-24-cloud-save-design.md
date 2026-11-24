# 雲端存檔與多使用者發布：設計文件

日期：2026-11-24
狀態：待使用者核准

## 1. 這份文件要回答什麼

目前系統是純前端靜態網站，資料只存在使用者自己的瀏覽器（IndexedDB），
發布要靠使用者手動把 zip 放到 GitHub Pages。使用者現在要：

1. 換電腦／手機登入後能接續編輯同一張名片。
2. 其他人也能量製、取得自己的短網址與 QR，下次登入能繼續編輯。
3. 收到的名片的人打開網址就能看（不必任何人手動上傳檔案）。

結論：需要一個後端（資料庫＋檔案儲存＋登入）。本文件定義第一版範圍、
資料模型、權限、前端改動與不做的東西。

## 2. 使用者的決定（已於對話中確認）

| 主題 | 決定 |
| --- | --- |
| 要存什麼 | 發布後的公開觀看、跨裝置接續編輯、同時管理多張名片（多個使用者各一張） |
| 誰會用 | 原本只有你；現在開放其他人製作 |
| 名片網址 | 短網址（`viewer.html?card=<code>`），不顯示資料夾結構 |
| 站點網址 | 繼續用 `https://yukauchi0v0.github.io/ID-Card/` |
| 製作端是否上鎖 | 不用，任何人可進 `studio.html`；存檔才需要登入 |
| 後端平台 | Supabase（Postgres、Storage、Auth） |
| 帳號模式 | 每人一個帳號（email 登入連結，不需密碼） |
| 每位使用者名片數 | 一人一張 |
| 顯示 ID 與網址 ID | 顯示 ID（使用者名）可用中文；網址代號由系統產生 8 碼英數 |
| 改名後舊網址 | 顯示 ID 改名**不動網址**，所以已發出的 QR 不會失效 |
| 檔案上限 | 見第 6 節 |

## 3. 目標與非目標

### 目標

- 登入後「雲端是主要資料來源」：在任何裝置登入都能拿到自己的名片草稿。
- 發布是一個明確動作；修改草稿不會即時外洩到公開網址，要重新發布才更新。
- 公開網址只給收名片的人讀；只有名片主人能寫。
- 每位使用者只能有一張名片；網址代號全站唯一。
- 顯示 ID 改名不影響網址，已發出的 QR 永遠有效。

### 非目標（第一版不做）

- 多人共同編輯同一張名片。
- 名片主題／版型選擇、3D 模型、GIF、音訊。
- 後台管理介面（管理員角度的用量、封鎖帳號）。
- 自訂網域。
- 舊的 zip 發布流程移除前，先保留匯出包當備援。

### 反目標（就算技術上可行也不做）

- 公開註冊後完全不限制檔案與張數：免費額度會被單一使用者吃光。
- 讓未登入的訪客能寫入任何資料。
- 前端直連資料庫時把 service role key 放進瀏覽器。

## 4. 考慮過的方案

### A. 維持純前端，用 repo 當資料庫（GitHub API 自動 commit）

發布時前端用 GitHub token 直接把 `cards/<code>/` 檔 push 進去，存檔等於 commit。

- 優點：零新增平台、與現有 Pages 完全相容。
- 缺點：沒有「使用者個人身分」，所有人都要共用一個 token；token 放在瀏覽器等於公開寫入權限。沒有一人一張名片的隔離，也無法限制檔案大小。**淘汰。**

### B. Supabase（Postgres + Storage + Auth）— 採用

- 優點：提供登入、資料庫權限（RLS）、檔案儲存與 CDN；前端用 JS SDK 直接接，
  不需要自寫伺服器；免費額度足夠第一版。
- 缺點：免費專案連續七天無活動會暫停（資料不刪，需手動還原）；Storage 1GB、
  資料庫 500MB、流量 5GB/月。需要限制上傳大小。

### C. 自架 Node.js API（Render/Railway + 自建 Postgres）

- 優點：完全可控。
- 缺點：要多維護一個服務、備份、部署與域名；對目前規模成本最高。**淘汰。**

選擇 B。若之後需要更多控制，B 的資料模型可以直接搬到 C，前端只換 API client。

## 5. 架構

```
瀏覽器（GitHub Pages 靜態站）
 ├─ studio.html  ── Supabase JS SDK ──┬─ Auth（email magic link）
 │                                   ├─ Postgres（cards、card_versions、profiles）
 │                                   └─ Storage（bucket: card-assets）
 └─ viewer.html  ── 讀取 RPC / 公開 view ──（只讀，不登入）
```

- 前端維持靜態；不新增建置流程。
- 只有「雲端」新增。舊的本機 IndexedDB 保留作離線暫存，登入後改為備援。
- 觀看端不需要登入，也不需要讀資料表；透過一個只回傳已發布資料的
  RPC（`get_public_card(code)`）取得 manifest。

## 6. 資料模型

### `profiles`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | uuid PK | 與 `auth.users.id` 相同 |
| `display_name` | text | 使用者名，可中文 |
| `card_code` | text unique | 網址代號；系統產生，唯一 |
| `created_at` | timestamptz | |

### `card_codes_history`（預留，第一版不寫入）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `old_code` | text PK | 舊代號 |
| `user_id` | uuid | 擁有者 |
| `created_at` | timestamptz | |

顯示 ID 改名不會動 `card_code`，所以第一版不需要這張表。保留設計是為了未來
開放「更換網址代號」時能讓舊 QR 跳轉；屆時 `get_public_card` 先查
`profiles.card_code`，找不到再查此表並回傳新 code。

### `cards`（每位使用者一張，草稿）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid unique | 一位使用者一張 |
| `profile` | jsonb | name/title/company/phone/email/website |
| `settings` | jsonb | 與現有 `DEFAULT_SETTINGS` 同形狀 |
| `targets` | jsonb | 每頁：label、contentType、text、url、markerAspect、asset 路徑 |
| `mind_path` | text | `.mind` 在 Storage 的路徑 |
| `signature` | text | 卡蓋圖簽章，與現有 `targetSignature()` 相同 |
| `updated_at` | timestamptz | |

### `card_versions`（已發布快照）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | uuid PK | |
| `card_id` | uuid | |
| `version` | int | 遞增 |
| `manifest` | jsonb | 與現有 `card.json` 同形狀，但只含 Storage 公開 URL |
| `published_at` | timestamptz | |

`cards` 只保留最新已發布版本的 `published_version_id`。

### Storage：`card-assets`

路徑規則（每張名片各自一個資料夾，RLS 以此判斷擁有者）：

```
{user_id}/draft/covers/{n}.png     卡蓋圖（已縮到 1024 長邊）
{user_id}/draft/media/{n}.jpg|mp4|pdf
{user_id}/draft/card.mind
{user_id}/published/{version}/...
```

- 草稿檔案只有擁有者可寫，擁有者可讀。
- 已發布檔案對所有人可讀（`getPublicUrl`）；寫入只有擁有者。

### 檔案上限（前端與後端都檢查）

| 內容 | 上限 |
| --- | --- |
| 卡蓋圖 | 每張 2MB、最多 8 張 |
| 照片 | 8MB |
| 影片（上傳 MP4/WebM） | 60MB |
| PDF | 15MB |
| 單張名片總計 | 150MB |

後端用 Storage bucket 的 `file_size_limit` 與前端檢查雙重防護；總量在發布前查
Storage 大小（RPC）並擋下。

## 7. 權限（RLS）

- `profiles`：登入者可 select/update 自己的列；insert 只在首次登入時由 trigger
  建立。`card_code` 由資料庫函式產生（`random short code`），前端不可指定。
- `cards`：select/insert/update 只限 `user_id = auth.uid()`。
- `card_versions`：只有擁有者可 insert；公開讀取經由 RPC，不直接給表權限。
- `card_codes_history`：只有擁有者可 select/insert。
- Storage：draft 路徑只有擁有者；published 路徑公開讀、擁有者寫。

公開的 RPC：

```
get_public_card(p_code text) returns jsonb
```

- 查 `profiles.card_code = p_code`（找不到就查 `card_codes_history` 回傳新 code）。
- 回傳最新已發布版本的 manifest；沒有發布就回傳 null。
- `security definer`，只回傳白名單欄位，不暴露 email 或 user_id。

## 8. 使用者流程

### 8.1 第一次製作（新使用者）

1. 進 `studio.html`，未登入時設定頁可自由試玩，但「存到雲端」與「發布」按鈕
   會要求登入。
2. 點「登入／存到雲端」→ 輸入 email → 收信點連結 → 回到 studio。
3. 第一次登入要填「顯示 ID」（可中文），系統產生 `card_code`。
4. 上傳卡蓋圖、填內容、編譯（與現在相同，編譯仍在本機）。
5. 按「發布」→ 上傳 `.mind` 與媒體到 `published/<version>/`，建立
   `card_versions` 一列，拿到短網址 `viewer.html?card=<code>` 與 QR。

### 8.2 從另一台裝置接續編輯

1. 進 `studio.html` → 登入 → 自動載入雲端草稿（設定、卡蓋圖、內容、`.mind`）。
2. 若雲端已有 `.mind` 且 signature 一致，不必重編譯。
3. 修改後按「保存」：更新 `cards`、上傳變更的草稿檔案。
4. 按「發布」才更新公開版本。

### 8.3 觀看（收名片的人）

`viewer.html?card=<code>` → RPC 取得 manifest → 顯示名片頁 → 「用 AR 看」。

沒有登入、不寫任何資料。舊 code 會回傳新 code，並由前端 `replaceState` 導向。

### 8.4 修改顯示 ID

顯示 ID 是 `profiles.display_name`，改它不會影響 `card_code`，網址與 QR 都
不變。`card_codes_history` 只是預留給未來「更換網址代號」用，第一版不開放。

## 9. 前端改動

### 新增

- `js/shared/supabase.js`：建立 client（讀 `SUPABASE_URL`、`SUPABASE_ANON_KEY`
  從 `js/config.public.js` 或 `<meta>`；只放 anon key）。
- `js/studio/auth.js`：登入／登出、magic link 導回、顯示目前 email。
- `js/studio/cloud.js`：`loadCloudCard()`、`saveCloudCard()`、`publishCard()`；
  把現有 state 轉成資料列、上傳 Storage。

### 修改

- `js/studio/session.js`：把 IndexedDB 的 `saveSession()` 改成「雲端 + 本機備援」；
  登入時以雲端為準，離線時退回本機。
- `js/studio/share.js`：`viewerUrl()` 改成 `viewer.html?card=<code>`；發布面板顯示
  發布狀態與已用空間。
- `js/viewer/manifest.js`：改為呼叫 `get_public_card`；保留讀取靜態
  `card.json` 的 fallback（讓舊靜態包仍可開）。
- `studio.html`：登入區塊、顯示 ID、已用空間、保存／發布按鈕。
- `styles/studio.css`：上述新區塊的樣式。

### 保留

- AR 引擎與內容渲染（`js/ar/*`、`js/media/*`）不變。
- 本機編譯流程不變；`.mind` 仍由瀏覽器產生。
- 靜態卡片包匯出保留當備援。

## 10. 遺漏與風險

| 風險 | 處理 |
| --- | --- |
| 免費專案 7 天無活動暫停 | 文件與 README 寫明；恢復在 Dashboard 按 Restore；可定期登入一次 |
| 儲存 1GB／流量 5GB 用完 | 檔案大小上限＋發布時顯示已用空間；必要時關閉新註冊 |
| 公開註冊被濫用（垃圾帳號） | 第一版先接受；可後加邀請碼或 admin 白名單 |
| anon key 公開 | 正常；權限靠 RLS，不留 service role key 在前端 |
| 舊 Static 包與新雲端並存 | viewer 兩條讀取路徑都保留 |
| Git 歷史中若曾放過 secret | 不把任何 secret 寫進 repo；config 用公開 anon key |

## 11. 需要的使用者動作（非程式）

1. 建立 Supabase 專案，提供 `Project URL` 與 `anon key` 給前端。
2. 在 Supabase 設定 Magic Link 的 Site URL 與 Redirect URL 為
   `https://yukauchi0v0.github.io/ID-Card/studio.html`。
3. 執行 repo 內的 SQL migration（設計完成後提供）。

## 12. 待使用者確認的實作細節（若無意見，依下列預設）

- `card_code` 格式：8 碼英數（例如 `k7m2p9qd`），短且可猜性低。
- 每位使用者一張名片，第一版不提供「多張名片切換」。
- 發布歷史只保留最新一版（不存舊版本檔案），避免 Storage 快速增長。
