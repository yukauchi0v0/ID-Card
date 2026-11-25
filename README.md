# ID Card · WebAR

用悠遊卡滑蓋卡套的不同圖案當識別 target，掃到哪一格，就在卡片上方顯示對應的平面內容。支援文字、照片、上傳影片、YouTube／Vimeo、互動網頁與 PDF。

現在分成三個入口：

- `/` — 首頁，說明觀看名片與製作名片兩種角色；製作從 `/studio.html` 進入
- `/studio.html` — 製作端：上傳卡蓋圖案、編輯內容、編譯、存到雲端、發布並產生 QR
- `/viewer.html?card=<8 碼代碼>` — 觀看端：先看名片資訊，再按「用 AR 看」掃卡面

**Live Demo：** https://yukauchi0v0.github.io/ID-Card/

## 技術

- A-Frame 1.5.0
- MindAR 1.2.2
- 原生 ES Modules（native ESM），不需要 build step
- 相機、編譯、本機暫存都在瀏覽器完成；雲端存檔與短網址使用 Supabase（見 `supabase/README.md`）
- 靜態卡片包：`card.json` + `card.mind` + `media/`，可作為不接後端的備援
- `fflate`（zip）、`qrcode-generator`（QR）與 `supabase-js` 已放在 `vendor/`，不依賴 CDN 的執行期載入

## 使用方式

### 製作名片

1. 開啟 `/studio.html`。
2. 「雲端存檔」填入 email，按「寄出登入連結」，到信箱點開連結回到頁面即登入。
   - 沒登入也能完整試用與編譯，只是不能存到雲端或取得公開網址。
3. 在「名片資訊」填入姓名、職稱、公司、電話、Email、網站；空白欄位不會顯示在觀看頁。
4. 上傳 1–8 個卡蓋圖案，順序即為卡蓋位置 1、2、3…
5. 為每個圖案選擇內容：平面文字、照片、上傳影片、影片連結、互動網頁或 PDF。
6. 在「AR 顯示位置」調整位置、間距、偏移、大小與平放／立起。
7. 按「編譯並進入 AR」，允許相機權限，確認內容顯示正常後返回。
8. 按「存到雲端」保存草稿（換手機、隔天回來都能接續編輯）。
9. 按「發布」：上傳最新一版並取得名片代碼、觀看網址與 QR。

### 發布與 QR

發布後觀看網址固定為：

```text
https://yukauchi0v0.github.io/ID-Card/viewer.html?card=<8 碼名片代碼>
```

- 代碼由系統產生，只含小寫英數字（避開 0/o/1/l）。
- 改名、改內容、重新發布都不會改變代碼，已印出的 QR 可繼續使用。
- QR 指向觀看網址，不指向首頁。掃到 QR 後先看到名片資訊，按「用 AR 看」才會啟動相機。
- 重新發布只換掉觀看端讀到的最新版本，舊版本仍留在 `card_versions`。

沒有登入或不想用雲端時，也可以用「下載卡片包（備援）」得到：

```text
cards/<slug>/
  card.json
  card.mind
  media/page-2.png
  media/page-3.mp4
```

把整個 `cards/<slug>/` 放到靜態網站根目錄後，用舊式路徑
`viewer.html?card=cards/<slug>/card.json` 也能觀看；觀看端兩種網址都支援。

### 觀看名片

1. 掃名片上的 QR，或開啟觀看網址（`viewer.html?card=<代碼>`）。
2. 觀看端向 Supabase 讀取最新已發布的名片，顯示姓名、職稱、公司、電話、Email、網站，
   下方就是「聯絡我」區：
   - 社群按鈕（LINE、Instagram、Threads、Facebook、X、LinkedIn、GitHub、自訂網址）
   - 「儲存名片」下載 `.vcf`，可直接加到手機通訊錄
   - 「分享這張名片」用系統分享面板；不支援時複製網址
3. 按「用 AR 看」，允許相機權限。
4. 把鏡頭對準卡蓋圖案；鎖定後可左右滑動換頁，或滑動卡蓋切換圖案。
5. 看完之後，按「返回名片」或 AR 畫面下方的「看完了？聯絡我 →」回到名片頁，
   會自動捲到「聯絡我」區。

