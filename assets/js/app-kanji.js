/* Japanote — kanji study/practice (split from app.js, phase 2) */

function normalizeKanjiRows(payload) {
  return Array.isArray(payload) ? payload.filter((row) => Array.isArray(row)) : [];
}
let kanjiDataRows = normalizeKanjiRows([]);

function refreshKanjiRows(payload) {
  kanjiDataRows = normalizeKanjiRows(payload || []);
  globalThis.JAPANOTE_KANJI_DATA = [...kanjiDataRows];
}
function loadKanjiDataFromJson() {
  return fetchJsonData("kanji.json", "kanji.json")
    .then((payload) => {
      refreshKanjiRows(payload || []);
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load kanji.json. Using empty kanji data.", error);
      refreshKanjiRows(kanjiDataRows);
      return null;
    });
}
const kanjiPageSize = 20;
const kanjiPracticeQuizCountOptions = [5, 10, 15, 20];
const kanjiMatchCountOptions = [5, 10, 15, 20];
const kanjiQuizFieldOptions = ["display", "reading", "meaning"];
const kanjiQuizFieldLabels = {
  display: "한자",
  reading: "발음",
  meaning: "\uB73B"
};
const kanjiGradeOptions = [allLevelValue, "1", "2", "3", "4", "5", "6"];
const kanjiToneMap = {
  "1": "tone-gold",
  "2": "tone-sky",
  "3": "tone-mint",
  "4": "tone-coral",
  "5": "tone-gold",
  "6": "tone-sky"
};
function getKanjiTone(grade) {
  return kanjiToneMap[String(grade)] || "tone-gold";
}

function getKanjiGrade(value = state?.kanjiGrade) {
  const normalizedGrade = normalizeQuizText(value);
  return kanjiGradeOptions.includes(normalizedGrade) ? normalizedGrade : allLevelValue;
}

function getKanjiGradeLabel(grade = state?.kanjiGrade) {
  const activeGrade = getKanjiGrade(grade);
  return activeGrade === allLevelValue ? "전체" : `${activeGrade}학년`;
}

function getKanjiGradeSummaryLabel(grade = state?.kanjiGrade) {
  return getKanjiGrade(grade) === allLevelValue ? "전체" : `${getKanjiGrade(grade)}학년`;
}

function getKanjiCollectionFilter(value = state?.kanjiCollectionFilter) {
  const normalizedValue = normalizeQuizText(value);
  if (normalizedValue === "saved") {
    return "review";
  }
  return Object.prototype.hasOwnProperty.call(kanjiCollectionFilterLabels, normalizedValue) ? normalizedValue : "all";
}

function getKanjiCollectionSummaryLabel(filter = state?.kanjiCollectionFilter) {
  return kanjiCollectionFilterLabels[getKanjiCollectionFilter(filter)] || kanjiCollectionFilterLabels.all;
}

function getKanjiView(view = state?.kanjiView) {
  return view === "list" ? "list" : "card";
}

function getKanjiViewLabel(view = state?.kanjiView) {
  return getKanjiView(view) === "list" ? "목록" : "카드";
}

function getKanjiOptionsSummaryText() {
  return [
    getKanjiGradeSummaryLabel(),
    getKanjiViewLabel(),
    getKanjiCollectionSummaryLabel()
  ].join(" · ");
}

function getKanjiPracticeQuizField(value, fallback = "display") {
  return kanjiQuizFieldOptions.includes(value) ? value : fallback;
}

function getAlternateKanjiPracticeField(field) {
  const normalizedField = getKanjiPracticeQuizField(field);
  return kanjiQuizFieldOptions.find((candidate) => candidate !== normalizedField) || "display";
}

function getDefaultKanjiPracticeOptionField(questionField) {
  return getAlternateKanjiPracticeField(questionField);
}

function getDefaultKanjiPracticeQuestionField(optionField) {
  return getAlternateKanjiPracticeField(optionField);
}

function getKanjiPracticeQuestionField(value = state?.kanjiPracticeQuestionField) {
  return getKanjiPracticeQuizField(value, "display");
}

function getKanjiPracticeOptionField(value = state?.kanjiPracticeOptionField, questionField = state?.kanjiPracticeQuestionField) {
  const normalizedQuestionField = getKanjiPracticeQuestionField(questionField);
  let nextField = getKanjiPracticeQuizField(value, getDefaultKanjiPracticeOptionField(normalizedQuestionField));

  if (nextField === normalizedQuestionField) {
    nextField = getDefaultKanjiPracticeOptionField(normalizedQuestionField);
  }

  if (nextField === normalizedQuestionField) {
    nextField = kanjiQuizFieldOptions.find((field) => field !== normalizedQuestionField) || "reading";
  }

  return nextField;
}

function getKanjiPracticeFieldLabel(field) {
  return kanjiQuizFieldLabels[getKanjiPracticeQuizField(field)] || kanjiQuizFieldLabels.display;
}

function getKanjiPracticeQuizConfigLabel(
  questionField = state?.kanjiPracticeQuestionField,
  optionField = state?.kanjiPracticeOptionField
) {
  return `${getKanjiPracticeFieldLabel(questionField)} → ${getKanjiPracticeFieldLabel(optionField)}`;
}

function getKanjiPracticeItemValue(item, field) {
  const normalizedField = getKanjiPracticeQuizField(field);

  if (normalizedField === "meaning") {
    return normalizeKanjiMeaning(item?.meaning);
  }

  return normalizedField === "reading" ? normalizeQuizText(item?.reading) : normalizeQuizDisplay(item?.display);
}

function getKanjiPracticePrompt(
  questionField = state?.kanjiPracticeQuestionField,
  optionField = state?.kanjiPracticeOptionField
) {
  const normalizedQuestionField = getKanjiPracticeQuestionField(questionField);
  const normalizedOptionField = getKanjiPracticeOptionField(optionField, normalizedQuestionField);

  if (normalizedQuestionField === "display") {
    return normalizedOptionField === "meaning" ? "이 한자, 무슨 뜻일까요?" : "이 한자, 어떻게 읽을까요?";
  }

  if (normalizedQuestionField === "reading") {
    return normalizedOptionField === "meaning" ? "이 발음, 무슨 뜻일까요?" : "이 발음, 어떤 한자일까요?";
  }

  return normalizedOptionField === "reading" ? "이 뜻, 어떤 발음일까요?" : "이 뜻, 어떤 한자일까요?";
}

