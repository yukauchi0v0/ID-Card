# WebAR Card

單檔 WebAR 頁面：上傳 1–8 張識別圖，在瀏覽器端編譯成 MindAR `.mind`，掃描後用 `<a-curvedimage>` 顯示由 Canvas 即時生成的弧形資訊卡。

## 技術

- A-Frame 1.5.0
- MindAR 1.2.2
- 純前端、單一 `index.html`、CDN 載入
- 不需要 Unity、不需要後端

## 功能

- 上傳多張識別圖（最多 8 張），每張可填標題與多行正文
- 瀏覽器端 `compileImageTargets → exportData → Blob URL`
- 動態建立 `<a-scene>`，每張圖對應一個 `mindar-image-target`
- 弧形畫面顯示使用者填寫的文字，不顯示識別圖本身
- 鎖定識別圖後可左右滑動循環切換頁面
- 返回時停止攝影機、銷毀場景、釋放 Blob URL

## 本機預覽

攝影機需要 HTTPS 或 localhost。可在這個目錄啟動一個靜態伺服器：

```bash
npx serve .
# 或
python -m http.server 8000
```

然後開啟 `http://localhost:8000`。

## 部署

### Netlify Drop

把整個資料夾拖到 Netlify Drop，取得 HTTPS 網址即可用手機測試。

### GitHub Pages

1. 將此倉庫推到 GitHub。
2. Settings → Pages → Build and deployment。
3. Source 選 `Deploy from a branch`，Branch 選 `main`，資料夾選 `/ (root)`。
4. 開啟產生的 `https://<帳號>.github.io/<repo>/`。

## 使用提醒

- 識別圖只負責觸發。AR 畫面內容來自表單文字，與識別圖外觀無關。
- 請使用紋理豐富、對比明顯的圖片；特徵點太少的圖可能不容易被追蹤。
- 第一次編譯在手機上可能需要數秒到數十秒，全部在本機完成，不會上傳圖片。
- iOS 請使用 Safari 16.4+，並允許相機權限。
