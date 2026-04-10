const matchStorageKey = "japanote-match-state";
const studyStateStorageKey = "jlpt-compass-state";
const sharedMatchGame = globalThis.japanoteSharedMatchGame;
const matchCopy = globalThis.japanoteMatchCopy || {};
const normalizeMatchText = sharedMatchGame.normalizeText;

const matchStudyList = sharedMatchGame.createStudyListManager({
  storageKey: studyStateStorageKey,
  reviewKey: "reviewIds",
  masteredKey: "masteredIds"
});

const matchSourceLevels = ["N5", "N4", "N3"];
const matchLevelOptions = [...matchSourceLevels, "all"];
const matchDurationOptions = [10, 15, 20, 0];
const matchTotalCountOptions = [5, 10, 15, 20];
const matchFilterOptions = ["all", "review", "mastered", "unmarked"];
const matchResultFilterOptions = ["all", "correct", "wrong"];
const matchPageSize = 5;
const matchWrongFlashDuration = 520;
const matchPageTransitionDelay = 720;

const defaultMatchPreferences = {
  level: "N5",
  filter: "all",
  part: "all",
  totalCount: 5,
  duration: 15,
  optionsOpen: false
};

const matchResultFilterLabels = matchCopy.resultFilterLabels || {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};

const matchFilterLabels = matchCopy.studyFilterLabels || {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 골랐어요"
};

const matchReadyStateText =
  typeof matchCopy.getReadyStateText === "function"
    ? matchCopy.getReadyStateText()
    : {
        ready: "준비되면 시작해볼까요?",
        unavailable: "지금은 준비 중이에요."
      };

function loadMatchPreferences() {
  return sharedMatchGame.loadStoredObject(matchStorageKey, defaultMatchPreferences);
}

const matchPreferences = loadMatchPreferences();

function saveMatchPreferences() {
  sharedMatchGame.saveStoredObject(matchStorageKey, matchPreferences);
}

const saveWordToMemorizationList = matchStudyList.saveToReviewList;
const removeWordFromMemorizationList = matchStudyList.removeFromReviewList;
const isWordSavedToMemorizationList = matchStudyList.isInReviewList;
const saveWordToMasteredList = matchStudyList.saveToMasteredList;
const removeWordFromMasteredList = matchStudyList.removeFromMasteredList;
const isWordSavedToMasteredList = matchStudyList.isInMasteredList;

function normalizeMatchText(value) {
  return sharedMatchGame.normalizeText(value);
}

function getMatchLevel(value = matchPreferences.level) {
  return matchLevelOptions.includes(value) ? value : "N5";
}

function formatMatchLevelLabel(level) {
  const normalizedLevel = normalizeMatchText(level).toUpperCase();

  if (!normalizedLevel) {
    return "N5";
  }

  if (normalizedLevel === "ALL" || normalizedLevel === "전체") {
    return "전체";
  }

  if (/^N\d+$/.test(normalizedLevel)) {
    return normalizedLevel;
  }

  if (/^\d+$/.test(normalizedLevel)) {
    return `N${normalizedLevel}`;
  }

  return normalizedLevel;
}

function getMatchLevelLabel(level = matchPreferences.level) {
  const activeLevel = getMatchLevel(level);
  return activeLevel === "all" ? "전체" : formatMatchLevelLabel(activeLevel);
}

function getMatchTotalCount(value = matchPreferences.totalCount) {
  const numericValue = Number(value);
  return matchTotalCountOptions.includes(numericValue) ? numericValue : 5;
}

