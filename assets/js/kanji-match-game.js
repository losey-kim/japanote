const kanjiMatchStorageKey = "japanote-kanji-match-state";
const kanjiStudyStateStorageKey = "jlpt-compass-state";
const sharedMatchGame = globalThis.japanoteSharedMatchGame;

const kanjiMatchGradeOptions = ["all", "1", "2", "3", "4", "5", "6"];
const kanjiMatchDurationOptions = [10, 15, 20, 0];
const kanjiMatchTotalCountOptions = [5, 10, 15, 20];
const kanjiMatchFilterOptions = ["all", "review", "mastered", "unmarked"];
const kanjiMatchResultFilterOptions = ["all", "correct", "wrong"];
const kanjiMatchPageSize = 5;
const kanjiMatchWrongFlashDuration = 520;
const kanjiMatchPageTransitionDelay = 720;

const defaultKanjiMatchPreferences = {
  grade: "all",
  filter: "all",
  totalCount: 5,
  duration: 15,
  optionsOpen: false
};

const kanjiMatchResultFilterLabels = {
  all: "?꾩껜",
  correct: "?뺣떟",
  wrong: "?ㅻ떟"
};

const kanjiMatchFilterLabels = {
  all: "?꾩껜",
  review: "?ㅼ떆 蹂쇰옒??,
  mastered: "?듯삍?댁슂",
  unmarked: "?꾩쭅 ???뺥뻽?댁슂"
};

