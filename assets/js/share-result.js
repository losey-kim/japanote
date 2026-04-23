(function (global) {
  const SHARE_CANVAS_PADDING = 36;
  /** html2canvas: 그라데이션/반투明은 얼룩·투명(눈으로는 체크무늬처럼 보임)이 나기 쉬움 — 캡처용은 단색·불투明만 */
  const SHARE_CANVAS_BG = "#fff0e6";
  const SHARE_CAPTURE_CLEAR_COLOR = "#fff0e6";
  const SHARE_CARD_SHADOW =
    "0 1px 2px rgba(25, 21, 22, 0.04), 0 10px 32px rgba(200, 86, 58, 0.09), 0 28px 64px rgba(200, 75, 53, 0.06)";
  const SHARE_CARD_INSET =
    "inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -1px 0 rgba(25, 21, 22, 0.05)";
  const SHARE_CARD_SURFACE = "#fff7f0";
  const SHARE_CARD_HEADER_BG = "#fff1e8";
  const SHARE_CARD_FOOTER_BG = "#f0e4d9";
  const SHARE_WATERMARK = "Japanote";
  /** 도전 비교용 공유 이미지: 전체 항목 표시 */
  const MAX_COMPARISON_LIST_ITEMS = Number.POSITIVE_INFINITY;
  /** html2canvas·모바일 WebView에서 이모지(⭕❌)가 깨지는 경우가 있어 벡터로 표시 */
  const SHARE_ICON_SVG_CORRECT =
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"display:block\"><circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"#4a9f78\"/><path fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M7.5 12.2l2.8 2.8L17 8.5\"/></svg>";
  const SHARE_ICON_SVG_WRONG =
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"display:block\"><circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"#d96548\"/><path stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\" d=\"M8 8l8 8M16 8l-8 8\"/></svg>";

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

  function formatShareSemicolons(value) {
    if (value == null) {
      return "";
    }
    const h = global.japanoteStudyViewHelpers;
    if (h && typeof h.formatQuizSemicolonsToCommaList === "function") {
      return h.formatQuizSemicolonsToCommaList(value);
    }
    return String(value).replace(/\s*;\s*/g, ", ").trim();
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
      return '<div style="font-size:0.82rem;color:#8a8078;text-align:center;padding:8px;">기록이 없어요.</div>';
    }

    const rows = visibleItems.map((item) => {
      const ok = item?.status === "correct";
      const iconSvg = ok ? SHARE_ICON_SVG_CORRECT : SHARE_ICON_SVG_WRONG;
      const label = escapeHtml(formatShareSemicolons(item?.label || item?.title || ""));
      const rowBg = ok ? "rgba(95,174,139,0.07)" : "rgba(222,107,72,0.07)";
      const border = ok ? "rgba(95,174,139,0.2)" : "rgba(222,107,72,0.2)";

      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:14px;background:${rowBg};border:1px solid ${border};font-size:0.83rem;line-height:1.45;">
          <span style="flex-shrink:0;width:26px;height:26px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#f4e9e2;line-height:0;">${iconSvg}</span>
          <span style="min-width:0;word-break:keep-all;overflow-wrap:anywhere;color:#2a2624;padding-top:1px;">${label}</span>
        </div>
      `;
    }).join("");

    const more = hiddenCount > 0
      ? `<div style="padding-top:10px;font-size:0.78rem;color:#8a8078;text-align:center;">외 ${hiddenCount}개</div>`
      : "";

    return `${rows}${more}`;
  }

  function buildComparisonShareMarkup(resultViewId) {
    const snapshot = global.japanoteChallengeLinks?.getComparisonSnapshot?.(resultViewId);

    if (!snapshot) {
      return "";
    }

    const buildColumnMarkup = (label, result, items) => `
      <section style="display:grid;gap:12px;padding:16px 15px;border-radius:20px;border:1px solid rgba(25,21,22,0.08);background:#fff4ec;box-shadow:0 3px 14px rgba(25,21,22,0.05);">
        <div>
          <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:#a8988e;text-transform:uppercase;">${escapeHtml(label)}</div>
          <div style="margin-top:8px;font-family:'Space Grotesk',sans-serif;font-size:1.48rem;font-weight:700;letter-spacing:-0.04em;color:#1a1614;line-height:1;">${result.correct}<span style="font-size:1.05rem;font-weight:600;color:#c4bbb3;margin:0 4px;">/</span>${result.total}</div>
          <div style="margin-top:8px;font-size:0.78rem;line-height:1.55;color:#7a716a;">
            정답 ${result.correct}개 · 오답 ${result.wrong}개 · 정확도 ${result.accuracy}%
          </div>
        </div>
        <div style="padding:9px 9px;border-radius:15px;background:#f7ebe4;border:1px solid rgba(25,21,22,0.08);display:grid;gap:7px;">
          ${buildComparisonListMarkup(items)}
        </div>
      </section>
    `;

    return `
      <div style="margin-top:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px;padding:12px 14px;border-radius:16px;background:#ffeee8;border:1px solid rgba(241,98,72,0.2);">
          <span style="font-size:0.74rem;font-weight:700;letter-spacing:0.09em;color:#a85a48;text-transform:uppercase;">친구 도전 비교</span>
          <strong style="font-size:0.96rem;color:#1a1614;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(snapshot.outcome.text)}</strong>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;">
          ${buildColumnMarkup("친구 기록", snapshot.sourceResult, snapshot.sourceItems)}
          ${buildColumnMarkup("내 기록", snapshot.currentResult, snapshot.currentItems)}
        </div>
      </div>
    `;
  }

  function buildStandardShareMarkup(resultView, resultViewId) {
    const summary = readShareResultSummary(resultViewId);
    const stats = resultView.querySelectorAll(".match-result-stat");
    const items = resultView.querySelectorAll(".match-result-item");
    let html = "";

    if (summary?.total) {
      const accuracy = Math.min(100, Math.max(0, Math.round((summary.correct / summary.total) * 100)));
      html += `
        <div style="text-align:center;padding:4px 2px 20px;">
          <div style="display:inline-block;margin-bottom:12px;padding:4px 12px;border-radius:999px;background:#fde8e0;border:1px solid rgba(241,98,72,0.18);">
            <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.16em;color:#c75d45;">RESULT</span>
          </div>
          <div style="padding:18px 22px 20px;border-radius:22px;background:#fff2e8;border:1px solid rgba(25,21,22,0.07);box-shadow:0 4px 18px rgba(25,21,22,0.05);">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:2.65rem;font-weight:700;letter-spacing:-0.06em;line-height:1;color:#1a1614;">
              ${summary.correct}<span style="font-size:1.45rem;font-weight:600;color:#c9c0b8;margin:0 4px;">/</span>${summary.total}
            </div>
            <div style="margin-top:6px;font-size:0.78rem;color:#9a918a;font-weight:500;">맞힌 문제</div>
          </div>
          <div style="margin-top:14px;display:flex;justify-content:center;flex-wrap:wrap;gap:7px;">
            <span style="padding:6px 13px;border-radius:999px;background:rgba(95,174,139,0.11);border:1px solid rgba(95,174,139,0.22);color:#1f6b4a;font-size:0.76rem;font-weight:600;">정답 ${summary.correct}</span>
            <span style="padding:6px 13px;border-radius:999px;background:rgba(222,107,72,0.09);border:1px solid rgba(222,107,72,0.2);color:#8f3a26;font-size:0.76rem;font-weight:600;">오답 ${summary.wrong}</span>
            <span style="padding:6px 13px;border-radius:999px;background:rgba(25,21,22,0.04);border:1px solid rgba(25,21,22,0.08);color:#5a524a;font-size:0.76rem;font-weight:600;">정확도 ${accuracy}%</span>
          </div>
        </div>`;
    } else if (stats.length) {
      html += '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:6px;">';
      stats.forEach((stat) => {
        const label = stat.querySelector("span")?.textContent || "";
        const value = stat.querySelector("strong")?.textContent || "0";
        const isCorrect = stat.dataset?.resultFilter === "correct";
        const isWrong = stat.dataset?.resultFilter === "wrong";
        const bg = isCorrect ? "rgba(95,174,139,0.14)" : isWrong ? "rgba(222,107,72,0.12)" : "rgba(25,21,22,0.06)";
        const color = isCorrect ? "#246748" : isWrong ? "#9a3f28" : "#1a1614";
        const border = isCorrect ? "rgba(95,174,139,0.28)" : isWrong ? "rgba(222,107,72,0.25)" : "rgba(25,21,22,0.08)";

        html += `<div style="flex:1;min-width:0;padding:12px 8px;border-radius:17px;background:${bg};border:1px solid ${border};text-align:center;">
          <div style="font-size:0.72rem;font-weight:600;color:#7a7168;letter-spacing:-0.01em;">${escapeHtml(label)}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.38rem;font-weight:700;color:${color};margin-top:5px;letter-spacing:-0.04em;">${escapeHtml(value)}</div>
        </div>`;
      });
      html += "</div>";
    }

    if (items.length > 0) {
      const topBorder = summary?.total || stats.length ? "margin-top:6px;border-top:1px solid rgba(25,21,22,0.07);padding-top:16px;" : "";
      html += `<div style="${topBorder}display:grid;gap:8px;">`;
      items.forEach((item) => {
        const isCorrect = item.classList.contains("is-correct");
        const iconSvg = isCorrect ? SHARE_ICON_SVG_CORRECT : SHARE_ICON_SVG_WRONG;
        const title = formatShareSemicolons(item.querySelector("strong")?.textContent || "");
        const description = formatShareSemicolons(item.querySelector("p")?.textContent || "");
        const rowBg = isCorrect ? "rgba(95,174,139,0.06)" : "rgba(222,107,72,0.07)";
        const accent = isCorrect ? "#3d8f6a" : "#c75d45";
        const border = isCorrect ? "rgba(95,174,139,0.18)" : "rgba(222,107,72,0.2)";

        html += `<div style="display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border-radius:15px;background:${rowBg};border:1px solid ${border};font-size:0.86rem;line-height:1.45;">
          <span style="flex-shrink:0;width:3px;align-self:stretch;border-radius:999px;background:${accent};min-height:2.4em;"></span>
          <span style="flex-shrink:0;width:28px;height:28px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#f7ebe4;line-height:0;box-shadow:0 1px 2px rgba(25,21,22,0.06);">${iconSvg}</span>
          <div style="min-width:0;flex:1;padding-top:1px;">
            <span style="font-weight:600;color:#1a1614;word-break:keep-all;overflow-wrap:anywhere;letter-spacing:-0.02em;">${escapeHtml(title)}</span>
            ${description ? `<div style="margin-top:4px;color:#756d66;font-size:0.81rem;font-weight:500;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;">${escapeHtml(description)}</div>` : ""}
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
    const width = comparisonSnapshot ? 580 : 440;

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

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

    const bodyContent = comparisonSnapshot
      ? buildComparisonShareMarkup(resultViewId)
      : buildStandardShareMarkup(resultView, resultViewId);

    const badge = gameLabel
      ? `<span style="padding:6px 14px;border-radius:999px;background:#fff5ee;border:1px solid rgba(25,21,22,0.1);font-size:0.76rem;font-weight:600;color:#5a524a;box-shadow:0 1px 3px rgba(25,21,22,0.04);letter-spacing:-0.02em;">${escapeHtml(gameLabel)}</span>`
      : "";

    card.innerHTML = `
      <div data-japanote-share-capture="1" style="border-radius:28px;overflow:hidden;background:${SHARE_CARD_SURFACE};border:1px solid rgba(25,21,22,0.055);box-shadow:${SHARE_CARD_SHADOW}, ${SHARE_CARD_INSET};">
        <div style="position:relative;padding:20px 22px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:${SHARE_CARD_HEADER_BG};border-bottom:1px solid rgba(25,21,22,0.06);">
          <div style="position:absolute;right:-28px;top:-36px;width:130px;height:130px;border-radius:50%;background:rgba(241,98,72,0.1);pointer-events:none;opacity:0.85;"></div>
          <div style="display:flex;align-items:center;gap:12px;min-width:0;position:relative;z-index:1;">
            <div style="width:4px;height:28px;border-radius:999px;background:#e86b4a;flex-shrink:0;box-shadow:0 1px 4px rgba(232,93,61,0.25);"></div>
            <div style="min-width:0;">
              <div style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;font-weight:700;letter-spacing:-0.03em;color:#1a1614;line-height:1.12;">${SHARE_WATERMARK}</div>
              <div style="font-size:0.7rem;color:#9a9189;margin-top:4px;letter-spacing:0.03em;">오늘의 연습 결과</div>
            </div>
          </div>
          ${badge ? `<div style="position:relative;z-index:1;">${badge}</div>` : ""}
        </div>
        <div style="padding:20px 22px 12px;">
          ${bodyContent}
        </div>
        <div style="text-align:center;padding:13px 16px 16px;border-top:1px solid rgba(25,21,22,0.06);background:${SHARE_CARD_FOOTER_BG};color:#7a6f66;font-size:0.74rem;letter-spacing:0.08em;font-weight:500;">${dateStr} · Japanote</div>
      </div>
    `;

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
        backgroundColor: SHARE_CAPTURE_CLEAR_COLOR,
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
      const link = String(challengeUrl || "").trim();
      const shareTitle = getGameLabel(resultViewId) || "Japanote";
      // challenge-links: { url } / { title, url } — 본문 멘트 없음. 이미지+url 병행 시 text에는 링크만(폴백).
      const candidates = link
        ? [
            { files: [file], url: link },
            { title: shareTitle, files: [file], url: link },
            { files: [file], text: link },
            { title: shareTitle, files: [file], text: link }
          ]
        : [{ title: shareTitle, files: [file] }, { files: [file] }];
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
      ? "공유하기를 누르면 결과 이미지와 도전 링크를 보내요. (멘트 없이 링크만, ‘도전 링크’ 공유와 같아요.)"
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
    const g = global.getJapanoteButtonLabel;
    const shortLabel =
      typeof g === "function" && g("resultShare")
        ? g("resultShare")
        : "공유";
    const detailLabel =
      typeof g === "function" && g("resultShareDetail")
        ? g("resultShareDetail")
        : "결과를 그림으로 만들어 공유해요";
    const readyLabel = shortLabel;
    const readyDescription = detailLabel;

    button.type = "button";
    button.className =
      "secondary-btn button-with-icon share-result-btn match-result-action-btn match-result-action-btn--with-caption";

    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "ios_share";

    label.className = "match-result-action-btn__text";
    label.setAttribute("aria-hidden", "true");
    label.textContent = readyLabel;
    button.title = readyDescription;
    button.setAttribute("aria-label", readyDescription);
    button.append(icon, label);

    const setButtonState = (shortText, { long, busy = false } = {}) => {
      const resolvedLong = long != null && String(long).length > 0 ? long : shortText;
      label.textContent = shortText;
      button.setAttribute("aria-label", resolvedLong);
      button.title = resolvedLong;
      if (typeof busy === "boolean") {
        button.setAttribute("aria-busy", busy ? "true" : "false");
      }
    };

    button.addEventListener("click", async () => {
      setButtonState("이미지 생성 중...", { busy: true });
      button.disabled = true;

      try {
        const canvas = await captureResultImage(resultViewId);
        const blob = await canvasToBlob(canvas);
        showPreviewModal(canvas, blob, resultViewId);
        setButtonState(readyLabel, { long: readyDescription, busy: false });
      } catch (error) {
        console.error("Failed to capture result image.", error);
        setButtonState("다시 시도해 주세요", { busy: false });
        setTimeout(() => {
          setButtonState(readyLabel, { long: readyDescription, busy: false });
        }, 2000);
      } finally {
        button.disabled = false;
      }
    });

    return button;
  }

  function ensureShareActionGroup(filters) {
    let shareActions = filters.querySelector(".match-result-share-actions");

    if (shareActions) {
      return shareActions;
    }

    shareActions = document.createElement("div");
    shareActions.className = "match-result-share-actions";
    filters.insertBefore(shareActions, filters.firstChild);
    return shareActions;
  }

  function ensureResultActionContainer(resultView) {
    const statsGrid = resultView.querySelector(".match-result-grid");
    let filters = resultView.querySelector(".match-result-filters");

    if (!filters) {
      filters = document.createElement("div");
      filters.className = "match-result-filters";

      if (statsGrid?.nextElementSibling) {
        resultView.insertBefore(filters, statsGrid.nextElementSibling);
      } else if (statsGrid) {
        resultView.insertBefore(filters, resultView.children[2] || null);
      } else {
        resultView.appendChild(filters);
      }
    }

    const bulkActions = filters.querySelector(".match-result-bulk-actions");

    return { filters, bulkActions, statsGrid };
  }

  function ensureComparisonFooter(resultView, filters, statsGrid) {
    let footer = resultView.querySelector(".match-result-share-footer");

    if (footer) {
      return footer;
    }

    footer = document.createElement("div");
    footer.className = "match-result-share-footer";

    if (filters) {
      resultView.insertBefore(footer, filters);
    } else if (statsGrid?.nextElementSibling) {
      resultView.insertBefore(footer, statsGrid.nextElementSibling);
    } else if (statsGrid) {
      resultView.insertBefore(footer, resultView.children[2] || null);
    } else {
      resultView.appendChild(footer);
    }

    return footer;
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
    const { filters, statsGrid } = ensureResultActionContainer(resultView);
    const shareActions = ensureShareActionGroup(filters);

    shareActions.append(button);
    if (challengeButton) {
      shareActions.appendChild(challengeButton);
    }
    ensureComparisonFooter(resultView, filters, statsGrid);
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