function getMatchDuration(value = matchPreferences.duration) {
  const numericValue = Number(value);
  return matchDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getMatchDurationLabel(duration = matchPreferences.duration) {
  if (typeof matchCopy.formatDurationLabel === "function") {
    return matchCopy.formatDurationLabel(duration);
  }

  const activeDuration = Number(duration);
  return activeDuration <= 0 ? "천천히" : `${activeDuration}초`;
}

function getMatchOptionsSummaryText() {
  const summaryItems = [`${getMatchTotalCount()}문제`, getMatchDurationLabel()];
  return typeof matchCopy.joinSummaryItems === "function" ? matchCopy.joinSummaryItems(summaryItems) : summaryItems.join(" · ");
}

function getMatchResultFilter(value = matchState.resultFilter) {
  return matchResultFilterOptions.includes(value) ? value : "all";
}

function getMatchFilter(value = matchPreferences.filter) {
  return matchFilterOptions.includes(value) ? value : "all";
}

function getMatchPartValue(item) {
  if (!Array.isArray(item.parts)) {
    return "";
  }

  return normalizeMatchText(item.parts[0] || "");
}

function getMatchStudyBuckets() {
  return matchStudyList.getBuckets();
}

function getMatchLevelSource(level) {
  const vocabStore = globalThis.japanoteVocabStore;
  const source =
    vocabStore && typeof vocabStore.getLevelItems === "function"
      ? vocabStore.getLevelItems(level)
      : [];

  return source.map((item) => ({
    ...item,
    _level: item?._level || item?.level || level
  }));
}

function getMatchSource(level = matchPreferences.level) {
  const activeLevel = getMatchLevel(level);

  if (activeLevel === "all") {
    return matchSourceLevels.flatMap((itemLevel) => getMatchLevelSource(itemLevel));
  }

  return getMatchLevelSource(activeLevel);
}

function getMatchReading(item) {
  return normalizeMatchText(item.showEntry || item.show_entry || item.entry || item.pron).replace(/-/g, "");
}

function getMatchMeaning(item) {
  if (!Array.isArray(item.means)) {
    return "";
  }

  return normalizeMatchText(item.means.find((value) => normalizeMatchText(value)) || "");
}

function buildMatchPool(source) {
  return source
    .map((item) => ({
      id: normalizeMatchText(item.id || item.entry_id),
      level: formatMatchLevelLabel(item._level || item.level || "N5"),
      part: getMatchPartValue(item),
      reading: getMatchReading(item),
      meaning: getMatchMeaning(item)
    }))
    .filter((item) => item.id && item.reading && item.meaning)
    .filter(
      (item, index, pool) =>
        pool.findIndex(
          (candidate) =>
            candidate.reading === item.reading &&
            candidate.meaning === item.meaning
        ) === index
    );
}

function getBaseMatchPool(level = matchPreferences.level) {
  return buildMatchPool(getMatchSource(level));
}

function getAvailableMatchParts(items = getBaseMatchPool()) {
  const counts = new Map();

  items.forEach((item) => {
    const part = normalizeMatchText(item.part);

    if (!part) {
      return;
    }

    counts.set(part, (counts.get(part) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value, "ko"));
}

function getMatchPartFilter(value = matchPreferences.part, items = getBaseMatchPool()) {
  const normalizedPart = normalizeMatchText(value);

  if (!normalizedPart || normalizedPart === "all") {
    return "all";
  }

  const exists = getAvailableMatchParts(items).some((item) => item.value === normalizedPart);
  return exists ? normalizedPart : "all";
}

function filterMatchPool(items, filter = matchPreferences.filter, part = matchPreferences.part) {
  if (!Array.isArray(items)) {
    return [];
  }

  const activeFilter = getMatchFilter(filter);
  const activePart = getMatchPartFilter(part, items);
  const { reviewIds, masteredIds } = getMatchStudyBuckets();
  const filteredByPart =
    activePart === "all" ? items : items.filter((item) => normalizeMatchText(item.part) === activePart);

  if (activeFilter === "review") {
    return filteredByPart.filter((item) => reviewIds.includes(item.id));
  }

  if (activeFilter === "mastered") {
    return filteredByPart.filter((item) => masteredIds.includes(item.id));
  }

  if (activeFilter === "unmarked") {
    return filteredByPart.filter((item) => !reviewIds.includes(item.id) && !masteredIds.includes(item.id));
  }

  return filteredByPart;
}

function getMatchFilterCounts(items = getBaseMatchPool()) {
  const activePart = getMatchPartFilter(matchPreferences.part, items);
  return {
    all: filterMatchPool(items, "all", activePart).length,
    review: filterMatchPool(items, "review", activePart).length,
    mastered: filterMatchPool(items, "mastered", activePart).length,
    unmarked: filterMatchPool(items, "unmarked", activePart).length
  };
}

const matchState = {
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
  timeLeft: getMatchDuration(),
  hasStarted: false,
  showResults: false,
  resultFilter: "all"
};

let matchPool = [];

const matchEngine = sharedMatchGame.createMatchGameEngine({
  state: matchState,
  pageSize: matchPageSize,
  wrongFlashDuration: matchWrongFlashDuration,
  pageTransitionDelay: matchPageTransitionDelay,
  getDuration: () => getMatchDuration(matchPreferences.duration),
  getDefaultSessionItems: buildMatchSessionItems,
  mapResultItem: (item) => ({
    id: item.id,
    level: item.level,
    reading: item.reading,
    meaning: item.meaning
  }),
  buildCardsFromPageItems: (pageItems) => ({
    leftCards: sharedMatchGame.shuffleItems(
      pageItems.map((item) => ({
        id: item.id,
        value: item.reading,
        side: "left"
      }))
    ),
    rightCards: sharedMatchGame.shuffleItems(
      pageItems.map((item) => ({
        id: item.id,
        value: item.meaning,
        side: "right"
      }))
    )
  }),
  onRender: renderMatchScreen,
  onSetActionAvailability: setMatchActionAvailability,
  onSetFeedback: setMatchFeedback,
  onUnavailable: () => {
    renderMatchUnavailableState("매칭할 단어 데이터가 없어서 시작할 수 없어요.");
  },
  onPageOpened: ({ isInitialPage }) => {
    if (isInitialPage) {
      scrollMatchBoardIntoView();
    }
  },
  getTimeoutMessage: ({ isFinalPage }) => {
    if (isFinalPage) {
      return "시간이 끝났어요. 결과에서 맞춘 단어와 놓친 단어를 확인해봐요.";
    }

    return "시간이 끝났어요. 다음 묶음으로 넘어갈게요.";
  }
});

matchPreferences.level = getMatchLevel(matchPreferences.level);
matchPreferences.filter = getMatchFilter(matchPreferences.filter);
matchPreferences.part = getMatchPartFilter(matchPreferences.part, getBaseMatchPool(matchPreferences.level));
matchPreferences.totalCount = getMatchTotalCount(matchPreferences.totalCount);
matchPreferences.duration = getMatchDuration(matchPreferences.duration);
matchPreferences.optionsOpen = false;

function clearMatchTransitionTimer() {
  matchEngine.clearTransitionTimer();
}

function stopMatchRoundTimer() {
  matchEngine.stopRoundTimer();
}

function clearWrongMatchTimer() {
  matchEngine.clearWrongMatchTimer();
}

function clearAllMatchTimers() {
  matchEngine.clearAllTimers();
}

function refreshMatchPool() {
  const basePool = getBaseMatchPool(matchPreferences.level);
  matchPreferences.part = getMatchPartFilter(matchPreferences.part, basePool);
  matchPool = filterMatchPool(basePool, matchPreferences.filter, matchPreferences.part);
}

function getMatchPageCount() {
  return matchEngine.getPageCount();
}

function getMatchResolvedCount() {
  return matchEngine.getResolvedCount();
}

function getMatchResultCounts() {
  return matchEngine.getResultCounts();
}

function setMatchResultStatus(ids, status) {
  matchEngine.setResultStatus(ids, status);
}

function resetMatchResultStatus(ids) {
  setMatchResultStatus(ids, "pending");
}

function getCurrentPageItems(pageIndex = matchState.pageIndex) {
  return matchEngine.getCurrentPageItems(pageIndex);
}

function resetSelectedCards() {
  matchEngine.resetSelectedCards();
}

function resetCurrentPageState() {
  matchEngine.resetCurrentPageState();
}

function setMatchFeedback(message, tone = "") {
  sharedMatchGame.setFeedbackById("match-feedback", message, tone);
}

function renderMatchActionCopy() {
  sharedMatchGame.renderActionCopy({
    buttonId: "match-new-round",
    labelId: "match-new-round-label",
    isResetState: matchState.hasStarted || matchState.showResults
  });
}

function renderMatchTimer() {
  const activeDuration = getMatchDuration(matchPreferences.duration);

  sharedMatchGame.renderTimer({
    timerId: "match-timer",
    duration: activeDuration,
    timeLeft: matchState.timeLeft,
    timerState: matchState
  });
}

function renderMatchStats() {
  const totalCount = matchState.sessionItems.length || getMatchTotalCount(matchPreferences.totalCount);

  sharedMatchGame.renderStats({
    progressId: "match-progress",
    resolvedCount: getMatchResolvedCount(),
    totalCount,
    renderTimer: renderMatchTimer
  });
}

function populateMatchFilterSelect(select, counts) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  matchFilterOptions.forEach((filter) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${matchFilterLabels[filter]} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getMatchFilter(matchPreferences.filter);
}

function populateMatchPartSelect(select, parts, activePart) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  [{ value: "all", count: parts.reduce((sum, item) => sum + item.count, 0) }, ...parts].forEach((partOption) => {
    const option = document.createElement("option");
    const label = partOption.value === "all" ? "전체 품사" : partOption.value;
    option.value = partOption.value;
    option.textContent = `${label} (${partOption.count})`;
    select.appendChild(option);
  });

  select.value = activePart;
}

function renderMatchSettings() {
  const levelSelect = document.getElementById("match-level-select");
  const filterSelect = document.getElementById("match-filter-select");
  const partSelect = document.getElementById("match-part-select");
  const countSpinner = document.querySelector('[data-spinner-id="match-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="match-time"]');
  const basePool = getBaseMatchPool(matchPreferences.level);
  const filterCounts = getMatchFilterCounts(basePool);
  const activePart = getMatchPartFilter(matchPreferences.part, basePool);
  const availableParts = getAvailableMatchParts(basePool);
  const isSettingsLocked = matchState.hasStarted && !matchState.showResults;

  sharedMatchGame.renderStandardMatchSettings({
    optionsShellId: "match-options-shell",
    optionsToggleId: "match-options-toggle",
    optionsPanelId: "match-options-panel",
    optionsSummaryId: "match-options-summary",
    summaryText: getMatchOptionsSummaryText(),
    isSettingsLocked,
    optionsOpen: matchPreferences.optionsOpen,
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => {
          if (element) {
            element.value = getMatchLevel(matchPreferences.level);
          }
        },
        disabled: isSettingsLocked
      },
      {
        element: filterSelect,
        populate: (element) => populateMatchFilterSelect(element, filterCounts),
        disabled: isSettingsLocked
      },
      {
        element: partSelect,
        populate: (element) => populateMatchPartSelect(element, availableParts, activePart),
        disabled: isSettingsLocked
      }
    ],
    countSpinner,
    countOptions: matchTotalCountOptions,
    countValue: getMatchTotalCount(matchPreferences.totalCount),
    countFormatValue: (value) => `${value}문제`,
    timeSpinner,
    timeOptions: matchDurationOptions,
    timeValue: getMatchDuration(matchPreferences.duration),
    timeFormatValue: getMatchDurationLabel,
    refreshPool: refreshMatchPool,
    updateActionAvailability: () => {
      setMatchActionAvailability(matchPool.length > 0);
    }
  });
}