function normalizeKanjiMeaning(value) {
  return normalizeQuizText(value || "");
}

function getKanjiMeaningDisplaySub(meaning) {
  const normalizedMeaning = normalizeKanjiMeaning(meaning);
  return normalizedMeaning;
}

function getKanjiPracticeDisplaySub(item, questionField = state?.kanjiPracticeQuestionField) {
  // 한자 퀴즈는 하단 보조 영역을 비워 두고 문제 본문과 보기만으로 판단하게 한다.
  return "";
}

function getKanjiFlashcardReadingText(item) {
  const normalizedReading = normalizeQuizText(item?.readingsDisplay || item?.reading || "");
  return normalizedReading;
}

function getKanjiFlashcardMeaningText(item) {
  const normalizedMeaning = normalizeKanjiMeaning(item?.meaning);
  return normalizedMeaning;
}
function buildKanjiPracticeItemsFromData(rows = kanjiDataRows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const [char, grade, reading, readingsDisplay, strokeCount, meaning] = Array.isArray(row) ? row : [];
      const normalizedGrade = String(grade || "");
      const normalizedReading = normalizeQuizText(reading || "");
      const normalizedChar = normalizeQuizText(char || "");
      const normalizedMeaning = normalizeKanjiMeaning(meaning);

      if (!normalizedChar || !normalizedReading || !kanjiGradeOptions.includes(normalizedGrade)) {
        return null;
      }

      const gradeLabel = getKanjiGradeLabel(normalizedGrade);
      const strokes = Number.isFinite(Number(strokeCount)) ? Number(strokeCount) : 0;

      return {
        id: `kanji-${normalizedGrade}-${index + 1}-${normalizedChar}`,
        grade: normalizedGrade,
        gradeLabel,
        source: gradeLabel,
        title: `${gradeLabel} \uD55C\uC790`,
        note: gradeLabel,
        prompt: "\uC774 \uD55C\uC790, \uC5B4\uB5BB\uAC8C \uC77D\uC744\uAE4C\uC694?",
        display: normalizedChar,
        displaySub: getKanjiMeaningDisplaySub(normalizedMeaning),
        reading: normalizedReading,
        readingsDisplay: normalizeQuizText(readingsDisplay || normalizedReading),
        meaning: normalizedMeaning,
        strokeCount: strokes,
        tone: getKanjiTone(normalizedGrade),
        explanation: normalizedMeaning
          ? `${normalizedChar}\uB294 ${normalizedReading}\uB77C\uACE0 \uC77D\uACE0, \uB73B\uC740 ${normalizedMeaning}\uC774\uC5D0\uC694.`
          : `${normalizedChar}\uC758 \uB300\uD45C \uC77D\uAE30 \uC911 \uD558\uB098\uB294 ${normalizedReading}\uC608\uC694.`
      };
    })
    .filter(Boolean);
}
function getKanjiPracticeQuizCount(value = state?.kanjiPracticeQuizCount) {
  const numericValue = Number(value);
  return kanjiPracticeQuizCountOptions.includes(numericValue) ? numericValue : 10;
}

function getKanjiPracticeQuizDuration(value = state?.kanjiPracticeQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getKanjiTab(value = state?.kanjiTab) {
  return ["list", "practice", "match"].includes(value) ? value : "list";
}
let activeKanjiPracticeQuestions = [];

const kanjiPracticeResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const kanjiCollectionFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 봤어요"
};
const kanjiPracticeState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};

function refreshKanjiPracticeSet() {
  const dynamicKanjiItems = buildKanjiPracticeItemsFromData();

  if (dynamicKanjiItems.length) {
    basicPracticeSets.kanji = {
      label: "한자",
      heading: "학년별 배당 한자",
      items: dynamicKanjiItems
    };
  } else {
    delete basicPracticeSets.kanji;
  }
}
function saveKanjiToReviewList(id) {
  setStudyListStatus("kanji", id, "review");
}

function removeKanjiFromReviewList(id) {
  removeFromStudyReviewList("kanji", id);
}

function saveKanjiToMasteredList(id) {
  setStudyListStatus("kanji", id, "mastered");
}

function removeKanjiFromMasteredList(id) {
  removeFromStudyMasteredList("kanji", id);
}

function isKanjiSavedToReviewList(id) {
  return isSavedToReviewList("kanji", id);
}

function isKanjiSavedToMasteredList(id) {
  return isSavedToMasteredList("kanji", id);
}

function getKanjiListStatus(id) {
  return getStudyListStatus("kanji", id);
}

function setKanjiListStatus(id, status) {
  setStudyListStatus("kanji", id, status);
}
function getKanjiCollectionItems(collectionFilter = state?.kanjiCollectionFilter) {
  const items = basicPracticeSets.kanji?.items || [];
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);

  if (activeCollectionFilter === "review") {
    return items.filter((item) => isKanjiSavedToReviewList(item.id));
  }

  if (activeCollectionFilter === "mastered") {
    return items.filter((item) => isKanjiSavedToMasteredList(item.id));
  }

  if (activeCollectionFilter === "unmarked") {
    return items.filter((item) => !isKanjiSavedToReviewList(item.id) && !isKanjiSavedToMasteredList(item.id));
  }

  return items;
}

function getVisibleKanjiItems(grade = state?.kanjiGrade, collectionFilter = state?.kanjiCollectionFilter) {
  const items = getKanjiCollectionItems(collectionFilter);
  const activeGrade = getKanjiGrade(grade);
  return activeGrade === allLevelValue ? items : items.filter((item) => item.grade === activeGrade);
}

function getKanjiCollectionCounts(items = basicPracticeSets.kanji?.items || []) {
  return {
    all: items.length,
    review: items.filter((item) => isKanjiSavedToReviewList(item.id)).length,
    mastered: items.filter((item) => isKanjiSavedToMasteredList(item.id)).length,
    unmarked: items.filter((item) => !isKanjiSavedToReviewList(item.id) && !isKanjiSavedToMasteredList(item.id)).length
  };
}

function getKanjiGradeCounts(items = basicPracticeSets.kanji?.items || []) {
  const counts = kanjiGradeOptions.reduce((map, grade) => {
    map[grade] = 0;
    return map;
  }, {});

  counts[allLevelValue] = items.length;
  items.forEach((item) => {
    const grade = String(item?.grade || "");
    if (Object.prototype.hasOwnProperty.call(counts, grade)) {
      counts[grade] += 1;
    }
  });

  return counts;
}

