(function (global) {
  const SHARE_CANVAS_PADDING = 32;
  const SHARE_CANVAS_BG = "#fffaf4";
  const SHARE_WATERMARK = "Japanote";
  const MAX_COMPARISON_LIST_ITEMS = 12;
  const GAME_LABELS = {
    "match-result": "단어 짝맞추기",
    "kanji-match-result": "한자 짝맞추기",
    "grammar-match-result": "문법 짝맞추기",
    "vocab-quiz-result": "단어 퀴즈",
    "kanji-practice-result": "한자 퀴즈",
    "grammar-practice-result": "문법 퀴즈",
    "reading-practice-result": "독해 퀴즈",
    "kana-quiz-result": "문자 퀴즈"
  };

  let html2canvasLoaded = false;

  function getGameLabel(resultViewId) {
    for (const [prefix, label] of Object.entries(GAME_LABELS)) {
      if (resultViewId.startsWith(prefix)) {
        return label;
      }
    }

    return "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function buildComparisonListMarkup(items = []) {
    const safeItems = Array.isArray(items) ? items : [];
    const visibleItems = safeItems.slice(0, MAX_COMPARISON_LIST_ITEMS);
    const hiddenCount = Math.max(safeItems.length - visibleItems.length, 0);

    if (!visibleItems.length) {
      return '<div style="font-size:0.82rem;color:#625a56;">기록이 없어요.</div>';
    }

    const rows = visibleItems.map((item) => {
      const emoji = item?.status === "correct" ? "⭕" : "❌";
      const label = escapeHtml(item?.label || item?.title || "");

      return `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(25,21,22,0.06);font-size:0.84rem;line-height:1.45;">
          <span style="flex-shrink:0;font-size:0.92rem;line-height:1.2;">${emoji}</span>
          <span style="min-width:0;word-break:keep-all;overflow-wrap:anywhere;">${label}</span>
        </div>
      `;
    }).join("");

    const more = hiddenCount > 0
      ? `<div style="padding-top:8px;font-size:0.8rem;color:#625a56;">외 ${hiddenCount}개</div>`
      : "";

    return `${rows}${more}`;
  }

  function buildComparisonShareMarkup(resultViewId) {
    const snapshot = global.japanoteChallengeLinks?.getComparisonSnapshot?.(resultViewId);

    if (!snapshot) {
      return "";
    }

    const buildColumnMarkup = (label, result, items) => `
      <section style="display:grid;gap:12px;padding:14px;border-radius:18px;border:1px solid rgba(25,21,22,0.08);background:rgba(255,255,255,0.78);">
        <div>
          <div style="font-size:0.8rem;color:#625a56;">${escapeHtml(label)}</div>
          <div style="margin-top:4px;font-family:'Space Grotesk',sans-serif;font-size:1.4rem;font-weight:700;color:#191516;">${result.correct} / ${result.total}</div>
          <div style="margin-top:6px;font-size:0.82rem;line-height:1.55;color:#625a56;">
            정답 ${result.correct}개 · 오답 ${result.wrong}개 · 정확도 ${result.accuracy}%
          </div>
        </div>
        <div style="padding:10px 12px;border-radius:14px;background:rgba(25,21,22,0.03);">
          ${buildComparisonListMarkup(items)}
        </div>
      </section>
    `;

    return `
      <div style="margin-top:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.08em;color:#625a56;text-transform:uppercase;">친구 도전 비교</span>
          <strong style="font-size:0.94rem;color:#191516;">${escapeHtml(snapshot.outcome.text)}</strong>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          ${buildColumnMarkup("친구 기록", snapshot.sourceResult, snapshot.sourceItems)}
          ${buildColumnMarkup("내 기록", snapshot.currentResult, snapshot.currentItems)}
        </div>
      </div>
    `;
  }

  function buildStandardShareMarkup(resultView) {
    const stats = resultView.querySelectorAll(".match-result-stat");
    const items = resultView.querySelectorAll(".match-result-item");
    let html = "";

    if (stats.length) {
      html += '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:4px;">';
      stats.forEach((stat) => {
        const label = stat.querySelector("span")?.textContent || "";
        const value = stat.querySelector("strong")?.textContent || "0";
        const isCorrect = stat.dataset?.resultFilter === "correct";
        const isWrong = stat.dataset?.resultFilter === "wrong";
        const bg = isCorrect ? "rgba(95,174,139,0.15)" : isWrong ? "rgba(222,107,72,0.15)" : "rgba(25,21,22,0.06)";
        const color = isCorrect ? "#2d7a54" : isWrong ? "#b84430" : "#191516";

        html += `<div style="flex:1;padding:10px 10px;border-radius:14px;background:${bg};text-align:center;">
          <div style="font-size:0.78rem;color:#625a56;">${escapeHtml(label)}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.4rem;font-weight:700;color:${color};margin-top:2px;">${escapeHtml(value)}</div>
        </div>`;
      });
      html += "</div>";
    }

    if (items.length > 0) {
      html += '<div style="margin-top:4px;border-top:1px solid rgba(25,21,22,0.08);padding-top:12px;">';
      items.forEach((item) => {
        const isCorrect = item.classList.contains("is-correct");
        const icon = isCorrect ? "⭕" : "❌";
        const title = item.querySelector("strong")?.textContent || "";
        const description = item.querySelector("p")?.textContent || "";

        html += `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:0.88rem;line-height:1.45;">
          <span style="flex-shrink:0;font-size:0.92rem;line-height:1.2;">${icon}</span>
          <div style="min-width:0;flex:1;">
            <span style="font-weight:600;word-break:keep-all;overflow-wrap:anywhere;">${escapeHtml(title)}</span>
            ${description ? `<span style="color:#625a56;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;"> ${escapeHtml(description)}</span>` : ""}
          </div>
        </div>`;
      });
      html += "</div>";
    }

    return html;
  }

  function buildShareCard(resultViewId) {
    const resultView = document.getElementById(resultViewId);
    const comparisonSnapshot = global.japanoteChallengeLinks?.getComparisonSnapshot?.(resultViewId);

    if (!resultView) {
      return null;
    }

    const card = document.createElement("div");
    const gameLabel = getGameLabel(resultViewId);
    const width = comparisonSnapshot ? 560 : 460;

    card.style.cssText = `
      position:fixed;
      left:-9999px;
      top:0;
      width:${width}px;
      padding:${SHARE_CANVAS_PADDING}px;
      background:${SHARE_CANVAS_BG};
      font-family:"Noto Sans KR",sans-serif;
      color:#191516;
    `;

    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;font-weight:700;">${SHARE_WATERMARK}</div>
      ${gameLabel ? `<span style="padding:5px 14px;border-radius:999px;background:rgba(25,21,22,0.06);font-size:0.82rem;font-weight:600;color:#625a56;">${gameLabel}</span>` : ""}
    </div>`;

    if (comparisonSnapshot) {
      html += buildComparisonShareMarkup(resultViewId);
    } else {
      html += buildStandardShareMarkup(resultView);
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    html += `<div style="text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid rgba(25,21,22,0.1);color:#625a56;font-size:0.82rem;">${dateStr}</div>`;

    card.innerHTML = html;
    return card;
  }

  async function captureResultImage(resultViewId) {
    await loadHtml2Canvas();
    const card = buildShareCard(resultViewId);

    if (!card) {
      throw new Error("결과 영역을 찾을 수 없어요");
    }

    document.body.appendChild(card);

    try {
      return await global.html2canvas(card, {
        backgroundColor: SHARE_CANVAS_BG,
        scale: 3,
        useCORS: true,
        logging: false
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
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function parseCountText(value) {
    const match = String(value || "").match(/\d+/u);
    return match ? Number(match[0]) : 0;
  }

  function readShareResultSummary(resultViewId) {
    const comparisonSnapshot = global.japanoteChallengeLinks?.getComparisonSnapshot?.(resultViewId);

    if (comparisonSnapshot?.currentResult) {
      return comparisonSnapshot.currentResult;
    }

    const resultView = document.getElementById(resultViewId);

    if (!resultView) {
      return null;
    }

    const stats = Array.from(resultView.querySelectorAll(".match-result-stat"));

    if (!stats.length) {
      return null;
    }

    const correct = parseCountText(
      stats.find((stat) => stat.dataset?.resultFilter === "correct")?.querySelector("strong")?.textContent
    );
    const wrong = parseCountText(
      stats.find((stat) => stat.dataset?.resultFilter === "wrong")?.querySelector("strong")?.textContent
    );
    const total = Math.max(correct + wrong, parseCountText(stats[0]?.querySelector("strong")?.textContent));

    if (!total) {
      return null;
    }

    return {
      correct,
      wrong,
      total
    };
  }

  function buildSharePrompt(resultViewId, challengeUrl = "") {
    const gameLabel = getGameLabel(resultViewId);
    const summary = readShareResultSummary(resultViewId);
    const intro = summary?.total
      ? `${gameLabel ? `${gameLabel} ` : ""}${summary.correct}/${summary.total} 맞혔어요.`
      : gameLabel
        ? `${gameLabel}에 도전해 보세요.`
        : "Japanote 친구 도전에 도전해 보세요.";
    const lines = [`${intro} 저보다 많이 맞출 수 있어요?`];

    if (challengeUrl) {
      lines.push(challengeUrl);
    }

    return lines.join("\n");
  }

  async function resolveChallengeShareData(resultViewId) {
    const challengeLinks = global.japanoteChallengeLinks;

    if (!challengeLinks || typeof challengeLinks.buildChallengeLink !== "function") {
      return { url: "", error: "" };
    }

    try {
      return await challengeLinks.buildChallengeLink(resultViewId);
    } catch (error) {
      console.error("Failed to build challenge link for share.", error);
      return { url: "", error: "" };
    }
  }

  async function tryNativeShare(blob, filename, resultViewId) {
    if (!navigator.share) {
      return false;
    }

    try {
      const file = new File([blob], filename, { type: "image/png" });
      const { url: challengeUrl } = await resolveChallengeShareData(resultViewId);
      const shareText = buildSharePrompt(resultViewId, challengeUrl);
      const shareTitle = getGameLabel(resultViewId) || "Japanote 친구 도전";
      // 일부 모바일 공유 대상은 files와 url 조합을 제대로 처리하지 않아 텍스트에 링크를 함께 넣는다.
      const candidates = [
        { files: [file], title: shareTitle, text: shareText },
        { files: [file], text: shareText },
        { files: [file] }
      ];
      let shared = false;

      for (const data of candidates) {
        if (navigator.canShare && !navigator.canShare(data)) {
          continue;
        }

        await navigator.share(data);
        shared = true;
        break;
      }

      return shared;
    } catch (error) {
      if (error.name === "AbortError") {
        return true;
      }

      return false;
    }
  }

  function removeModal() {
    const existing = document.getElementById("share-preview-modal");

    if (existing) {
      existing.remove();
    }
  }

  function showPreviewModal(canvas, blob, resultViewId) {
    removeModal();

    const filename = `japanote-result-${Date.now()}.png`;
    const dataUrl = canvas.toDataURL("image/png");
    const overlay = document.createElement("div");
    const panel = document.createElement("div");
    const img = document.createElement("img");
    const tip = document.createElement("p");
    const actions = document.createElement("div");
    const saveBtn = document.createElement("button");
    const closeBtn = document.createElement("button");

    overlay.id = "share-preview-modal";
    overlay.className = "share-modal-overlay";

    panel.className = "share-modal-panel";

    img.src = dataUrl;
    img.className = "share-modal-image";
    img.alt = "퀴즈 결과 이미지";

    tip.className = "share-modal-tip";
    tip.textContent = navigator.share && global.japanoteChallengeLinks?.buildChallengeLink
      ? "공유하기를 누르면 결과 이미지와 도전 링크를 함께 보낼 수 있어요."
      : "이미지를 길게 눌러 저장할 수도 있어요.";

    actions.className = "share-modal-actions";

    if (navigator.share) {
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "primary-btn button-with-icon";
      shareBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">share</span><span>공유하기</span>';
      shareBtn.addEventListener("click", async () => {
        shareBtn.disabled = true;
        const shared = await tryNativeShare(blob, filename, resultViewId);
        shareBtn.disabled = false;

        if (!shared) {
          downloadBlob(blob, filename);
        }
      });
      actions.appendChild(shareBtn);
    }

    saveBtn.type = "button";
    saveBtn.className = "secondary-btn button-with-icon";
    saveBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span><span>이미지 저장</span>';
    saveBtn.addEventListener("click", () => {
      downloadBlob(blob, filename);
    });
    actions.appendChild(saveBtn);

    closeBtn.type = "button";
    closeBtn.className = "share-modal-close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">close</span>';
    closeBtn.addEventListener("click", removeModal);

    panel.append(closeBtn, actions, img, tip);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        removeModal();
      }
    });

    document.body.appendChild(overlay);
  }

  function createShareButton(resultViewId) {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    button.type = "button";
    button.className = "secondary-btn button-with-icon share-result-btn";

    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "share";

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
      } catch (error) {
        console.error("Failed to capture result image.", error);
        label.textContent = "다시 시도해 주세요";
        setTimeout(() => {
          label.textContent = originalLabel;
        }, 2000);
      } finally {
        button.disabled = false;
      }
    });

    return button;
  }

  function attachShareButton(resultViewId) {
    const resultView = document.getElementById(resultViewId);

    if (!resultView || resultView.querySelector(".share-result-btn")) {
      return;
    }

    const challengeLinks = global.japanoteChallengeLinks;
    const button = createShareButton(resultViewId);
    const challengeButton =
      challengeLinks && typeof challengeLinks.createChallengeButton === "function"
        ? challengeLinks.createChallengeButton(resultViewId)
        : null;
    const footer = document.createElement("div");
    const statsGrid = resultView.querySelector(".match-result-grid");
    const filters = resultView.querySelector(".match-result-filters");
    const insertBefore = filters || (statsGrid ? statsGrid.nextElementSibling : null);

    footer.className = "match-result-share-footer";
    footer.appendChild(button);

    if (challengeButton) {
      footer.appendChild(challengeButton);
    }

    if (insertBefore) {
      resultView.insertBefore(footer, insertBefore);
    } else {
      resultView.insertBefore(footer, resultView.children[1] || null);
    }

    challengeLinks?.syncResultComparison?.(resultViewId);
  }

  global.japanoteShareResult = {
    captureResultImage,
    createShareButton,
    attachShareButton
  };

  document.querySelectorAll(".match-result-view").forEach((view) => {
    if (view.id) {
      attachShareButton(view.id);
    }
  });
})(globalThis);
