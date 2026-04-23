/* Japanote — reading study/practice (split from app.js, phase 4) */

let readingContent = {};
let readingSets = {};

function normalizeReadingContent(payload) {
  const normalized = payload || {};

  return {
    sets: getLevelContentSets(normalized.sets || {})
  };
}

function refreshReadingContentState(payload) {
  const normalized = normalizeReadingContent(payload || {});
  readingContent = normalized;
  readingSets = getLevelContentSets(normalized.sets);
  readingSets[allLevelValue] = getAllPracticeSets(readingSets);
}

function loadReadingDataFromJson() {
  return fetchJsonData("reading.json", "reading.json")
    .then((payload) => {
      refreshReadingContentState(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load reading.json. Using empty reading data.", error);
      refreshReadingContentState(readingContent);
      return null;
    });
}

const readingPracticeResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const readingCountOptions = [5, 10, 15, 20];
const readingDurationOptions = [45, 60, 90, 0];

function getReadingCount(value = state?.readingCount) {
  const numericValue = Number(value);
  return readingCountOptions.includes(numericValue) ? numericValue : 10;
}

function getReadingLevel(level = state?.readingLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getReadingDuration(value = state?.readingDuration) {
  const numericValue = Number(value);
  return readingDurationOptions.includes(numericValue) ? numericValue : 45;
}

let activeReadingPracticeQuestions = [];
const readingPracticeState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};

function getReadingOptionsSummaryText() {
  return [
    getLevelSummaryLabel(getReadingLevel()),
    formatQuestionCountLabel(getReadingCount()),
    getDurationLabel(getReadingDuration())
  ].join(" · ");
}

function setReadingLevel(level) {
  const nextLevel = getReadingLevel(level);

  if (state.readingLevel === nextLevel) {
    return;
  }

  state.readingLevel = nextLevel;
  invalidateReadingPracticeSession();
  saveState();
  renderReadingPractice();
}

function setReadingDuration(duration) {
  const nextDuration = getReadingDuration(duration);

  if (state.readingDuration === nextDuration) {
    return;
  }

  state.readingDuration = nextDuration;
  saveState();
  renderReadingPractice();
}

function invalidateReadingPracticeSession() {
  resetReadingPracticeSessionState();
}

function resetReadingPracticeSessionState() {
  activeReadingPracticeQuestions = [];
  readingPracticeState.results = [];
  readingPracticeState.showResults = false;
  readingPracticeState.resultFilter = "all";
  state.readingStarted = false;
  state.readingSessionQuestionIndex = 0;
  resetQuizSessionScore("reading");
  setQuizSessionDuration("reading", getReadingDuration());
  stopQuizSessionTimer("reading");
}

function renderReadingControls() {
  const optionsShell = document.getElementById("reading-options-shell");
  const optionsToggle = document.getElementById("reading-options-toggle");
  const optionsPanel = document.getElementById("reading-options-panel");
  const optionsSummary = document.getElementById("reading-options-summary");
  const levelSelect = document.getElementById("reading-level-select");
  const countSpinner = document.querySelector('[data-spinner-id="reading-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="reading-time"]');
  const startButton = document.getElementById("reading-start");
  const startLabel = document.getElementById("reading-start-label");
  const activeLevel = getReadingLevel(state.readingLevel);
  const activeCount = getReadingCount(state.readingCount);
  const activeDuration = getReadingDuration(state.readingDuration);
  const isOptionsOpen = state.readingOptionsOpen === true;
  const canStart = (readingSets[activeLevel] || []).length > 0;
  const isSettingsLocked = state.readingStarted;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getReadingOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: readingCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: readingDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateContentLevelSelect(element, activeLevel, { includeAll: true })
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.readingStarted || readingPracticeState.showResults,
      canStart: state.readingStarted || readingPracticeState.showResults || canStart
    }
  });
}

function buildReadingPracticeQuestionSet(level = state?.readingLevel, count = state?.readingCount) {
  const activeLevel = getReadingLevel(level);
  const sets = readingSets[activeLevel] || [];
  const questionCount = getReadingCount(count);
  const startIndex = getPracticeLevelIndex(state.readingIndexes, activeLevel);

  return buildFixedPracticeSessionItems(sets, questionCount, startIndex, true);
}

function startNewReadingPracticeSession() {
  const activeLevel = getReadingLevel(state.readingLevel);

  resetReadingPracticeSessionState();
  state.readingLevel = activeLevel;
  activeReadingPracticeQuestions = buildReadingPracticeQuestionSet(activeLevel, state.readingCount);

  if (!activeReadingPracticeQuestions.length) {
    state.readingStarted = false;
    return false;
  }

  state.readingStarted = true;
  return true;
}

