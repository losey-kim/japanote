/* Japanote — grammar study/practice (split from app.js, phase 3) */

let grammarContent = {};
let grammarItems = [];
let grammarPracticeEntriesByLevel = {};

function resolveGrammarPracticeSetGrammarId(set) {
  const explicitId = normalizeQuizText(set?.grammarId);

  if (explicitId) {
    return explicitId;
  }

  const legacyMatch = normalizeQuizText(set?.id).match(/g(\d+)$/i);
  return legacyMatch ? `g${legacyMatch[1]}` : "";
}

function normalizeGrammarPracticeSet(set, item = null) {
  const normalizedSet = set && typeof set === "object" ? set : {};
  const grammarId = resolveGrammarPracticeSetGrammarId({ ...normalizedSet, grammarId: normalizedSet.grammarId || item?.id });
  const sentence = normalizeQuizText(normalizedSet.sentence);
  const options = Array.isArray(normalizedSet.options)
    ? normalizedSet.options.map((option) => normalizeQuizText(option)).filter(Boolean)
    : [];
  const answer = Number(normalizedSet.answer);

  if (!grammarId || !sentence || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return null;
  }

  return {
    id: normalizeQuizText(normalizedSet.id || grammarId),
    grammarId,
    source: normalizeQuizText(normalizedSet.source || `${formatStudyLevelLabel(item?.level, "N5")} 문법`),
    title: normalizeQuizText(normalizedSet.title || item?.pattern),
    note: normalizeQuizText(normalizedSet.note),
    tone: normalizeQuizText(normalizedSet.tone || "tone-gold"),
    sentence,
    options,
    answer,
    // 문법 퀴즈 풀이도 학습 목록과 같은 기준 설명을 보여줘야 흐름이 끊기지 않는다.
    explanation: normalizeQuizText(item?.description || normalizedSet.explanation)
  };
}

function getGrammarPracticeDistractorDescriptions(item, levelItems = [], fallbackItems = []) {
  const correctDescription = normalizeQuizText(item?.description);
  const candidateItems = [...(Array.isArray(levelItems) ? levelItems : []), ...(Array.isArray(fallbackItems) ? fallbackItems : [])];

  return Array.from(
    new Set(
      candidateItems
        .filter((candidate) => candidate && candidate.id !== item?.id)
        .map((candidate) => normalizeQuizText(candidate?.description))
        .filter((description) => description && description !== correctDescription)
    )
  );
}

function createGrammarPracticeSetFromItem(item, levelItems = [], index = 0, fallbackItems = []) {
  const pattern = normalizeQuizText(item?.pattern);
  const description = normalizeQuizText(item?.description);
  const grammarId = normalizeQuizText(item?.id);

  if (!pattern || !description || !grammarId) {
    return null;
  }

  // 문법 퀴즈는 별도 practice 데이터가 아니라 학습 목록의 pattern/description 조합을 그대로 쓴다.
  const distractorDescriptions = shuffleQuizArray(
    getGrammarPracticeDistractorDescriptions(item, levelItems, fallbackItems)
  ).slice(0, 3);
  const options = shuffleQuizArray([description, ...distractorDescriptions]);
  const tones = ["tone-gold", "tone-coral", "tone-sky", "tone-mint"];

  return normalizeGrammarPracticeSet(
    {
      id: grammarId,
      grammarId,
      source: `${formatStudyLevelLabel(item?.level, "N5")} 문법`,
      title: pattern,
      note: "문법 뜻 고르기",
      tone: tones[index % tones.length],
      sentence: pattern,
      options,
      answer: options.indexOf(description),
      explanation: description
    },
    item
  );
}

function getGrammarPracticeEntriesByLevelFromItems(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const itemsByLevel = safeItems.reduce((grouped, item) => {
    const level = normalizeStudyLevelValue(item?.level);

    if (!contentLevels.includes(level)) {
      return grouped;
    }

    grouped[level].push(item);
    return grouped;
  }, getLevelContentSets({}));

  return contentLevels.reduce((setsByLevel, level) => {
    const levelItems = itemsByLevel[level] || [];

    setsByLevel[level] = levelItems
      .map((item, index) => createGrammarPracticeSetFromItem(item, levelItems, index, safeItems))
      .filter(Boolean);

    return setsByLevel;
  }, getLevelContentSets({}));
}