function normalizeKanjiMatchText(value) {
  const text = String(value ?? "").trim();

  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      return decodeURIComponent(text).replace(/\s+/g, " ").trim();
    } catch (error) {
      return text.replace(/\s+/g, " ").trim();
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

function loadKanjiMatchPreferences() {
  return sharedMatchGame.loadStoredObject(kanjiMatchStorageKey, defaultKanjiMatchPreferences);
}

const kanjiMatchPreferences = loadKanjiMatchPreferences();

function saveKanjiMatchPreferences() {
  sharedMatchGame.saveStoredObject(kanjiMatchStorageKey, kanjiMatchPreferences);
}

function loadKanjiSharedStudyState() {
  return sharedMatchGame.loadStoredObject(kanjiStudyStateStorageKey);
}

function saveKanjiSharedStudyState(studyState) {
  sharedMatchGame.saveStoredObject(kanjiStudyStateStorageKey, studyState);
}

function syncKanjiStudyStateToApp() {
  if (typeof applyExternalStudyState === "function") {
    applyExternalStudyState(loadKanjiSharedStudyState());
    return;
  }

  sharedMatchGame.dispatchStorageUpdated(kanjiStudyStateStorageKey, loadKanjiSharedStudyState(), "local");
}

function saveKanjiToMemorizationList(id) {
  if (!id) {
    return;
  }

  const studyState = loadKanjiSharedStudyState();
  const reviewIds = Array.isArray(studyState.kanjiReviewIds) ? studyState.kanjiReviewIds : [];
  const masteredIds = Array.isArray(studyState.kanjiMasteredIds) ? studyState.kanjiMasteredIds : [];

  studyState.kanjiReviewIds = Array.from(new Set([...reviewIds, id]));
  studyState.kanjiMasteredIds = masteredIds.filter((itemId) => itemId !== id);
  saveKanjiSharedStudyState(studyState);
  syncKanjiStudyStateToApp();
}

function removeKanjiFromMemorizationList(id) {
  if (!id) {
    return;
  }

  const studyState = loadKanjiSharedStudyState();
  const reviewIds = Array.isArray(studyState.kanjiReviewIds) ? studyState.kanjiReviewIds : [];

  studyState.kanjiReviewIds = reviewIds.filter((itemId) => itemId !== id);
  saveKanjiSharedStudyState(studyState);
  syncKanjiStudyStateToApp();
}

function isKanjiSavedToMemorizationList(id) {
  if (!id) {
    return false;
  }

  const studyState = loadKanjiSharedStudyState();
  return Array.isArray(studyState.kanjiReviewIds) && studyState.kanjiReviewIds.includes(id);
}

function getKanjiMatchStudyBuckets() {
  const studyState = loadKanjiSharedStudyState();
  return {
    reviewIds: Array.isArray(studyState.kanjiReviewIds) ? studyState.kanjiReviewIds : [],
    masteredIds: Array.isArray(studyState.kanjiMasteredIds) ? studyState.kanjiMasteredIds : []
  };
}

function getKanjiMatchGrade(value = kanjiMatchPreferences.grade) {
  const normalizedValue = normalizeKanjiMatchText(value);
  return kanjiMatchGradeOptions.includes(normalizedValue) ? normalizedValue : "all";
}

function getKanjiMatchGradeLabel(grade = kanjiMatchPreferences.grade) {
  const activeGrade = getKanjiMatchGrade(grade);
  return activeGrade === "all" ? "?꾩껜" : `${activeGrade}?숇뀈`;
}

function getKanjiMatchFilter(value = kanjiMatchPreferences.filter) {
  return kanjiMatchFilterOptions.includes(value) ? value : "all";
}

function getKanjiMatchFilterLabel(filter = kanjiMatchPreferences.filter) {
  return kanjiMatchFilterLabels[getKanjiMatchFilter(filter)] || kanjiMatchFilterLabels.all;
}

function getKanjiMatchTotalCount(value = kanjiMatchPreferences.totalCount) {
  const numericValue = Number(value);
  return kanjiMatchTotalCountOptions.includes(numericValue) ? numericValue : 5;
}

function getKanjiMatchDuration(value = kanjiMatchPreferences.duration) {
  const numericValue = Number(value);
  return kanjiMatchDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getKanjiMatchDurationLabel(duration = kanjiMatchPreferences.duration) {
  const activeDuration = Number(duration);
  return activeDuration <= 0 ? "泥쒖쿇?? : `${activeDuration}珥?;
}

function getKanjiMatchResultFilter(value = kanjiMatchState.resultFilter) {
  return kanjiMatchResultFilterOptions.includes(value) ? value : "all";
}

function getKanjiMatchOptionsSummaryText() {
  return [
    getKanjiMatchFilterLabel(),
    getKanjiMatchGradeLabel(),
    `${getKanjiMatchTotalCount()}臾몄젣`,
    getKanjiMatchDurationLabel()
  ].join(" 쨌 ");
}

function getBaseKanjiMatchPool() {
  const rows = Array.isArray(globalThis.JAPANOTE_KANJI_DATA) ? globalThis.JAPANOTE_KANJI_DATA : [];

  return rows
    .map((row, index) => {
      const [char, grade, reading] = Array.isArray(row) ? row : [];
      const normalizedChar = normalizeKanjiMatchText(char);
      const normalizedGrade = normalizeKanjiMatchText(grade);
      const normalizedReading = normalizeKanjiMatchText(reading);

      if (!normalizedChar || !normalizedReading || !kanjiMatchGradeOptions.includes(normalizedGrade)) {
        return null;
      }

      return {
        id: `kanji-${normalizedGrade}-${index + 1}-${normalizedChar}`,
        grade: normalizedGrade,
        gradeLabel: getKanjiMatchGradeLabel(normalizedGrade),
        char: normalizedChar,
        reading: normalizedReading
      };
    })
    .filter(Boolean);
}

function filterKanjiMatchPool(items, filter = kanjiMatchPreferences.filter, grade = kanjiMatchPreferences.grade) {
  if (!Array.isArray(items)) {
    return [];
  }

  const activeFilter = getKanjiMatchFilter(filter);
  const activeGrade = getKanjiMatchGrade(grade);
  const { reviewIds, masteredIds } = getKanjiMatchStudyBuckets();
  const filteredByGrade = activeGrade === "all" ? items : items.filter((item) => item.grade === activeGrade);

  if (activeFilter === "review") {
    return filteredByGrade.filter((item) => reviewIds.includes(item.id));
  }

  if (activeFilter === "mastered") {
    return filteredByGrade.filter((item) => masteredIds.includes(item.id));
  }

  if (activeFilter === "unmarked") {
    return filteredByGrade.filter((item) => !reviewIds.includes(item.id) && !masteredIds.includes(item.id));
  }

  return filteredByGrade;
}

function getKanjiMatchFilterCounts(items = getBaseKanjiMatchPool()) {
  const activeGrade = getKanjiMatchGrade(kanjiMatchPreferences.grade);
  return {
    all: filterKanjiMatchPool(items, "all", activeGrade).length,
    review: filterKanjiMatchPool(items, "review", activeGrade).length,
    mastered: filterKanjiMatchPool(items, "mastered", activeGrade).length,
    unmarked: filterKanjiMatchPool(items, "unmarked", activeGrade).length
  };
}

function getKanjiMatchGradeCounts(items = getBaseKanjiMatchPool()) {
  const counts = kanjiMatchGradeOptions.reduce((map, grade) => {
    map[grade] = 0;
    return map;
  }, {});
  const activeFilter = getKanjiMatchFilter(kanjiMatchPreferences.filter);
  const { reviewIds, masteredIds } = getKanjiMatchStudyBuckets();
  const filteredByCollection =
    activeFilter === "review"
      ? items.filter((item) => reviewIds.includes(item.id))
      : activeFilter === "mastered"
        ? items.filter((item) => masteredIds.includes(item.id))
        : items;

  counts.all = filteredByCollection.length;
  filteredByCollection.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(counts, item.grade)) {
      counts[item.grade] += 1;
    }
  });

  return counts;
}