function ensureReadingPracticeSession(force = false) {
  if (!state.readingStarted) {
    return false;
  }

  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (
    force ||
    !activeReadingPracticeQuestions.length ||
    currentSessionIndex < 0 ||
    currentSessionIndex >= activeReadingPracticeQuestions.length
  ) {
    const started = startNewReadingPracticeSession();
    saveState();
    return started;
  }

  return true;
}

function getCurrentReadingSet() {
  const currentIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  return activeReadingPracticeQuestions[currentIndex] || activeReadingPracticeQuestions[0] || null;
}

function getReadingPracticeResultFilter(value = readingPracticeState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(readingPracticeResultFilterLabels, value) ? value : "all";
}

function getReadingPracticeResultCounts() {
  return getStudyResultCounts(readingPracticeState.results);
}

function getFilteredReadingPracticeResults(filter = getReadingPracticeResultFilter(readingPracticeState.resultFilter)) {
  return getFilteredStudyResults(readingPracticeState.results, getReadingPracticeResultFilter(filter));
}

function setReadingPracticeResult(current, selectedIndex, correct, timedOut = false) {
  // 독해는 문제 수가 지문 수보다 많을 수 있어 같은 지문이 다시 나와도 세션 결과를 덮어쓰지 않게 한다.
  const resultId = `${current.id || "reading"}-${state.readingSessionQuestionIndex}`;
  const answerText = current.options[current.answer] || "";
  const selected = timedOut ? "" : current.options[selectedIndex] || "";
  const result = {
    id: resultId,
    source: current.source || `${getReadingLevel(state.readingLevel)} 독해`,
    title: current.title || "",
    question: current.question || "",
    explanation: current.explanation || "",
    answerText,
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const currentResultIndex = readingPracticeState.results.findIndex((item) => item.id === resultId);

  if (currentResultIndex >= 0) {
    readingPracticeState.results[currentResultIndex] = result;
    return;
  }

  readingPracticeState.results.push(result);
}

function getReadingPracticeResultDetail(item) {
  const parts = [];

  if (item.question) {
    parts.push(softenVisibleKoreanCopy(item.question));
  }

  if (item.status === "wrong") {
    if (item.timedOut) {
      parts.push("시간 초과");
    } else {
      parts.push(`선택 ${softenVisibleKoreanCopy(item.selected || "미응답")}`);
    }
    parts.push(`정답 ${softenVisibleKoreanCopy(item.answerText)}`);
  }

  if (item.explanation) {
    parts.push(softenExplanationCopy(item.explanation));
  }

  const joined = parts.join(" · ");
  const h = globalThis.japanoteStudyViewHelpers;
  if (h && typeof h.formatQuizSemicolonsToCommaList === "function") {
    return h.formatQuizSemicolonsToCommaList(joined);
  }
  return String(joined).replace(/\s*;\s*/g, ", ").trim();
}

function renderReadingPracticeResults() {
  const counts = getReadingPracticeResultCounts();
  const filteredResults = getFilteredReadingPracticeResults();

  renderSharedStudyResults({
    resultViewId: "reading-practice-result-view",
    totalId: "reading-practice-result-total",
    correctId: "reading-practice-result-correct",
    wrongId: "reading-practice-result-wrong",
    emptyId: "reading-practice-result-empty",
    listId: "reading-practice-result-list",
    counts,
    filteredResults,
    activeFilter: getReadingPracticeResultFilter(readingPracticeState.resultFilter),
    filterLabels: readingPracticeResultFilterLabels,
    getEmptyText: ({ activeFilter }) => getStudyPracticeResultEmptyMessage(activeFilter),
    renderItems: (results, container) => {
      const h = globalThis.japanoteStudyViewHelpers;
      const listFmt =
        h && typeof h.formatQuizSemicolonsToCommaList === "function"
          ? (v) => h.formatQuizSemicolonsToCommaList(v)
          : (v) => String(v || "").replace(/\s*;\s*/g, ", ").trim();
      results.forEach((item) => {
        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.source || "독해",
          titleText: listFmt(item.title || item.question || "-"),
          descriptionText: getReadingPracticeResultDetail(item)
        });
      });
    }
  });
}