function normalizeGrammarContent(payload) {
  const normalized = payload || {};
  const items = Array.isArray(normalized.items) ? normalized.items : [];

  // 문법 설명과 퀴즈를 같은 JSON 항목에서만 읽어오도록 고정한다.
  return {
    items,
    practiceEntriesByLevel: getGrammarPracticeEntriesByLevelFromItems(items)
  };
}
function refreshGrammarContentState(payload) {
  const normalized = normalizeGrammarContent(payload || {});
  grammarContent = normalized;
  grammarItems = normalized.items;
  grammarPracticeEntriesByLevel = getLevelContentSets(normalized.practiceEntriesByLevel);
  grammarPracticeEntriesByLevel[allLevelValue] = getAllPracticeSets(grammarPracticeEntriesByLevel);
  globalThis.JAPANOTE_GRAMMAR_ITEMS = [...grammarItems];
}
function loadGrammarDataFromJson() {
  return fetchJsonData("grammar.json", "grammar.json")
    .then((payload) => {
      refreshGrammarContentState(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load grammar.json. Using empty grammar data.", error);
      refreshGrammarContentState(grammarContent);
      return null;
    });
}
const grammarPageSize = 20;
const grammarPracticeResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const grammarPracticeCountOptions = [5, 10, 15, 20];
const grammarPracticeDurationOptions = [15, 25, 35, 0];
const grammarFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "미분류"
};
function getGrammarPracticeCount(value = state?.grammarPracticeCount) {
  const numericValue = Number(value);
  return grammarPracticeCountOptions.includes(numericValue) ? numericValue : 10;
}
function getGrammarPracticeLevel(level = state?.grammarPracticeLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getGrammarPracticeDuration(value = state?.grammarPracticeDuration) {
  const numericValue = Number(value);
  return grammarPracticeDurationOptions.includes(numericValue) ? numericValue : 25;
}
function getGrammarTab(value) {
  return ["list", "practice", "match"].includes(value) ? value : "list";
}

function getGrammarLevel(level = state?.grammarLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, allLevelValue);
  return selectableStudyLevels.includes(normalizedLevel) ? normalizedLevel : allLevelValue;
}

function getGrammarLevelLabel(level = state?.grammarLevel) {
  return formatStudyLevelLabel(getGrammarLevel(level), "N5");
}

function getGrammarFilter(value = state?.grammarFilter) {
  const normalizedValue = normalizeQuizText(value);
  if (normalizedValue === "saved") {
    return "review";
  }
  return Object.prototype.hasOwnProperty.call(grammarFilterLabels, normalizedValue) ? normalizedValue : "all";
}

function getGrammarFilterSummaryLabel(filter = state?.grammarFilter) {
  return grammarFilterLabels[getGrammarFilter(filter)] || grammarFilterLabels.all;
}

function getGrammarView(view = state?.grammarView) {
  return view === "list" ? "list" : "card";
}

function getGrammarViewLabel(view = state?.grammarView) {
  return getGrammarView(view) === "list" ? "목록" : "카드";
}

let activeGrammarPracticeQuestions = [];
const grammarPracticeState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};
function saveGrammarToReviewList(id) {
  setStudyListStatus("grammar", id, "review");
}

function removeGrammarFromReviewList(id) {
  removeFromStudyReviewList("grammar", id);
}

function saveGrammarToMasteredList(id) {
  setStudyListStatus("grammar", id, "mastered");
}

function removeGrammarFromMasteredList(id) {
  removeFromStudyMasteredList("grammar", id);
}

function isGrammarSavedToReviewList(id) {
  return isSavedToReviewList("grammar", id);
}

function isGrammarSavedToMasteredList(id) {
  return isSavedToMasteredList("grammar", id);
}

function getGrammarListStatus(id) {
  return getStudyListStatus("grammar", id);
}

function setGrammarListStatus(id, status) {
  setStudyListStatus("grammar", id, status);
}

function createGrammarListStatusIconsMarkup(id) {
  return createStudyListStatusCycleButtonMarkup(id, "grammar");
}

function getGrammarLevelItems(level = state?.grammarLevel) {
  const activeLevel = getGrammarLevel(level);
  return activeLevel === allLevelValue ? [...grammarItems] : grammarItems.filter((item) => item.level === activeLevel);
}

function getGrammarCollectionItems(filter = state?.grammarFilter, level = state?.grammarLevel) {
  const items = getGrammarLevelItems(level);
  const activeFilter = getGrammarFilter(filter);

  if (activeFilter === "review") {
    return items.filter((item) => isGrammarSavedToReviewList(item.id));
  }

  if (activeFilter === "mastered") {
    return items.filter((item) => isGrammarSavedToMasteredList(item.id));
  }

  if (activeFilter === "unmarked") {
    return items.filter((item) => !isGrammarSavedToReviewList(item.id) && !isGrammarSavedToMasteredList(item.id));
  }

  return items;
}

function getVisibleGrammarItems(level = state?.grammarLevel, filter = state?.grammarFilter) {
  return getGrammarCollectionItems(filter, level);
}

function getGrammarCollectionCounts(items = getGrammarLevelItems()) {
  return {
    all: items.length,
    review: items.filter((item) => isGrammarSavedToReviewList(item.id)).length,
    mastered: items.filter((item) => isGrammarSavedToMasteredList(item.id)).length,
    unmarked: items.filter((item) => !isGrammarSavedToReviewList(item.id) && !isGrammarSavedToMasteredList(item.id)).length
  };
}

function getGrammarPracticeEntriesByLevel(level = state?.grammarPracticeLevel) {
  const activeLevel = getGrammarPracticeLevel(level);
  return grammarPracticeEntriesByLevel[activeLevel] || [];
}

function getGrammarPracticeSetGrammarId(set) {
  return resolveGrammarPracticeSetGrammarId(set);
}

