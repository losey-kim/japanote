(function (global) {
  const storageKey = "jlpt-compass-state";

  function loadStudyState() {
    try {
      const syncStore = global.japanoteSync;
      if (syncStore && typeof syncStore.readValue === "function") {
        const saved = syncStore.readValue(storageKey, null);
        if (saved && typeof saved === "object") return saved;
      }
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  // ── 오답노트 ──

  function getMistakes() {
    const state = loadStudyState();
    return Array.isArray(state.quizMistakes) ? state.quizMistakes : [];
  }

  function renderMistakeNotePanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const mistakes = getMistakes();

    if (!mistakes.length) {
      container.innerHTML = `
        <div class="study-tools-empty">
          <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
          <p>아직 틀린 문제가 없어요. 퀴즈를 풀어보세요!</p>
        </div>`;
      return;
    }

    let html = `
      <div class="study-tools-header">
        <div>
          <strong>오답노트</strong>
          <span class="study-tools-count">${mistakes.length}개</span>
        </div>
        <div class="study-tools-actions">
          <button class="secondary-btn button-with-icon" type="button" id="retry-mistakes-btn">
            <span class="material-symbols-rounded" aria-hidden="true">replay</span>
            <span>오답만 다시 풀기</span>
          </button>
          <button class="secondary-btn button-with-icon" type="button" id="clear-mistakes-btn">
            <span class="material-symbols-rounded" aria-hidden="true">delete_sweep</span>
            <span>전체 삭제</span>
          </button>
        </div>
      </div>
      <div class="study-tools-list">`;

    mistakes.forEach((item) => {
      const statusClass = "is-wrong";
      html += `
        <article class="match-result-item ${statusClass}">
          <div class="match-result-item-head">
            <div class="match-result-item-badges">
              <span class="match-result-badge ${statusClass}">${item.modeLabel || "퀴즈"}</span>
            </div>
          </div>
          <div class="match-result-item-main">
            <strong>${escapeHtml(item.word || item.correctAnswer)}</strong>
            <p>${escapeHtml(item.prompt)}</p>
            <div class="study-tools-detail">
              <span>정답 · ${escapeHtml(item.correctAnswer)}</span>
              <span>내 답 · ${escapeHtml(item.userAnswer)}</span>
              ${item.reading ? `<span>읽기 · ${escapeHtml(item.reading)}</span>` : ""}
              ${item.meaning ? `<span>뜻 · ${escapeHtml(item.meaning)}</span>` : ""}
            </div>
          </div>
        </article>`;
    });

    html += "</div>";
    container.innerHTML = html;

    const retryBtn = document.getElementById("retry-mistakes-btn");
    const clearBtn = document.getElementById("clear-mistakes-btn");

    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        retryMistakes();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (confirm("오답노트를 모두 삭제할까요?")) {
          clearMistakes();
          renderMistakeNotePanel(containerId);
        }
      });
    }
  }

  function clearMistakes() {
    const state = loadStudyState();
    state.quizMistakes = [];
    state.quizSessionMistakeIds = [];
    saveStudyState(state);
  }

  function retryMistakes() {
    const mistakes = getMistakes();
    if (!mistakes.length) return;

    // 오답 기반 퀴즈 세션을 만들어서 퀴즈 탭으로 이동
    const vocabTab = document.querySelector('[data-vocab-tab="quiz"]');
    if (vocabTab) {
      vocabTab.click();
      showJapanoteToastSafe("오답 " + mistakes.length + "개로 퀴즈를 시작해요!");
    }
  }

  function saveStudyState(state) {
    const syncStore = global.japanoteSync;
    if (syncStore && typeof syncStore.writeValue === "function") {
      syncStore.writeValue(storageKey, state);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  // ── 단어장 내보내기 ──

  function getReviewItems() {
    const state = loadStudyState();
    const reviewIds = Array.isArray(state.reviewIds) ? state.reviewIds : [];
    const masteredIds = Array.isArray(state.masteredIds) ? state.masteredIds : [];
    const kanjiReviewIds = Array.isArray(state.kanjiReviewIds) ? state.kanjiReviewIds : [];
    const kanjiMasteredIds = Array.isArray(state.kanjiMasteredIds) ? state.kanjiMasteredIds : [];

    return { reviewIds, masteredIds, kanjiReviewIds, kanjiMasteredIds };
  }

  function getVocabItemById(id) {
    const vocabStore = global.japanoteVocabStore;
    if (!vocabStore || typeof vocabStore.getLevelItems !== "function") return null;

    const levels = ["N5", "N4", "N3"];
    for (const level of levels) {
      const items = vocabStore.getLevelItems(level) || [];
      const found = items.find((item) => (item.id || item.entry_id) === id);
      if (found) return { ...found, _level: level };
    }
    return null;
  }

  function getKanjiItemById(id) {
    const rows = Array.isArray(global.JAPANOTE_KANJI_DATA) ? global.JAPANOTE_KANJI_DATA : [];
    for (let i = 0; i < rows.length; i++) {
      const [char, grade, reading] = Array.isArray(rows[i]) ? rows[i] : [];
      const itemId = `kanji-${grade}-${i + 1}-${String(char || "").trim()}`;
      if (itemId === id) return { char, grade, reading };
    }
    return null;
  }

  function buildExportData() {
    const { reviewIds, masteredIds, kanjiReviewIds, kanjiMasteredIds } = getReviewItems();
    const lines = [];

    lines.push("종류,상태,단어/한자,읽기,뜻,레벨");

    reviewIds.forEach((id) => {
      const item = getVocabItemById(id);
      if (!item) return;
      const word = item.showEntry || item.show_entry || item.entry || "";
      const reading = item.pron || "";
      const meaning = Array.isArray(item.means) ? item.means.join("; ") : "";
      lines.push(csvRow("단어", "다시 볼래요", word, reading, meaning, item._level || ""));
    });

    masteredIds.forEach((id) => {
      const item = getVocabItemById(id);
      if (!item) return;
      const word = item.showEntry || item.show_entry || item.entry || "";
      const reading = item.pron || "";
      const meaning = Array.isArray(item.means) ? item.means.join("; ") : "";
      lines.push(csvRow("단어", "익혔어요", word, reading, meaning, item._level || ""));
    });

    kanjiReviewIds.forEach((id) => {
      const item = getKanjiItemById(id);
      if (!item) return;
      lines.push(csvRow("한자", "다시 볼래요", item.char, item.reading, "", item.grade + "학년"));
    });

    kanjiMasteredIds.forEach((id) => {
      const item = getKanjiItemById(id);
      if (!item) return;
      lines.push(csvRow("한자", "익혔어요", item.char, item.reading, "", item.grade + "학년"));
    });

    return lines.join("\n");
  }

  function csvRow(...values) {
    return values.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",");
  }

  function exportStudyList() {
    const csv = "\uFEFF" + buildExportData(); // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `japanote-wordlist-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showJapanoteToastSafe("단어장이 저장됐어요!");
  }

  function renderExportButton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { reviewIds, masteredIds, kanjiReviewIds, kanjiMasteredIds } = getReviewItems();
    const totalCount = reviewIds.length + masteredIds.length + kanjiReviewIds.length + kanjiMasteredIds.length;

    container.innerHTML = `
      <div class="study-tools-header">
        <div>
          <strong>내 단어장 내보내기</strong>
          <span class="study-tools-count">${totalCount}개</span>
        </div>
        <button class="secondary-btn button-with-icon" type="button" id="export-wordlist-btn" ${totalCount === 0 ? "disabled" : ""}>
          <span class="material-symbols-rounded" aria-hidden="true">download</span>
          <span>CSV 다운로드</span>
        </button>
      </div>
      <p class="study-tools-description">
        "다시 볼래요"와 "익혔어요"로 표시한 단어와 한자를 CSV 파일로 내보내요.
        엑셀이나 구글 시트에서 열 수 있어요.
      </p>`;

    const btn = document.getElementById("export-wordlist-btn");
    if (btn) {
      btn.addEventListener("click", exportStudyList);
    }
  }

  // ── 유틸 ──

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text || "");
    return div.innerHTML;
  }

  function showJapanoteToastSafe(message) {
    if (typeof global.showJapanoteToast === "function") {
      global.showJapanoteToast(message);
      return;
    }
    // app.js가 아직 toast를 expose하지 않으면 조용히 무시
  }

  // ── 자동 초기화 ──

  function initialize() {
    renderMistakeNotePanel("study-tools-mistakes");
    renderExportButton("study-tools-export");

    // vocab 데이터 로드 후 내보내기 카운트 갱신
    window.addEventListener("japanote:vocab-loaded", () => {
      renderExportButton("study-tools-export");
    });

    window.addEventListener("japanote:supplementary-content-loaded", () => {
      renderMistakeNotePanel("study-tools-mistakes");
      renderExportButton("study-tools-export");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  global.japanoteStudyTools = {
    renderMistakeNotePanel,
    renderExportButton,
    exportStudyList,
    getMistakes,
    getReviewItems
  };
})(globalThis);