function populateKanjiMatchGradeSelect(select, counts) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  kanjiMatchGradeOptions.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade === "all" ? `?꾩껜 (${counts[grade] ?? 0})` : `${grade}?숇뀈 (${counts[grade] ?? 0})`;
    select.appendChild(option);
  });
  select.value = getKanjiMatchGrade(kanjiMatchPreferences.grade);
}

function populateKanjiMatchFilterSelect(select, counts) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  kanjiMatchFilterOptions.forEach((filter) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${kanjiMatchFilterLabels[filter]} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });
  select.value = getKanjiMatchFilter(kanjiMatchPreferences.filter);
}

const kanjiMatchState = {
  sessionItems: [],
  pageItems: [],
  pageIndex: 0,
  results: [],
  leftCards: [],
  rightCards: [],
  selectedLeft: null,
  selectedRight: null,
  wrongLeft: null,
  wrongRight: null,
  matchedIds: [],
  isLocked: false,
  timedOut: false,
  timeLeft: getKanjiMatchDuration(),
  hasStarted: false,
  showResults: false,
  resultFilter: "all"
};

let kanjiMatchPool = [];

const kanjiMatchEngine = sharedMatchGame.createMatchGameEngine({
  state: kanjiMatchState,
  pageSize: kanjiMatchPageSize,
  wrongFlashDuration: kanjiMatchWrongFlashDuration,
  pageTransitionDelay: kanjiMatchPageTransitionDelay,
  getDuration: () => getKanjiMatchDuration(kanjiMatchPreferences.duration),
  getDefaultSessionItems: buildKanjiMatchSessionItems,
  mapResultItem: (item) => ({
    id: item.id,
    gradeLabel: item.gradeLabel,
    char: item.char,
    reading: item.reading
  }),
  buildCardsFromPageItems: (pageItems) => ({
    leftCards: sharedMatchGame.shuffleItems(
      pageItems.map((item) => ({
        id: item.id,
        value: item.char,
        side: "left"
      }))
    ),
    rightCards: sharedMatchGame.shuffleItems(
      pageItems.map((item) => ({
        id: item.id,
        value: item.reading,
        side: "right"
      }))
    )
  }),
  onRender: renderKanjiMatchScreen,
  onSetActionAvailability: setKanjiMatchActionAvailability,
  onSetFeedback: setKanjiMatchFeedback,
  onUnavailable: () => {
    renderKanjiMatchUnavailableState("??뽰쁽 筌욎빖彛ょ빊遺쎈┛??餓Β??쑵釉??餓λ쵐??癒?뒄.");
  },
  onPageOpened: ({ isInitialPage }) => {
    if (isInitialPage) {
      scrollKanjiMatchBoardIntoView();
    }
  },
  getTimeoutMessage: ({ isFinalPage }) => {
    if (isFinalPage) {
      return "??볦퍢????멸텢??癰귣똻?????뽰쁽???????얜챷?ｆ에?野껉퀗?든몴?獄쏆꼷???됰선??";
    }

    return "??볦퍢????멸텢??筌왖疫?癰귣똻?????뽰쁽???????얜챷?ｆ에??띾┛????쇱벉??곗쨮 揶쏅뜃苡??";
  }
});

