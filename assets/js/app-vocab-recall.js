(function initJapanoteVocabRecallMode(global) {
  const ANSWER_MODE_OPTIONS = ["choice", "recall"];
  let recallQuestionKey = "";
  let recallAnswerRevealed = false;
  let recallAnswerCommitted = false;
  let recallRetrySessionKey = "";
  let recallRetriedSourceIds = new Set();
  let recallAdvanceTimer = null;

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
    recallAdvanceTimer = global.setTimeout(() => {
      recallAdvanceTimer = null;

      if (!state?.vocabQuizStarted || state?.vocabQuizFinished !== false) {
        return;
      }

      const nextButton = document.getElementById("vocab-quiz-next");
      if (!nextButton || nextButton.disabled || nextButton.hidden) {
        return;
      }

      nextButton.click();
    }, 450);
  }

  function getRecallQuestionKey(question) {
    if (!question || typeof question !== "object") {
      return "";
    }

    return String(question.id || question.sourceId || "");
  }

  function getRecallSessionKey() {
    return [activeVocabQuizSignature || "", state?.vocabQuizTodayReviewActive === true ? "today" : "general"].join("::");
  }

  function syncRecallSessionState() {
    const nextSessionKey = getRecallSessionKey();

    if (nextSessionKey === recallRetrySessionKey) {
      return;
    }

    recallRetrySessionKey = nextSessionKey;
    recallRetriedSourceIds = new Set();
    recallQuestionKey = "";
    recallAnswerRevealed = false;
    recallAnswerCommitted = false;
    clearRecallAdvanceTimer();
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
      }
      .vocab-recall-answer {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.82);
      }
      .vocab-recall-answer-label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 700;
        opacity: 0.7;
      }
      .vocab-recall-answer-value {
        font-size: 20px;
        font-weight: 700;
        line-height: 1.4;
      }
      .vocab-recall-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .vocab-recall-actions > button {
        flex: 1 1 140px;
      }
      .vocab-recall-actions > button[disabled] {
        opacity: 0.6;
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

  function queueRecallRetryQuestion(question) {
    if (!question || !Array.isArray(activeVocabQuizQuestions)) {
      return;
    }

    syncRecallSessionState();

    const sourceId = String(question.sourceId || question.id || "");

    if (!sourceId || recallRetriedSourceIds.has(sourceId)) {
      return;
    }

    recallRetriedSourceIds.add(sourceId);
    const retryQuestion = cloneRecallQuestion(question);
    retryQuestion.id = `${sourceId}-recall-retry-${Date.now()}`;
    retryQuestion.retry = true;
    const insertIndex = Math.min(activeVocabQuizQuestions.length, Math.max(0, Number(state?.vocabQuizIndex) || 0) + 3);
    activeVocabQuizQuestions.splice(insertIndex, 0, retryQuestion);
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
    const isCorrect = verdict === "correct";

    if (!question || !feedback || !explanation || !nextButton) {
      return;
    }

    if (!isCorrect) {
      queueRecallRetryQuestion(question);
      rememberRecentWrongVocab(question.sourceId || question.id);
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

    feedback.textContent =
      verdict === "timeout"
        ? getVocabRecallCopy("timeoutMessage") || "시간이 지나서 정답을 먼저 보여줄게요."
        : verdict === "correct"
          ? ""
          : verdict === "unsure"
            ? "조금 헷갈렸네요. 한 번 더 보면 더 잘 남아요."
            : "다시 한번 보면 더 잘 남을 거예요.";
    explanation.textContent = formatQuizLineBreaks(getRecallExplanationText(question));
    nextButton.disabled = false;
    nextButton.hidden = false;
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

    const isCommitted = recallAnswerCommitted;
    const answerMarkup = recallAnswerRevealed
      ? `
        <div class="vocab-recall-answer">
          <span class="vocab-recall-answer-label">${getVocabRecallCopy("answerLabel") || "정답"}</span>
          <strong class="vocab-recall-answer-value">${question.options?.[question.answer] || ""}</strong>
        </div>
      `
      : "";

    optionsContainer.innerHTML = `
      <div class="vocab-recall-panel">
        <p class="basic-practice-note">${getVocabRecallCopy("selfCheckPrompt") || "먼저 떠올려보고 스스로 체크해봐요."}</p>
        ${answerMarkup}
        <div class="vocab-recall-actions">
          ${
            !recallAnswerRevealed
              ? `<button class="secondary-btn" type="button" data-vocab-recall-action="reveal">${getVocabRecallCopy("revealAnswer") || "정답 보기"}</button>`
              : `
                <button class="primary-btn" type="button" data-vocab-recall-action="correct"${isCommitted ? " disabled" : ""}>${getVocabRecallCopy("correctButton") || "맞았어요"}</button>
                <button class="secondary-btn" type="button" data-vocab-recall-action="unsure"${isCommitted ? " disabled" : ""}>${getVocabRecallCopy("unsureButton") || "애매해요"}</button>
                <button class="secondary-btn" type="button" data-vocab-recall-action="wrong"${isCommitted ? " disabled" : ""}>${getVocabRecallCopy("wrongButton") || "틀렸어요"}</button>
              `
          }
        </div>
      </div>
    `;

    if (!recallAnswerRevealed && explanation) {
      explanation.textContent = "";
    }

    if (nextButton && !recallAnswerCommitted) {
      nextButton.disabled = true;
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
      saveState();
      renderVocabQuiz();
    };
  }

  ensureRecallStyles();
  ensureRecallModeField();
  syncRecallModeField();
})(window);