function getGrammarPracticeSetLevel(set, fallbackLevel = state?.grammarPracticeLevel) {
  const grammarId = getGrammarPracticeSetGrammarId(set);
  const matchedItem = grammarItems.find((item) => item.id === grammarId);

  if (matchedItem?.level) {
    return matchedItem.level;
  }

  const activeLevel = getGrammarPracticeLevel(fallbackLevel);
  return activeLevel === allLevelValue ? "전체" : activeLevel;
}

function getGrammarPracticeQuestionLimit(
  level = state?.grammarPracticeLevel,
  filter = state?.grammarFilter,
  count = state?.grammarPracticeCount
) {
  const availableCount = getVisibleGrammarPracticeSets(level, filter).length;

  if (!availableCount) {
    return 0;
  }

  // 필터 결과가 적을 때 같은 문제를 반복하지 않도록 실제 문제 수를 상한으로 맞춘다.
  return Math.min(getGrammarPracticeCount(count), availableCount);
}

function getVisibleGrammarPracticeSets(level = state?.grammarPracticeLevel, filter = state?.grammarFilter) {
  const sets = getGrammarPracticeEntriesByLevel(level);
  const activeFilter = getGrammarFilter(filter);

  if (activeFilter === "all") {
    return sets;
  }

  return sets.filter((set) => {
    const grammarId = getGrammarPracticeSetGrammarId(set);

    if (activeFilter === "review") {
      return isGrammarSavedToReviewList(grammarId);
    }

    if (activeFilter === "mastered") {
      return isGrammarSavedToMasteredList(grammarId);
    }

    return !isGrammarSavedToReviewList(grammarId) && !isGrammarSavedToMasteredList(grammarId);
  });
}

function getGrammarPracticeCollectionCounts(level = state?.grammarPracticeLevel) {
  const sets = getGrammarPracticeEntriesByLevel(level);

  return {
    all: sets.length,
    review: sets.filter((set) => isGrammarSavedToReviewList(getGrammarPracticeSetGrammarId(set))).length,
    mastered: sets.filter((set) => isGrammarSavedToMasteredList(getGrammarPracticeSetGrammarId(set))).length,
    unmarked: sets.filter((set) => {
      const grammarId = getGrammarPracticeSetGrammarId(set);
      return !isGrammarSavedToReviewList(grammarId) && !isGrammarSavedToMasteredList(grammarId);
    }).length
  };
}

function getGrammarPracticeResultFilter(value = grammarPracticeState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(grammarPracticeResultFilterLabels, value) ? value : "all";
}

function getGrammarPracticeResultCounts() {
  return getStudyResultCounts(grammarPracticeState.results);
}

function getFilteredGrammarPracticeResults(filter = getGrammarPracticeResultFilter(grammarPracticeState.resultFilter)) {
  return getFilteredStudyResults(grammarPracticeState.results, getGrammarPracticeResultFilter(filter));
}

function setGrammarPracticeResult(current, selectedIndex, correct, timedOut = false) {
  if (!current) {
    return;
  }

  const grammarId = getGrammarPracticeSetGrammarId(current);
  const answerText = current.options[current.answer] || "";
  const selected = timedOut ? "" : current.options[selectedIndex] || "";
  const result = {
    id: grammarId,
    source: getGrammarPracticeSetLevel(current),
    title: current.title || current.sentence || "",
    sentence: current.sentence || "",
    selected,
    answerText,
    explanation: current.explanation || "",
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const currentResultIndex = grammarPracticeState.results.findIndex((item) => item.id === grammarId);

  if (currentResultIndex >= 0) {
    grammarPracticeState.results[currentResultIndex] = result;
    return;
  }

  grammarPracticeState.results.push(result);
}

function getGrammarPracticeResultDetail(item) {
  const h = globalThis.japanoteStudyViewHelpers;
  const listFmt =
    h && typeof h.formatQuizSemicolonsToCommaList === "function"
      ? (v) => h.formatQuizSemicolonsToCommaList(v)
      : (v) => String(v || "").replace(/\s*;\s*/g, ", ").trim();

  if (item.explanation) {
    return listFmt(item.explanation);
  }

  if (item.sentence && item.sentence !== item.title) {
    return listFmt(item.sentence);
  }

  return "";
}

function renderGrammarPracticeBulkActionButtons(results) {
  const reviewActionButton = document.getElementById("grammar-practice-result-bulk-action");
  const reviewActionLabel = document.getElementById("grammar-practice-result-bulk-label");
  const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
  const masteredActionButton = document.getElementById("grammar-practice-result-mastered-action");
  const masteredActionLabel = document.getElementById("grammar-practice-result-mastered-label");
  const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: reviewActionButton,
    label: reviewActionLabel,
    icon: reviewActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isGrammarSavedToReviewList,
    datasetKey: "grammarPracticeBulkAction",
    removeActionValue: "remove-review",
    saveLabel: getJapanoteButtonLabel("reviewSave"),
    removeLabel: getJapanoteButtonLabel("reviewRemove"),
    saveLabelShort: getJapanoteButtonLabel("reviewSaveShort"),
    removeLabelShort: getJapanoteButtonLabel("reviewRemoveShort"),
    emptyTitle: "지금 표시 중인 문법이 없어요.",
    saveTitle: "지금 보이는 문법을 모두 다시 볼 항목으로 표시해요.",
    removeTitle: "지금 보이는 문법의 다시 보기 표시를 모두 해제해요."
  });
  renderResultBulkActionButton({
    button: masteredActionButton,
    label: masteredActionLabel,
    icon: masteredActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isGrammarSavedToMasteredList,
    datasetKey: "grammarPracticeMasteredBulkAction",
    saveActionValue: "save-mastered",
    removeActionValue: "remove-mastered",
    saveLabel: getJapanoteButtonLabel("masteredSave"),
    removeLabel: getJapanoteButtonLabel("masteredRemove"),
    saveLabelShort: getJapanoteButtonLabel("masteredSaveShort"),
    removeLabelShort: getJapanoteButtonLabel("masteredRemoveShort"),
    emptyTitle: "지금 표시 중인 문법이 없어요.",
    saveTitle: "지금 보이는 문법을 모두 익힘으로 표시해요.",
    removeTitle: "지금 보이는 문법의 익힘 표시를 모두 해제해요.",
    saveIcon: "check_circle",
    removeIcon: "remove_done"
  });
}

