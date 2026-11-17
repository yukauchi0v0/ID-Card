# ID Card · WebAR

用悠遊卡滑蓋卡套的不同圖案當識別 target，掃到哪一格，就在卡片上方顯示對應的平面內容。支援文字、照片、上傳影片、YouTube／Vimeo、互動網頁與 PDF。

現在分成三個入口：

- `/` — 首頁，說明觀看名片與製作名片兩種角色；製作從 `/studio.html` 進入
- `/studio.html` — 製作端：上傳卡蓋圖案、編輯內容、編譯、下載卡片包、產生 QR
- `/viewer.html?card=cards/<slug>/card.json` — 觀看端：先看名片資訊，再按「用 AR 看」掃卡面

**Live Demo：** https://yukauchi0v0.github.io/ID-Card/

## 技術

- A-Frame 1.5.0
- MindAR 1.2.2
- 原生 ES Modules（native ESM），不需要 build step
- 純前端；相機、編譯、Storage 都在瀏覽器本機完成
- 靜態卡片包：`card.json` + `card.mind` + `media/`，不需要後端
- `fflate`（zip）與 `qrcode-generator`（QR）已放在 `vendor/`，不依賴 CDN 的執行期載入

## 使用方式

### 製作名片

1. 開啟 `/studio.html`。
2. 在「名片資訊」填入姓名、職稱、公司、電話、Email、網站；空白欄位不會顯示在觀看頁。
3. 上傳 1–8 個卡蓋圖案，順序即為卡蓋位置 1、2、3…
4. 為每個圖案選擇內容：平面文字、照片、上傳影片、影片連結、互動網頁或 PDF。
5. 在「AR 顯示位置」調整位置、間距、偏移、大小與平放／立起。
6. 按「編譯並進入 AR」，允許相機權限，確認內容顯示正常後返回。
7. 按「發布名片」：
   - 下載 `<slug>-card.zip`。
   - 下載 QR，或複製觀看網址。
   - 把 zip 解壓後的 `cards/<slug>/` 放到網站根目錄。

### 發布與 QR

卡片包解壓後會長這樣：

```text
cards/<slug>/
  card.json
  card.mind
  media/page-2.png
  media/page-3.mp4
```

把整個 `cards/<slug>/` 上傳到靜態網站根目錄，觀看網址就是：

```text
https://your-site.example/viewer.html?card=cards/<slug>/card.json
```

QR 指向這個觀看網址，不指向首頁。掃到 QR 後先看到名片資訊，按「用 AR 看」才會啟動相機。

### 觀看名片

1. 掃名片上的 QR，或開啟觀看網址。
2. 先讀取 `card.json`，顯示姓名、職稱、公司、電話、Email、網站。
3. 按「用 AR 看」，允許相機權限。
4. 把鏡頭對準卡蓋圖案；鎖定後可左右滑動換頁，或滑動卡蓋切換圖案。
5. 按「返回名片」停止相機並回到名片頁。

## 專案結構

```text
index.html                  首頁
studio.html                 製作端
viewer.html                 觀看端
styles.css                  CSS entry，只負責 @import
styles/
  tokens.css                色票、字型、間距變數
  base.css                  reset、頁面底色、通用元素
  landing.css               首頁
  setup.css                 上傳區、卡蓋卡片、action bar、footer
  studio.css                名片資訊、發布／分享面板
  settings.css              AR 顯示位置與示意圖
  viewer.css                觀看端名片頁
  ar.css                    AR HUD、掃描框、圓點、影片聲音按鈕
  panel.css                 2D 內容面板
  overlays.css              編譯 overlay、錯誤面板、toast
  responsive.css            手機／窄螢幕覆寫，最後載入
js/
  config.js                 常數、內容類型、預設名片、追蹤預設
  events.js                 小型 event bus
  mindar-bundle-ref.js      保存 A-Frame bundle 的 MINDAR.IMAGE.Compiler
  shared/
    toast.js                AR／studio 共用的 toast
  studio/
    main.js                 注入 AR shell，載入 studio app
    app.js                  製作流程協調
    state.js                製作端 state
    dom.js                  製作端 DOM refs
    profile.js              名片資訊表單
    manifest.js             產生 card.json
    card-package.js         打包 zip
    share.js                觀看網址、QR、複製與下載
    session.js              IndexedDB save/restore/clear
    ui/
      targets.js            上傳、縮圖、內容編輯器、拖放
      settings.js           位置／間距／大小／方向／穩定度
      compile-overlay.js
      enter-button.js
  viewer/
    main.js                 注入 AR shell，載入 viewer app
    app.js                  讀 manifest、名片頁、啟動 AR
    dom.js                  觀看端 DOM refs
    manifest.js             驗證並解析 card.json
  ar/
    state.js                AR singleton state
    dom.js                  AR shell DOM refs
    shell.js                注入 HUD／面板／toast／錯誤面板
    runtime.js              initArUi / startAr / stopAr
    scene.js                動態建立 a-scene、target anchors、teardown
    content.js              平面內容 layout、targetFound/Lost、換頁
    panel.js                2D 內容面板
    hud.js                  HUD、頁碼、圓點
    gestures.js             左右滑動換頁
  media/
    compiler.js             MindAR Compiler 取得與特徵數檢查
    textures.js             文字／照片／影片 texture、快取與清理
    embeds.js               YouTube／Vimeo URL 處理
  utils/
    files.js                圖片載入、壓縮、檔案限制
    format.js               pad2、clamp、escapeHtml、nextPaint
    slug.js                 ASCII slug；中文名稱用穩定 hash
    canvas.js               Canvas 文字換行
vendor/
  fflate.js                 zip 打包（MIT）
  qrcode.min.js             QR 產生（MIT）
tests/
  manifest.test.js
  viewer-manifest.test.js
  structure.test.js
```