> 社群按鈕只會產生 http(s) 連結；`javascript:` 之類的輸入會在寫入資料庫前就丟掉，
> vCard 的文字也會轉義，避免姓名裡的換行變成額外欄位。
> `navigator.share()` 必須在使用者手勢中同步呼叫，程式碼刻意不先 `await`，否則 iOS Safari 會擋下分享。


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
  config.js                 常數、內容類型、預設名片、追蹤預設、上傳上限
  config.public.js          Supabase URL 與 publishable key（可公開）
  events.js                 小型 event bus
  mindar-bundle-ref.js      保存 A-Frame bundle 的 MINDAR.IMAGE.Compiler
  shared/
    toast.js                AR／studio 共用的 toast
    supabase.js             Supabase client（未設定時回傳 null）
    social.js               社群連結正規化、安全網址、vCard 產生
  studio/
    main.js                 注入 AR shell，載入 studio app
    app.js                  製作流程協調
    state.js                製作端 state
    dom.js                  製作端 DOM refs
    auth.js                 email + 密碼登入／註冊、magic link 備援、session、登出
    cloud.js                雲端草稿存檔／載入、發布、上傳上限檢查
    cloud-ui.js             帳號面板、存到雲端、發布流程
    profile.js              名片資訊表單
    social-ui.js            社群平台勾選與帳號輸入
    manifest.js             產生 card.json
    card-package.js         打包 zip（備援發布方式）
    share.js                觀看網址、QR、複製與下載
    session.js              IndexedDB save/restore/clear
    ui/
      targets.js            上傳、縮圖、內容編輯器、拖放
      settings.js           位置／間距／大小／方向／穩定度
      compile-overlay.js
      enter-button.js
  viewer/
    main.js                 注入 AR shell，載入 viewer app
    app.js                  讀 manifest、名片頁（含聯絡區）、啟動 AR
    contact.js              社群按鈕、儲存名片（vCard）、分享名片
    dom.js                  觀看端 DOM refs
    manifest.js             短代碼／舊式路徑解析、manifest 驗證
  ar/
    state.js                AR singleton state
    dom.js                  AR shell DOM refs
    shell.js                注入 HUD／面板／toast／錯誤面板（含「看完了？聯絡我」）
    runtime.js              initArUi / startAr / stopAr
    scene.js                動態建立 a-scene、target anchors、teardown、辨識資料錯誤
    content.js              平面內容 layout、targetFound/Lost、換頁
    panel.js                2D 內容面板
    hud.js                  HUD、頁碼、圓點、viewer 聯絡 CTA
    gestures.js             左右滑動換頁
  media/
    compiler.js             MindAR Compiler 取得與特徵數檢查
    textures.js             文字／照片／影片 texture、快取與清理
    embeds.js               YouTube／Vimeo URL 處理
  utils/
    files.js                圖片載入、壓縮、檔案限制
    format.js               pad2、clamp、escapeHtml、nextPaint、isHttpUrl、normalizeHttpUrl
    slug.js                 ASCII slug；中文名稱用穩定 hash
    signature.js            卡蓋集合簽章（跨帳號沿用草稿）
    extension.js            由檔名／MIME 推斷副檔名
    canvas.js               Canvas 文字換行
supabase/
  README.md                 Supabase 設定步驟
  migrations/               資料表、RLS、Storage 政策
vendor/
  fflate.js                 zip 打包（MIT）
  qrcode.min.js             QR 產生（MIT）
  supabase.js               supabase-js 2.x UMD（MIT）
tests/
  manifest.test.js
  viewer-manifest.test.js
  viewer-source.test.js
  cloud-row.test.js
  auth.test.js
  social.test.js            社群連結、安全網址、vCard
  structure.test.js