function getGrammarEmptyMessage(filter = state?.grammarFilter, level = state?.grammarLevel) {
  const activeFilter = getGrammarFilter(filter);

  if (activeFilter === "review") {
    return "다시 볼 문법이 아직 없어요. 표시해두면 여기서 다시 볼 수 있어요.";
  }

  if (activeFilter === "mastered") {
    return "익힌 문법이 아직 없어요. 익혔어요를 눌러두면 여기 모여요.";
  }

  if (activeFilter === "unmarked") {
    return "아직 상태를 정하지 않은 문법은 지금 없어요. 다른 레벨도 같이 볼까요?";
  }

  return STUDY_NO_CONTENT_LEVEL_HINT;
}

function getGrammarSummaryText(count, level = state?.grammarLevel, filter = state?.grammarFilter) {
  const activeLevel = getGrammarLevel(level);
  const levelLabel = activeLevel === allLevelValue ? "전체" : activeLevel;

  if (getGrammarFilter(filter) === "all") {
    return `${levelLabel} 문법 ${count}개를 보고 있어요`;
  }

  return `${levelLabel} ${getGrammarFilterSummaryLabel(filter)} 문법 ${count}개를 보고 있어요`;
}

function getVisibleGrammarCards() {
  return getOrderedStudyCards("grammar", getVisibleGrammarItems());
}

function getGrammarPageCount(items) {
  return getStudyPageCount(items, grammarPageSize);
}

function resetGrammarStudyPointers() {
  resetStudyCatalogPointers({
    pageKey: "grammarPage",
    indexKey: "grammarFlashcardIndex",
    revealedKey: "grammarFlashcardRevealed"
  });
}

function syncGrammarFlashcardIndexAfterUpdate(currentCardId, previousIndex) {
  syncStudyFlashcardIndexAfterUpdate({
    currentCardId,
    previousIndex,
    getCards: getVisibleGrammarCards,
    indexKey: "grammarFlashcardIndex"
  });
}

function setGrammarLevel(level) {
  updateStudyCatalogState({
    stateKey: "grammarLevel",
    nextValue: getGrammarLevel(level),
    resetPointers: resetGrammarStudyPointers,
    render: renderGrammarPage
  });
}

function setGrammarFilter(filter) {
  updateStudyCatalogState({
    stateKey: "grammarFilter",
    nextValue: getGrammarFilter(filter),
    resetPointers: resetGrammarStudyPointers,
    invalidate: invalidateGrammarPracticeSession,
    render: renderGrammarPage
  });
}

function setGrammarView(view) {
  updateStudyCatalogState({
    stateKey: "grammarView",
    nextValue: getGrammarView(view),
    render: renderGrammarPage
  });
}

function populateGrammarLevelSelect(select, activeLevel = getGrammarLevel()) {
  populateContentLevelSelect(select, activeLevel, { includeAll: true });
}

function populateGrammarFilterSelect(select, counts, activeFilter = getGrammarFilter()) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  Object.entries(grammarFilterLabels).forEach(([filter, label]) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${label} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getGrammarFilter(activeFilter);
}

function renderGrammarStudyControls() {
  const summary = document.getElementById("grammar-summary");
  const levelSelect = document.getElementById("grammar-level-select");
  const filterSelect = document.getElementById("grammar-filter-select");
  const counts = getGrammarCollectionCounts(getGrammarLevelItems());
  const visibleItems = getVisibleGrammarItems();

  renderStudyCatalogControls({
    summary,
    summaryText: getGrammarSummaryText(visibleItems.length),
    viewSelector: "[data-grammar-view]",
    viewAttribute: "data-grammar-view",
    activeView: getGrammarView(),
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateGrammarLevelSelect(element)
      },
      {
        element: filterSelect,
        populate: (element) => populateGrammarFilterSelect(element, counts)
      }
    ]
  });
}

function getGrammarFlashcardPlaceholder() {
  return {
    id: "grammar-empty",
    level: getGrammarLevelLabel(),
    pattern: getGrammarEmptyMessage(),
    description: ""
  };
}

