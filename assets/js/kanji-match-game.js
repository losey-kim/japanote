const kanjiMatchStorageKey = "japanote-kanji-match-state";
(function (global) {
const kanjiMatchStorageKey = "japanote-kanji-match-state";
const kanjiStudyStateStorageKey = "jlpt-compass-state";
const sharedMatchGame = global.japanoteSharedMatchGame;
const matchCopy = global.japanoteMatchCopy || {};
const kanjiStudyList = sharedMatchGame.createStudyListManager({
  storageKey: kanjiStudyStateStorageKey,
  reviewKey: "kanjiReviewIds",
  masteredKey: "kanjiMasteredIds"
});

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

const kanjiMatchResultFilterLabels = matchCopy.resultFilterLabels || {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};

const kanjiMatchFilterLabels = matchCopy.studyFilterLabels || {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 골랐어요"
};

const kanjiMatchReadyStateText =
  typeof matchCopy.getReadyStateText === "function"
    ? matchCopy.getReadyStateText()
    : {
        ready: "시작해볼까요?",
        unavailable: "지금은 준비 중이에요."
      };

function normalizeKanjiMatchText(value) {
  return sharedMatchGame.normalizeText(value);
}

function loadKanjiMatchPreferences() {
  return sharedMatchGame.loadStoredObject(kanjiMatchStorageKey, defaultKanjiMatchPreferences);
}

const kanjiMatchPreferences = loadKanjiMatchPreferences();

function saveKanjiMatchPreferences() {
  sharedMatchGame.saveStoredObject(kanjiMatchStorageKey, kanjiMatchPreferences);
}

const saveKanjiToMemorizationList = kanjiStudyList.saveToReviewList;
const removeKanjiFromMemorizationList = kanjiStudyList.removeFromReviewList;
const isKanjiSavedToMemorizationList = kanjiStudyList.isInReviewList;
const saveKanjiToMasteredList = kanjiStudyList.saveToMasteredList;
const removeKanjiFromMasteredList = kanjiStudyList.removeFromMasteredList;
const isKanjiSavedToMasteredList = kanjiStudyList.isInMasteredList;

function getKanjiMatchStudyBuckets() {
  return kanjiStudyList.getBuckets();
}

function getKanjiMatchGrade(value = kanjiMatchPreferences.grade) {
  const normalizedValue = normalizeKanjiMatchText(value);
  return kanjiMatchGradeOptions.includes(normalizedValue) ? normalizedValue : "all";
}

function getKanjiMatchGradeLabel(grade = kanjiMatchPreferences.grade) {
  const activeGrade = getKanjiMatchGrade(grade);
  return activeGrade === "all" ? "전체" : `${activeGrade}학년`;
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
  if (typeof matchCopy.formatDurationLabel === "function") {
    return matchCopy.formatDurationLabel(duration);
  }

  const activeDuration = Number(duration);
  return activeDuration <= 0 ? "천천히" : `${activeDuration}초`;
}

function getKanjiMatchResultFilter(value = kanjiMatchState.resultFilter) {
  return kanjiMatchResultFilterOptions.includes(value) ? value : "all";
}

function getKanjiMatchOptionsSummaryText() {
  const summaryItems = [
    getKanjiMatchFilterLabel(),
    getKanjiMatchGradeLabel(),
    `${getKanjiMatchTotalCount()}문제`,
    getKanjiMatchDurationLabel()
  ];

  return typeof matchCopy.joinSummaryItems === "function" ? matchCopy.joinSummaryItems(summaryItems) : summaryItems.join(" · ");
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
    option.textContent = grade === "all" ? `전체 (${counts[grade] ?? 0})` : `${grade}학년 (${counts[grade] ?? 0})`;
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
    renderKanjiMatchUnavailableState("지금 선택한 조건에 맞는 한자가 없어요.");
  },
  onPageOpened: ({ isInitialPage }) => {
    if (isInitialPage) {
      scrollKanjiMatchBoardIntoView();
    }
  },
  getTimeoutMessage: ({ isFinalPage }) => {
    if (isFinalPage) {
      return "시간이 끝났어요. 결과에서 맞춘 한자와 놓친 한자를 확인해봐요.";
    }

    return "시간이 끝났어요. 다음 묶음으로 넘어갈게요.";
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
  sharedMatchGame.setFeedbackById("kanji-match-feedback", message, tone);
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
    timeLeft: kanjiMatchState.timeLeft,
    timerState: kanjiMatchState
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

  sharedMatchGame.renderStandardMatchSettings({
    optionsShellId: "kanji-match-options-shell",
    optionsToggleId: "kanji-match-options-toggle",
    optionsPanelId: "kanji-match-options-panel",
    optionsSummaryId: "kanji-match-options-summary",
    summaryText: getKanjiMatchOptionsSummaryText(),
    isSettingsLocked,
    optionsOpen: kanjiMatchPreferences.optionsOpen,
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
    countSpinner,
    countOptions: kanjiMatchTotalCountOptions,
    countValue: getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount),
    countFormatValue: (value) => `${value}문제`,
    timeSpinner,
    timeOptions: kanjiMatchDurationOptions,
    timeValue: getKanjiMatchDuration(kanjiMatchPreferences.duration),
    timeFormatValue: getKanjiMatchDurationLabel,
    refreshPool: refreshKanjiMatchPool,
    updateActionAvailability: () => {
      setKanjiMatchActionAvailability(kanjiMatchPool.length > 0);
    }
  });
}

function setKanjiMatchActionAvailability(startEnabled) {
  sharedMatchGame.setActionAvailabilityById("kanji-match-new-round", startEnabled);
}

function scrollKanjiMatchBoardIntoView() {
  sharedMatchGame.scrollElementIntoViewById("kanji-match-board");
}

const createKanjiMatchCard = sharedMatchGame.createMatchCard({
  state: kanjiMatchState,
  onSelection: handleKanjiMatchSelection
});

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

function renderKanjiMatchBulkActionButtons(results) {
  const reviewActionButton = document.getElementById("kanji-match-result-bulk-action");
  const reviewActionLabel = document.getElementById("kanji-match-result-bulk-label");
  const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
  const masteredActionButton = document.getElementById("kanji-match-result-mastered-action");
  const masteredActionLabel = document.getElementById("kanji-match-result-mastered-label");
  const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");
  const uniqueIds = Array.from(new Set(results.map((item) => item.id).filter(Boolean)));

  if (reviewActionButton && reviewActionLabel && reviewActionIcon) {
    const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isKanjiSavedToMemorizationList(id));

    sharedMatchGame.renderBulkActionButtonState({
      button: reviewActionButton,
      label: reviewActionLabel,
      icon: reviewActionIcon,
      count: uniqueIds.length,
      allSaved,
      datasetKey: "kanjiMatchBulkAction",
      getActionLabel: () => allSaved ? "다시 보기 해제" : "다시 보기로 표시",
      getActionTitle: ({ count, allSaved: savedState }) =>
        count === 0 ? "지금 표시 중인 한자가 없어요." : savedState ? "다시 보기 해제" : "다시 보기로 표시"
    });
  }

  if (masteredActionButton && masteredActionLabel && masteredActionIcon) {
    const allMastered = uniqueIds.length > 0 && uniqueIds.every((id) => isKanjiSavedToMasteredList(id));

    sharedMatchGame.renderBulkActionButtonState({
      button: masteredActionButton,
      label: masteredActionLabel,
      icon: masteredActionIcon,
      count: uniqueIds.length,
      allSaved: allMastered,
      datasetKey: "kanjiMatchMasteredBulkAction",
      getActionLabel: () => allMastered ? "익힘 해제" : "익힘으로 표시",
      getActionTitle: ({ count, allSaved: savedState }) =>
        count === 0 ? "지금 표시 중인 한자가 없어요." : savedState ? "익힘 해제" : "익힘으로 표시"
    });

    masteredActionIcon.textContent = allMastered ? "remove_done" : "check_circle";
  }
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
    bulkActionButtonId: "kanji-match-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getKanjiMatchResultFilter(kanjiMatchState.resultFilter),
    filterLabels: kanjiMatchResultFilterLabels,
    renderBulkActionButton: renderKanjiMatchBulkActionButtons,
    renderItems: (results, container) => {
      const fmt = global.japanoteStudyViewHelpers?.formatQuizSemicolonsToCommaList;
      const listFmt = typeof fmt === "function" ? fmt : (v) => String(v || "").replace(/\s*;\s*/g, ", ").trim();
      results.forEach((item) => {
        const reviewSelected = isKanjiSavedToMemorizationList(item.id);
        const masteredSelected = isKanjiSavedToMasteredList(item.id);

        sharedMatchGame.appendResultItem({
          container,
          status: item.status,
          levelText: item.gradeLabel,
          titleText: listFmt(item.char),
          descriptionText: listFmt(item.reading),
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? "다시 보기 해제" : "다시 보기로 표시",
              datasetName: "kanjiMatchReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? "익힘 해제" : "익힘으로 표시",
              datasetName: "kanjiMatchMastered",
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
    emptyReadyText: kanjiMatchReadyStateText.ready,
    emptyUnavailableText: kanjiMatchReadyStateText.unavailable,
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
  return sharedMatchGame.createSessionItems(kanjiMatchPool, getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount));
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
  sharedMatchGame.renderUnavailableState({
    leftListId: "kanji-match-left-list",
    rightListId: "kanji-match-right-list",
    resultListId: "kanji-match-result-list",
    resultEmptyId: "kanji-match-result-empty",
    state: kanjiMatchState,
    engine: kanjiMatchEngine,
    setActionAvailability: setKanjiMatchActionAvailability,
    setFeedback: setKanjiMatchFeedback,
    renderScreen: renderKanjiMatchScreen,
    message
  });
}

function handleKanjiMatchSelection(card) {
  kanjiMatchEngine.handleSelection(card);
}
function handleKanjiMatchTimeout() {
  kanjiMatchEngine.handleTimeout();
}
function startNewKanjiMatchSession() {
  global.japanoteChallengeLinks?.clearActiveChallenge?.("kanji-match-result-view");
  kanjiMatchEngine.startNewSession();
}

const setKanjiMatchGrade = sharedMatchGame.createPreferenceHandler({
  preferences: kanjiMatchPreferences,
  key: "grade",
  normalize: getKanjiMatchGrade,
  savePreferences: saveKanjiMatchPreferences,
  renderSettings: renderKanjiMatchSettings,
  enterReadyState: enterKanjiMatchReadyState
});

const setKanjiMatchFilterPreference = sharedMatchGame.createPreferenceHandler({
  preferences: kanjiMatchPreferences,
  key: "filter",
  normalize: getKanjiMatchFilter,
  savePreferences: saveKanjiMatchPreferences,
  renderSettings: renderKanjiMatchSettings,
  enterReadyState: enterKanjiMatchReadyState
});

const setKanjiMatchTotalCount = sharedMatchGame.createPreferenceHandler({
  preferences: kanjiMatchPreferences,
  key: "totalCount",
  normalize: getKanjiMatchTotalCount,
  savePreferences: saveKanjiMatchPreferences,
  renderSettings: renderKanjiMatchSettings,
  enterReadyState: enterKanjiMatchReadyState
});

const setKanjiMatchDuration = sharedMatchGame.createPreferenceHandler({
  preferences: kanjiMatchPreferences,
  key: "duration",
  normalize: getKanjiMatchDuration,
  savePreferences: saveKanjiMatchPreferences,
  renderSettings: renderKanjiMatchSettings,
  enterReadyState: enterKanjiMatchReadyState
});

const setKanjiMatchResultFilter = sharedMatchGame.createResultFilterHandler({
  state: kanjiMatchState,
  normalize: getKanjiMatchResultFilter,
  renderResults: renderKanjiMatchResults
});

if (global.japanoteChallengeLinks && typeof global.japanoteChallengeLinks.registerProvider === "function") {
  global.japanoteChallengeLinks.registerProvider({
    resultViewId: "kanji-match-result-view",
    kind: "kanji-match",
    getApplyMessage: () => "친구가 보낸 한자 짝맞추기가 열렸어요.",
    createPayload: () => {
      if (!Array.isArray(kanjiMatchState.sessionItems) || !kanjiMatchState.sessionItems.length) {
        return null;
      }

      return {
        config: {
          grade: getKanjiMatchGrade(kanjiMatchPreferences.grade),
          filter: getKanjiMatchFilter(kanjiMatchPreferences.filter),
          totalCount: getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount),
          duration: getKanjiMatchDuration(kanjiMatchPreferences.duration)
        },
        sessionItems: kanjiMatchState.sessionItems.map((item) => ({ ...item }))
      };
    },
    applyPayload: (payload) => {
      if (!Array.isArray(payload?.sessionItems) || !payload.sessionItems.length) {
        return false;
      }

      kanjiMatchPreferences.grade = getKanjiMatchGrade(payload.config?.grade);
      kanjiMatchPreferences.filter = getKanjiMatchFilter(payload.config?.filter);
      kanjiMatchPreferences.totalCount = getKanjiMatchTotalCount(payload.config?.totalCount);
      kanjiMatchPreferences.duration = getKanjiMatchDuration(payload.config?.duration);
      saveKanjiMatchPreferences();

      if (typeof global.setKanjiTab === "function") {
        global.setKanjiTab("match");
      } else {
        document.querySelector('[data-kanji-tab="match"]')?.click();
      }

      kanjiMatchEngine.startSession(payload.sessionItems.map((item) => ({ ...item })));
      return true;
    }
  });
}

function attachKanjiMatchEventListeners() {
  const newRound = document.getElementById("kanji-match-new-round");
  const optionsToggle = document.getElementById("kanji-match-options-toggle");
  const gradeSelect = document.getElementById("kanji-match-grade-select");
  const filterSelect = document.getElementById("kanji-match-filter-select");
  const countSpinner = document.querySelector('[data-spinner-id="kanji-match-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kanji-match-time"]');
  const resultFilterButtons = document.querySelectorAll("#kanji-match-result-view [data-result-filter]");
  const resultBulkAction = document.getElementById("kanji-match-result-bulk-action");
  const resultMasteredAction = document.getElementById("kanji-match-result-mastered-action");
  const resultList = document.getElementById("kanji-match-result-list");

  sharedMatchGame.attachStandardMatchEventListeners({
    newRoundButton: newRound,
    onStartNewRound: startNewKanjiMatchSession,
    optionsToggleButton: optionsToggle,
    onToggleOptions: () => {
      kanjiMatchPreferences.optionsOpen = !kanjiMatchPreferences.optionsOpen;
      saveKanjiMatchPreferences();
      renderKanjiMatchSettings();
    },
    selectConfigs: [
      { element: gradeSelect, handler: setKanjiMatchGrade },
      { element: filterSelect, handler: setKanjiMatchFilterPreference }
    ],
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: kanjiMatchTotalCountOptions,
        getCurrentValue: () => getKanjiMatchTotalCount(kanjiMatchPreferences.totalCount),
        handler: setKanjiMatchTotalCount
      },
      {
        spinner: timeSpinner,
        options: kanjiMatchDurationOptions,
        getCurrentValue: () => getKanjiMatchDuration(kanjiMatchPreferences.duration),
        handler: setKanjiMatchDuration
      }
    ],
    resultFilterButtons,
    onResultFilterChange: setKanjiMatchResultFilter,
    bulkActionConfig: {
      button: resultBulkAction,
      datasetKey: "kanjiMatchBulkAction",
      getFilteredResults: getFilteredKanjiMatchResults,
      getItemId: (item) => item.id,
      onRemove: removeKanjiFromMemorizationList,
      onSave: saveKanjiToMemorizationList,
      afterChange: renderKanjiMatchResults
    },
    resultSaveConfig: {
      list: resultList,
      buttonSelector: "[data-kanji-match-review]",
      getItemId: (button) => button.dataset.kanjiMatchReview,
      isSaved: isKanjiSavedToMemorizationList,
      onRemove: removeKanjiFromMemorizationList,
      onSave: saveKanjiToMemorizationList,
      afterChange: renderKanjiMatchResults
    }
  });

  sharedMatchGame.attachBulkActionListener({
    button: resultMasteredAction,
    datasetKey: "kanjiMatchMasteredBulkAction",
    getFilteredResults: getFilteredKanjiMatchResults,
    getItemId: (item) => item.id,
    onRemove: removeKanjiFromMasteredList,
    onSave: saveKanjiToMasteredList,
    afterChange: renderKanjiMatchResults
  });
  sharedMatchGame.attachResultSaveListener({
    list: resultList,
    buttonSelector: "[data-kanji-match-mastered]",
    getItemId: (button) => button.dataset.kanjiMatchMastered,
    isSaved: isKanjiSavedToMasteredList,
    onRemove: removeKanjiFromMasteredList,
    onSave: saveKanjiToMasteredList,
    afterChange: renderKanjiMatchResults
  });
}

sharedMatchGame.initializeStandardMatchScreen({
  guardElement: document.getElementById("kanji-match-new-round"),
  renderSettings: renderKanjiMatchSettings,
  renderActionCopy: renderKanjiMatchActionCopy,
  attachEventListeners: attachKanjiMatchEventListeners,
  storageHandlers: {
    [kanjiMatchStorageKey]: () => {
      const nextPreferences = loadKanjiMatchPreferences();
      // 원격 동기화 응답이 와도, 지금 사용자가 보고 있는 설정 패널은
      // 닫지 않고 유지해야 연속으로 옵션을 조정할 수 있다.
      nextPreferences.optionsOpen = kanjiMatchPreferences.optionsOpen === true;
      sharedMatchGame.replaceObjectContents(kanjiMatchPreferences, nextPreferences);
      renderKanjiMatchSettings();
      enterKanjiMatchReadyState();
    },
    [kanjiStudyStateStorageKey]: () => {
      renderKanjiMatchSettings();
      enterKanjiMatchReadyState();
    }
  },
  windowListeners: [
    {
      eventName: "japanote:supplementary-content-loaded",
      handler: () => {
        renderKanjiMatchSettings();
        enterKanjiMatchReadyState();
      }
    }
  ],
  enterReadyState: enterKanjiMatchReadyState
});

})(globalThis);