```

### 依賴方向

- `js/studio/main.js` 先注入 AR shell，再載入 `studio/app.js`
- `js/viewer/main.js` 先注入 AR shell，再載入 `viewer/app.js`
- 兩端都只透過 `js/ar/runtime.js` 的 `startAr`／`stopAr` 操作 AR
- `js/ar/*` 只依賴 `ar/state.js`、`ar/dom.js`、`media/`、`utils/`，不依賴 studio
- `js/studio/session.js` 只屬於製作端；viewer 不寫 IndexedDB
- `js/studio/cloud*.js` 只在已設定 Supabase 且有登入 session 時才會寫入雲端
- `js/viewer/manifest.js` 只驗證資料，不編譯

## 本機預覽

相機需要 HTTPS 或 localhost。在這個目錄啟動靜態伺服器：

```bash
python -m http.server 8767
```

開啟：

- http://127.0.0.1:8767/
- http://127.0.0.1:8767/studio.html
- http://127.0.0.1:8767/viewer.html?card=&lt;8 碼代碼&gt;（該名片需已發布）
- http://127.0.0.1:8767/viewer.html?card=cards/&lt;slug&gt;/card.json（舊式：先放好對應卡片包）

這是 native ESM，請不要用 `file://` 直接開。

本機測試登入時，記得在 Supabase 的 Redirect URLs 加上
`http://localhost:8767/studio.html`，否則 magic link 會導向正式網址。

## 疑難排解

**換一台裝置登入後畫面是空的**

雲端草稿要靠卡蓋圖才還原得起來，所以「存到雲端成功」一定要連卡蓋圖一起上去。早期版本的卡蓋圖是 `<img>` 元素、沒有 `toBlob()`，上傳時會被靜默跳過，雲端只剩卡片資料列，換裝置登入時整份草稿就被丟棄。現在的作法：

- `js/studio/cloud.js` 的 `imageToPngBlob()` 會把 `<img>` 用 canvas 轉成 PNG 再上傳；轉不出來就丟錯，畫面會顯示「儲存草稿失敗」。
- 入口 `js/studio/main.js`、`js/viewer/main.js` 用 `js/version.js` 的 `APP_VERSION` 動態載入 app，避免新版上線後瀏覽器還在跑舊的模組快取。**改程式時要一起調高 `APP_VERSION`。**

排查順序：登入後按「存到雲端」，確認 toast 是「已存到雲端。」；仍空白就開 DevTools → Application → Storage，看 `card-assets/<uid>/draft/covers/1.png` 是否存在。

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

社交聯絡卡的瀏覽器回歸只需要本機靜態伺服器（不需要相機、不需要編譯）：

1. 在 `cards/test-card/` 放一份 `card.json`（含 `profile.links`）與任意 `card.mind`。
2. 開 `viewer.html?card=cards/test-card/card.json`。
3. 確認：名片一打開就看得到「聯絡我」區與社群網址，`javascript:` 會被忽略；AR 鎖定後 HUD 出現「看完了？聯絡我」，按下之後回到名片並捲到聯絡區。
4. 按「儲存名片」應下載 `.vcf`；按「分享這張名片」在支援的瀏覽器會開系統分享，不支援時複製網址。

## 部署

### GitHub Pages

此倉庫已開啟 GitHub Pages（`main` / root）：

- https://yukauchi0v0.github.io/ID-Card/

每次 push 到 `main` 會自動重新部署。`index.html`、`studio.html`、`viewer.html`、`styles/`、`js/`、`vendor/` 與 `cards/` 會一起部署，沒有 build 產物。

### Netlify Drop

把整個專案資料夾（包含三個 HTML、`styles/`、`js/`、`vendor/`）拖到 Netlify Drop，不要只拖 `index.html`，也不要把 `.git` 一起上傳。若已有 `cards/<slug>/`，一起帶上。

## 限制

- 沒有到期日、造訪統計或跨網域托管。
- 已發布的名片是公開的：任何拿到 8 碼網址的人都能讀取該名片的最新版本與公開內容檔。草稿只有本人能讀。
- 觀看端不寫 IndexedDB；重新整理會重新向雲端讀取。
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
- 雲端存檔：email magic link 登入、Supabase 草稿、`?card=<8 碼代碼>` 短網址、改名不換網址、重新發布不動 QR
