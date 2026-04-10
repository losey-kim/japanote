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
      script.onload = () => {
        html2canvasLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error("html2canvas 로드 실패"));
      document.head.appendChild(script);
    });
  }

  function buildShareCard(resultViewId) {
    const resultView = document.getElementById(resultViewId);
    if (!resultView) return null;

    const card = document.createElement("div");
    card.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: 400px; padding: ${SHARE_CANVAS_PADDING}px;
      background: ${SHARE_CANVAS_BG};
      font-family: "Noto Sans KR", sans-serif;
      color: #191516;
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
    const maxItems = Math.min(items.length, 5);
    if (maxItems > 0) {
      html += '<div style="display:grid;gap:8px;">';
      for (let i = 0; i < maxItems; i++) {
        const item = items[i];
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
      }
      if (items.length > maxItems) {
        html += `<div style="text-align:center;color:#625a56;font-size:0.88rem;">외 ${items.length - maxItems}개 더</div>`;
      }
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
      const canvas = await global.html2canvas(card, {
        backgroundColor: SHARE_CANVAS_BG,
        scale: 2,
        useCORS: true,
        logging: false
      });
      return canvas;
    } finally {
      card.remove();
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareResult(resultViewId) {
    const canvas = await captureResultImage(resultViewId);
    const blob = await canvasToBlob(canvas);
    const filename = `japanote-result-${Date.now()}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // 1순위: Web Share API (모바일 공유시트)
    if (navigator.share) {
      try {
        const shareData = { files: [file] };
        // canShare 체크가 가능하면 확인, 없으면 바로 시도
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return "shared";
        }
      } catch (err) {
        if (err.name === "AbortError") return "cancelled";
        // share 실패 시 아래 폴백으로
      }

      // 파일 공유 안 되면 텍스트+URL로라도 공유시트 띄우기
      try {
        await navigator.share({
          title: "Japanote 퀴즈 결과",
          text: buildShareText(resultViewId)
        });
        return "shared";
      } catch (err) {
        if (err.name === "AbortError") return "cancelled";
      }
    }

    // 2순위: 클립보드에 이미지 복사
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        return "copied";
      } catch {
        // 클립보드도 실패하면 다운로드
      }
    }

    // 3순위: 다운로드
    downloadBlob(blob, filename);
    return "downloaded";
  }

  function buildShareText(resultViewId) {
    const resultView = document.getElementById(resultViewId);
    if (!resultView) return "";

    const stats = resultView.querySelectorAll(".match-result-stat");
    const parts = ["📝 Japanote 퀴즈 결과"];

    stats.forEach((stat) => {
      const label = stat.querySelector("span")?.textContent || "";
      const value = stat.querySelector("strong")?.textContent || "0";
      if (label && value) parts.push(`${label}: ${value}`);
    });

    return parts.join(" | ");
  }

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
        const result = await shareResult(resultViewId);
        const feedbackMap = {
          shared: "공유했어요",
          copied: "클립보드에 복사했어요",
          downloaded: "이미지가 저장됐어요",
          cancelled: "취소했어요"
        };
        label.textContent = feedbackMap[result] || "완료";
        setTimeout(() => { label.textContent = originalLabel; }, 2000);
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
    shareResult,
    captureResultImage,
    createShareButton,
    attachShareButton
  };

  // 모든 결과 뷰에 공유 버튼 자동 부착
  document.querySelectorAll(".match-result-view").forEach((view) => {
    if (view.id) {
      attachShareButton(view.id);
    }
  });
})(globalThis);