function renderGrammarFlashcard() {
  const flashcard = document.getElementById("grammar-flashcard");
  const toggle = document.getElementById("grammar-flashcard-toggle");
  const prev = document.getElementById("grammar-flashcard-prev");
  const next = document.getElementById("grammar-flashcard-next");
  const reviewButton = document.getElementById("grammar-flashcard-review");
  const masteredButton = document.getElementById("grammar-flashcard-mastered");
  const level = document.getElementById("grammar-flashcard-level");
  const word = document.getElementById("grammar-flashcard-word");
  const reading = document.getElementById("grammar-flashcard-reading");
  const meaning = document.getElementById("grammar-flashcard-meaning");
  const hint = document.getElementById("grammar-flashcard-hint");
  const cards = getVisibleGrammarCards();

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
  const currentIndex = hasCards ? state.grammarFlashcardIndex % cards.length : 0;
  const currentCard = hasCards ? cards[currentIndex] : getGrammarFlashcardPlaceholder();
  const review = hasCards && isGrammarSavedToReviewList(currentCard.id);
  const mastered = hasCards && isGrammarSavedToMasteredList(currentCard.id);
  const isRevealed = hasCards && state.grammarFlashcardRevealed;
  const hintText = hasCards
    ? isRevealed
      ? review
        ? "다시 볼래요에 담긴 문법이에요"
        : mastered
          ? "익혔어요에 담긴 문법이에요"
          : "이 문법도 바로 저장 상태를 바꿀 수 있어요"
      : "눌러서 설명을 확인해봐요"
    : "다른 레벨이나 모아보기로 바꿔봐요";

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
    levelText: currentCard.level || getGrammarLevelLabel(),
    wordText: currentCard.pattern || "",
    meaningText: currentCard.description || "",
    hintText,
    hideReading: true,
    toggleOpenLabel: "설명을 다시 접을까요?",
    toggleClosedLabel: "설명을 확인해볼까요?",
    toggleEmptyLabel: "다른 레벨이나 모아보기로 바꿔봐요",
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

function renderGrammarList() {
  const list = document.getElementById("grammar-list");
  const pageInfo = document.getElementById("grammar-page-info");
  const prev = document.getElementById("grammar-page-prev");
  const next = document.getElementById("grammar-page-next");
  const items = getVisibleGrammarItems();

  renderStatefulStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    pageKey: "grammarPage",
    pageSize: grammarPageSize,
    emptyMessage: getGrammarEmptyMessage(),
    renderItem: (item, displayIndex) => createStudyListCardMarkup({
      index: displayIndex,
      headMetaMarkup: `<span class="vocab-list-index">${formatStudyLevelLabel(item.level, "N5")}</span>`,
      headRightMarkup: createGrammarListStatusIconsMarkup(item.id),
      mainClassName: "vocab-list-main grammar-list-main",
      titleClassName: "vocab-list-word grammar-list-pattern",
      titleText: formatQuizLineBreaks(item.pattern),
      subtitleClassName: "vocab-list-reading grammar-list-description",
      subtitleText: formatQuizLineBreaks(item.description),
      descriptionMarkup: "",
      actionsMarkup: ""
    })
  });
}

function toggleGrammarFlashcardReveal() {
  toggleStudyFlashcardReveal("grammarFlashcardRevealed", () => {
    renderStudyViewWithStats(renderGrammarPage);
  });
}

function moveGrammarFlashcard(step) {
  moveStudyFlashcard(step, {
    getCards: getVisibleGrammarCards,
    indexKey: "grammarFlashcardIndex",
    revealedKey: "grammarFlashcardRevealed",
    render: renderGrammarPage
  });
}

function markGrammarFlashcardForReview() {
  markStudyFlashcardStatus({
    getCards: getVisibleGrammarCards,
    indexKey: "grammarFlashcardIndex",
    revealedKey: "grammarFlashcardRevealed",
    saveItem: saveGrammarToReviewList,
    syncIndexAfterUpdate: syncGrammarFlashcardIndexAfterUpdate,
    render: () => renderStudyViewWithStats(renderGrammarPage)
  });
}

function markGrammarFlashcardMastered() {
  markStudyFlashcardStatus({
    getCards: getVisibleGrammarCards,
    indexKey: "grammarFlashcardIndex",
    revealedKey: "grammarFlashcardRevealed",
    saveItem: saveGrammarToMasteredList,
    syncIndexAfterUpdate: syncGrammarFlashcardIndexAfterUpdate,
    render: () => renderStudyViewWithStats(renderGrammarPage)
  });
}