function setMatchActionAvailability(startEnabled) {
  sharedMatchGame.setActionAvailabilityById("match-new-round", startEnabled);
}

function scrollMatchBoardIntoView() {
  sharedMatchGame.scrollElementIntoViewById("match-board");
}

const createMatchCard = sharedMatchGame.createMatchCard({
  state: matchState,
  onSelection: handleMatchSelection
});

function renderMatchBoard() {
  sharedMatchGame.renderBoard({
    leftListId: "match-left-list",
    rightListId: "match-right-list",
    leftCards: matchState.leftCards,
    rightCards: matchState.rightCards,
    selectedLeft: matchState.selectedLeft,
    selectedRight: matchState.selectedRight,
    createCard: createMatchCard,
    renderStats: renderMatchStats
  });
}

function getFilteredMatchResults(filter = getMatchResultFilter(matchState.resultFilter)) {
  return matchEngine.getFilteredResults(filter);
}

function renderMatchBulkActionButtons(results) {
  const reviewActionButton = document.getElementById("match-result-bulk-action");
  const reviewActionLabel = document.getElementById("match-result-bulk-label");
  const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
  const masteredActionButton = document.getElementById("match-result-mastered-action");
  const masteredActionLabel = document.getElementById("match-result-mastered-label");
  const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");
  const uniqueIds = Array.from(new Set(results.map((item) => item.id).filter(Boolean)));

  if (reviewActionButton && reviewActionLabel && reviewActionIcon) {
    const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isWordSavedToMemorizationList(id));

    sharedMatchGame.renderBulkActionButtonState({
      button: reviewActionButton,
      label: reviewActionLabel,
      icon: reviewActionIcon,
      count: uniqueIds.length,
      allSaved,
      datasetKey: "matchBulkAction",
      getActionLabel: () => allSaved ? "다시 보기 해제" : "모두 다시 보기",
      getActionTitle: ({ count, allSaved: savedState }) =>
        count === 0
          ? "지금 표시 중인 단어가 없어요."
          : savedState
            ? "지금 보이는 단어의 다시 보기 표시를 모두 해제해요."
            : "지금 보이는 단어를 모두 다시 볼 항목으로 표시해요."
    });
  }

  if (masteredActionButton && masteredActionLabel && masteredActionIcon) {
    const allMastered = uniqueIds.length > 0 && uniqueIds.every((id) => isWordSavedToMasteredList(id));

    sharedMatchGame.renderBulkActionButtonState({
      button: masteredActionButton,
      label: masteredActionLabel,
      icon: masteredActionIcon,
      count: uniqueIds.length,
      allSaved: allMastered,
      datasetKey: "matchMasteredBulkAction",
      getActionLabel: () => allMastered ? "익힘 해제" : "모두 익히기",
      getActionTitle: ({ count, allSaved: savedState }) =>
        count === 0
          ? "지금 표시 중인 단어가 없어요."
          : savedState
            ? "지금 보이는 단어의 익힘 표시를 모두 해제해요."
            : "지금 보이는 단어를 모두 익힘으로 표시해요."
    });

    masteredActionIcon.textContent = allMastered ? "remove_done" : "check_circle";
  }
}

