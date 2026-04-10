(function (global) {
  const SHARE_CANVAS_PADDING = 32;
  const SHARE_CANVAS_BG = "#fffaf4";
  const SHARE_WATERMARK = "Japanote";
  let html2canvasLoaded = false;

  function loadHtml2Canvas() {
    if (html2canvasLoaded || global.html2canvas) {
      html2canvasLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.onload = () => { html2canvasLoaded = true; resolve(); };
      script.onerror = () => reject(new Error("html2canvas 로드 실패"));
      document.head.appendChild(script);
    });
  }

  function buildShareCard(resultViewId) {
    const resultView = document.getElementById(resultViewId);
    if (!resultView) return null;

    const card = document.createElement("div");
    card.style.cssText = `
      position:fixed;left:-9999px;top:0;width:400px;padding:${SHARE_CANVAS_PADDING}px;
      background:${SHARE_CANVAS_BG};font-family:"Noto Sans KR",sans-serif;color:#191516;
    `;

    const title = resultView.querySelector(".match-result-title");
    const stats = resultView.querySelectorAll(".match-result-stat");

    let html = `<div style="text-align:center;margin-bottom:20px;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700;">${SHARE_WATERMARK}</div>
      <div style="color:#625a56;font-size:0.88rem;margin-top:4px;">오늘도 일본어 해봐요</div>
    </div>`;

    if (title) {
      html += `<div style="font-size:1.1rem;font-weight:700;text-align:center;margin-bottom:16px;">${title.textContent}</div>`;
    }

    if (stats.length) {
      html += '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;">';
      stats.forEach((stat) => {
        const label = stat.querySelector("span")?.textContent || "";
        const value = stat.querySelector("strong")?.textContent || "0";
        const isCorrect = stat.dataset?.resultFilter === "correct";
        const isWrong = stat.dataset?.resultFilter === "wrong";
        const bg = isCorrect ? "rgba(95,174,139,0.15)" : isWrong ? "rgba(222,107,72,0.15)" : "rgba(25,21,22,0.06)";
        const color = isCorrect ? "#2d7a54" : isWrong ? "#b84430" : "#191516";
        html += `<div style="flex:1;padding:14px 10px;border-radius:16px;background:${bg};text-align:center;">
          <div style="font-size:0.82rem;color:#625a56;">${label}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;color:${color};margin-top:4px;">${value}</div>
        </div>`;
      });
      html += "</div>";
    }

    const items = resultView.querySelectorAll(".match-result-item");
    if (items.length > 0) {
      html += '<div style="display:grid;gap:8px;">';
      items.forEach((item) => {
        const status = item.classList.contains("is-correct") ? "correct" : "wrong";
        const badge = status === "correct" ? "정답" : "오답";
        const badgeBg = status === "correct" ? "rgba(95,174,139,0.18)" : "rgba(222,107,72,0.18)";
        const badgeColor = status === "correct" ? "#2d7a54" : "#b84430";
        const titleEl = item.querySelector("strong");
        const descEl = item.querySelector("p");
        html += `<div style="padding:12px 14px;border-radius:14px;background:rgba(25,21,22,0.04);border:1px solid rgba(25,21,22,0.08);">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:0.76rem;font-weight:700;">${badge}</span>
          <div style="margin-top:6px;font-weight:700;">${titleEl?.textContent || ""}</div>
          <div style="color:#625a56;font-size:0.9rem;">${descEl?.textContent || ""}</div>
        </div>`;
      });
      html += "</div>";
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    html += `<div style="text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid rgba(25,21,22,0.1);color:#625a56;font-size:0.8rem;">${dateStr}</div>`;

    card.innerHTML = html;
    return card;
  }

  async function captureResultImage(resultViewId) {
    await loadHtml2Canvas();
    const card = buildShareCard(resultViewId);
    if (!card) throw new Error("결과 영역을 찾을 수 없어요.");
    document.body.appendChild(card);
    try {
      return await global.html2canvas(card, {
        backgroundColor: SHARE_CANVAS_BG, scale: 2, useCORS: true, logging: false
      });
    } finally {
      card.remove();
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function tryNativeShare(blob, filename) {
    if (!navigator.share) return false;
    try {
      const file = new File([blob], filename, { type: "image/png" });
      const data = { files: [file] };
      if (navigator.canShare && !navigator.canShare(data)) return false;
      await navigator.share(data);
      return true;
    } catch (err) {
      if (err.name === "AbortError") return true; // 사용자가 취소한 것도 성공 취급
      return false;
    }
  }

  // ── 미리보기 모달 ──

  function removeModal() {
    const existing = document.getElementById("share-preview-modal");
    if (existing) existing.remove();
  }

  function showPreviewModal(canvas, blob, resultViewId) {
    removeModal();

    const filename = `japanote-result-${Date.now()}.png`;
    const dataUrl = canvas.toDataURL("image/png");

    const overlay = document.createElement("div");
    overlay.id = "share-preview-modal";
    overlay.className = "share-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "share-modal-panel";

    // 이미지 미리보기
    const img = document.createElement("img");
    img.src = dataUrl;
    img.className = "share-modal-image";
    img.alt = "퀴즈 결과 이미지";

    // 안내 문구
    const tip = document.createElement("p");
    tip.className = "share-modal-tip";
    tip.textContent = "이미지를 길게 눌러 저장하거나, 아래 버튼을 사용하세요.";

    // 버튼 영역
    const actions = document.createElement("div");
    actions.className = "share-modal-actions";

    // 공유 버튼 (navigator.share 있을 때만)
    if (navigator.share) {
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "primary-btn button-with-icon";
      shareBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">share</span><span>공유하기</span>';
      shareBtn.addEventListener("click", async () => {
        const shared = await tryNativeShare(blob, filename);
        if (!shared) {
          downloadBlob(blob, filename);
        }
      });
      actions.appendChild(shareBtn);
    }

    // 저장 버튼
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "secondary-btn button-with-icon";
    saveBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span><span>이미지 저장</span>';
    saveBtn.addEventListener("click", () => {
      downloadBlob(blob, filename);
    });
    actions.appendChild(saveBtn);

    // 닫기 버튼
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "secondary-btn button-with-icon";
    closeBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">close</span><span>닫기</span>';
    closeBtn.addEventListener("click", removeModal);
    actions.appendChild(closeBtn);

    panel.append(img, tip, actions);
    overlay.appendChild(panel);

    // 배경 클릭으로 닫기
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) removeModal();
    });

    document.body.appendChild(overlay);
  }

  // ── 공유 버튼 ──

  function createShareButton(resultViewId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn button-with-icon share-result-btn";

    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "share";

    const label = document.createElement("span");
    label.textContent = "결과 공유하기";

    button.append(icon, label);

    button.addEventListener("click", async () => {
      const originalLabel = label.textContent;
      label.textContent = "이미지 생성 중...";
      button.disabled = true;

      try {
        const canvas = await captureResultImage(resultViewId);
        const blob = await canvasToBlob(canvas);
        showPreviewModal(canvas, blob, resultViewId);
        label.textContent = originalLabel;
      } catch {
        label.textContent = "다시 시도해주세요";
        setTimeout(() => { label.textContent = originalLabel; }, 2000);
      } finally {
        button.disabled = false;
      }
    });

    return button;
  }

  function attachShareButton(resultViewId) {
    const resultView = document.getElementById(resultViewId);
    if (!resultView || resultView.querySelector(".share-result-btn")) return;

    const button = createShareButton(resultViewId);
    const footer = document.createElement("div");
    footer.className = "match-result-share-footer";
    footer.appendChild(button);
    resultView.appendChild(footer);
  }

  global.japanoteShareResult = {
    captureResultImage,
    createShareButton,
    attachShareButton
  };

  document.querySelectorAll(".match-result-view").forEach((view) => {
    if (view.id) attachShareButton(view.id);
  });
})(globalThis);
