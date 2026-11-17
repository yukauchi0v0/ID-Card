// The only copy of the AR HUD / scan guide / panel / toast markup. Hosting
// pages call mountArShell() before importing their app module, because
// js/ar/dom.js resolves these ids at module-evaluation time.
let mounted = false;

export function mountArShell({ backLabel = "返回設定" } = {}) {
  if (mounted || document.getElementById("arRoot")) return;
  mounted = true;

  const shell = `
    <div id="arRoot" hidden></div>

    <div id="arHud" hidden>
      <div class="hud-top">
        <button id="backBtn" class="icon-btn" type="button" aria-label="返回設定">← <span>返回</span></button>
        <div class="hud-title">
          <span>ID CARD</span>
          <strong id="hudLabel">等待識別</strong>
        </div>
        <span id="hudMode" class="mode-pill">掃描中</span>
      </div>

      <div id="scanGuide" class="scan-guide">
        <span class="guide-corner tl"></span>
        <span class="guide-corner tr"></span>
        <span class="guide-corner bl"></span>
        <span class="guide-corner br"></span>
        <p>將鏡頭對準卡蓋圖案，避免反光</p>
      </div>

      <div class="hud-bottom">
        <div id="dots" class="dots" role="tablist" aria-label="AR 頁面"></div>
        <div class="hud-meta">
          <span id="pageCounter">01 / 01</span>
          <span class="sep"></span>
          <span id="swipeHint">左右滑動切換</span>
        </div>
      </div>

      <div id="errorPanel" class="error-panel" hidden>
        <div class="error-card">
          <div class="error-icon">!</div>
          <h2>相機沒有啟動</h2>
          <p>
            請確認：<br />
            · 頁面是透過 HTTPS 或 localhost 打開的；<br />
            · 瀏覽器已允許相機權限；<br />
            · 沒有使用不支援相機的內建瀏覽器。
          </p>
          <button id="errorBackBtn" type="button">返回設定</button>
        </div>
      </div>
    </div>

    <button id="videoSoundBtn" class="video-sound-btn" type="button" hidden>開啟聲音</button>
    <button id="panelOpenBtn" class="panel-open-btn" type="button" hidden>開啟內容面板</button>

    <section id="contentPanel" aria-label="內容面板" aria-hidden="true" inert>
      <div class="content-panel-head">
        <button id="panelPrev" class="panel-arrow" type="button" aria-label="上一頁">‹</button>
        <button id="panelNext" class="panel-arrow" type="button" aria-label="下一頁">›</button>
        <div class="panel-title-wrap">
          <span id="panelKicker">WEB CONTENT</span>
          <strong id="panelTitle">內容</strong>
        </div>
        <a id="panelOpenExternal" class="panel-link" href="#" target="_blank" rel="noopener">另開</a>
        <button id="panelClose" class="panel-close" type="button">收起</button>
      </div>
      <div id="panelBody"></div>
    </section>

    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  `;

  document.body.insertAdjacentHTML("beforeend", shell);

  const back = document.getElementById("backBtn");
  if (back) {
    const label = back.querySelector("span");
    if (label) label.textContent = backLabel;
    back.setAttribute("aria-label", backLabel);
  }
  const errorBack = document.getElementById("errorBackBtn");
  if (errorBack) errorBack.textContent = backLabel;
}