function renderGrammarPage() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const activeTab = getGrammarTab(state.grammarTab);
  const cardView = document.getElementById("grammar-card-view");
  const listView = document.getElementById("grammar-list-view");

  renderGrammarStudyControls();

  document.querySelectorAll("[data-grammar-tab]").forEach((button) => {
    const isActive = button.dataset.grammarTab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-grammar-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.grammarTabPanel === activeTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (activeTab === "practice") {
    renderGrammarPractice();
    return;
  }

  stopQuizSessionTimer("grammar");
  renderQuizSessionHud("grammar");

  if (activeTab === "match") {
    return;
  }

  renderStudyCatalogSection({
    cardView,
    listView,
    activeView: getGrammarView(),
    renderFlashcard: renderGrammarFlashcard,
    renderList: renderGrammarList
  });
}

function renderGrammarPageLayout() {
  renderGrammarPage();
}

function renderGrammar() {
  renderGrammarPage();
}

function getGrammarPracticeOptionsSummaryText() {
  return [
    getLevelSummaryLabel(getGrammarPracticeLevel()),
    getGrammarFilterSummaryLabel(),
    formatQuestionCountLabel(getGrammarPracticeQuestionLimit()),
    getDurationLabel(getGrammarPracticeDuration())
  ].join(" · ");
}

function setGrammarPracticeLevel(level) {
  const nextLevel = getGrammarPracticeLevel(level);

  if (state.grammarPracticeLevel === nextLevel) {
    return;
  }

  state.grammarPracticeLevel = nextLevel;
  invalidateGrammarPracticeSession();
  saveState();
  renderGrammarPractice();
}

function setGrammarPracticeDuration(duration) {
  const nextDuration = getGrammarPracticeDuration(duration);

  if (state.grammarPracticeDuration === nextDuration) {
    return;
  }

  state.grammarPracticeDuration = nextDuration;
  saveState();
  renderGrammarPractice();
}

function resetGrammarPracticeSessionState(resetIndex = false) {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("grammar-practice-result-view");
  activeGrammarPracticeQuestions = [];
  grammarPracticeState.results = [];
  grammarPracticeState.showResults = false;
  grammarPracticeState.resultFilter = "all";
  state.grammarPracticeStarted = false;
  state.grammarPracticeSessionQuestionIndex = 0;
  resetQuizSessionScore("grammar");
  setQuizSessionDuration("grammar", getGrammarPracticeDuration());
  stopQuizSessionTimer("grammar");

  if (resetIndex) {
    const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
    state.grammarPracticeIndexes[activeLevel] = 0;
  }
}

function invalidateGrammarPracticeSession() {
  resetGrammarPracticeSessionState();
}

function renderGrammarPracticeControls() {
  const optionsShell = document.getElementById("grammar-practice-options-shell");
  const optionsToggle = document.getElementById("grammar-practice-options-toggle");
  const optionsPanel = document.getElementById("grammar-practice-options-panel");
  const optionsSummary = document.getElementById("grammar-practice-options-summary");
  const levelSelect = document.getElementById("grammar-practice-level-select");
  const filterSelect = document.getElementById("grammar-practice-filter-select");
  const countSpinner = document.querySelector('[data-spinner-id="grammar-practice-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="grammar-practice-time"]');
  const startButton = document.getElementById("grammar-practice-start");
  const startLabel = document.getElementById("grammar-practice-start-label");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const practiceCounts = getGrammarPracticeCollectionCounts(activeLevel);
  const activeCount = getGrammarPracticeCount(state.grammarPracticeCount);
  const activeDuration = getGrammarPracticeDuration(state.grammarPracticeDuration);
  const isOptionsOpen = state.grammarPracticeOptionsOpen === true;
  const canStart = getVisibleGrammarPracticeSets(activeLevel).length > 0;
  const isSettingsLocked = state.grammarPracticeStarted;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getGrammarPracticeOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: grammarPracticeCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: grammarPracticeDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateContentLevelSelect(element, activeLevel, { includeAll: true })
      },
      {
        element: filterSelect,
        populate: (element) => populateGrammarFilterSelect(element, practiceCounts),
        disabled: isSettingsLocked
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.grammarPracticeStarted || grammarPracticeState.showResults,
      canStart: state.grammarPracticeStarted || grammarPracticeState.showResults || canStart
    }
  });
}
function buildGrammarPracticeQuestionSet(
  level = state?.grammarPracticeLevel,
  filter = state?.grammarFilter,
  count = state?.grammarPracticeCount
) {
  const activeLevel = getGrammarPracticeLevel(level);
  const sets = getVisibleGrammarPracticeSets(activeLevel, filter);
  const questionCount = getGrammarPracticeQuestionLimit(activeLevel, filter, count);
  const startIndex = getPracticeLevelIndex(state.grammarPracticeIndexes, activeLevel);

  return buildFixedPracticeSessionItems(sets, questionCount, startIndex);
}

function startNewGrammarPracticeSession() {
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);

  resetGrammarPracticeSessionState();
  state.grammarPracticeLevel = activeLevel;
  activeGrammarPracticeQuestions = buildGrammarPracticeQuestionSet(
    activeLevel,
    state.grammarFilter,
    state.grammarPracticeCount
  );

  if (!activeGrammarPracticeQuestions.length) {
    state.grammarPracticeStarted = false;
    return false;
  }

  state.grammarPracticeStarted = true;
  return true;
}

function ensureGrammarPracticeSession(force = false) {
  if (!state.grammarPracticeStarted) {
    return false;
  }

  const currentSessionIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  if (
    force ||
    !activeGrammarPracticeQuestions.length ||
    currentSessionIndex < 0 ||
    currentSessionIndex >= activeGrammarPracticeQuestions.length
  ) {
    const started = startNewGrammarPracticeSession();
    saveState();
    return started;
  }

  return true;
}