kanjiMatchPreferences.grade = getKanjiMatchGrade(kanjiMatchPreferences.grade);
kanjiMatchPreferences.filter = getKanjiMatchFilter(kanjiMatchPreferences.filter);
kanjiMatchPreferences.totalCount = getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount);
kanjiMatchPreferences.duration = getKanjiMatchDuration(kanjiMatchPreferences.duration);
kanjiMatchPreferences.optionsOpen = false;

function clearKanjiMatchTransitionTimer() {
  kanjiMatchEngine.clearTransitionTimer();
}

function stopKanjiMatchRoundTimer() {
  kanjiMatchEngine.stopRoundTimer();
}

function clearKanjiWrongMatchTimer() {
  kanjiMatchEngine.clearWrongMatchTimer();
}

function clearAllKanjiMatchTimers() {
  kanjiMatchEngine.clearAllTimers();
}

function refreshKanjiMatchPool() {
  kanjiMatchPool = filterKanjiMatchPool(getBaseKanjiMatchPool(), kanjiMatchPreferences.filter, kanjiMatchPreferences.grade);
}

function getKanjiMatchPageCount() {
  return kanjiMatchEngine.getPageCount();
}

function getKanjiMatchResolvedCount() {
  return kanjiMatchEngine.getResolvedCount();
}

function getKanjiMatchResultCounts() {
  return kanjiMatchEngine.getResultCounts();
}

function setKanjiMatchResultStatus(ids, status) {
  kanjiMatchEngine.setResultStatus(ids, status);
}

function resetKanjiMatchResultStatus(ids) {
  setKanjiMatchResultStatus(ids, "pending");
}

function getCurrentKanjiMatchPageItems(pageIndex = kanjiMatchState.pageIndex) {
  return kanjiMatchEngine.getCurrentPageItems(pageIndex);
}

function resetKanjiSelectedCards() {
  kanjiMatchEngine.resetSelectedCards();
}

function resetKanjiCurrentPageState() {
  kanjiMatchEngine.resetCurrentPageState();
}

function setKanjiMatchFeedback(message, tone = "") {
  const feedback = document.getElementById("kanji-match-feedback");

  if (!feedback) {
    return;
  }

  feedback.hidden = !message;
  feedback.textContent = message;
  feedback.classList.remove("is-success", "is-fail");

  if (tone) {
    feedback.classList.add(tone);
  }
}

function renderKanjiMatchActionCopy() {
  sharedMatchGame.renderActionCopy({
    buttonId: "kanji-match-new-round",
    labelId: "kanji-match-new-round-label",
    isResetState: kanjiMatchState.hasStarted || kanjiMatchState.showResults
  });
}

function renderKanjiMatchTimer() {
  const activeDuration = getKanjiMatchDuration(kanjiMatchPreferences.duration);

  sharedMatchGame.renderTimer({
    timerId: "kanji-match-timer",
    duration: activeDuration,
    timeLeft: kanjiMatchState.timeLeft
  });
}

function renderKanjiMatchStats() {
  const totalCount = kanjiMatchState.sessionItems.length || getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount);

  sharedMatchGame.renderStats({
    progressId: "kanji-match-progress",
    resolvedCount: getKanjiMatchResolvedCount(),
    totalCount,
    renderTimer: renderKanjiMatchTimer
  });
}