function populateKanjiCollectionSelect(select, counts, activeFilter = getKanjiCollectionFilter()) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  Object.entries(kanjiCollectionFilterLabels).forEach(([filter, label]) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${label} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getKanjiCollectionFilter(activeFilter);
}

function populateKanjiGradeSelect(select, counts, activeGrade = getKanjiGrade()) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  kanjiGradeOptions.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent =
      grade === allLevelValue
        ? `전체 (${counts[grade] ?? 0})`
        : `${grade}학년 (${counts[grade] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getKanjiGrade(activeGrade);
}

function buildKanjiPracticeOptions(
  item,
  pool = getVisibleKanjiItems(),
  optionField = getKanjiPracticeOptionField()
) {
  const correctAnswer = getKanjiPracticeItemValue(item, optionField);
  const poolReadings = shuffleQuizArray(
    uniqueQuizValues(
      pool
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => getKanjiPracticeItemValue(candidate, optionField))
        .filter((value) => value && value !== correctAnswer)
    )
  );
  const fallbackReadings = shuffleQuizArray(
    uniqueQuizValues(
      (basicPracticeSets.kanji?.items || [])
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => getKanjiPracticeItemValue(candidate, optionField))
        .filter((value) => value && value !== correctAnswer && !poolReadings.includes(value))
    )
  );
  const options = [correctAnswer];

  [...poolReadings, ...fallbackReadings].forEach((value) => {
    if (options.length < 4 && !options.includes(value)) {
      options.push(value);
    }
  });

  return shuffleQuizArray(options);
}

function buildKanjiPracticeQuestion(item, pool = getVisibleKanjiItems(), config = {}) {
  if (!item) {
    return null;
  }

  const questionField = getKanjiPracticeQuestionField(config.questionField);
  const optionField = getKanjiPracticeOptionField(config.optionField, questionField);
  const options = buildKanjiPracticeOptions(item, pool, optionField);
  const answerValue = getKanjiPracticeItemValue(item, optionField);
  const answer = options.indexOf(answerValue);

  if (!answerValue || answer < 0 || options.length < 2) {
    return null;
  }

  return {
    ...item,
    baseDisplay: item.display,
    baseReading: item.reading,
    questionField,
    optionField,
    prompt: getKanjiPracticePrompt(questionField, optionField),
    display: getKanjiPracticeItemValue(item, questionField),
    displaySub: getKanjiPracticeDisplaySub(item, questionField),
    options,
    answer
  };
}

function buildKanjiPracticeQuestionSet(items = getVisibleKanjiItems(), config = {}) {
  const pool = Array.isArray(items) ? items.filter(Boolean) : [];
  const count = Math.min(getKanjiPracticeQuizCount(config.count), pool.length);
  const questionField = getKanjiPracticeQuestionField(config.questionField);
  const optionField = getKanjiPracticeOptionField(config.optionField, questionField);
  const seedItems = shuffleQuizArray(pool);
  const questions = [];

  // 한자 퀴즈는 시작 시점의 보기 배열을 고정해야 재렌더 중에도 보기가 바뀌지 않는다.
  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const question = buildKanjiPracticeQuestion(seedItems[index], pool, {
      questionField,
      optionField
    });

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

function getKanjiPracticeQuestionCount() {
  const total = getVisibleKanjiItems().length;
  return Math.min(getKanjiPracticeQuizCount(), total);
}

function resetKanjiPracticeSessionState(resetIndex = false) {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("kanji-practice-result-view");
  activeKanjiPracticeQuestions = [];
  kanjiPracticeState.results = [];
  kanjiPracticeState.showResults = false;
  kanjiPracticeState.resultFilter = "all";
  resetQuizSessionScore("kanjiPractice");
  setQuizSessionDuration("kanjiPractice", getKanjiPracticeQuizDuration());
  stopQuizSessionTimer("kanjiPractice");

  if (resetIndex) {
    state.basicPracticeIndexes.kanji = 0;
  }
}

function invalidateKanjiPracticeSession() {
  resetKanjiPracticeSessionState(true);
  state.kanjiPracticeQuizStarted = false;
  state.kanjiPracticeQuizFinished = false;
  // 설정 패널 안에서 문제 수나 시간을 연속으로 조정할 수 있어야 해서
  // 세션만 초기화하고 패널 open 상태는 그대로 유지한다.
}

function startNewKanjiPracticeSession() {
  resetKanjiPracticeSessionState(true);
  activeKanjiPracticeQuestions = buildKanjiPracticeQuestionSet(getVisibleKanjiItems(), {
    questionField: getKanjiPracticeQuestionField(),
    optionField: getKanjiPracticeOptionField(),
    count: getKanjiPracticeQuizCount()
  });

  if (!activeKanjiPracticeQuestions.length) {
    state.kanjiPracticeQuizStarted = false;
    state.kanjiPracticeQuizFinished = false;
    return false;
  }

  state.kanjiPracticeQuizStarted = true;
  state.kanjiPracticeQuizFinished = false;
  return true;
}

function ensureKanjiPracticeSession(force = false) {
  if (!state.kanjiPracticeQuizStarted) {
    return false;
  }

  const currentIndex = Number.isFinite(Number(state.basicPracticeIndexes.kanji))
    ? Number(state.basicPracticeIndexes.kanji)
    : 0;

  if (
    force ||
    !activeKanjiPracticeQuestions.length ||
    currentIndex < 0 ||
    currentIndex >= activeKanjiPracticeQuestions.length
  ) {
    const started = startNewKanjiPracticeSession();
    saveState();
    return started;
  }

  return true;
}

function getCurrentKanjiPracticeSet() {
  const currentIndex = Number.isFinite(Number(state.basicPracticeIndexes.kanji))
    ? Number(state.basicPracticeIndexes.kanji)
    : 0;
  return activeKanjiPracticeQuestions[currentIndex] || activeKanjiPracticeQuestions[0] || null;
}

function getKanjiPracticeResultFilter(value = kanjiPracticeState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(kanjiPracticeResultFilterLabels, value) ? value : "all";
}

function getKanjiPracticeOptionsSummaryText() {
  return [
    getKanjiPracticeQuizConfigLabel(),
    getKanjiCollectionSummaryLabel(),
    getKanjiGradeSummaryLabel(),
    `${getKanjiPracticeQuestionCount()}문제`,
    getDurationLabel(getKanjiPracticeQuizDuration())
  ].join(" · ");
}

function getKanjiEmptyMessage(collectionFilter = state?.kanjiCollectionFilter, grade = state?.kanjiGrade) {
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);

  if (activeCollectionFilter === "review") {
    return "다시 볼 한자가 아직 없어요. 표시해두면 여기서 모아 볼 수 있어요.";
  }

  if (activeCollectionFilter === "mastered") {
    return "익힌 한자가 아직 없어요. 익혔어요를 눌러두면 여기 모여요.";
  }

  if (activeCollectionFilter === "unmarked") {
    return "아직 상태를 정하지 않은 한자는 지금 없어요. 다른 학년으로 바꿔보세요.";
  }

  return "지금 보여줄 한자가 없어요. 학년이나 모아보기를 바꿔볼까요?";
}
function getKanjiPracticeResultCounts() {
  return getStudyResultCounts(kanjiPracticeState.results);
}

function getFilteredKanjiPracticeResults(filter = getKanjiPracticeResultFilter(kanjiPracticeState.resultFilter)) {
  return getFilteredStudyResults(kanjiPracticeState.results, getKanjiPracticeResultFilter(filter));
}
function setKanjiPracticeResult(current, selectedIndex, correct, timedOut = false) {
  const answerText = current.options[current.answer] || "";
  const selected = timedOut ? "" : current.options[selectedIndex] || "";
  const result = {
    id: current.id,
    source: current.gradeLabel || current.source,
    char: current.baseDisplay || current.display,
    reading: current.baseReading || current.reading,
    meaning: current.meaning || "",
    questionField: current.questionField,
    optionField: current.optionField,
    answerText,
    meta: current.gradeLabel || current.note || "",
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const currentResultIndex = kanjiPracticeState.results.findIndex((item) => item.id === current.id);

  if (currentResultIndex >= 0) {
    kanjiPracticeState.results[currentResultIndex] = result;
    return;
  }

  kanjiPracticeState.results.push(result);
}

function renderKanjiPracticeBulkActionButtons(results) {
  const reviewActionButton = document.getElementById("kanji-practice-result-bulk-action");
  const reviewActionLabel = document.getElementById("kanji-practice-result-bulk-label");
  const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
  const masteredActionButton = document.getElementById("kanji-practice-result-mastered-action");
  const masteredActionLabel = document.getElementById("kanji-practice-result-mastered-label");
  const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: reviewActionButton,
    label: reviewActionLabel,
    icon: reviewActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isKanjiSavedToReviewList,
    datasetKey: "kanjiPracticeBulkAction",
    saveActionValue: "save-review",
    removeActionValue: "remove-review",
    saveLabel: getJapanoteButtonLabel("reviewSave"),
    removeLabel: getJapanoteButtonLabel("reviewRemove"),
    emptyTitle: "지금 표시 중인 한자가 없어요.",
    saveTitle: "지금 보이는 한자를 모두 다시 볼 항목으로 표시해요.",
    removeTitle: "지금 보이는 한자의 다시 보기 표시를 모두 해제해요."
  });
  renderResultBulkActionButton({
    button: masteredActionButton,
    label: masteredActionLabel,
    icon: masteredActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isKanjiSavedToMasteredList,
    datasetKey: "kanjiPracticeMasteredBulkAction",
    saveActionValue: "save-mastered",
    removeActionValue: "remove-mastered",
    saveLabel: getJapanoteButtonLabel("masteredSave"),
    removeLabel: getJapanoteButtonLabel("masteredRemove"),
    emptyTitle: "지금 표시 중인 한자가 없어요.",
    saveTitle: "지금 보이는 한자를 모두 익힘으로 표시해요.",
    removeTitle: "지금 보이는 한자의 익힘 표시를 모두 해제해요.",
    saveIcon: "check_circle",
    removeIcon: "remove_done"
  });
}
function getKanjiPracticeResultDetail(item) {
  const parts = [];

  if (item.status === "wrong" && item.timedOut) {
    parts.push("\uC2DC\uAC04 \uCD08\uACFC");
  }

  if (item.optionField !== "reading" && item.reading) {
    parts.push(`\uBC1C\uC74C ${item.reading}`);
  }

  if (item.meaning) {
    parts.push(`\uB73B ${item.meaning}`);
  }

  if (item.meta) {
    parts.push(item.meta);
  }

  return parts.join(" \u00B7 ");
}
function renderKanjiPracticeResults() {
  const counts = getKanjiPracticeResultCounts();
  const filteredResults = getFilteredKanjiPracticeResults();
  renderSharedStudyResults({
    resultViewId: "kanji-practice-result-view",
    totalId: "kanji-practice-result-total",
    correctId: "kanji-practice-result-correct",
    wrongId: "kanji-practice-result-wrong",
    emptyId: "kanji-practice-result-empty",
    listId: "kanji-practice-result-list",
    bulkActionButtonId: "kanji-practice-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getKanjiPracticeResultFilter(kanjiPracticeState.resultFilter),
    filterLabels: kanjiPracticeResultFilterLabels,
    renderBulkActionButton: renderKanjiPracticeBulkActionButtons,
    getEmptyText: ({ activeFilter }) => getStudyPracticeResultEmptyMessage(activeFilter),
    renderItems: (results, container) => {
      results.forEach((item) => {
        const saved = isKanjiSavedToReviewList(item.id);
        const reviewSelected = saved;
        const masteredSelected = isKanjiSavedToMasteredList(item.id);

        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.source || "한자",
          titleText: item.reading ? `${item.char || "-"} · ${item.reading}` : item.char || "-",
          descriptionText: getKanjiPracticeResultDetail(item),
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? getJapanoteButtonLabel("reviewRemove") : getJapanoteButtonLabel("reviewSave"),
              datasetName: "kanjiResultReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? getJapanoteButtonLabel("masteredRemove") : getJapanoteButtonLabel("masteredSave"),
              datasetName: "kanjiResultMastered",
              defaultIcon: "check_circle",
              selectedIcon: "task_alt",
              selectedClassName: "is-mastered"
            }
          ]
        });
      });
    }
  });
}

function renderKanjiPracticeControls() {
  const optionsShell = document.getElementById("kanji-practice-options-shell");
  const optionsToggle = document.getElementById("kanji-practice-options-toggle");
  const optionsPanel = document.getElementById("kanji-practice-options-panel");
  const optionsSummary = document.getElementById("kanji-practice-options-summary");
  const questionFieldSelect = document.getElementById("kanji-practice-question-field");
  const optionFieldSelect = document.getElementById("kanji-practice-option-field");
  const collectionSelect = document.getElementById("kanji-practice-collection-select");
  const gradeSelect = document.getElementById("kanji-practice-grade-select");
  const startButton = document.getElementById("kanji-practice-start");
  const startLabel = document.getElementById("kanji-practice-start-label");
  const countSpinner = document.querySelector('[data-spinner-id="kanji-practice-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kanji-practice-time"]');
  const isOptionsOpen = state.kanjiPracticeQuizOptionsOpen === true;
  const activeCount = getKanjiPracticeQuizCount();
  const activeDuration = getKanjiPracticeQuizDuration();
  const activeQuestionField = getKanjiPracticeQuestionField();
  const activeOptionField = getKanjiPracticeOptionField();
  const collectionCounts = getKanjiCollectionCounts();
  const gradeCounts = getKanjiGradeCounts(getKanjiCollectionItems());
  const canStart = getKanjiPracticeQuestionCount() > 0;
  const isSettingsLocked = state.kanjiPracticeQuizStarted && !state.kanjiPracticeQuizFinished;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getKanjiPracticeOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: kanjiPracticeQuizCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: quizDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: questionFieldSelect,
        value: activeQuestionField,
        populate: populateKanjiPracticeQuizFieldSelect
      },
      {
        element: optionFieldSelect,
        value: activeOptionField,
        populate: populateKanjiPracticeQuizFieldSelect
      },
      {
        element: collectionSelect,
        populate: (element) => populateKanjiCollectionSelect(element, collectionCounts, getKanjiCollectionFilter())
      },
      {
        element: gradeSelect,
        populate: (element) => populateKanjiGradeSelect(element, gradeCounts, getKanjiGrade())
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.kanjiPracticeQuizStarted,
      canStart
    }
  });
}

function renderKanjiPractice() {
  const card = document.getElementById("kanji-practice-card");
  const nextButton = document.getElementById("kanji-practice-next");
  const optionsContainer = document.getElementById("kanji-practice-options");
  const progress = document.getElementById("kanji-practice-progress");
  const display = document.getElementById("kanji-practice-display");
  const displaySub = document.getElementById("kanji-practice-display-sub");
  const questionCount = activeKanjiPracticeQuestions.length;
  const current = getCurrentKanjiPracticeSet();

  if (!card || !nextButton || !optionsContainer || !progress || !display || !displaySub) {
    return;
  }

  if (!questionCount || !current) {
    optionsContainer.innerHTML = "";
    delete optionsContainer.dataset.answered;
    nextButton.disabled = true;
    return;
  }

  progress.textContent = `${state.basicPracticeIndexes.kanji + 1} / ${questionCount}`;
  display.textContent = formatQuizLineBreaks(current.display);
  displaySub.textContent = formatQuizLineBreaks(current.displaySub || "");
  displaySub.hidden = !normalizeQuizText(current.displaySub || "");
  applyDisplayTextSize(display);

  card.className = `basic-practice-card kanji-practice-card ${current.tone || "tone-gold"}`;
  nextButton.textContent =
    state.basicPracticeIndexes.kanji >= questionCount - 1 ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
  nextButton.disabled = true;

  delete optionsContainer.dataset.answered;
  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "basic-practice-option",
    formatText: formatQuizLineBreaks,
    onSelect: handleKanjiPracticeAnswer,
    setPressedState: true
  });

  setQuizSessionDuration("kanjiPractice", getKanjiPracticeQuizDuration());
  resetQuizSessionTimer("kanjiPractice", handleKanjiPracticeTimeout);
}

function getKanjiSummaryText(count, collectionFilter = state?.kanjiCollectionFilter, grade = state?.kanjiGrade) {
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);
  const collectionLabel = getKanjiCollectionSummaryLabel(activeCollectionFilter);
  const gradeLabel = getKanjiGradeSummaryLabel(grade);
  const subject = activeCollectionFilter === "all" ? "한자" : `${collectionLabel} 한자`;

  return `${gradeLabel} ${subject} ${count}개를 보고 있어요`;
}

function getVisibleKanjiCards() {
  return getOrderedStudyCards("kanji", getVisibleKanjiItems());
}

function getKanjiPageCount(items) {
  return getStudyPageCount(items, kanjiPageSize);
}

function clampKanjiPage(items) {
  clampStudyPage("kanjiPage", items, kanjiPageSize);
}

function getKanjiFlashcardRevealStep(step = state?.kanjiFlashcardRevealStep) {
  const normalizedStep = Math.floor(Number(step));
  return Number.isFinite(normalizedStep) ? Math.min(Math.max(normalizedStep, 0), 2) : 0;
}

function setKanjiFlashcardRevealStep(step) {
  state.kanjiFlashcardRevealStep = getKanjiFlashcardRevealStep(step);
  state.kanjiFlashcardRevealed = state.kanjiFlashcardRevealStep > 0;
}

function resetKanjiStudyPointers() {
  state.kanjiPage = 1;
  state.kanjiFlashcardIndex = 0;
  setKanjiFlashcardRevealStep(0);
}

function syncKanjiFlashcardIndexAfterUpdate(currentCardId, previousIndex) {
  syncStudyFlashcardIndexAfterUpdate({
    currentCardId,
    previousIndex,
    getCards: getVisibleKanjiCards,
    indexKey: "kanjiFlashcardIndex"
  });
}

function getKanjiFlashcardPlaceholder() {
  const activeCollectionFilter = getKanjiCollectionFilter();

  return {
    id: "kanji-empty",
    gradeLabel: getKanjiGradeSummaryLabel(),
    display: "漢字",
    statusText: getKanjiEmptyMessage(),
    readingsDisplay: ""
  };
}

function getKanjiPageHeading(tab = getKanjiTab(state.kanjiTab)) {
  const copyRoot = getJapanoteCopy();
  const fb = japanoteCopyFallback.kanji;
  if (tab === "practice") {
    return resolveHeadingNode(copyRoot.kanji?.practice, fb.practice);
  }

  if (tab === "match") {
    return resolveHeadingNode(copyRoot.kanji?.match, fb.match);
  }

  return resolveHeadingNode(copyRoot.kanji?.list, fb.list);
}

function renderKanjiPageHeader(tab = getKanjiTab(state.kanjiTab)) {
  applyPageHeading(
    document.getElementById("kanji-heading-title"),
    document.getElementById("kanji-heading-copy"),
    getKanjiPageHeading(tab)
  );
}

function renderKanjiStudyControls() {
  const summary = document.getElementById("kanji-summary");
  const collectionSelect = document.getElementById("kanji-collection-select");
  const gradeSelect = document.getElementById("kanji-grade-select");
  const collectionCounts = getKanjiCollectionCounts();
  const gradeCounts = getKanjiGradeCounts(getKanjiCollectionItems());
  const activeView = getKanjiView();
  const visibleItems = getVisibleKanjiItems();

  renderStudyCatalogControls({
    summary,
    summaryText: getKanjiSummaryText(visibleItems.length),
    viewSelector: "[data-kanji-view]",
    viewAttribute: "data-kanji-view",
    activeView,
    selectConfigs: [
      {
        element: collectionSelect,
        populate: (element) => populateKanjiCollectionSelect(element, collectionCounts, getKanjiCollectionFilter())
      },
      {
        element: gradeSelect,
        populate: (element) => populateKanjiGradeSelect(element, gradeCounts, getKanjiGrade())
      }
    ]
  });
}

function renderKanjiFlashcard() {
  const flashcard = document.getElementById("kanji-flashcard");
  const toggle = document.getElementById("kanji-flashcard-toggle");
  const prev = document.getElementById("kanji-flashcard-prev");
  const next = document.getElementById("kanji-flashcard-next");
  const reviewButton = document.getElementById("kanji-flashcard-review");
  const masteredButton = document.getElementById("kanji-flashcard-mastered");
  const level = document.getElementById("kanji-flashcard-level");
  const word = document.getElementById("kanji-flashcard-word");
  const reading = document.getElementById("kanji-flashcard-reading");
  const meaning = document.getElementById("kanji-flashcard-meaning");
  const hint = document.getElementById("kanji-flashcard-hint");
  const cards = getVisibleKanjiCards();

  if (
    !flashcard ||
    !toggle ||
    !prev ||
    !next ||
    !reviewButton ||
    !masteredButton ||
    !level ||
    !word ||
    !reading ||
    !meaning ||
    !hint
  ) {
    return;
  }

  const hasCards = cards.length > 0;
  const currentIndex = hasCards ? state.kanjiFlashcardIndex % cards.length : 0;
  const currentCard = hasCards ? cards[currentIndex] : getKanjiFlashcardPlaceholder();
  const review = hasCards && isKanjiSavedToReviewList(currentCard.id);
  const mastered = hasCards && isKanjiSavedToMasteredList(currentCard.id);
  const revealStep = hasCards ? getKanjiFlashcardRevealStep() : 0;
  const isRevealed = hasCards && revealStep > 0;
  const hintText = hasCards
    ? revealStep === 0
      ? "\uB204\uB974\uBA74 \uBC1C\uC74C\uC744 \uD655\uC778\uD574\uC694"
      : revealStep === 1
        ? "\uD55C \uBC88 \uB354 \uB204\uB974\uBA74 \uB73B\uC744 \uD655\uC778\uD574\uC694"
        : review
          ? "\uB2E4\uC2DC \uBCFC\uB798\uC694\uC5D0 \uB2F4\uAE34 \uD55C\uC790\uC608\uC694"
          : mastered
            ? "\uC775\uD614\uC5B4\uC694\uC5D0 \uB2F4\uAE34 \uD55C\uC790\uC608\uC694"
            : "\uD55C \uBC88 \uB354 \uB204\uB974\uBA74 \uB2E4\uC2DC \uAC00\uB824\uC838\uC694"
    : "\uD544\uD130\uB97C \uBC14\uAFB8\uBA74 \uB2E4\uB978 \uD55C\uC790\uB97C \uBC14\uB85C \uBCFC \uC218 \uC788\uC5B4\uC694.";
  const toggleLabel = hasCards
    ? revealStep === 0
      ? "\uBC1C\uC74C\uC744 \uD655\uC778\uD574\uBCFC\uAE4C\uC694?"
      : revealStep === 1
        ? "\uB73B\uC744 \uD655\uC778\uD574\uBCFC\uAE4C\uC694?"
        : "\uCE74\uB4DC\uB97C \uB2E4\uC2DC \uAC00\uB9B4\uAE4C\uC694?"
    : "";

  renderStudyFlashcardComponent({
    flashcard,
    toggle,
    prev,
    next,
    level,
    word,
    reading,
    meaning,
    hint,
    hasCards,
    isRevealed,
    revealWhenEmpty: true,
    levelText: currentCard.gradeLabel || "\uD55C\uC790",
    wordText: currentCard.display || "\u6F22\u5B57",
    readingText: hasCards ? getKanjiFlashcardReadingText(currentCard) : "",
    meaningText: hasCards ? getKanjiFlashcardMeaningText(currentCard) : currentCard.statusText || getKanjiEmptyMessage(),
    hintText,
    hideReading: hasCards && revealStep < 1,
    hideMeaning: hasCards && revealStep < 2,
    toggleLabel,
    toggleOpenLabel: "\uBC1C\uC74C\uACFC \uB73B\uC744 \uB2E4\uC2DC \uC811\uC744\uAE4C\uC694?",
    toggleClosedLabel: "\uBC1C\uC74C\uACFC \uB73B\uC744 \uD655\uC778\uD574\uBCFC\uAE4C\uC694?",
    toggleEmptyLabel: "\uD45C\uC2DC\uD560 \uD55C\uC790\uAC00 \uC5C6\uC5B4\uC694",
    prevDisabled: cards.length <= 1,
    nextDisabled: cards.length <= 1,
    actionButtons: [
      {
        button: reviewButton,
        selected: review,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      },
      {
        button: masteredButton,
        selected: mastered,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      }
    ]
  });
}

function renderKanjiList() {
  const list = document.getElementById("kanji-list");
  const pageInfo = document.getElementById("kanji-page-info");
  const prev = document.getElementById("kanji-page-prev");
  const next = document.getElementById("kanji-page-next");
  const items = getVisibleKanjiItems();

  renderStatefulStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    pageKey: "kanjiPage",
    pageSize: kanjiPageSize,
    emptyMessage: getKanjiEmptyMessage(),
    renderItem: (item, displayIndex) => {
      const gradeLabel = item.gradeLabel || getKanjiGradeLabel(item.grade);

      return createStudyListCardMarkup({
        index: displayIndex,
        headMetaMarkup: gradeLabel ? `<span class="vocab-list-index">${gradeLabel}</span>` : "",
        headRightMarkup: createKanjiListStatusIconsMarkup(item.id),
        mainClassName: "vocab-list-main kanji-list-main",
        titleClassName: "vocab-list-word kanji-list-char",
        titleText: formatQuizLineBreaks(item.display),
        subtitleText: formatQuizLineBreaks(item.readingsDisplay || item.reading),
        descriptionMarkup: item.meaning
          ? `<p class="vocab-list-meaning kanji-list-meaning">${formatQuizLineBreaks(item.meaning)}</p>`
          : "",
        actionsMarkup: ""
      });
    }
  });
}

function renderKanjiPageLayout() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const activeTab = getKanjiTab(state.kanjiTab);
  const cardView = document.getElementById("kanji-card-view");
  const listView = document.getElementById("kanji-list-view");
  const empty = document.getElementById("kanji-practice-empty");
  const practiceView = document.getElementById("kanji-practice-view");
  const resultView = document.getElementById("kanji-practice-result-view");

  renderKanjiPageHeader(activeTab);
  renderKanjiPracticeControls();
  renderKanjiStudyControls();

  syncTabButtonsAndPanels({
    buttonSelector: "[data-kanji-tab]",
    panelSelector: "[data-kanji-tab-panel]",
    buttonAttribute: "kanjiTab",
    panelAttribute: "kanjiTabPanel",
    activeValue: activeTab
  });

  if (activeTab === "list") {
    stopQuizSessionTimer("kanjiPractice");
    renderQuizSessionHud("kanjiPractice");
    renderStudyCatalogSection({
      cardView,
      listView,
      activeView: getKanjiView(),
      renderFlashcard: renderKanjiFlashcard,
      renderList: renderKanjiList
    });
    return;
  }

  if (activeTab === "match") {
    stopQuizSessionTimer("kanjiPractice");
    renderQuizSessionHud("kanjiPractice");
    return;
  }

  if (!state.kanjiPracticeQuizStarted) {
    stopQuizSessionTimer("kanjiPractice");
    resetQuizSessionScore("kanjiPractice");
    setQuizSessionDuration("kanjiPractice", getKanjiPracticeQuizDuration());
    if (empty) {
      empty.textContent = getKanjiPracticeQuestionCount() > 0
        ? getJapanoteButtonLabel("start")
        : getKanjiEmptyMessage();
    }
    setElementHidden(empty, false);
    setElementHidden(practiceView, true);
    setElementHidden(resultView, true);
    renderQuizSessionHud("kanjiPractice");
    return;
  }

  if (!ensureKanjiPracticeSession()) {
    stopQuizSessionTimer("kanjiPractice");
    if (empty) {
      empty.textContent = getKanjiEmptyMessage();
    }
    setElementHidden(empty, false);
    setElementHidden(practiceView, true);
    setElementHidden(resultView, true);
    renderQuizSessionHud("kanjiPractice");
    return;
  }

  setElementHidden(empty, true);
  setElementHidden(practiceView, kanjiPracticeState.showResults);
  setElementHidden(resultView, !kanjiPracticeState.showResults);

  if (kanjiPracticeState.showResults) {
    stopQuizSessionTimer("kanjiPractice");
    renderQuizSessionHud("kanjiPractice");
    renderKanjiPracticeResults();
    return;
  }

  renderKanjiPractice();
}
function setKanjiTab(tab) {
  const nextTab = getKanjiTab(tab);

  if (state.kanjiTab === nextTab) {
    return;
  }

  state.kanjiTab = nextTab;
  saveState();
  renderKanjiPageLayout();

  const activePanel = document.querySelector(`[data-kanji-tab-panel="${nextTab}"]`);
  if (activePanel?.scrollIntoView) {
    activePanel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function handleKanjiPracticeAnswer(index) {
  const current = getCurrentKanjiPracticeSet();
  const nextButton = document.getElementById("kanji-practice-next");
  const optionsContainer = document.getElementById("kanji-practice-options");
  const options = document.querySelectorAll("#kanji-practice-options .basic-practice-option");
  const alreadyAnswered = optionsContainer?.dataset.answered === "true";

  if (!current || !nextButton || !optionsContainer || alreadyAnswered || quizSessions.kanjiPractice.isPaused) {
    return;
  }

  const correct = index === current.answer;
  const totalQuestions = activeKanjiPracticeQuestions.length;

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    setPressedState: true
  });
  optionsContainer.dataset.answered = "true";
  finalizeQuizSession("kanjiPractice", correct);
  setKanjiPracticeResult(current, index, correct);

  updateStudyStreak();
  saveState();
  renderStats();

  nextButton.textContent =
    kanjiPracticeState.results.length >= totalQuestions ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
  nextButton.disabled = false;
}

function handleKanjiPracticeTimeout() {
  const current = getCurrentKanjiPracticeSet();
  const nextButton = document.getElementById("kanji-practice-next");
  const optionsContainer = document.getElementById("kanji-practice-options");
  const options = document.querySelectorAll("#kanji-practice-options .basic-practice-option");
  const alreadyAnswered = optionsContainer?.dataset.answered === "true";
  const totalQuestions = activeKanjiPracticeQuestions.length;

  if (!current || !nextButton || !optionsContainer || alreadyAnswered) {
    return;
  }

  finalizeQuizSession("kanjiPractice", false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    setPressedState: true
  });

  optionsContainer.dataset.answered = "true";
  setKanjiPracticeResult(current, -1, false, true);
  updateStudyStreak();
  saveState();
  renderStats();
  nextButton.textContent =
    kanjiPracticeState.results.length >= totalQuestions ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
  nextButton.disabled = false;
}

function nextKanjiPracticeSet() {
  const optionsContainer = document.getElementById("kanji-practice-options");
  const answered = optionsContainer?.dataset.answered === "true";
  const questionCount = activeKanjiPracticeQuestions.length;

  if (!questionCount || !answered) {
    return;
  }

  if (kanjiPracticeState.results.length >= questionCount || state.basicPracticeIndexes.kanji >= questionCount - 1) {
    kanjiPracticeState.showResults = true;
    state.kanjiPracticeQuizFinished = true;
    saveState();
    renderKanjiPageLayout();
    return;
  }

  state.basicPracticeIndexes.kanji += 1;

  saveState();
  renderKanjiPractice();
}

function restartKanjiPractice() {
  invalidateKanjiPracticeSession();
  saveState();
  renderKanjiPageLayout();
}

function setKanjiGrade(grade) {
  const nextGrade = getKanjiGrade(grade);
  updateStudyCatalogState({
    stateKey: "kanjiGrade",
    nextValue: nextGrade,
    resetPointers: resetKanjiStudyPointers,
    invalidate: invalidateKanjiPracticeSession,
    render: renderKanjiPageLayout
  });
}

function setKanjiCollectionFilter(filter) {
  const nextFilter = getKanjiCollectionFilter(filter);
  updateStudyCatalogState({
    stateKey: "kanjiCollectionFilter",
    nextValue: nextFilter,
    resetPointers: resetKanjiStudyPointers,
    invalidate: invalidateKanjiPracticeSession,
    render: renderKanjiPageLayout
  });
}

function setKanjiView(view) {
  const nextView = getKanjiView(view);
  updateStudyCatalogState({
    stateKey: "kanjiView",
    nextValue: nextView,
    render: renderKanjiPageLayout
  });
}

function toggleKanjiFlashcardReveal() {
  if (!getVisibleKanjiCards().length) {
    return;
  }

  // 한자 카드는 한 번에 답을 다 열기보다 발음과 뜻을 순서대로 보여주는 편이 암기 흐름에 맞다.
  const nextRevealStep = getKanjiFlashcardRevealStep() >= 2 ? 0 : getKanjiFlashcardRevealStep() + 1;
  setKanjiFlashcardRevealStep(nextRevealStep);
  updateStudyStreak();
  saveState();
  renderStudyViewWithStats(renderKanjiPageLayout);
}

function moveKanjiFlashcard(step) {
  const cards = getVisibleKanjiCards();

  if (!cards.length) {
    return;
  }

  state.kanjiFlashcardIndex = (state.kanjiFlashcardIndex + step + cards.length) % cards.length;
  setKanjiFlashcardRevealStep(0);
  saveState();
  renderKanjiPageLayout();
}

function markKanjiFlashcardForReview() {
  const cards = getVisibleKanjiCards();

  if (!cards.length) {
    return;
  }

  const currentIndex = state.kanjiFlashcardIndex % cards.length;
  const currentCard = cards[currentIndex];

  saveKanjiToReviewList(currentCard.id);
  updateStudyStreak();
  setKanjiFlashcardRevealStep(0);
  syncKanjiFlashcardIndexAfterUpdate(currentCard.id, currentIndex);
  saveState();
  renderStudyViewWithStats(renderKanjiPageLayout);
}

function markKanjiFlashcardMastered() {
  const cards = getVisibleKanjiCards();

  if (!cards.length) {
    return;
  }

  const currentIndex = state.kanjiFlashcardIndex % cards.length;
  const currentCard = cards[currentIndex];

  saveKanjiToMasteredList(currentCard.id);
  updateStudyStreak();
  setKanjiFlashcardRevealStep(0);
  syncKanjiFlashcardIndexAfterUpdate(currentCard.id, currentIndex);
  saveState();
  renderStudyViewWithStats(renderKanjiPageLayout);
}
function createKanjiListStatusIconsMarkup(id) {
  return createStudyListStatusCycleButtonMarkup(id, "kanji");
}
function populateKanjiPracticeQuizFieldSelect(select, activeField) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  kanjiQuizFieldOptions.forEach((field) => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = getKanjiPracticeFieldLabel(field);
    select.appendChild(option);
  });

  select.value = getKanjiPracticeQuizField(activeField);
}
function attachKanjiListStatusIconListeners({ list, render }) {
  return attachStudyListStatusIconListeners({ list, kind: "kanji", render });
}

function attachKanjiStudyListeners({
  kanjiOptionsToggle,
  kanjiGradeButtons,
  kanjiViewButtons,
  kanjiCollectionSelect,
  kanjiGradeSelect,
  kanjiPagePrev,
  kanjiPageNext,
  kanjiFlashcardToggle,
  kanjiFlashcardPrev,
  kanjiFlashcardNext,
  kanjiFlashcardReview,
  kanjiFlashcardMastered,
  kanjiList
}) {
  attachStudyCatalogListeners({
    optionsToggle: kanjiOptionsToggle,
    optionsStateKey: "kanjiOptionsOpen",
    renderOptions: renderKanjiStudyControls,
    viewButtons: kanjiViewButtons,
    getViewValue: (button) => button.dataset.kanjiView,
    setView: setKanjiView,
    flashcardListeners: {
      toggle: kanjiFlashcardToggle,
      prev: kanjiFlashcardPrev,
      next: kanjiFlashcardNext,
      review: kanjiFlashcardReview,
      mastered: kanjiFlashcardMastered,
      onToggle: toggleKanjiFlashcardReveal,
      onMove: moveKanjiFlashcard,
      onReview: markKanjiFlashcardForReview,
      onMastered: markKanjiFlashcardMastered
    },
    paginationListeners: {
      prev: kanjiPagePrev,
      next: kanjiPageNext,
      getPage: () => state.kanjiPage,
      setPage: (page) => {
        state.kanjiPage = page;
      },
      getPageCount: () => getKanjiPageCount(getVisibleKanjiItems()),
      render: renderKanjiPageLayout
    },
    selectListeners: [
      { element: kanjiCollectionSelect, handler: setKanjiCollectionFilter },
      { element: kanjiGradeSelect, handler: setKanjiGrade }
    ]
  });
  attachKanjiListStatusIconListeners({
    list: kanjiList,
    render: () => renderStudyViewWithStats(renderKanjiPageLayout)
  });
  attachValueButtonListeners(kanjiGradeButtons, (button) => button.dataset.kanjiGradeOption, setKanjiGrade);
}