function renderMatchResults() {
  const counts = getMatchResultCounts();
  const filteredResults = getFilteredMatchResults();

  sharedMatchGame.renderResultsView({
    resultViewId: "match-result-view",
    totalId: "match-result-total",
    correctId: "match-result-correct",
    wrongId: "match-result-wrong",
    emptyId: "match-result-empty",
    listId: "match-result-list",
    bulkActionButtonId: "match-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getMatchResultFilter(matchState.resultFilter),
    filterLabels: matchResultFilterLabels,
    renderBulkActionButton: renderMatchBulkActionButtons,
    renderItems: (results, container) => {
      results.forEach((item) => {
        const reviewSelected = isWordSavedToMemorizationList(item.id);
        const masteredSelected = isWordSavedToMasteredList(item.id);

        sharedMatchGame.appendResultItem({
          container,
          status: item.status,
          levelText: formatMatchLevelLabel(item.level),
          titleText: item.reading,
          descriptionText: item.meaning,
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? "다시 보기 해제" : "다시 보기로 표시",
              datasetName: "matchReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? "익힘 해제" : "익힘으로 표시",
              datasetName: "matchMastered",
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

function renderMatchScreen() {
  sharedMatchGame.renderScreen({
    boardId: "match-board",
    emptyId: "match-empty",
    playViewId: "match-play-view",
    resultViewId: "match-result-view",
    feedbackId: "match-feedback",
    hasStarted: matchState.hasStarted,
    showResults: matchState.showResults,
    isReady: matchPool.length > 0,
    emptyReadyText: matchReadyStateText.ready,
    emptyUnavailableText: matchReadyStateText.unavailable,
    renderSettings: renderMatchSettings,
    renderActionCopy: renderMatchActionCopy,
    renderStats: renderMatchStats,
    renderResults: renderMatchResults,
    renderBoard: renderMatchBoard
  });
}

function startMatchRoundTimer() {
  matchEngine.startRoundTimer();
}

function enterMatchReadyState(message = "") {
  refreshMatchPool();
  setMatchActionAvailability(matchPool.length > 0);
  matchEngine.enterReadyState(message);
}

function openMatchPage(pageItems) {
  matchEngine.openPage(pageItems);
}

function showMatchResults() {
  matchEngine.showResults();
}

function moveToNextMatchPage() {
  matchEngine.moveToNextPage();
}

function buildMatchSessionItems() {
  refreshMatchPool();
  return sharedMatchGame.createSessionItems(matchPool, getMatchTotalCount(matchPreferences.totalCount));
}

function startMatchSession(items = buildMatchSessionItems()) {
  matchEngine.startSession(items);
}

function replayCurrentMatchPage() {
  matchEngine.replayCurrentPage();
}

function replayCurrentMatchSet() {
  matchEngine.replayCurrentSet();
}

function renderMatchUnavailableState(message) {
  sharedMatchGame.renderUnavailableState({
    leftListId: "match-left-list",
    rightListId: "match-right-list",
    resultListId: "match-result-list",
    resultEmptyId: "match-result-empty",
    state: matchState,
    engine: matchEngine,
    setActionAvailability: setMatchActionAvailability,
    setFeedback: setMatchFeedback,
    renderScreen: renderMatchScreen,
    message
  });
}

function handleMatchSelection(card) {
  matchEngine.handleSelection(card);
}

function handleMatchTimeout() {
  matchEngine.handleTimeout();
}

function startNewMatchSession() {
  matchEngine.startNewSession();
}

function setMatchLevel(level) {
  const nextLevel = getMatchLevel(level);

  if (matchPreferences.level === nextLevel) {
    return;
  }

  matchPreferences.level = nextLevel;
  matchPreferences.part = getMatchPartFilter(matchPreferences.part, getBaseMatchPool(nextLevel));
  saveMatchPreferences();
  renderMatchSettings();
  enterMatchReadyState();
}

const setMatchFilterPreference = sharedMatchGame.createPreferenceHandler({
  preferences: matchPreferences,
  key: "filter",
  normalize: getMatchFilter,
  savePreferences: saveMatchPreferences,
  renderSettings: renderMatchSettings,
  enterReadyState: enterMatchReadyState
});

function setMatchPartPreference(part) {
  const nextPart = getMatchPartFilter(part, getBaseMatchPool(matchPreferences.level));

  if (matchPreferences.part === nextPart) {
    return;
  }

  matchPreferences.part = nextPart;
  saveMatchPreferences();
  renderMatchSettings();
  enterMatchReadyState();
}

const setMatchTotalCount = sharedMatchGame.createPreferenceHandler({
  preferences: matchPreferences,
  key: "totalCount",
  normalize: getMatchTotalCount,
  savePreferences: saveMatchPreferences,
  renderSettings: renderMatchSettings,
  enterReadyState: enterMatchReadyState
});

const setMatchDuration = sharedMatchGame.createPreferenceHandler({
  preferences: matchPreferences,
  key: "duration",
  normalize: getMatchDuration,
  savePreferences: saveMatchPreferences,
  renderSettings: renderMatchSettings,
  enterReadyState: enterMatchReadyState
});

const setMatchResultFilter = sharedMatchGame.createResultFilterHandler({
  state: matchState,
  normalize: getMatchResultFilter,
  renderResults: renderMatchResults
});

function handleMatchResetAction() {
  if (matchState.showResults) {
    replayCurrentMatchSet();
    return;
  }

  replayCurrentMatchPage();
}

function attachMatchEventListeners() {
  const newRound = document.getElementById("match-new-round");
  const optionsToggle = document.getElementById("match-options-toggle");
  const levelSelect = document.getElementById("match-level-select");
  const filterSelect = document.getElementById("match-filter-select");
  const partSelect = document.getElementById("match-part-select");
  const countSpinner = document.querySelector('[data-spinner-id="match-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="match-time"]');
  const resultFilterButtons = document.querySelectorAll("#match-result-view [data-result-filter]");
  const resultBulkAction = document.getElementById("match-result-bulk-action");
  const resultMasteredAction = document.getElementById("match-result-mastered-action");
  const resultList = document.getElementById("match-result-list");

  sharedMatchGame.attachStandardMatchEventListeners({
    newRoundButton: newRound,
    onStartNewRound: startNewMatchSession,
    optionsToggleButton: optionsToggle,
    onToggleOptions: () => {
      matchPreferences.optionsOpen = !matchPreferences.optionsOpen;
      saveMatchPreferences();
      renderMatchSettings();
    },
    selectConfigs: [
      { element: levelSelect, handler: setMatchLevel },
      { element: filterSelect, handler: setMatchFilterPreference },
      { element: partSelect, handler: setMatchPartPreference }
    ],
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: matchTotalCountOptions,
        getCurrentValue: () => getMatchTotalCount(matchPreferences.totalCount),
        handler: setMatchTotalCount
      },
      {
        spinner: timeSpinner,
        options: matchDurationOptions,
        getCurrentValue: () => getMatchDuration(matchPreferences.duration),
        handler: setMatchDuration
      }
    ],
    resultFilterButtons,
    onResultFilterChange: setMatchResultFilter,
    bulkActionConfig: {
      button: resultBulkAction,
      datasetKey: "matchBulkAction",
      getFilteredResults: getFilteredMatchResults,
      getItemId: (item) => item.id,
      onRemove: removeWordFromMemorizationList,
      onSave: saveWordToMemorizationList,
      afterChange: renderMatchResults
    },
    resultSaveConfig: {
      list: resultList,
      buttonSelector: "[data-match-review]",
      getItemId: (button) => button.dataset.matchReview,
      isSaved: isWordSavedToMemorizationList,
      onRemove: removeWordFromMemorizationList,
      onSave: saveWordToMemorizationList,
      afterChange: renderMatchResults
    }
  });

  sharedMatchGame.attachBulkActionListener({
    button: resultMasteredAction,
    datasetKey: "matchMasteredBulkAction",
    getFilteredResults: getFilteredMatchResults,
    getItemId: (item) => item.id,
    onRemove: removeWordFromMasteredList,
    onSave: saveWordToMasteredList,
    afterChange: renderMatchResults
  });
  sharedMatchGame.attachResultSaveListener({
    list: resultList,
    buttonSelector: "[data-match-mastered]",
    getItemId: (button) => button.dataset.matchMastered,
    isSaved: isWordSavedToMasteredList,
    onRemove: removeWordFromMasteredList,
    onSave: saveWordToMasteredList,
    afterChange: renderMatchResults
  });
}

sharedMatchGame.initializeStandardMatchScreen({
  guardElement: document.getElementById("match-new-round"),
  renderSettings: renderMatchSettings,
  renderActionCopy: renderMatchActionCopy,
  attachEventListeners: attachMatchEventListeners,
  storageHandlers: {
    [matchStorageKey]: () => {
      const nextPreferences = loadMatchPreferences();
      // 원격 동기화 응답이 와도, 지금 사용자가 보고 있는 설정 패널은
      // 닫지 않고 유지해야 연속으로 옵션을 조정할 수 있다.
      nextPreferences.optionsOpen = matchPreferences.optionsOpen === true;
      sharedMatchGame.replaceObjectContents(matchPreferences, nextPreferences);
      renderMatchSettings();
      enterMatchReadyState();
    },
    [studyStateStorageKey]: () => {
      renderMatchSettings();
      enterMatchReadyState();
    }
  },
  windowListeners: [
    {
      eventName: "japanote:vocab-loaded",
      handler: () => {
        renderMatchSettings();
        enterMatchReadyState();
      }
    }
  ],
  enterReadyState: enterMatchReadyState
});