function renderKanjiMatchSettings() {
  const gradeSelect = document.getElementById("kanji-match-grade-select");
  const filterSelect = document.getElementById("kanji-match-filter-select");
  const countSpinner = document.querySelector('[data-spinner-id="kanji-match-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kanji-match-time"]');
  const basePool = getBaseKanjiMatchPool();
  const filterCounts = getKanjiMatchFilterCounts(basePool);
  const gradeCounts = getKanjiMatchGradeCounts(basePool);
  const isSettingsLocked = kanjiMatchState.hasStarted && !kanjiMatchState.showResults;
  const shouldShowOptionsPanel = !isSettingsLocked && kanjiMatchPreferences.optionsOpen !== false;

  sharedMatchGame.renderSettingsPanel({
    optionsShellId: "kanji-match-options-shell",
    optionsToggleId: "kanji-match-options-toggle",
    optionsPanelId: "kanji-match-options-panel",
    optionsSummaryId: "kanji-match-options-summary",
    summaryText: getKanjiMatchOptionsSummaryText(),
    isSettingsLocked,
    shouldShowOptionsPanel,
    selectConfigs: [
      {
        element: gradeSelect,
        populate: (element) => populateKanjiMatchGradeSelect(element, gradeCounts),
        disabled: isSettingsLocked
      },
      {
        element: filterSelect,
        populate: (element) => populateKanjiMatchFilterSelect(element, filterCounts),
        disabled: isSettingsLocked
      }
    ],
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: kanjiMatchTotalCountOptions,
        activeValue: getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount),
        formatValue: (value) => `${value}臾몄젣`,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: kanjiMatchDurationOptions,
        activeValue: getKanjiMatchDuration(kanjiMatchPreferences.duration),
        formatValue: getKanjiMatchDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    refreshPool: refreshKanjiMatchPool,
    updateActionAvailability: () => {
      setKanjiMatchActionAvailability(kanjiMatchPool.length > 0);
    }
  });
}

function setKanjiMatchActionAvailability(startEnabled) {
  const newRound = document.getElementById("kanji-match-new-round");

  if (newRound) {
    newRound.disabled = !startEnabled;
  }
}