function renderReadingPractice() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const empty = document.getElementById("reading-empty");
  const practiceView = document.getElementById("reading-practice-view");
  const resultView = document.getElementById("reading-practice-result-view");
  const readingCard = document.querySelector(".reading-card");
  const passage = document.getElementById("reading-passage");
  const optionsContainer = document.getElementById("reading-options");
  const nextButton = document.getElementById("reading-next");
  const progress = document.getElementById("reading-progress");
  const question = document.getElementById("reading-question");
  const feedback = document.getElementById("reading-feedback");
  const explanation = document.getElementById("reading-explanation");
  state.readingLevel = getReadingLevel(state.readingLevel);
  state.readingDuration = getReadingDuration(state.readingDuration);
  renderReadingControls();
  const sets = readingSets[state.readingLevel] || [];
  const activeCount = state.readingStarted ? activeReadingPracticeQuestions.length : getReadingCount(state.readingCount);
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (
    !empty ||
    !practiceView ||
    !resultView ||
    !readingCard ||
    !passage ||
    !optionsContainer ||
    !nextButton ||
    !progress ||
    !question ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  if (readingPracticeState.showResults) {
    stopQuizSessionTimer("reading");
    renderQuizSessionHud("reading");
    empty.hidden = true;
    practiceView.hidden = true;
    resultView.hidden = false;
    renderReadingPracticeResults();
    return;
  }

  if (!state.readingStarted) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = sets.length ? STUDY_READY_TO_START_HINT : STUDY_NO_CONTENT_LEVEL_HINT;
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  if (!ensureReadingPracticeSession()) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = STUDY_NO_CONTENT_LEVEL_HINT;
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  const current = getCurrentReadingSet();
  const questionCount = activeReadingPracticeQuestions.length;

  if (currentSessionIndex >= activeCount) {
    readingPracticeState.showResults = true;
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  if (!current || !questionCount) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = STUDY_NO_CONTENT_LEVEL_HINT;
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  empty.hidden = true;
  practiceView.hidden = false;
  resultView.hidden = true;

  progress.textContent = `${currentSessionIndex + 1} / ${questionCount}`;
  question.textContent = softenVisibleKoreanCopy(current.question);
  feedback.textContent = "";
  explanation.textContent = "";
  nextButton.textContent =
    currentSessionIndex >= questionCount - 1
      ? getJapanoteButtonLabel("result")
      : getJapanoteButtonLabel("nextPassage");
  nextButton.disabled = true;
  delete optionsContainer.dataset.answered;

  readingCard.className = `reading-card ${current.tone}`;

  passage.className = `reading-passage${current.passageStyle === "note" ? " is-note" : ""}`;
  passage.innerHTML = current.passage.map((line) => `<p>${line}</p>`).join("");

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "reading-option",
    formatText: softenVisibleKoreanCopy,
    onSelect: handleReadingAnswer,
    setPressedState: true
  });

  setQuizSessionDuration("reading", state.readingDuration);
  resetQuizSessionTimer("reading", handleReadingTimeout);
}

function handleReadingAnswer(index) {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = activeReadingPracticeQuestions.length;
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered || quizSessions.reading.isPaused) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("reading", correct);
  setReadingPracticeResult(current, index, correct, false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    markSelected: true,
    setPressedState: true
  });

  document.getElementById("reading-feedback").textContent = correct
    ? ""
    : "";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextPassage");
    nextButton.disabled = false;
  }
  const optionsContainer = document.getElementById("reading-options");

  if (optionsContainer) {
    optionsContainer.dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleReadingTimeout() {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = activeReadingPracticeQuestions.length;
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("reading", false);
  setReadingPracticeResult(current, -1, false, true);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    markSelected: true,
    setPressedState: true
  });

  document.getElementById("reading-feedback").textContent = "";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextPassage");
    nextButton.disabled = false;
  }
  if (document.getElementById("reading-options")) {
    document.getElementById("reading-options").dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextReadingSet() {
  const nextButton = document.getElementById("reading-next");
  const activeLevel = getReadingLevel(state.readingLevel);
  const sets = readingSets[activeLevel] || [];
  const questionLimit = activeReadingPracticeQuestions.length;
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (!sets.length || !nextButton || nextButton.disabled) {
    return;
  }

  if (currentSessionIndex >= questionLimit - 1) {
    readingPracticeState.showResults = true;
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  state.readingLevel = activeLevel;
  state.readingSessionQuestionIndex = currentSessionIndex + 1;
  state.readingIndexes[activeLevel] = (state.readingIndexes[activeLevel] + 1) % sets.length;
  saveState();
  renderReadingPractice();
}

function restartReadingPractice() {
  if (state.readingStarted) {
    invalidateReadingPracticeSession();
    saveState();
    renderReadingPractice();
    return;
  }

  startNewReadingPracticeSession();
  saveState();
  renderReadingPractice();
}