### 依賴方向

- `js/studio/main.js` 先注入 AR shell，再載入 `studio/app.js`
- `js/viewer/main.js` 先注入 AR shell，再載入 `viewer/app.js`
- 兩端都只透過 `js/ar/runtime.js` 的 `startAr`／`stopAr` 操作 AR
- `js/ar/*` 只依賴 `ar/state.js`、`ar/dom.js`、`media/`、`utils/`，不依賴 studio
- `js/studio/session.js` 只屬於製作端；viewer 不寫 IndexedDB
- `js/viewer/manifest.js` 只驗證資料，不編譯

## 本機預覽

相機需要 HTTPS 或 localhost。在這個目錄啟動靜態伺服器：

```bash
python -m http.server 8767
```

開啟：

- http://127.0.0.1:8767/
- http://127.0.0.1:8767/studio.html
- http://127.0.0.1:8767/viewer.html?card=cards/&lt;slug&gt;/card.json（先放好對應卡片包）

這是 native ESM，請不要用 `file://` 直接開。

## 測試

```bash
npm.cmd test
```

Windows PowerShell 若擋住 `npm.ps1`，用 `npm.cmd`。也可以直接跑：

```bash
node --test "tests/*.test.js"
node --check js/ar/runtime.js
```

瀏覽器回歸需要用支援 WebGL 的 Chrome；headless SwiftShader 可以跑，但一張圖編譯可能超過 90 秒，測試請等 180 秒。不要加 `--disable-gpu`，否則 MindAR 的 TensorFlow kernel 會退回 CPU 而失敗。

## 部署

### GitHub Pages

此倉庫已開啟 GitHub Pages（`main` / root）：

- https://yukauchi0v0.github.io/ID-Card/

每次 push 到 `main` 會自動重新部署。`index.html`、`studio.html`、`viewer.html`、`styles/`、`js/`、`vendor/` 與 `cards/` 會一起部署，沒有 build 產物。

### Netlify Drop

把整個專案資料夾（包含三個 HTML、`styles/`、`js/`、`vendor/`）拖到 Netlify Drop，不要只拖 `index.html`，也不要把 `.git` 一起上傳。若已有 `cards/<slug>/`，一起帶上。

## 限制

- 第一版沒有後端、帳號、權限、到期日、統計或跨網域托管。
- 靜態卡片包是公開檔案；任何拿到網址的人都能讀取 `card.json`、`card.mind` 與 `media/`。不要放敏感資料。
- 觀看端不寫 IndexedDB；重新整理會重新讀 manifest。
- 第二版才會加入 3D 模型、GIF 動畫與音訊。
- iOS 請使用 Safari 16.4+，並允許相機權限。
- 多數 Android 內建瀏覽器不支援相機；請用 Chrome 或 Safari。

## 辨識與抖動

- MindAR 是靠紋理與角點追蹤，不是理解卡片；大面積素色、反光或特徵太少的圖案會較不穩。
- 卡套表面反光會造成明顯抖動，霧面卡套或霧面貼膜通常比調參數有效。
- 預設使用「穩定」預設值（`filterMinCF: 0.0005`、`filterBeta: 100`、`missTolerance: 12`）。如果覺得慢半拍，可在設定改成「平衡」或「靈敏」。
- 內容離卡片越遠、越大，視覺上的抖動會被放大；先把大小降到 70–80% 測試。
- 掃描框已改成悠遊卡比例；讓圖案填滿框、避免反光。

## 版本

- `v0.1.0`：最初的弧形文字卡版本
- `v0.2.0`：平面內容、卡蓋多 target、內容面板、位置控制、本機儲存
- 模組化重構：把單檔拆成 native ESM 模組與分層 CSS，行為不變
- 三入口版本：`/` 首頁、`/studio.html` 製作端、`/viewer.html` 觀看端；名片資訊、靜態卡片包、QR 分享
