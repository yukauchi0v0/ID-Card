# Viewer / Studio Split Design

**Goal:** 讓收到名片的人開啟一個連結或 QR，就直接看到名片與 AR；製作名片的人則使用獨立的製作端。第一版不接後端，卡片以靜態資料夾發布。

**Status:** Approved architecture (three entries + shared AR core), implementation planning.

## Non-goals

- 不做帳號、後台、權限、密碼、到期、更新通知、流量統計。
- 不做跨網域卡片托管；卡片包與觀看端必須同一個網站。
- 不把 3D 模型、GIF、音訊加入這一版。
- 不改現有 AR 視覺與內容行為。

## Users and entry points

| 角色 | 入口 | 用途 |
| --- | --- | --- |
| 內部／名片製作者 | `/` | 首頁，選擇製作或觀看 |
| 名片製作者 | `/studio.html` | 上傳、編輯、編譯、預覽、發布 |
| 收到名片的人 | `/viewer.html?card=cards/<slug>/card.json` | 看名片、啟動 AR、掃描卡面 |

QR code 指向 viewer URL，不指向首頁。首頁只給內部與製作者使用。

## Shared AR core

AR 場景、內容排版、換頁、面板、紋理、影片、手勢只有一套，放在 `js/ar` 與 `js/media`。製作端與觀看端是兩個薄殼：

- `js/ar/state.js`：AR session 的可變狀態（targets、settings、currentPage、cards、sceneEl、panel、video、callbacks）。不再使用製作端 `js/studio/state.js`。
- `js/ar/dom.js`：AR shell 的 DOM refs；由 `js/ar/shell.js` 注入後才解析。
- `js/ar/shell.js`：唯一的 AR HUD／掃描框／圓點／面板／toast markup 來源；`mountArShell({ backLabel })` 在 app 動態 import 前呼叫。
- `js/ar/runtime.js`：`startAr({ targets, settings, mindUrl })`、`stopAr()`；負責 reset、build dots、mount/teardown。
- `js/ar/hud.js`：共用 HUD 更新、dots、影片聲音按鈕。
- `js/ar/gestures.js`：共用左右滑動手勢。
- `js/ar/scene.js`、`content.js`、`panel.js`：只依賴 `ar/state.js`、`ar/dom.js`、`ar/hud.js`、`shared/toast.js`。
- `js/media/textures.js`：接受 page/current index/total 參數，不讀製作端 state。
- `js/shared/toast.js`：使用 AR shell 的 `#toast`。

**載入順序：**

1. HTML 載入 A-Frame／MindAR CDN、頁面 CSS。
2. `js/studio/main.js` 或 `js/viewer/main.js` 先 `mountArShell(...)`。
3. 再 `await import("./app.js")`；所有 AR module 此時才解析 `arDom`。

這個順序避免 `byId` 在 shell 注入前失敗。

## Page model and manifest

觀看端只讀 `card.json`、`card.mind`、`media/`。不編譯、不寫 IndexedDB。

```json
{
  "version": 1,
  "slug": "lin-yi",
  "profile": {
    "name": "林一",
    "title": "視覺傳達設計",
    "company": "Studio",
    "phone": "0912-345-678",
    "email": "hi@example.com",
    "website": "https://example.com"
  },
  "settings": {
    "position": "above",
    "gapCm": 0.45,
    "offsetXCm": 0,
    "offsetYCm": 0,
    "scale": 1,
    "orientation": "flat",
    "stability": "stable"
  },
  "mind": "card.mind",
  "targets": [
    {
      "label": "個人資料",
      "contentType": "text",
      "text": "姓名 / 職稱 / 簡介",
      "markerAspect": 0.75
    },
    {
      "label": "作品集",
      "contentType": "image",
      "media": "media/page-2.png",
      "mediaName": "portfolio.png",
      "mediaMime": "image/png",
      "markerAspect": 0.75
    }
  ]
}
```

