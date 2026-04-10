(function (global) {
  const sharedMatchGame = global.japanoteSharedMatchGame;

  if (!sharedMatchGame) {
    return;
  }

  const grammarMatchStorageKey = "japanote-grammar-match-state";
  const grammarStudyStateStorageKey = "jlpt-compass-state";
  const matchCopy = global.japanoteMatchCopy || {};
  const grammarStudyList = sharedMatchGame.createStudyListManager({
    storageKey: grammarStudyStateStorageKey,
    reviewKey: "grammarReviewIds",
    masteredKey: "grammarMasteredIds"
  });

  const grammarMatchSourceLevels = ["N5", "N4", "N3"];
  const grammarMatchLevelOptions = [...grammarMatchSourceLevels, "all"];
  const grammarMatchDurationOptions = [10, 15, 20, 0];
  const grammarMatchTotalCountOptions = [5, 10, 15, 20];
  const grammarMatchFilterOptions = ["all", "review", "mastered", "unmarked"];
  const grammarMatchResultFilterOptions = ["all", "correct", "wrong"];
  const defaultGrammarMatchPreferences = {
    level: "N5",
    filter: "all",
    totalCount: 5,
    duration: 15,
    optionsOpen: false
  };
  const grammarMatchState = {
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
    timeLeft: 15,
    hasStarted: false,
    showResults: false,
    resultFilter: "all"
  };
  const grammarMatchResultFilterLabels = matchCopy.resultFilterLabels || {
    all: "전체",
    correct: "정답",
    wrong: "오답"
  };
  const grammarMatchFilterLabels = matchCopy.studyFilterLabels || {
    all: "전체",
    review: "다시 볼래요",
    mastered: "익혔어요",
    unmarked: "아직 안 골랐어요"
  };
  const grammarMatchReadyStateText =
    typeof matchCopy.getReadyStateText === "function"
      ? matchCopy.getReadyStateText()
      : {
          ready: "준비되면 시작해볼까요?",
          unavailable: "지금은 준비 중이에요."
        };

  const grammarMatchPreferences = sharedMatchGame.loadStoredObject(
    grammarMatchStorageKey,
    defaultGrammarMatchPreferences
  );
  const saveGrammarToReviewList = grammarStudyList.saveToReviewList;
  const removeGrammarFromReviewList = grammarStudyList.removeFromReviewList;
  const isGrammarSavedToReviewList = grammarStudyList.isInReviewList;
  const saveGrammarToMasteredList = grammarStudyList.saveToMasteredList;
  const removeGrammarFromMasteredList = grammarStudyList.removeFromMasteredList;
  const isGrammarSavedToMasteredList = grammarStudyList.isInMasteredList;
  let grammarMatchPool = [];

  function normalizeGrammarMatchText(value) {
    return sharedMatchGame.normalizeText(value);
  }

  function saveGrammarMatchPreferences() {
    sharedMatchGame.saveStoredObject(grammarMatchStorageKey, grammarMatchPreferences);
  }

  function getGrammarMatchStudyBuckets() {
    return grammarStudyList.getBuckets();
  }

  function getGrammarMatchLevel(value = grammarMatchPreferences.level) {
    const normalizedValue = normalizeGrammarMatchText(value).toUpperCase();
    if (normalizedValue === "ALL") {
      return "all";
    }
    return grammarMatchLevelOptions.includes(normalizedValue) ? normalizedValue : "N5";
  }

  function getGrammarMatchLevelLabel(level = grammarMatchPreferences.level) {
    const activeLevel = getGrammarMatchLevel(level);
    return activeLevel === "all" ? "전체" : activeLevel;
  }

  function getGrammarMatchFilter(value = grammarMatchPreferences.filter) {
    return grammarMatchFilterOptions.includes(value) ? value : "all";
  }

  function getGrammarMatchTotalCount(value = grammarMatchPreferences.totalCount) {
    const numericValue = Number(value);
    return grammarMatchTotalCountOptions.includes(numericValue) ? numericValue : 5;
  }

  function getGrammarMatchDuration(value = grammarMatchPreferences.duration) {
    const numericValue = Number(value);
    return grammarMatchDurationOptions.includes(numericValue) ? numericValue : 15;
  }

  function getGrammarMatchDurationLabel(duration = grammarMatchPreferences.duration) {
    if (typeof matchCopy.formatDurationLabel === "function") {
      return matchCopy.formatDurationLabel(duration);
    }

    const activeDuration = Number(duration);
    return activeDuration <= 0 ? "천천히" : `${activeDuration}초`;
  }

  function getGrammarMatchResultFilter(value = grammarMatchState.resultFilter) {
    return grammarMatchResultFilterOptions.includes(value) ? value : "all";
  }

  function getGrammarMatchOptionsSummaryText() {
    const summaryItems = [
      grammarMatchFilterLabels[getGrammarMatchFilter()] || grammarMatchFilterLabels.all,
      getGrammarMatchLevelLabel(),
      `${getGrammarMatchTotalCount()}문제`,
      getGrammarMatchDurationLabel()
    ];

    return typeof matchCopy.joinSummaryItems === "function" ? matchCopy.joinSummaryItems(summaryItems) : summaryItems.join(" · ");
  }

  function getBaseGrammarMatchPool() {
    const items = Array.isArray(globalThis.JAPANOTE_GRAMMAR_ITEMS) ? globalThis.JAPANOTE_GRAMMAR_ITEMS : [];

    return items
      .map((item, index) => {
        const level = normalizeGrammarMatchText(item?.level).toUpperCase();
        const pattern = normalizeGrammarMatchText(item?.pattern);
        const description = normalizeGrammarMatchText(item?.description);
        const id = normalizeGrammarMatchText(item?.id || `grammar-${level || "item"}-${index + 1}`);

        if (!grammarMatchSourceLevels.includes(level) || !pattern || !description) {
          return null;
        }

        return {
          id,
          level,
          levelLabel: getGrammarMatchLevelLabel(level),
          pattern,
          description
        };
      })
      .filter(Boolean)
      .filter(
        (item, index, pool) =>
          pool.findIndex(
            (candidate) => candidate.pattern === item.pattern && candidate.description === item.description
          ) === index
      );
  }

  function filterGrammarMatchPool(items, filter = grammarMatchPreferences.filter, level = grammarMatchPreferences.level) {
    if (!Array.isArray(items)) {
      return [];
    }

    const activeFilter = getGrammarMatchFilter(filter);
    const activeLevel = getGrammarMatchLevel(level);
    const { reviewIds, masteredIds } = getGrammarMatchStudyBuckets();
    const filteredByLevel = activeLevel === "all" ? items : items.filter((item) => item.level === activeLevel);

    if (activeFilter === "review") {
      return filteredByLevel.filter((item) => reviewIds.includes(item.id));
    }

    if (activeFilter === "mastered") {
      return filteredByLevel.filter((item) => masteredIds.includes(item.id));
    }

    if (activeFilter === "unmarked") {
      return filteredByLevel.filter((item) => !reviewIds.includes(item.id) && !masteredIds.includes(item.id));
    }

    return filteredByLevel;
  }

  function getGrammarMatchFilterCounts(items = getBaseGrammarMatchPool()) {
    const activeLevel = getGrammarMatchLevel(grammarMatchPreferences.level);
    return {
      all: filterGrammarMatchPool(items, "all", activeLevel).length,
      review: filterGrammarMatchPool(items, "review", activeLevel).length,
      mastered: filterGrammarMatchPool(items, "mastered", activeLevel).length,
      unmarked: filterGrammarMatchPool(items, "unmarked", activeLevel).length
    };
  }

  function getGrammarMatchLevelCounts(items = getBaseGrammarMatchPool()) {
    const counts = grammarMatchLevelOptions.reduce((map, level) => ({ ...map, [level]: 0 }), {});
    const activeFilter = getGrammarMatchFilter(grammarMatchPreferences.filter);
    const { reviewIds, masteredIds } = getGrammarMatchStudyBuckets();
    const filteredByCollection =
      activeFilter === "review"
        ? items.filter((item) => reviewIds.includes(item.id))
        : activeFilter === "mastered"
          ? items.filter((item) => masteredIds.includes(item.id))
          : activeFilter === "unmarked"
            ? items.filter((item) => !reviewIds.includes(item.id) && !masteredIds.includes(item.id))
            : items;

    counts.all = filteredByCollection.length;
    filteredByCollection.forEach((item) => {
      counts[item.level] = (counts[item.level] || 0) + 1;
    });
    return counts;
  }

  function populateGrammarMatchLevelSelect(select, counts) {
    if (!select) {
      return;
    }

    select.innerHTML = "";
    grammarMatchLevelOptions.forEach((level) => {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = level === "all" ? `전체 (${counts[level] ?? 0})` : `${level} (${counts[level] ?? 0})`;
      select.appendChild(option);
    });
    select.value = getGrammarMatchLevel(grammarMatchPreferences.level);
  }

  function populateGrammarMatchFilterSelect(select, counts) {
    if (!select) {
      return;
    }

    select.innerHTML = "";
    grammarMatchFilterOptions.forEach((filter) => {
      const option = document.createElement("option");
      option.value = filter;
      option.textContent = `${grammarMatchFilterLabels[filter]} (${counts[filter] ?? 0})`;
      select.appendChild(option);
    });
    select.value = getGrammarMatchFilter(grammarMatchPreferences.filter);
  }

  function refreshGrammarMatchPool() {
    grammarMatchPool = filterGrammarMatchPool(
      getBaseGrammarMatchPool(),
      grammarMatchPreferences.filter,
      grammarMatchPreferences.level
    );
  }

  const grammarMatchEngine = sharedMatchGame.createMatchGameEngine({
    state: grammarMatchState,
    pageSize: 5,
    wrongFlashDuration: 520,
    pageTransitionDelay: 720,
    getDuration: () => getGrammarMatchDuration(grammarMatchPreferences.duration),
    getDefaultSessionItems: buildGrammarMatchSessionItems,
    mapResultItem: (item) => ({
      id: item.id,
      levelLabel: item.levelLabel,
      pattern: item.pattern,
      description: item.description
    }),
    buildCardsFromPageItems: (pageItems) => ({
      leftCards: sharedMatchGame.shuffleItems(pageItems.map((item) => ({ id: item.id, value: item.pattern, side: "left" }))),
      rightCards: sharedMatchGame.shuffleItems(pageItems.map((item) => ({ id: item.id, value: item.description, side: "right" })))
    }),
    onRender: renderGrammarMatchScreen,
    onSetActionAvailability: setGrammarMatchActionAvailability,
    onSetFeedback: (message, tone = "") => sharedMatchGame.setFeedbackById("grammar-match-feedback", message, tone),
    onUnavailable: () => renderGrammarMatchUnavailableState("지금 선택한 조건에 맞는 문법이 없어요."),
    onPageOpened: ({ isInitialPage }) => {
      if (isInitialPage) {
        sharedMatchGame.scrollElementIntoViewById("grammar-match-board");
      }
    },
    getTimeoutMessage: ({ isFinalPage }) =>
      isFinalPage
        ? "시간이 끝났어요. 결과에서 맞춘 문법과 놓친 문법을 확인해봐요."
        : "시간이 끝났어요. 다음 묶음으로 넘어갈게요."
  });

  grammarMatchPreferences.level = getGrammarMatchLevel(grammarMatchPreferences.level);
  grammarMatchPreferences.filter = getGrammarMatchFilter(grammarMatchPreferences.filter);
  grammarMatchPreferences.totalCount = getGrammarMatchTotalCount(grammarMatchPreferences.totalCount);
  grammarMatchPreferences.duration = getGrammarMatchDuration(grammarMatchPreferences.duration);
  grammarMatchPreferences.optionsOpen = false;
  grammarMatchState.timeLeft = grammarMatchPreferences.duration;

  const createGrammarMatchCard = sharedMatchGame.createMatchCard({
    state: grammarMatchState,
    onSelection: (card) => grammarMatchEngine.handleSelection(card)
  });

  function setGrammarMatchActionAvailability(startEnabled) {
    sharedMatchGame.setActionAvailabilityById("grammar-match-new-round", startEnabled);
  }

  function renderGrammarMatchActionCopy() {
    sharedMatchGame.renderActionCopy({
      buttonId: "grammar-match-new-round",
      labelId: "grammar-match-new-round-label",
      isResetState: grammarMatchState.hasStarted || grammarMatchState.showResults
    });
  }

  function renderGrammarMatchStats() {
    sharedMatchGame.renderStats({
      progressId: "grammar-match-progress",
      resolvedCount: grammarMatchEngine.getResolvedCount(),
      totalCount: grammarMatchState.sessionItems.length || getGrammarMatchTotalCount(grammarMatchPreferences.totalCount),
      renderTimer: () =>
        sharedMatchGame.renderTimer({
          timerId: "grammar-match-timer",
          duration: getGrammarMatchDuration(grammarMatchPreferences.duration),
          timeLeft: grammarMatchState.timeLeft,
          timerState: grammarMatchState
        })
    });
  }

  function renderGrammarMatchSettings() {
    const basePool = getBaseGrammarMatchPool();
    const isSettingsLocked = grammarMatchState.hasStarted && !grammarMatchState.showResults;

    sharedMatchGame.renderStandardMatchSettings({
      optionsShellId: "grammar-match-options-shell",
      optionsToggleId: "grammar-match-options-toggle",
      optionsPanelId: "grammar-match-options-panel",
      optionsSummaryId: "grammar-match-options-summary",
      summaryText: getGrammarMatchOptionsSummaryText(),
      isSettingsLocked,
      optionsOpen: grammarMatchPreferences.optionsOpen,
      selectConfigs: [
        {
          element: document.getElementById("grammar-match-level-select"),
          populate: (element) => populateGrammarMatchLevelSelect(element, getGrammarMatchLevelCounts(basePool)),
          disabled: isSettingsLocked
        },
        {
          element: document.getElementById("grammar-match-filter-select"),
          populate: (element) => populateGrammarMatchFilterSelect(element, getGrammarMatchFilterCounts(basePool)),
          disabled: isSettingsLocked
        }
      ],
      countSpinner: document.querySelector('[data-spinner-id="grammar-match-count"]'),
      countOptions: grammarMatchTotalCountOptions,
      countValue: getGrammarMatchTotalCount(grammarMatchPreferences.totalCount),
      countFormatValue: (value) => `${value}문제`,
      timeSpinner: document.querySelector('[data-spinner-id="grammar-match-time"]'),
      timeOptions: grammarMatchDurationOptions,
      timeValue: getGrammarMatchDuration(grammarMatchPreferences.duration),
      timeFormatValue: getGrammarMatchDurationLabel,
      refreshPool: refreshGrammarMatchPool,
      updateActionAvailability: () => setGrammarMatchActionAvailability(grammarMatchPool.length > 0)
    });
  }

  function getFilteredGrammarMatchResults(filter = getGrammarMatchResultFilter(grammarMatchState.resultFilter)) {
    return grammarMatchEngine.getFilteredResults(filter);
  }

  function renderGrammarMatchBulkActionButtons(results) {
    const reviewActionButton = document.getElementById("grammar-match-result-bulk-action");
    const reviewActionLabel = document.getElementById("grammar-match-result-bulk-label");
    const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
    const masteredActionButton = document.getElementById("grammar-match-result-mastered-action");
    const masteredActionLabel = document.getElementById("grammar-match-result-mastered-label");
    const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");
    const uniqueIds = Array.from(new Set(results.map((item) => item.id).filter(Boolean)));

    if (reviewActionButton && reviewActionLabel && reviewActionIcon) {
      const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isGrammarSavedToReviewList(id));
      sharedMatchGame.renderBulkActionButtonState({
        button: reviewActionButton,
        label: reviewActionLabel,
        icon: reviewActionIcon,
        count: uniqueIds.length,
        allSaved,
        datasetKey: "grammarMatchBulkAction",
        getActionLabel: () => allSaved ? "다시 보기 해제" : "모두 다시 보기",
        getActionTitle: ({ count, allSaved: savedState }) =>
          count === 0 ? "지금 표시 중인 문법이 없어요." : savedState ? "지금 보이는 문법의 다시 보기 표시를 모두 해제해요." : "지금 보이는 문법을 모두 다시 볼 항목으로 표시해요."
      });
    }

    if (masteredActionButton && masteredActionLabel && masteredActionIcon) {
      const allMastered = uniqueIds.length > 0 && uniqueIds.every((id) => isGrammarSavedToMasteredList(id));
      sharedMatchGame.renderBulkActionButtonState({
        button: masteredActionButton,
        label: masteredActionLabel,
        icon: masteredActionIcon,
        count: uniqueIds.length,
        allSaved: allMastered,
        datasetKey: "grammarMatchMasteredBulkAction",
        getActionLabel: () => allMastered ? "익힘 해제" : "모두 익히기",
        getActionTitle: ({ count, allSaved: savedState }) =>
          count === 0 ? "지금 표시 중인 문법이 없어요." : savedState ? "지금 보이는 문법의 익힘 표시를 모두 해제해요." : "지금 보이는 문법을 모두 익힘으로 표시해요."
      });
      masteredActionIcon.textContent = allMastered ? "remove_done" : "check_circle";
    }
  }

  function renderGrammarMatchResults() {
    sharedMatchGame.renderResultsView({
      resultViewId: "grammar-match-result-view",
      totalId: "grammar-match-result-total",
      correctId: "grammar-match-result-correct",
      wrongId: "grammar-match-result-wrong",
      emptyId: "grammar-match-result-empty",
      listId: "grammar-match-result-list",
      bulkActionButtonId: "grammar-match-result-bulk-action",
      counts: grammarMatchEngine.getResultCounts(),
      filteredResults: getFilteredGrammarMatchResults(),
      activeFilter: getGrammarMatchResultFilter(grammarMatchState.resultFilter),
      filterLabels: grammarMatchResultFilterLabels,
      renderBulkActionButton: renderGrammarMatchBulkActionButtons,
      renderItems: (results, container) => {
        results.forEach((item) => {
          sharedMatchGame.appendResultItem({
            container,
            status: item.status,
            levelText: item.levelLabel,
            titleText: item.pattern,
            descriptionText: item.description,
            actionButtons: [
              {
                itemId: item.id,
                selected: isGrammarSavedToReviewList(item.id),
                actionLabel: isGrammarSavedToReviewList(item.id) ? "다시 보기 해제" : "다시 보기로 표시",
                datasetName: "grammarMatchReview",
                defaultIcon: "bookmark_add",
                selectedIcon: "delete",
                selectedClassName: "is-saved"
              },
              {
                itemId: item.id,
                selected: isGrammarSavedToMasteredList(item.id),
                actionLabel: isGrammarSavedToMasteredList(item.id) ? "익힘 해제" : "익힘으로 표시",
                datasetName: "grammarMatchMastered",
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

  function renderGrammarMatchScreen() {
    sharedMatchGame.renderScreen({
      boardId: "grammar-match-board",
      emptyId: "grammar-match-empty",
      playViewId: "grammar-match-play-view",
      resultViewId: "grammar-match-result-view",
      feedbackId: "grammar-match-feedback",
      hasStarted: grammarMatchState.hasStarted,
      showResults: grammarMatchState.showResults,
      isReady: grammarMatchPool.length > 0,
      emptyReadyText: grammarMatchReadyStateText.ready,
      emptyUnavailableText: grammarMatchReadyStateText.unavailable,
      renderSettings: renderGrammarMatchSettings,
      renderActionCopy: renderGrammarMatchActionCopy,
      renderStats: renderGrammarMatchStats,
      renderResults: renderGrammarMatchResults,
      renderBoard: () =>
        sharedMatchGame.renderBoard({
          leftListId: "grammar-match-left-list",
          rightListId: "grammar-match-right-list",
          leftCards: grammarMatchState.leftCards,
          rightCards: grammarMatchState.rightCards,
          selectedLeft: grammarMatchState.selectedLeft,
          selectedRight: grammarMatchState.selectedRight,
          createCard: createGrammarMatchCard,
          renderStats: renderGrammarMatchStats
        })
    });
  }

  function buildGrammarMatchSessionItems() {
    refreshGrammarMatchPool();
    return sharedMatchGame.createSessionItems(grammarMatchPool, getGrammarMatchTotalCount(grammarMatchPreferences.totalCount));
  }

  function renderGrammarMatchUnavailableState(message) {
    sharedMatchGame.renderUnavailableState({
      leftListId: "grammar-match-left-list",
      rightListId: "grammar-match-right-list",
      resultListId: "grammar-match-result-list",
      resultEmptyId: "grammar-match-result-empty",
      state: grammarMatchState,
      engine: grammarMatchEngine,
      setActionAvailability: setGrammarMatchActionAvailability,
      setFeedback: (feedback, tone = "") => sharedMatchGame.setFeedbackById("grammar-match-feedback", feedback, tone),
      renderScreen: renderGrammarMatchScreen,
      message
    });
  }

  const setGrammarMatchLevel = sharedMatchGame.createPreferenceHandler({
    preferences: grammarMatchPreferences,
    key: "level",
    normalize: getGrammarMatchLevel,
    savePreferences: saveGrammarMatchPreferences,
    renderSettings: renderGrammarMatchSettings,
    enterReadyState: () => grammarMatchEngine.enterReadyState()
  });
  const setGrammarMatchFilterPreference = sharedMatchGame.createPreferenceHandler({
    preferences: grammarMatchPreferences,
    key: "filter",
    normalize: getGrammarMatchFilter,
    savePreferences: saveGrammarMatchPreferences,
    renderSettings: renderGrammarMatchSettings,
    enterReadyState: () => grammarMatchEngine.enterReadyState()
  });
  const setGrammarMatchTotalCount = sharedMatchGame.createPreferenceHandler({
    preferences: grammarMatchPreferences,
    key: "totalCount",
    normalize: getGrammarMatchTotalCount,
    savePreferences: saveGrammarMatchPreferences,
    renderSettings: renderGrammarMatchSettings,
    enterReadyState: () => grammarMatchEngine.enterReadyState()
  });
  const setGrammarMatchDuration = sharedMatchGame.createPreferenceHandler({
    preferences: grammarMatchPreferences,
    key: "duration",
    normalize: getGrammarMatchDuration,
    savePreferences: saveGrammarMatchPreferences,
    renderSettings: renderGrammarMatchSettings,
    enterReadyState: () => grammarMatchEngine.enterReadyState()
  });

  sharedMatchGame.initializeStandardMatchScreen({
    guardElement: document.getElementById("grammar-match-new-round"),
    renderSettings: renderGrammarMatchSettings,
    renderActionCopy: renderGrammarMatchActionCopy,
    attachEventListeners: () => {
      sharedMatchGame.attachStandardMatchEventListeners({
        newRoundButton: document.getElementById("grammar-match-new-round"),
        onStartNewRound: () => grammarMatchEngine.startNewSession(),
        optionsToggleButton: document.getElementById("grammar-match-options-toggle"),
        onToggleOptions: () => {
          grammarMatchPreferences.optionsOpen = !grammarMatchPreferences.optionsOpen;
          saveGrammarMatchPreferences();
          renderGrammarMatchSettings();
        },
        selectConfigs: [
          { element: document.getElementById("grammar-match-level-select"), handler: setGrammarMatchLevel },
          { element: document.getElementById("grammar-match-filter-select"), handler: setGrammarMatchFilterPreference }
        ],
        spinnerConfigs: [
          {
            spinner: document.querySelector('[data-spinner-id="grammar-match-count"]'),
            options: grammarMatchTotalCountOptions,
            getCurrentValue: () => getGrammarMatchTotalCount(grammarMatchPreferences.totalCount),
            handler: setGrammarMatchTotalCount
          },
          {
            spinner: document.querySelector('[data-spinner-id="grammar-match-time"]'),
            options: grammarMatchDurationOptions,
            getCurrentValue: () => getGrammarMatchDuration(grammarMatchPreferences.duration),
            handler: setGrammarMatchDuration
          }
        ],
        resultFilterButtons: document.querySelectorAll("#grammar-match-result-view [data-result-filter]"),
        onResultFilterChange: sharedMatchGame.createResultFilterHandler({
          state: grammarMatchState,
          normalize: getGrammarMatchResultFilter,
          renderResults: renderGrammarMatchResults
        }),
        bulkActionConfig: {
          button: document.getElementById("grammar-match-result-bulk-action"),
          datasetKey: "grammarMatchBulkAction",
          getFilteredResults: getFilteredGrammarMatchResults,
          getItemId: (item) => item.id,
          onRemove: removeGrammarFromReviewList,
          onSave: saveGrammarToReviewList,
          afterChange: renderGrammarMatchResults
        },
        resultSaveConfig: {
          list: document.getElementById("grammar-match-result-list"),
          buttonSelector: "[data-grammar-match-review]",
          getItemId: (button) => button.dataset.grammarMatchReview,
          isSaved: isGrammarSavedToReviewList,
          onRemove: removeGrammarFromReviewList,
          onSave: saveGrammarToReviewList,
          afterChange: renderGrammarMatchResults
        }
      });

      sharedMatchGame.attachBulkActionListener({
        button: document.getElementById("grammar-match-result-mastered-action"),
        datasetKey: "grammarMatchMasteredBulkAction",
        getFilteredResults: getFilteredGrammarMatchResults,
        getItemId: (item) => item.id,
        onRemove: removeGrammarFromMasteredList,
        onSave: saveGrammarToMasteredList,
        afterChange: renderGrammarMatchResults
      });
      sharedMatchGame.attachResultSaveListener({
        list: document.getElementById("grammar-match-result-list"),
        buttonSelector: "[data-grammar-match-mastered]",
        getItemId: (button) => button.dataset.grammarMatchMastered,
        isSaved: isGrammarSavedToMasteredList,
        onRemove: removeGrammarFromMasteredList,
        onSave: saveGrammarToMasteredList,
        afterChange: renderGrammarMatchResults
      });
    },
    storageHandlers: {
      [grammarMatchStorageKey]: () => {
        const nextPreferences = sharedMatchGame.loadStoredObject(grammarMatchStorageKey, defaultGrammarMatchPreferences);
        nextPreferences.optionsOpen = grammarMatchPreferences.optionsOpen === true;
        sharedMatchGame.replaceObjectContents(grammarMatchPreferences, nextPreferences);
        renderGrammarMatchSettings();
        grammarMatchEngine.enterReadyState();
      },
      [grammarStudyStateStorageKey]: () => {
        renderGrammarMatchSettings();
        grammarMatchEngine.enterReadyState();
      }
    },
    windowListeners: [
      {
        eventName: "japanote:supplementary-content-loaded",
        handler: () => {
          renderGrammarMatchSettings();
          grammarMatchEngine.enterReadyState();
        }
      }
    ],
    enterReadyState: () => grammarMatchEngine.enterReadyState()
  });
})(globalThis);