function getCurrentGrammarPracticeSet() {
  const currentIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  return activeGrammarPracticeQuestions[currentIndex] || activeGrammarPracticeQuestions[0] || null;
}

function renderGrammarPracticeResults() {
  const counts = getGrammarPracticeResultCounts();
  const filteredResults = getFilteredGrammarPracticeResults();

  renderSharedStudyResults({
    resultViewId: "grammar-practice-result-view",
    totalId: "grammar-practice-result-total",
    correctId: "grammar-practice-result-correct",
    wrongId: "grammar-practice-result-wrong",
    emptyId: "grammar-practice-result-empty",
    listId: "grammar-practice-result-list",
    bulkActionButtonId: "grammar-practice-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getGrammarPracticeResultFilter(grammarPracticeState.resultFilter),
    filterLabels: grammarPracticeResultFilterLabels,
    renderBulkActionButton: renderGrammarPracticeBulkActionButtons,
    getEmptyText: ({ activeFilter }) => getStudyPracticeResultEmptyMessage(activeFilter),
    renderItems: (results, container) => {
      const h2 = globalThis.japanoteStudyViewHelpers;
      const listFmt =
        h2 && typeof h2.formatQuizSemicolonsToCommaList === "function"
          ? (v) => h2.formatQuizSemicolonsToCommaList(v)
          : (v) => String(v || "").replace(/\s*;\s*/g, ", ").trim();
      results.forEach((item) => {
        const reviewSelected = isGrammarSavedToReviewList(item.id);
        const masteredSelected = isGrammarSavedToMasteredList(item.id);

        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.source || "문법",
          titleText: listFmt(item.title || item.sentence || "-"),
          descriptionText: getGrammarPracticeResultDetail(item),
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? getJapanoteButtonLabel("reviewRemove") : getJapanoteButtonLabel("reviewSave"),
              datasetName: "grammarPracticeReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? getJapanoteButtonLabel("masteredRemove") : getJapanoteButtonLabel("masteredSave"),
              datasetName: "grammarPracticeMastered",
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

function renderGrammarPractice() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const empty = document.getElementById("grammar-practice-empty");
  const practiceView = document.getElementById("grammar-practice-view");
  const resultView = document.getElementById("grammar-practice-result-view");
  const grammarCard = document.querySelector(".grammar-practice-card");
  const optionsContainer = document.getElementById("grammar-practice-options");
  const nextButton = document.getElementById("grammar-practice-next");
  const progress = document.getElementById("grammar-practice-progress");
  const sentence = document.getElementById("grammar-practice-sentence");
  const feedback = document.getElementById("grammar-practice-feedback");
  const explanation = document.getElementById("grammar-practice-explanation");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const activeDuration = getGrammarPracticeDuration(state.grammarPracticeDuration);
  const sets = getVisibleGrammarPracticeSets(activeLevel);
  const activeCount = state.grammarPracticeStarted
    ? activeGrammarPracticeQuestions.length
    : getGrammarPracticeQuestionLimit(activeLevel, state.grammarFilter, state.grammarPracticeCount);
  const currentSessionIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  renderGrammarPracticeControls();

  if (
    !empty ||
    !practiceView ||
    !resultView ||
    !grammarCard ||
    !optionsContainer ||
    !nextButton ||
    !progress ||
    !sentence ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  if (grammarPracticeState.showResults) {
    stopQuizSessionTimer("grammar");
    renderQuizSessionHud("grammar");
    empty.hidden = true;
    practiceView.hidden = true;
    resultView.hidden = false;
    renderGrammarPracticeResults();
    return;
  }

  if (!state.grammarPracticeStarted) {
    stopQuizSessionTimer("grammar");
    resetQuizSessionScore("grammar");
    setQuizSessionDuration("grammar", activeDuration);
    empty.hidden = false;
    practiceView.hidden = true;
    resultView.hidden = true;
    empty.textContent = sets?.length ? STUDY_READY_TO_START_HINT : getGrammarEmptyMessage(getGrammarFilter(), activeLevel);
    renderQuizSessionHud("grammar");
    return;
  }

  if (!ensureGrammarPracticeSession()) {
    stopQuizSessionTimer("grammar");
    setQuizSessionDuration("grammar", activeDuration);
    empty.hidden = false;
    practiceView.hidden = true;
    resultView.hidden = true;
    empty.textContent = getGrammarEmptyMessage(getGrammarFilter(), activeLevel);
    renderQuizSessionHud("grammar");
    return;
  }

  const current = getCurrentGrammarPracticeSet();
  const questionCount = activeGrammarPracticeQuestions.length;

  if (currentSessionIndex >= activeCount) {
    grammarPracticeState.showResults = true;
    state.grammarPracticeStarted = false;
    state.grammarPracticeSessionQuestionIndex = 0;
    saveState();
    renderGrammarPractice();
    return;
  }

  if (!current || !questionCount) {
    stopQuizSessionTimer("grammar");
    setQuizSessionDuration("grammar", activeDuration);
    empty.hidden = false;
    practiceView.hidden = true;
    resultView.hidden = true;
    empty.textContent = sets?.length ? STUDY_READY_TO_START_HINT : getGrammarEmptyMessage(getGrammarFilter(), activeLevel);
    renderQuizSessionHud("grammar");
    return;
  }

  empty.hidden = true;
  practiceView.hidden = false;
  resultView.hidden = true;

  progress.textContent =
    `${currentSessionIndex + 1} / ${questionCount}`;
  sentence.textContent = current.sentence;
  applyDisplayTextSize(sentence);
  feedback.textContent = "";
  explanation.textContent = "";
  nextButton.textContent = currentSessionIndex >= questionCount - 1 ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
  nextButton.disabled = true;
  delete optionsContainer.dataset.answered;

  grammarCard.className = `grammar-practice-card ${current.tone}`;

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "grammar-practice-option",
    formatText: softenVisibleKoreanCopy,
    onSelect: handleGrammarPracticeAnswer
  });

  setQuizSessionDuration("grammar", activeDuration);
  resetQuizSessionTimer("grammar", handleGrammarPracticeTimeout);
}

function handleGrammarPracticeAnswer(index) {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("grammar-practice-next");
  const activeCount = activeGrammarPracticeQuestions.length;
  const isLastQuestion = state.grammarPracticeSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered || quizSessions.grammar.isPaused) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("grammar", correct);
  setGrammarPracticeResult(current, index, correct, false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    markSelected: false
  });

  document.getElementById("grammar-practice-feedback").textContent = correct
    ? ""
    : "";
  document.getElementById("grammar-practice-explanation").textContent = "";
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
    nextButton.disabled = false;
  }
  const optionsContainer = document.getElementById("grammar-practice-options");

  if (optionsContainer) {
    optionsContainer.dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleGrammarPracticeTimeout() {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("grammar-practice-next");
  const activeCount = activeGrammarPracticeQuestions.length;
  const isLastQuestion = state.grammarPracticeSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("grammar", false);
  setGrammarPracticeResult(current, -1, false, true);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    markSelected: false
  });

  document.getElementById("grammar-practice-feedback").textContent = "";
  document.getElementById("grammar-practice-explanation").textContent = "";
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");
    nextButton.disabled = false;
  }
  if (document.getElementById("grammar-practice-options")) {
    document.getElementById("grammar-practice-options").dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextGrammarPracticeSet() {
  const nextButton = document.getElementById("grammar-practice-next");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const sets = getVisibleGrammarPracticeSets(activeLevel);
  const questionLimit = activeGrammarPracticeQuestions.length;
  const currentSessionIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  if (!sets.length || !nextButton || nextButton.disabled) {
    return;
  }

  if (currentSessionIndex >= questionLimit - 1) {
    grammarPracticeState.showResults = true;
    state.grammarPracticeStarted = false;
    state.grammarPracticeSessionQuestionIndex = 0;
    saveState();
    renderGrammarPractice();
    return;
  }

  state.grammarPracticeLevel = activeLevel;
  state.grammarPracticeSessionQuestionIndex = currentSessionIndex + 1;
  state.grammarPracticeIndexes[activeLevel] =
    (state.grammarPracticeIndexes[activeLevel] + 1) % sets.length;
  saveState();
  renderGrammarPractice();
}

function restartGrammarPractice() {
  if (state.grammarPracticeStarted) {
    invalidateGrammarPracticeSession();
    saveState();
    renderGrammarPractice();
    return;
  }

  startNewGrammarPracticeSession();
  saveState();
  renderGrammarPractice();
}
function attachGrammarListStatusIconListeners({ list, render }) {
  return attachStudyListStatusIconListeners({ list, kind: "grammar", render });
}
function attachGrammarStudyListeners({
  grammarViewButtons,
  grammarLevelSelect,
  grammarFilterSelect,
  grammarPagePrev,
  grammarPageNext,
  grammarFlashcardToggle,
  grammarFlashcardPrev,
  grammarFlashcardNext,
  grammarFlashcardReview,
  grammarFlashcardMastered,
  grammarList
}) {
  attachStudyCatalogListeners({
    viewButtons: grammarViewButtons,
    getViewValue: (button) => button.dataset.grammarView,
    setView: setGrammarView,
    flashcardListeners: {
      toggle: grammarFlashcardToggle,
      prev: grammarFlashcardPrev,
      next: grammarFlashcardNext,
      review: grammarFlashcardReview,
      mastered: grammarFlashcardMastered,
      onToggle: toggleGrammarFlashcardReveal,
      onMove: moveGrammarFlashcard,
      onReview: markGrammarFlashcardForReview,
      onMastered: markGrammarFlashcardMastered
    },
    paginationListeners: {
      prev: grammarPagePrev,
      next: grammarPageNext,
      getPage: () => state.grammarPage,
      setPage: (page) => {
        state.grammarPage = page;
      },
      getPageCount: () => getGrammarPageCount(getVisibleGrammarItems()),
      render: renderGrammarPage
    },
    selectListeners: [
      { element: grammarLevelSelect, handler: setGrammarLevel },
      { element: grammarFilterSelect, handler: setGrammarFilter }
    ]
  });
  attachGrammarListStatusIconListeners({
    list: grammarList,
    render: () => renderStudyViewWithStats(renderGrammarPage)
  });
}