- `targets` 陣列順序必須與 `.mind` 的 target 順序一致。
- `markerAspect` 是卡面圖片的 `height / width`，供內容定位使用；沒有時 fallback 到 `CARD_H`。
- 觀看端把 `media` 相對路徑解析成絕對 URL，放進 page 的 `contentObjectUrl`，讓既有 `textures.js`／`panel.js` 直接使用。
- `profile` 可全部為空；觀看端用 fallback 文字，不讓頁面壞掉。

## Viewer UX

1. 讀 `?card=`；缺少或 fetch 失敗 → 顯示可讀錯誤與回首頁連結。
2. 顯示名片：姓名、職稱／公司、電話、Email、網站；空欄位不顯示。
3. 顯示「用 AR 看」按鈕；按下才顯示 AR shell 並請求相機。
4. AR 啟動中顯示「正在啟動相機」；`arReady` 後進入掃描。
5. 返回或相機錯誤 → 回到名片頁，不回到製作端。
6. 名片頁在沒有相機、拒絕權限、桌面瀏覽器時仍然可用。

## Studio changes

- 新增「名片資訊」區塊：`name`、`title`、`company`、`phone`、`email`、`website`、`slug`。
- `slug` 只用 `[a-z0-9-]`；空白或中文時 fallback `my-card`，可手動修改。
- 將 `profile` 寫入 IndexedDB session，重新整理可還原。
- 新增「發布」／「分享」：
  - 下載 `cards/<slug>/` 的 zip：`card.json`、`card.mind`、`media/`。
  - 顯示觀看 URL 與 QR；URL 可在部署後貼回修改。
- 發布前檢查：`mindBlob` 存在且 `mindSignature === targetSignature()`；否則提示先編譯。

## Publish package

```text
cards/<slug>/
  card.json
  card.mind
  media/page-2.png
  media/page-3.mp4
```

- zip 內路徑從 `cards/<slug>/` 開始；解壓到站點根目錄即可。
- 觀看 URL：`viewer.html?card=cards/<slug>/card.json`。
- 靜態站必須同源；不處理 CORS。
- 發布包不含 viewer 程式；viewer 是站點的一部分。

## File structure

```text
index.html                 landing
studio.html                studio shell
viewer.html                viewer shell

styles.css                 studio entry
styles/landing.css
styles/viewer.css
styles/...                 shared + studio styles

js/studio/
  main.js                  mountArShell -> dynamic import app
  app.js                   upload/compile/enter/exit
  dom.js
  state.js
  profile.js
  session.js
  manifest.js              pure manifest builder
  card-package.js          zip export (browser)
  share.js                 URL + QR
  ui/{targets,settings,enter-button,compile-overlay}.js

js/viewer/
  main.js                  mountArShell -> dynamic import app
  app.js                   load manifest, profile, start/stop AR
  dom.js
  manifest.js              fetch + normalize + resolve URLs

js/ar/
  shell.js
  dom.js
  state.js
  runtime.js
  hud.js
  gestures.js
  scene.js
  content.js
  panel.js

js/shared/toast.js
js/config.js
js/events.js
js/media/
js/utils/
js/mindar-bundle-ref.js
vendor/fflate.js           zip (MIT)
vendor/qrcode.min.js       QR (MIT)
```

## Testing strategy

- Pure Node tests (`node --test`): manifest builder, slugify, viewer manifest normalization/resolution.
- `node --check` all JS; import/DOM ID checks.
- Browser smoke (local static server):
  - studio loads, profile saves/restores, compile, enter/exit, existing four content types.
  - viewer loads a package, profile renders, AR starts, target lost/back returns to profile, camera-denied path shows profile.
  - package zip contains the expected paths; QR renders.
- No new build step.

## Risks / decisions

- AR state is a singleton per page, not a class instance. Acceptable because one AR session exists at a time per page; avoids threading dependencies through every function.
- AR shell markup is injected before app import; this is the one dynamic-import complexity.
- Vendor `fflate` and `qrcode-generator` rather than CDN at runtime so publishing/QR works offline after first load.
- Static package is public by URL; no privacy guarantees in this version.