function scrollKanjiMatchBoardIntoView() {
  const board = document.getElementById("kanji-match-board");

  if (!board?.scrollIntoView) {
    return;
  }

  window.requestAnimationFrame(() => {
    board.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

function createKanjiMatchCard(card, selectedId) {
  const button = document.createElement("button");
  const matched = kanjiMatchState.matchedIds.includes(card.id);
  const wrong =
    (card.side === "left" && kanjiMatchState.wrongLeft === card.id) ||
    (card.side === "right" && kanjiMatchState.wrongRight === card.id);

  button.type = "button";
  button.className = "match-card";
  button.textContent = card.value;
  button.disabled = kanjiMatchState.isLocked || matched;

  if (selectedId === card.id) {
    button.classList.add("is-selected");
  }

  if (matched) {
    button.classList.add("is-matched");
  }

  if (wrong) {
    button.classList.add("is-wrong");
  }

  button.addEventListener("click", () => {
    handleKanjiMatchSelection(card);
  });

  return button;
}

function renderKanjiMatchBoard() {
  sharedMatchGame.renderBoard({
    leftListId: "kanji-match-left-list",
    rightListId: "kanji-match-right-list",
    leftCards: kanjiMatchState.leftCards,
    rightCards: kanjiMatchState.rightCards,
    selectedLeft: kanjiMatchState.selectedLeft,
    selectedRight: kanjiMatchState.selectedRight,
    createCard: createKanjiMatchCard,
    renderStats: renderKanjiMatchStats
  });
}

function getFilteredKanjiMatchResults(filter = getKanjiMatchResultFilter(kanjiMatchState.resultFilter)) {
  return kanjiMatchEngine.getFilteredResults(filter);
}

function renderKanjiMatchBulkActionButton(results) {
  const bulkActionButton = document.getElementById("kanji-match-result-bulk-action");
  const bulkActionLabel = document.getElementById("kanji-match-result-bulk-label");
  const bulkActionIcon = bulkActionButton?.querySelector(".material-symbols-rounded");

  if (!bulkActionButton || !bulkActionLabel || !bulkActionIcon) {
    return;
  }

  const uniqueIds = Array.from(new Set(results.map((item) => item.id).filter(Boolean)));
  const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isKanjiSavedToMemorizationList(id));
  const actionLabel = allSaved ? "?꾩껜 鍮쇨린" : "?꾩껜 ?ㅼ떆 蹂쇰옒??;
  const actionTitle =
    uniqueIds.length === 0
      ? "吏湲??댁븘???쒖옄媛 ?놁뼱??"
      : allSaved
        ? "吏湲?蹂댁씠???쒖옄瑜??ㅼ떆 蹂쇰옒?붿뿉??紐⑤몢 類꾧쾶??"
        : "吏湲?蹂댁씠???쒖옄瑜??ㅼ떆 蹂쇰옒?붿뿉 紐⑤몢 ?댁븘?섍쾶??";

  bulkActionButton.disabled = uniqueIds.length === 0;
  bulkActionButton.dataset.kanjiMatchBulkAction = allSaved ? "remove" : "save";
  bulkActionButton.setAttribute("aria-label", actionTitle);
  bulkActionButton.title = actionTitle;
  bulkActionLabel.textContent = actionLabel;
  bulkActionIcon.textContent = allSaved ? "delete_sweep" : "bookmark_add";
}

function renderKanjiMatchResultFilterOptions(counts) {
  sharedMatchGame.renderResultFilterOptions({
    selectId: "kanji-match-result-filter",
    filters: kanjiMatchResultFilterOptions,
    labels: kanjiMatchResultFilterLabels,
    counts,
    activeFilter: getKanjiMatchResultFilter(kanjiMatchState.resultFilter)
  });
}

function renderKanjiMatchResults() {
  const counts = getKanjiMatchResultCounts();
  const filteredResults = getFilteredKanjiMatchResults();

  sharedMatchGame.renderResultsView({
    resultViewId: "kanji-match-result-view",
    totalId: "kanji-match-result-total",
    correctId: "kanji-match-result-correct",
    wrongId: "kanji-match-result-wrong",
    emptyId: "kanji-match-result-empty",
    listId: "kanji-match-result-list",
    filterSelectId: "kanji-match-result-filter",
    bulkActionButtonId: "kanji-match-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getKanjiMatchResultFilter(kanjiMatchState.resultFilter),
    filterLabels: kanjiMatchResultFilterLabels,
    renderFilterOptions: renderKanjiMatchResultFilterOptions,
    renderBulkActionButton: renderKanjiMatchBulkActionButton,
    createItemMarkup: (item) => {
      const saved = isKanjiSavedToMemorizationList(item.id);
      const statusLabel = item.status === "correct" ? "?뺣떟" : "?ㅻ떟";
      const actionLabel = saved ? "?ㅼ떆 蹂쇰옒?붿뿉??鍮쇨린" : "?ㅼ떆 蹂쇰옒?붿뿉 ?닿린";
      const actionIcon = saved ? "delete" : "bookmark_add";

      return `
        <article class="match-result-item is-${item.status}">
          <div class="match-result-item-head">
            <div class="match-result-item-badges">
              <span class="match-result-badge is-${item.status}">${statusLabel}</span>
              <span class="match-result-level">${item.gradeLabel}</span>
            </div>
            <button
              class="secondary-btn match-save-btn icon-only-btn${saved ? " is-saved" : ""}"
              type="button"
              data-kanji-match-save="${item.id}"
              aria-label="${actionLabel}"
              aria-pressed="${saved ? "true" : "false"}"
              title="${actionLabel}"
            >
              <span class="material-symbols-rounded" aria-hidden="true">${actionIcon}</span>
            </button>
          </div>
          <div class="match-result-item-main">
            <strong>${item.char}</strong>
            <p>${item.reading}</p>
          </div>
        </article>
      `;
    }
  });
}

function renderKanjiMatchScreen() {
  sharedMatchGame.renderScreen({
    boardId: "kanji-match-board",
    emptyId: "kanji-match-empty",
    playViewId: "kanji-match-play-view",
    resultViewId: "kanji-match-result-view",
    feedbackId: "kanji-match-feedback",
    hasStarted: kanjiMatchState.hasStarted,
    showResults: kanjiMatchState.showResults,
    isReady: kanjiMatchPool.length > 0,
    emptyReadyText: "以鍮꾨릱?ㅻ㈃ ?쒖옉?대낵源뚯슂?",
    emptyUnavailableText: "吏앸쭪異붽린瑜?以鍮꾪븯怨??덉뼱??",
    renderSettings: renderKanjiMatchSettings,
    renderActionCopy: renderKanjiMatchActionCopy,
    renderStats: renderKanjiMatchStats,
    renderResults: renderKanjiMatchResults,
    renderBoard: renderKanjiMatchBoard
  });
}

function startKanjiMatchRoundTimer() {
  kanjiMatchEngine.startRoundTimer();
}
function enterKanjiMatchReadyState(message = "") {
  kanjiMatchEngine.enterReadyState(message);
}
function openKanjiMatchPage(pageItems) {
  kanjiMatchEngine.openPage(pageItems);
}
function showKanjiMatchResults() {
  kanjiMatchEngine.showResults();
}
function moveToNextKanjiMatchPage() {
  kanjiMatchEngine.moveToNextPage();
}
function buildKanjiMatchSessionItems() {
  refreshKanjiMatchPool();

  if (!kanjiMatchPool.length) {
    return [];
  }

  const totalCount = Math.min(getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount), kanjiMatchPool.length);
  return sharedMatchGame.shuffleItems(kanjiMatchPool).slice(0, totalCount);
}
function startKanjiMatchSession(items = buildKanjiMatchSessionItems()) {
  kanjiMatchEngine.startSession(items);
}
function replayCurrentKanjiMatchPage() {
  kanjiMatchEngine.replayCurrentPage();
}
function replayCurrentKanjiMatchSet() {
  kanjiMatchEngine.replayCurrentSet();
}
function renderKanjiMatchUnavailableState(message) {
  const leftList = document.getElementById("kanji-match-left-list");
  const rightList = document.getElementById("kanji-match-right-list");
  const resultList = document.getElementById("kanji-match-result-list");
  const resultEmpty = document.getElementById("kanji-match-result-empty");

  clearAllKanjiMatchTimers();
  kanjiMatchState.sessionItems = [];
  kanjiMatchState.pageItems = [];
  kanjiMatchState.results = [];
  kanjiMatchState.leftCards = [];
  kanjiMatchState.rightCards = [];
  kanjiMatchState.pageIndex = 0;
  kanjiMatchState.hasStarted = false;
  kanjiMatchState.showResults = false;
  resetKanjiCurrentPageState();

  if (leftList) {
    leftList.innerHTML = "";
  }

  if (rightList) {
    rightList.innerHTML = "";
  }

  if (resultList) {
    resultList.innerHTML = "";
  }

  if (resultEmpty) {
    resultEmpty.hidden = true;
  }

  setKanjiMatchActionAvailability(false);
  setKanjiMatchFeedback(message, "is-fail");
  renderKanjiMatchScreen();
}

function handleKanjiMatchSelection(card) {
  kanjiMatchEngine.handleSelection(card);
}
function handleKanjiMatchTimeout() {
  kanjiMatchEngine.handleTimeout();
}
function startNewKanjiMatchSession() {
  kanjiMatchEngine.startNewSession();
}

function setKanjiMatchGrade(grade) {
  const nextGrade = getKanjiMatchGrade(grade);

  if (kanjiMatchPreferences.grade === nextGrade) {
    return;
  }

  kanjiMatchPreferences.grade = nextGrade;
  saveKanjiMatchPreferences();
  renderKanjiMatchSettings();
  enterKanjiMatchReadyState();
}

function setKanjiMatchFilterPreference(filter) {
  const nextFilter = getKanjiMatchFilter(filter);

  if (kanjiMatchPreferences.filter === nextFilter) {
    return;
  }

  kanjiMatchPreferences.filter = nextFilter;
  saveKanjiMatchPreferences();
  renderKanjiMatchSettings();
  enterKanjiMatchReadyState();
}

function setKanjiMatchTotalCount(totalCount) {
  const nextCount = getKanjiMatchTotalCount(totalCount);

  if (kanjiMatchPreferences.totalCount === nextCount) {
    return;
  }

  kanjiMatchPreferences.totalCount = nextCount;
  saveKanjiMatchPreferences();
  renderKanjiMatchSettings();
  enterKanjiMatchReadyState();
}

function setKanjiMatchDuration(duration) {
  const nextDuration = getKanjiMatchDuration(duration);

  if (kanjiMatchPreferences.duration === nextDuration) {
    return;
  }

  kanjiMatchPreferences.duration = nextDuration;
  saveKanjiMatchPreferences();
  renderKanjiMatchSettings();
  enterKanjiMatchReadyState();
}

function setKanjiMatchResultFilter(filter) {
  const nextFilter = getKanjiMatchResultFilter(filter);

  if (kanjiMatchState.resultFilter === nextFilter) {
    return;
  }

  kanjiMatchState.resultFilter = nextFilter;
  renderKanjiMatchResults();
}

function attachKanjiMatchEventListeners() {
  const newRound = document.getElementById("kanji-match-new-round");
  const optionsToggle = document.getElementById("kanji-match-options-toggle");
  const gradeSelect = document.getElementById("kanji-match-grade-select");
  const filterSelect = document.getElementById("kanji-match-filter-select");
  const countSpinner = document.querySelector('[data-spinner-id="kanji-match-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kanji-match-time"]');
  const resultFilterSelect = document.getElementById("kanji-match-result-filter");
  const resultBulkAction = document.getElementById("kanji-match-result-bulk-action");
  const resultList = document.getElementById("kanji-match-result-list");

  if (newRound) {
    newRound.addEventListener("click", startNewKanjiMatchSession);
  }

  sharedMatchGame.attachOptionsToggleListener(optionsToggle, () => {
    kanjiMatchPreferences.optionsOpen = !kanjiMatchPreferences.optionsOpen;
    saveKanjiMatchPreferences();
    renderKanjiMatchSettings();
  });

  sharedMatchGame.attachSelectChangeListener(gradeSelect, setKanjiMatchGrade);
  sharedMatchGame.attachSelectChangeListener(filterSelect, setKanjiMatchFilterPreference);
  sharedMatchGame.attachSpinnerListeners({
    spinner: countSpinner,
    options: kanjiMatchTotalCountOptions,
    getCurrentValue: () => getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount),
    handler: setKanjiMatchTotalCount
  });
  sharedMatchGame.attachSpinnerListeners({
    spinner: timeSpinner,
    options: kanjiMatchDurationOptions,
    getCurrentValue: () => getKanjiMatchDuration(kanjiMatchPreferences.duration),
    handler: setKanjiMatchDuration
  });
  sharedMatchGame.attachSelectChangeListener(resultFilterSelect, setKanjiMatchResultFilter);
  sharedMatchGame.attachBulkActionListener({
    button: resultBulkAction,
    datasetKey: "kanjiMatchBulkAction",
    getFilteredResults: getFilteredKanjiMatchResults,
    getItemId: (item) => item.id,
    onRemove: removeKanjiFromMemorizationList,
    onSave: saveKanjiToMemorizationList,
    afterChange: renderKanjiMatchResults
  });
  sharedMatchGame.attachResultSaveListener({
    list: resultList,
    buttonSelector: "[data-kanji-match-save]",
    getItemId: (button) => button.dataset.kanjiMatchSave,
    isSaved: isKanjiSavedToMemorizationList,
    onRemove: removeKanjiFromMemorizationList,
    onSave: saveKanjiToMemorizationList,
    afterChange: renderKanjiMatchResults
  });
}

if (document.getElementById("kanji-match-new-round")) {
  renderKanjiMatchSettings();
  renderKanjiMatchActionCopy();
  attachKanjiMatchEventListeners();
  sharedMatchGame.attachStorageUpdateListener({
    [kanjiMatchStorageKey]: () => {
      const nextPreferences = loadKanjiMatchPreferences();
      nextPreferences.optionsOpen = false;
      sharedMatchGame.replaceObjectContents(kanjiMatchPreferences, nextPreferences);
      renderKanjiMatchSettings();
      enterKanjiMatchReadyState();
    },
    [kanjiStudyStateStorageKey]: () => {
      renderKanjiMatchSettings();
      enterKanjiMatchReadyState();
    }
  });
  window.addEventListener("japanote:supplementary-content-loaded", () => {
    renderKanjiMatchSettings();
    enterKanjiMatchReadyState();
  });
  enterKanjiMatchReadyState();
}
