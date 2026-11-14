# ID Card · WebAR

單檔 WebAR 頁面：用悠遊卡滑蓋卡套的不同圖案當識別 target，掃到哪一格，就在卡片上方顯示對應的平面內容。支援文字、照片、上傳影片、YouTube／Vimeo、互動網頁與 PDF。

**Live Demo：** https://yukauchi0v0.github.io/webar-card/

## 技術

- A-Frame 1.5.0
- MindAR 1.2.2
- 純前端、單一 `index.html`、CDN 載入
- 不需要 Unity、不需要後端

## 功能

- 上傳 1–8 個卡蓋圖案，順序即為卡蓋位置 1、2、3…
- 每個圖案可設定一種內容：
  - 平面文字
  - 照片／PNG
  - 上傳影片（MP4／WebM）
  - 影片連結（YouTube／Vimeo／直接影片 URL）
  - 互動網頁（下方內容面板）
  - PDF（下方內容面板）
- 瀏覽器端 `compileImageTargets → exportData → Blob URL` 編譯 `.mind`
- 平面內容可調位置（上／下／左／右／正中）、與卡片間距、X／Y 偏移、大小、平放／面向鏡頭
- 卡片比例以悠遊卡 85.6 × 54 mm 為基準
- 2D 內容面板：網頁、YouTube／Vimeo、PDF 用可互動的下方面板開啟
- 鎖定後可左右滑動切換頁面；卡蓋圖案切換也會自動切到對應頁
- 追蹤穩定度預設：穩定（可切平衡／靈敏）
- 編譯成功後，卡蓋圖案、內容、設定與 `.mind` 會存在這台手機的 IndexedDB，重新整理可繼續，第二次進入通常不需重新編譯
- 返回時停止相機、銷毀場景、釋放 Blob URL

## 使用方式

1. 上傳卡蓋圖案（建議只拍圖案本身，避免大面積背景）。
2. 為每個圖案選擇內容類型，填入文字或選擇檔案／網址。
3. 在「AR 顯示位置」調整內容位置與大小；預設是卡片上方、平放、間距 0.45 cm。
4. 按「編譯並進入 AR」，允許相機權限。
5. 把鏡頭對準卡蓋圖案。若內容超出畫面，把手機往後退或把內容縮小。

## 辨識與抖動

- MindAR 是靠紋理與角點追蹤，不是理解卡片；大面積素色、反光或特徵太少的圖案會較不穩。
- 卡套表面反光會造成明顯抖動，霧面卡套或霧面貼膜通常比調參數有效。
- 預設使用「穩定」預設值（`filterMinCF: 0.0005`、`filterBeta: 100`、`missTolerance: 12`）。如果覺得慢半拍，可在設定改成「平衡」或「靈敏」。
- 內容離卡片越遠、越大，視覺上的抖動會被放大；先把大小降到 70–80% 測試。
- 掃描框已改成悠遊卡比例；讓圖案填滿框、避免反光。

## 本機預覽

相機需要 HTTPS 或 localhost。在這個目錄啟動靜態伺服器：

```bash
npx serve .
# 或
python -m http.server 8000
```

開啟 `http://localhost:8000`。

## 部署

### GitHub Pages

此倉庫已開啟 GitHub Pages（`main` / root）：

- https://yukauchi0v0.github.io/webar-card/

每次 push 到 `main` 會自動重新部署。

### Netlify Drop

也可以把 `index.html` 拖到 Netlify Drop（不要連 `.git` 目錄一起上傳）。

## 檔案

- `index.html`：完整應用程式
- `README.md`：本說明

## 版本

- `v0.1.0`：最初的弧形文字卡版本
- 目前 `main`：平面內容、卡蓋多 target、內容面板、位置控制、本機儲存

## 備註

- 第二版才會加入 3D 模型、GIF 動畫與音訊。
- iOS 請使用 Safari 16.4+，並允許相機權限。
- 本機設定只存在目前瀏覽器；換手機或無痕模式不會同步。
