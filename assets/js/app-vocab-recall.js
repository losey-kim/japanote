(function initJapanoteVocabRecallMode(global) {
  const ANSWER_MODE_OPTIONS = ["choice", "recall"];
  const RECALL_MASTERY_THRESHOLD = 2;
  let recallQuestionKey = "";
  let recallAnswerRevealed = false;
  let recallAnswerCommitted = false;
  let recallRetrySessionKey = "";
  let recallRetriedSourceIds = new Set();
  let recallAdvanceTimer = null;
  let recallInlineStatusMessage = "";
  let recallTargetQuestionCount = 0;

  function getVocabQuizAnswerMode(value = state?.vocabQuizAnswerMode) {
    return ANSWER_MODE_OPTIONS.includes(value) ? value : "choice";
  }

  function getVocabQuizAnswerModeLabel(value = state?.vocabQuizAnswerMode) {
    return getVocabQuizAnswerMode(value) === "recall"
      ? getVocabRecallCopy("summaryLabel") || getVocabRecallCopy("recallMode")
      : getVocabRecallCopy("choiceMode");
  }

  function clearRecallAdvanceTimer() {
    if (recallAdvanceTimer) {
      global.clearTimeout(recallAdvanceTimer);
      recallAdvanceTimer = null;
    }
  }

  function scheduleRecallAdvance() {
    clearRecallAdvanceTimer();
  }

  function getRecallQuestionKey(question) {
    if (!question || typeof question !== "object") {
      return "";
    }

    return String(question.id || question.sourceId || "");
  }

  function getRecallSourceId(question) {
    if (!question || typeof question !== "object") {
      return "";
    }

    return String(question.sourceId || question.id || "").trim();
  }

  function getRecallSessionKey() {
    return [activeVocabQuizSignature || "", state?.vocabQuizTodayReviewActive === true ? "today" : "general"].join("::");
  }

  function syncRecallSessionState() {
    const nextSessionKey = getRecallSessionKey();

    if (nextSessionKey === recallRetrySessionKey) {
      if (!recallTargetQuestionCount && Array.isArray(activeVocabQuizQuestions)) {
        recallTargetQuestionCount = activeVocabQuizQuestions.length;
      }
      return;
    }

    recallRetrySessionKey = nextSessionKey;
    recallRetriedSourceIds = new Set();
    recallQuestionKey = "";
    recallAnswerRevealed = false;
    recallAnswerCommitted = false;
    recallInlineStatusMessage = "";
    recallTargetQuestionCount = Array.isArray(activeVocabQuizQuestions) ? activeVocabQuizQuestions.length : 0;
    clearRecallAdvanceTimer();
  }

  function getRecallStageMeta() {
    if (!recallAnswerRevealed) {
      return {
        title: "먼저 떠올려보세요"
      };
    }

    if (!recallAnswerCommitted) {
      return {
        title: "어땠나요?"
      };
    }

    return {
      title: "다음으로 넘어가볼까요?"
    };
  }

  function ensureRecallStyles() {
    if (document.getElementById("japanote-vocab-recall-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "japanote-vocab-recall-style";
    style.textContent = `
      .study-options-group--recall { grid-column: 1 / -1; }
      .vocab-recall-panel {
        display: grid;
        gap: 12px;
        padding: 16px;
        border-radius: 22px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.94));
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
      }
      .vocab-recall-head {
        display: grid;
        gap: 4px;
      }
      .vocab-recall-title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.35;
        letter-spacing: -0.02em;
      }
      .vocab-recall-answer {
        display: grid;
        gap: 8px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.96);
      }
      .vocab-recall-answer-label {
        display: block;
        font-size: 12px;
        font-weight: 800;
        color: rgba(15, 23, 42, 0.56);
        letter-spacing: -0.01em;
      }
      .vocab-recall-answer-value {
        font-size: 24px;
        font-weight: 800;
        line-height: 1.35;
        letter-spacing: -0.03em;
        color: rgba(15, 23, 42, 0.96);
      }
      .vocab-recall-self-check {
        display: grid;
        gap: 10px;
      }
      .vocab-recall-self-check-label {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: rgba(15, 23, 42, 0.7);
      }
      .vocab-recall-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .vocab-recall-actions--single {
        grid-template-columns: minmax(0, 1fr);
      }
      .vocab-recall-btn {
        min-height: 50px;
        border-radius: 16px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .vocab-recall-btn--reveal {
        width: 100%;
      }
      .vocab-recall-btn--correct {
        background: rgba(34, 197, 94, 0.12);
        border-color: rgba(34, 197, 94, 0.2);
      }
      .vocab-recall-btn--unsure {
        background: rgba(245, 158, 11, 0.12);
        border-color: rgba(245, 158, 11, 0.2);
      }
      .vocab-recall-btn--wrong {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.16);
      }
      .vocab-recall-btn[disabled] {
        opacity: 0.55;
      }
      .vocab-recall-status {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.1);
        color: rgba(30, 64, 175, 0.92);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .vocab-recall-next-ready {
        width: 100%;
        min-height: 54px;
        border-radius: 18px;
        box-shadow: 0 12px 22px rgba(15, 23, 42, 0.06);
      }
      @media (max-width: 640px) {
        .vocab-recall-panel {
          padding: 14px;
          border-radius: 18px;
        }
        .vocab-recall-title {
          font-size: 18px;
        }
        .vocab-recall-actions {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRecallModeField() {
    const panel = document.getElementById("vocab-quiz-options-panel");

    if (!panel || document.getElementById("vocab-quiz-answer-mode")) {
      return;
    }

    const group = document.createElement("div");
    group.className = "study-options-group study-options-group--recall";
    const label = document.createElement("span");
    label.textContent = getVocabRecallCopy("modeLabel") || "풀이 방식";

    const field = document.createElement("label");
    field.className = "vocab-select-field";
    field.setAttribute("for", "vocab-quiz-answer-mode");

    const wrap = document.createElement("div");
    wrap.className = "vocab-select-wrap";
    const select = document.createElement("select");
    select.className = "vocab-select";
    select.id = "vocab-quiz-answer-mode";
    select.setAttribute("aria-label", getVocabRecallCopy("modeLabel") || "풀이 방식");

    [
      { value: "choice", label: getVocabRecallCopy("choiceMode") || "객관식" },
      { value: "recall", label: getVocabRecallCopy("recallMode") || "떠올리기" }
    ].forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      select.appendChild(option);
    });

    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "expand_more";

    wrap.append(select, icon);
    field.appendChild(wrap);
    group.append(label, field);

    panel.insertBefore(group, panel.firstChild || null);

    if (select.dataset.recallBound !== "true") {
      select.dataset.recallBound = "true";
      select.addEventListener("change", () => {
        const nextMode = getVocabQuizAnswerMode(select.value);

        if (state.vocabQuizAnswerMode === nextMode) {
          return;
        }

        clearRecallAdvanceTimer();
        state.vocabQuizAnswerMode = nextMode;
        saveState();
        renderVocabPage();
      });
    }
  }

  function syncRecallModeField() {
    const select = document.getElementById("vocab-quiz-answer-mode");

    if (!select) {
      return;
    }

    select.value = getVocabQuizAnswerMode();
    select.disabled = Boolean(state?.vocabQuizStarted && !state?.vocabQuizFinished);
  }

  function cloneRecallQuestion(question) {
    return JSON.parse(JSON.stringify(question));
  }

  function trimRecallQuestionPool(insertedQuestionId) {
    if (!Array.isArray(activeVocabQuizQuestions) || !recallTargetQuestionCount) {
      return;
    }

    while (activeVocabQuizQuestions.length > recallTargetQuestionCount) {
      let removeIndex = -1;

      for (let index = activeVocabQuizQuestions.length - 1; index > Number(state?.vocabQuizIndex || 0); index -= 1) {
        const candidate = activeVocabQuizQuestions[index];
        if (!candidate || candidate.id === insertedQuestionId) {
          continue;
        }

        removeIndex = index;
        if (!candidate.retry) {
          break;
        }
      }

      if (removeIndex < 0) {
        break;
      }

      activeVocabQuizQuestions.splice(removeIndex, 1);
    }
  }

  function queueRecallRetryQuestion(question, priority = "wrong") {
    if (!question || !Array.isArray(activeVocabQuizQuestions)) {
      return;
    }

    syncRecallSessionState();

    const sourceId = getRecallSourceId(question);
    const currentIndex = Math.max(0, Number(state?.vocabQuizIndex) || 0);
    const remainingFutureCount = activeVocabQuizQuestions.length - (currentIndex + 1);

    if (!sourceId || recallRetriedSourceIds.has(sourceId) || remainingFutureCount <= 0) {
      return;
    }

    recallRetriedSourceIds.add(sourceId);
    const retryQuestion = cloneRecallQuestion(question);
    retryQuestion.id = `${sourceId}-recall-retry-${Date.now()}`;
    retryQuestion.retry = true;
    retryQuestion.retryPriority = priority;
    const retryOffset = priority === "unsure" ? 5 : 3;
    const insertIndex = Math.min(
      activeVocabQuizQuestions.length,
      currentIndex + retryOffset
    );
    activeVocabQuizQuestions.splice(insertIndex, 0, retryQuestion);
    trimRecallQuestionPool(retryQuestion.id);
  }

  function rememberRecentWrongVocab(sourceId) {
    const normalizedSourceId = String(sourceId || "").trim();

    if (!normalizedSourceId) {
      return;
    }

    const nextIds = [normalizedSourceId, ...(Array.isArray(state?.recentVocabWrongIds) ? state.recentVocabWrongIds : [])]
      .filter(Boolean)
      .filter((item, index, source) => source.indexOf(item) === index)
      .slice(0, 30);

    state.recentVocabWrongIds = nextIds;
  }

  function getVocabRecallMasteryCounts() {
    if (!state.vocabRecallMasteryCounts || typeof state.vocabRecallMasteryCounts !== "object") {
      state.vocabRecallMasteryCounts = {};
    }

    return state.vocabRecallMasteryCounts;
  }

  function getVocabRecallMasteryCount(sourceId) {
    const counts = getVocabRecallMasteryCounts();
    const raw = Number(counts[sourceId]);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function setVocabRecallMasteryCount(sourceId, count) {
    if (!sourceId) {
      return;
    }

    const counts = getVocabRecallMasteryCounts();
    const normalizedCount = Number(count);

    if (!Number.isFinite(normalizedCount) || normalizedCount <= 0) {
      delete counts[sourceId];
      return;
    }

    counts[sourceId] = Math.min(3, Math.max(1, Math.floor(normalizedCount)));
  }

  function applyAutoStatusForRecall(sourceId, verdict) {
    if (!sourceId || typeof getWordVocabStatus !== "function" || typeof setWordVocabStatus !== "function") {
      return "";
    }

    const currentStatus = getWordVocabStatus(sourceId);

    if (verdict === "correct") {
      const nextCount = getVocabRecallMasteryCount(sourceId) + 1;
      setVocabRecallMasteryCount(sourceId, nextCount);

      if (nextCount >= RECALL_MASTERY_THRESHOLD && currentStatus !== "mastered") {
        setWordVocabStatus(sourceId, "mastered");
        if (typeof showJapanoteToast === "function") {
          showJapanoteToast("두 번 연속 맞아서 익혔어요로 바꿨어요");
        }
        return "익혔어요에 담았어요";
      }

      if (currentStatus === "mastered") {
        return "이미 익혔어요";
      }

      return "한 번 더 맞히면 익혀져요";
    }

    setVocabRecallMasteryCount(sourceId, 0);

    if (currentStatus !== "review") {
      setWordVocabStatus(sourceId, "review");
      if (typeof showJapanoteToast === "function") {
        showJapanoteToast(verdict === "unsure" ? "헷갈려서 다시 볼래요로 바꿨어요" : "틀려서 다시 볼래요로 바꿨어요");
      }
      return "다시 볼래요에 담았어요";
    }

    return "다시 볼래요에 있어요";
  }

  function getRecallExplanationText(question) {
    const answerLabel = getVocabRecallCopy("answerLabel") || "정답";
    const answerText = question?.options?.[question.answer] || "";
    const parts = [`${answerLabel} · ${answerText}`];

    if (question?.explanation) {
      parts.push(question.explanation);
    }

    return softenExplanationCopy(parts.filter(Boolean).join(" "));
  }

  function finalizeVocabRecallQuestion(question, verdict) {
    const feedback = document.getElementById("vocab-quiz-feedback");
    const explanation = document.getElementById("vocab-quiz-explanation");
    const nextButton = document.getElementById("vocab-quiz-next");
    const sourceId = getRecallSourceId(question);
    const isCorrect = verdict === "correct";

    if (!question || !feedback || !explanation || !nextButton) {
      return;
    }

    if (!isCorrect) {
      queueRecallRetryQuestion(question, verdict === "unsure" ? "unsure" : "wrong");
      rememberRecentWrongVocab(sourceId);
    }

    const isLastQuestion = state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1;

    finalizeQuizSession("vocab", isCorrect);
    state.quizAnsweredCount += 1;

    if (isCorrect) {
      state.quizCorrectCount += 1;
    }

    recordVocabQuizResult(question, -1, isCorrect, verdict === "timeout");
    const latestResult = activeVocabQuizResults[activeVocabQuizResults.length - 1];
    if (latestResult) {
      latestResult.selfCheck = verdict;
    }

    recallInlineStatusMessage = applyAutoStatusForRecall(sourceId, verdict);

    feedback.textContent =
      verdict === "timeout"
        ? getVocabRecallCopy("timeoutMessage") || "시간이 지나서 정답을 먼저 보여줄게요."
        : verdict === "correct"
          ? "좋아요"
          : verdict === "unsure"
            ? "조금 더 볼게요"
            : "다시 나와요";
    explanation.textContent = formatQuizLineBreaks(getRecallExplanationText(question));
    nextButton.disabled = false;
    nextButton.hidden = false;
    nextButton.classList.add("vocab-recall-next-ready");
    nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");

    updateStudyStreak();
    saveState();
    renderStats();
    scheduleRecallAdvance();
  }

  function renderRecallActions(question) {
    const optionsContainer = document.getElementById("vocab-quiz-options");
    const explanation = document.getElementById("vocab-quiz-explanation");
    const nextButton = document.getElementById("vocab-quiz-next");

    if (!optionsContainer || !question) {
      return;
    }

    const stage = getRecallStageMeta();
    const answerMarkup = recallAnswerRevealed
      ? `
        <div class="vocab-recall-answer">
          <span class="vocab-recall-answer-label">${getVocabRecallCopy("answerLabel") || "정답"}</span>
          <strong class="vocab-recall-answer-value">${question.options?.[question.answer] || ""}</strong>
        </div>
      `
      : "";
    const statusMarkup = recallInlineStatusMessage
      ? `<span class="vocab-recall-status">${recallInlineStatusMessage}</span>`
      : "";

    optionsContainer.innerHTML = `
      <div class="vocab-recall-panel">
        <div class="vocab-recall-head">
          <h3 class="vocab-recall-title">${stage.title}</h3>
        </div>
        ${answerMarkup}
        ${
          !recallAnswerRevealed
            ? `
              <div class="vocab-recall-actions vocab-recall-actions--single">
                <button class="primary-btn vocab-recall-btn vocab-recall-btn--reveal" type="button" data-vocab-recall-action="reveal">
                  ${getVocabRecallCopy("revealAnswer") || "정답 보기"}
                </button>
              </div>
            `
            : `
              <div class="vocab-recall-self-check">
                <p class="vocab-recall-self-check-label">어땠나요?</p>
                <div class="vocab-recall-actions">
                  <button class="secondary-btn vocab-recall-btn vocab-recall-btn--correct" type="button" data-vocab-recall-action="correct"${recallAnswerCommitted ? " disabled" : ""}>
                    ${getVocabRecallCopy("correctButton") || "맞았어요"}
                  </button>
                  <button class="secondary-btn vocab-recall-btn vocab-recall-btn--unsure" type="button" data-vocab-recall-action="unsure"${recallAnswerCommitted ? " disabled" : ""}>
                    ${getVocabRecallCopy("unsureButton") || "애매해요"}
                  </button>
                  <button class="secondary-btn vocab-recall-btn vocab-recall-btn--wrong" type="button" data-vocab-recall-action="wrong"${recallAnswerCommitted ? " disabled" : ""}>
                    ${getVocabRecallCopy("wrongButton") || "틀렸어요"}
                  </button>
                </div>
              </div>
            `
        }
        ${statusMarkup}
      </div>
    `;

    if (!recallAnswerRevealed && explanation) {
      explanation.textContent = "";
    }

    if (nextButton) {
      nextButton.disabled = !recallAnswerCommitted;
      nextButton.classList.toggle("vocab-recall-next-ready", recallAnswerCommitted);
    }

    optionsContainer.querySelectorAll("[data-vocab-recall-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.vocabRecallAction;

        if (action === "reveal") {
          recallAnswerRevealed = true;
          renderRecallActions(question);
          return;
        }

        if (recallAnswerCommitted) {
          return;
        }

        recallAnswerCommitted = true;
        recallAnswerRevealed = true;
        finalizeVocabRecallQuestion(question, action);
        renderRecallActions(question);
      });
    });
  }

  const originalGetVocabQuizOptionsSummaryText =
    typeof getVocabQuizOptionsSummaryText === "function" ? getVocabQuizOptionsSummaryText : null;
  if (originalGetVocabQuizOptionsSummaryText) {
    getVocabQuizOptionsSummaryText = function getPatchedVocabQuizOptionsSummaryText() {
      return [
        getVocabQuizAnswerModeLabel(),
        getVocabQuizConfigLabel(),
        `${getVocabQuizCount()}문제`,
        getDurationLabel(getVocabQuizDuration())
      ].join(" · ");
    };
  }

  const originalRenderVocabQuizControls =
    typeof renderVocabQuizControls === "function" ? renderVocabQuizControls : null;
  if (originalRenderVocabQuizControls) {
    renderVocabQuizControls = function renderPatchedVocabQuizControls(...args) {
      const result = originalRenderVocabQuizControls.apply(this, args);
      ensureRecallModeField();
      syncRecallModeField();
      return result;
    };
  }

  const originalRenderVocabQuiz = typeof renderVocabQuiz === "function" ? renderVocabQuiz : null;
  if (originalRenderVocabQuiz) {
    renderVocabQuiz = function renderPatchedVocabQuiz(...args) {
      const result = originalRenderVocabQuiz.apply(this, args);
      ensureRecallStyles();
      ensureRecallModeField();
      syncRecallModeField();
      syncRecallSessionState();

      if (getVocabQuizAnswerMode() !== "recall") {
        clearRecallAdvanceTimer();
        return result;
      }

      if (!state?.vocabQuizStarted || state?.vocabQuizFinished) {
        clearRecallAdvanceTimer();
        return result;
      }

      const question = typeof getCurrentVocabQuizQuestion === "function" ? getCurrentVocabQuizQuestion() : null;
      const questionKey = getRecallQuestionKey(question);

      if (!question || !questionKey) {
        clearRecallAdvanceTimer();
        return result;
      }

      if (recallQuestionKey !== questionKey) {
        recallQuestionKey = questionKey;
        recallAnswerRevealed = false;
        recallAnswerCommitted = false;
        recallInlineStatusMessage = "";
        clearRecallAdvanceTimer();
      }

      renderRecallActions(question);
      return result;
    };
  }

  const originalHandleVocabQuizTimeout = typeof handleVocabQuizTimeout === "function" ? handleVocabQuizTimeout : null;
  if (originalHandleVocabQuizTimeout) {
    handleVocabQuizTimeout = function handlePatchedVocabQuizTimeout(...args) {
      if (getVocabQuizAnswerMode() !== "recall") {
        return originalHandleVocabQuizTimeout.apply(this, args);
      }

      const question = typeof getCurrentVocabQuizQuestion === "function" ? getCurrentVocabQuizQuestion() : null;

      if (!question || recallAnswerCommitted) {
        return;
      }

      recallAnswerRevealed = true;
      recallAnswerCommitted = true;
      finalizeVocabRecallQuestion(question, "timeout");
      renderRecallActions(question);
    };
  }

  const originalNextVocabQuizQuestion = typeof nextVocabQuizQuestion === "function" ? nextVocabQuizQuestion : null;
  if (originalNextVocabQuizQuestion) {
    nextVocabQuizQuestion = function nextPatchedVocabQuizQuestion(...args) {
      if (getVocabQuizAnswerMode() !== "recall") {
        return originalNextVocabQuizQuestion.apply(this, args);
      }

      if (state.vocabQuizFinished) {
        return originalNextVocabQuizQuestion.apply(this, args);
      }

      if (!recallAnswerCommitted) {
        return;
      }

      clearRecallAdvanceTimer();

      if (state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1) {
        state.vocabQuizFinished = true;
        stopQuizSessionTimer("vocab");
        clearVocabQuizSessionRuntime();
        saveState();
        renderVocabQuiz();
        return;
      }

      state.vocabQuizIndex += 1;
      recallAnswerCommitted = false;
      recallAnswerRevealed = false;
      recallInlineStatusMessage = "";
      saveState();
      renderVocabQuiz();
    };
  }

  ensureRecallStyles();
  ensureRecallModeField();
  syncRecallModeField();
})(window);
