(function (global) {
  const sharedTimer = global.japanoteSharedTimer || {};

  function getSyncStore() {
    if (global.japanoteSync && typeof global.japanoteSync.readValue === "function") {
      return global.japanoteSync;
    }

    return null;
  }

  function loadStoredObject(storageKey, defaults = {}) {
    const syncStore = getSyncStore();
    const baseValue = defaults && typeof defaults === "object" && !Array.isArray(defaults) ? { ...defaults } : {};

    if (syncStore) {
      const saved = syncStore.readValue(storageKey, null);

      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        return {
          ...baseValue,
          ...saved
        };
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        return {
          ...baseValue,
          ...saved
        };
      }
    } catch (error) {
      return baseValue;
    }

    return baseValue;
  }

  function saveStoredObject(storageKey, value) {
    const syncStore = getSyncStore();

    if (syncStore) {
      syncStore.writeValue(storageKey, value);
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  function shuffleItems(items) {
    const copy = Array.isArray(items) ? [...items] : [];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  function replaceObjectContents(target, nextState) {
    Object.keys(target).forEach((key) => {
      delete target[key];
    });

    Object.assign(target, nextState);
  }

  function dispatchStorageUpdated(key, value, source = "local") {
    window.dispatchEvent(
      new CustomEvent("japanote:storage-updated", {
        detail: {
          key,
          value,
          source
        }
      })
    );
  }

  function createBoundListenerAttributeName(bindingKind) {
    const safeKind = String(bindingKind || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");

    return `data-japanote-bound-${safeKind}`;
  }

  function hasBoundListener(element, bindingKind) {
    if (!element) {
      return false;
    }

    return element.hasAttribute(createBoundListenerAttributeName(bindingKind));
  }

  function markBoundListener(element, bindingKind) {
    if (!element) {
      return;
    }

    element.setAttribute(createBoundListenerAttributeName(bindingKind), "true");
  }

  function isSettingsPanelOpen({ optionsShell, optionsToggle, optionsPanel }) {
    if (optionsPanel && !optionsPanel.hidden) {
      return true;
    }

    if (optionsShell?.classList.contains("is-open")) {
      return true;
    }

    return optionsToggle?.getAttribute("aria-expanded") === "true";
  }

  function attachStorageUpdateListener(handlersByKey, source = "remote") {
    window.addEventListener("japanote:storage-updated", (event) => {
      if (event.detail?.source !== source) {
        return;
      }

      const handler = handlersByKey[event.detail.key];

      if (typeof handler === "function") {
        handler(event.detail.value);
      }
    });
  }

  function initializeStandardMatchScreen({
    guardElement,
    renderSettings,
    renderActionCopy,
    attachEventListeners,
    storageHandlers,
    windowListeners = [],
    enterReadyState
  }) {
    if (!guardElement) {
      return;
    }

    if (typeof renderSettings === "function") {
      renderSettings();
    }

    if (typeof renderActionCopy === "function") {
      renderActionCopy();
    }

    if (typeof attachEventListeners === "function") {
      attachEventListeners();
    }

    if (storageHandlers && typeof storageHandlers === "object" && Object.keys(storageHandlers).length) {
      attachStorageUpdateListener(storageHandlers);
    }

    windowListeners.forEach(({ eventName, handler }) => {
      if (!eventName || typeof handler !== "function") {
        return;
      }

      window.addEventListener(eventName, handler);
    });

    if (typeof enterReadyState === "function") {
      enterReadyState();
    }
  }

  function renderSpinnerControl({ spinner, options = [], activeValue, formatValue, disabled = false }) {
    if (!spinner) {
      return;
    }

    const valueElement = spinner.querySelector("[data-spinner-value]");
    const directionButtons = spinner.querySelectorAll("[data-spinner-direction]");
    const currentIndex = options.indexOf(activeValue);
    const safeValue = currentIndex >= 0 ? activeValue : options[0];

    if (valueElement) {
      valueElement.textContent = typeof formatValue === "function" ? formatValue(safeValue) : String(safeValue ?? "");
    }

    spinner.classList.toggle("is-disabled", Boolean(disabled));

    directionButtons.forEach((button) => {
      const direction = Number(button.dataset.spinnerDirection);
      const nextIndex = currentIndex + direction;
      button.disabled = Boolean(disabled) || currentIndex < 0 || nextIndex < 0 || nextIndex >= options.length;
    });
  }

  function renderActionCopy({ buttonId, labelId, isResetState }) {
    const button = document.getElementById(buttonId);
    const label = document.getElementById(labelId);
    const icon = button?.querySelector(".material-symbols-rounded");
    const matchCopy = global.japanoteMatchCopy || {};
    const actionCopy =
      typeof matchCopy.getActionButtonText === "function"
        ? matchCopy.getActionButtonText(isResetState)
        : {
            label: isResetState ? "다시 해볼까요?" : "시작해볼까요?",
            icon: isResetState ? "autorenew" : "play_arrow"
          };

    if (button) {
      button.classList.toggle("primary-btn", !isResetState);
      button.classList.toggle("secondary-btn", isResetState);
    }

    if (label) {
      label.textContent = actionCopy.label;
    }

    if (icon) {
      icon.textContent = actionCopy.icon;
    }
  }

  function renderTimer({ timerId, duration, timeLeft, timerState }) {
    if (typeof sharedTimer.renderTimer === "function") {
      const resolvedTimerState = timerState || {
        duration,
        timeLeft,
        timeLeftMs: Math.max(0, (Number(timeLeft) || 0) * 1000),
        timerId: null
      };

      return sharedTimer.renderTimer({
        timerId,
        timerState: resolvedTimerState
      });
    }

    const timer = document.getElementById(timerId);

    if (!timer) {
      return;
    }

    const warning = duration > 0 && timeLeft <= Math.max(10, Math.floor(duration / 3));
    const progress = duration > 0 ? Math.max(0, Math.min(1, timeLeft / duration)) : 0;
    const timerItem = timer.closest(".quiz-hud-item");
    const formattedTime =
      duration <= 0
        ? "천천히"
        : `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;

    timer.textContent = formattedTime;
    timer.classList.toggle("is-warning", warning);

    if (!timerItem) {
      return;
    }

    if (typeof global.updateQuizTimerItem === "function") {
      global.updateQuizTimerItem(timerItem, progress, warning, duration <= 0);
      return;
    }

    timerItem.classList.add("is-timer");
    timerItem.classList.toggle("is-warning", warning);
    timerItem.classList.toggle("is-static", duration <= 0);
    timerItem.style.setProperty("--timer-progress", progress.toFixed(3));
  }

  function renderStats({ progressId, resolvedCount, totalCount, renderTimer }) {
    const progress = document.getElementById(progressId);

    if (progress) {
      progress.textContent = `${resolvedCount} / ${totalCount}`;
    }

    if (typeof renderTimer === "function") {
      renderTimer();
    }
  }

  function renderSettingsPanel({
    optionsShellId,
    optionsToggleId,
    optionsPanelId,
    optionsSummaryId,
    summaryText,
    isSettingsLocked,
    shouldShowOptionsPanel,
    selectConfigs = [],
    spinnerConfigs = [],
    refreshPool,
    updateActionAvailability
  }) {
    const optionsShell = document.getElementById(optionsShellId);
    const optionsToggle = document.getElementById(optionsToggleId);
    const optionsPanel = document.getElementById(optionsPanelId);
    const optionsSummary = document.getElementById(optionsSummaryId);
    const closeRequested = optionsToggle?.dataset.japanoteOptionsIntent === "close";
    const requestedOpen = shouldShowOptionsPanel !== false;
    // 저장/동기화 렌더가 중간에 한 번 끼어들어도, 사용자가 직접 닫기 전까지는
    // 이미 열어 둔 설정 패널을 유지해야 연속으로 옵션을 바꿀 때 흐름이 끊기지 않는다.
    const resolvedShouldShowOptionsPanel =
      !isSettingsLocked &&
      (requestedOpen ||
        (isSettingsPanelOpen({
          optionsShell,
          optionsToggle,
          optionsPanel
        }) &&
          !closeRequested));

    if (optionsSummary) {
      optionsSummary.textContent = summaryText;
    }

    selectConfigs.forEach(({ element, populate, disabled }) => {
      if (typeof populate === "function") {
        populate(element);
      }

      if (element) {
        element.disabled = disabled;
      }
    });

    if (typeof refreshPool === "function") {
      refreshPool();
    }

    if (typeof updateActionAvailability === "function") {
      updateActionAvailability();
    }

    if (optionsShell) {
      optionsShell.classList.toggle("is-open", resolvedShouldShowOptionsPanel);
    }

    if (optionsToggle) {
      optionsToggle.disabled = isSettingsLocked;
      optionsToggle.setAttribute("aria-expanded", String(resolvedShouldShowOptionsPanel));
      delete optionsToggle.dataset.japanoteOptionsIntent;
    }

    if (optionsPanel) {
      optionsPanel.hidden = !resolvedShouldShowOptionsPanel;
      optionsPanel.setAttribute("aria-hidden", String(!resolvedShouldShowOptionsPanel));
    }

    spinnerConfigs.forEach((config) => {
      renderSpinnerControl(config);
    });
  }

  function renderStandardMatchSettings({
    optionsShellId,
    optionsToggleId,
    optionsPanelId,
    optionsSummaryId,
    summaryText,
    isSettingsLocked,
    optionsOpen,
    selectConfigs = [],
    countSpinner,
    countOptions = [],
    countValue,
    countFormatValue = (value) => String(value ?? ""),
    timeSpinner,
    timeOptions = [],
    timeValue,
    timeFormatValue = (value) => String(value ?? ""),
    refreshPool,
    updateActionAvailability
  }) {
    renderSettingsPanel({
      optionsShellId,
      optionsToggleId,
      optionsPanelId,
      optionsSummaryId,
      summaryText,
      isSettingsLocked,
      shouldShowOptionsPanel: !isSettingsLocked && optionsOpen !== false,
      selectConfigs,
      spinnerConfigs: [
        {
          spinner: countSpinner,
          options: countOptions,
          activeValue: countValue,
          formatValue: countFormatValue,
          disabled: isSettingsLocked
        },
        {
          spinner: timeSpinner,
          options: timeOptions,
          activeValue: timeValue,
          formatValue: timeFormatValue,
          disabled: isSettingsLocked
        }
      ],
      refreshPool,
      updateActionAvailability
    });
  }

  function renderBoard({ leftListId, rightListId, leftCards, rightCards, selectedLeft, selectedRight, createCard, renderStats }) {
    const leftList = document.getElementById(leftListId);
    const rightList = document.getElementById(rightListId);

    if (!leftList || !rightList) {
      return;
    }

    leftList.innerHTML = "";
    rightList.innerHTML = "";

    leftCards.forEach((card) => {
      leftList.appendChild(createCard(card, selectedLeft));
    });

    rightCards.forEach((card) => {
      rightList.appendChild(createCard(card, selectedRight));
    });

    if (typeof renderStats === "function") {
      renderStats();
    }
  }

  function syncResultFilterButtons(resultView, activeFilter) {
    if (!resultView) {
      return;
    }

    resultView.querySelectorAll("[data-result-filter]").forEach((button) => {
      const isActive = button.dataset.resultFilter === activeFilter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderBulkActionButtonState({
    button,
    label,
    icon,
    count,
    allSaved,
    datasetKey,
    getActionLabel,
    getActionTitle
  }) {
    if (!button || !label || !icon) {
      return;
    }

    const actionLabel =
      typeof getActionLabel === "function" ? getActionLabel(allSaved) : allSaved ? "전체 빼기" : "전체 담기";
    const actionTitle =
      typeof getActionTitle === "function" ? getActionTitle({ count, allSaved }) : "";

    const actionIcon = allSaved ? "delete_sweep" : "bookmark_add";

    button.disabled = !count;
    button.dataset[datasetKey] = allSaved ? "remove" : "save";
    button.setAttribute("aria-label", actionTitle);
    button.title = actionTitle;
    label.textContent = actionLabel;
    icon.textContent = actionIcon;
  }

  function createResultItemHeadMarkup({
    status,
    statusLabel,
    levelLabel,
    saved,
    datasetName,
    itemId,
    actionLabel
  }) {
    const safeStatus = typeof status === "string" ? status : "pending";
    const safeStatusLabel = typeof statusLabel === "string" ? statusLabel : "";
    const safeLevelLabel = typeof levelLabel === "string" ? levelLabel : "";
    const safeItemId = typeof itemId === "string" ? itemId : "";
    const safeDatasetName = typeof datasetName === "string" ? datasetName : "match-save";
    const safeActionLabel = typeof actionLabel === "string" ? actionLabel : "";
    const actionIcon = saved ? "delete" : "bookmark_add";

    return `
      <div class="match-result-item-head">
        <div class="match-result-item-badges">
          <span class="match-result-badge is-${safeStatus}">${safeStatusLabel}</span>
          <span class="match-result-level">${safeLevelLabel}</span>
        </div>
        <button
          class="secondary-btn match-save-btn icon-only-btn${saved ? " is-saved" : ""}"
          type="button"
          data-${safeDatasetName}="${safeItemId}"
          aria-label="${safeActionLabel}"
          aria-pressed="${saved ? "true" : "false"}"
          title="${safeActionLabel}"
        >
          <span class="material-symbols-rounded" aria-hidden="true">${actionIcon}</span>
        </button>
      </div>
    `;
  }

  function createResultActionButton({
    selected,
    datasetName,
    itemId,
    actionLabel,
    defaultIcon = "bookmark_add",
    selectedIcon = "delete",
    selectedClassName = "is-saved"
  }) {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    const safeDatasetName = typeof datasetName === "string" ? datasetName : "match-save";
    const safeItemId = typeof itemId === "string" ? itemId : "";
    const safeActionLabel = typeof actionLabel === "string" ? actionLabel : "";
    const actionIcon = selected ? selectedIcon : defaultIcon;

    button.className = `secondary-btn match-save-btn icon-only-btn${selected ? ` ${selectedClassName}` : ""}`;
    button.type = "button";
    button.dataset[safeDatasetName] = safeItemId;
    button.setAttribute("aria-label", safeActionLabel);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.title = safeActionLabel;

    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = actionIcon;

    button.appendChild(icon);
    return button;
  }

  function appendResultItem({
    container,
    status,
    levelText,
    titleText,
    descriptionText,
    actionButtons = []
  }) {
    if (!container) {
      return;
    }

    const article = document.createElement("article");
    const head = document.createElement("div");
    const badges = document.createElement("div");
    const actions = document.createElement("div");
    const statusBadge = document.createElement("span");
    const levelBadge = document.createElement("span");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("p");
    const statusLabel = status === "correct" ? "정답" : "오답";

    article.className = `match-result-item is-${status}`;
    head.className = "match-result-item-head";
    badges.className = "match-result-item-badges";
    actions.className = "match-result-item-actions";
    statusBadge.className = `match-result-badge is-${status}`;
    statusBadge.textContent = statusLabel;
    levelBadge.className = "match-result-level";
    levelBadge.textContent = levelText;
    main.className = "match-result-item-main";
    title.textContent = titleText;
    description.textContent = descriptionText;

    badges.append(statusBadge, levelBadge);
    actionButtons.forEach((actionButtonConfig) => {
      actions.appendChild(createResultActionButton(actionButtonConfig));
    });
    head.append(badges, actions);
    main.append(title, description);
    article.append(head, main);
    container.appendChild(article);
  }

  function renderResultsView({
    resultViewId,
    totalId,
    correctId,
    wrongId,
    emptyId,
    listId,
    bulkActionButtonId,
    counts,
    filteredResults,
    activeFilter,
    filterLabels,
    renderBulkActionButton,
    createItemMarkup,
    renderItems,
    getEmptyText
  }) {
    const resultView = document.getElementById(resultViewId);
    const total = document.getElementById(totalId);
    const correct = document.getElementById(correctId);
    const wrong = document.getElementById(wrongId);
    const empty = document.getElementById(emptyId);
    const list = document.getElementById(listId);
    const bulkActionButton = bulkActionButtonId ? document.getElementById(bulkActionButtonId) : null;

    if (!resultView || !total || !correct || !wrong || !empty || !list) {
      return;
    }

    total.textContent = String(counts.all);
    correct.textContent = String(counts.correct);
    wrong.textContent = String(counts.wrong);
    syncResultFilterButtons(resultView, activeFilter);

    if (bulkActionButton && typeof renderBulkActionButton === "function") {
      renderBulkActionButton(filteredResults);
    }

    if (!filteredResults.length) {
      const matchCopy = global.japanoteMatchCopy || {};
      empty.hidden = false;
      empty.textContent =
        typeof getEmptyText === "function"
          ? getEmptyText({ activeFilter, filterLabels })
          : typeof matchCopy.getEmptyResultsText === "function"
            ? matchCopy.getEmptyResultsText(filterLabels[activeFilter])
            : `${filterLabels[activeFilter]} 결과가 아직 없어요.`;
      list.innerHTML = "";
      return;
    }

    empty.hidden = true;
    list.innerHTML = "";

    if (typeof renderItems === "function") {
      renderItems(filteredResults, list);
      return;
    }

    list.innerHTML = filteredResults.map((item) => createItemMarkup(item)).join("");
  }

  function createMatchGameEngine({
    state,
    pageSize = 5,
    wrongFlashDuration = 520,
    pageTransitionDelay = 720,
    getDuration = () => 0,
    getDefaultSessionItems = () => [],
    mapResultItem = (item) => ({ ...item }),
    buildCardsFromPageItems = () => ({
      leftCards: [],
      rightCards: []
    }),
    onRender = () => {},
    onSetActionAvailability,
    onSetFeedback = () => {},
    onUnavailable = () => {},
    onPageOpened = () => {},
    getTimeoutMessage = () => ""
  }) {
    if (!state || typeof state !== "object") {
      state = {
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
        timeLeft: 0,
        hasStarted: false,
        showResults: false,
        resultFilter: "all"
      };
    }

    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.max(1, Math.floor(pageSize)) : 5;

    const roundTimerState = {
      duration: 0,
      timeLeft: 0,
      timeLeftMs: 0,
      deadlineAt: null,
      timerId: null
    };
    let roundTimer = null;
    let wrongMatchTimer = null;
    let transitionTimer = null;

    const render = () => {
      if (typeof onRender === "function") {
        onRender();
      }
    };

    const setActionAvailability = (startEnabled) => {
      if (typeof onSetActionAvailability === "function") {
        onSetActionAvailability(startEnabled);
      }
    };

    const setFeedback = (message, tone = "") => {
      if (typeof onSetFeedback === "function") {
        onSetFeedback(message, tone);
      }
    };

    const getActiveDuration = () => Number(getDuration() || 0);

    function mirrorRoundTimerState() {
      state.duration = roundTimerState.duration;
      state.timeLeft = Math.max(0, Number(roundTimerState.timeLeft) || 0);
      state.timeLeftMs = Math.max(0, Number(roundTimerState.timeLeftMs) || 0);
      state.deadlineAt = roundTimerState.deadlineAt;
      state.timerId = roundTimerState.timerId;
    }

    function syncRoundTimerState(resetRemaining = false) {
      if (typeof sharedTimer.setDuration === "function") {
        sharedTimer.setDuration(roundTimerState, getActiveDuration(), { resetRemaining });
      } else {
        roundTimerState.duration = getActiveDuration();

        if (resetRemaining) {
          roundTimerState.timeLeft = roundTimerState.duration;
          roundTimerState.timeLeftMs = roundTimerState.duration * 1000;
          roundTimerState.deadlineAt = null;
        }
      }

      mirrorRoundTimerState();
    }

    function clearTransitionTimer() {
      if (!transitionTimer) {
        return;
      }

      window.clearTimeout(transitionTimer);
      transitionTimer = null;
    }

    function stopRoundTimer() {
      if (typeof sharedTimer.stopTimer === "function") {
        sharedTimer.stopTimer(roundTimerState);
        roundTimer = null;
        mirrorRoundTimerState();
        return;
      }

      if (!roundTimer) {
        return;
      }

      window.clearInterval(roundTimer);
      roundTimer = null;
    }

    function clearWrongMatchTimer() {
      if (!wrongMatchTimer) {
        return;
      }

      window.clearTimeout(wrongMatchTimer);
      wrongMatchTimer = null;
    }

    function clearAllTimers() {
      clearTransitionTimer();
      clearWrongMatchTimer();
      stopRoundTimer();
    }

    function resetCurrentPageState() {
      clearAllTimers();
      state.selectedLeft = null;
      state.selectedRight = null;
      state.wrongLeft = null;
      state.wrongRight = null;
      state.matchedIds = [];
      state.isLocked = false;
      state.timedOut = false;
      syncRoundTimerState(true);
    }

    function resetSelectedCards() {
      state.selectedLeft = null;
      state.selectedRight = null;
    }

    function queueTransition(callback) {
      clearTransitionTimer();
      transitionTimer = window.setTimeout(() => {
        transitionTimer = null;
        if (typeof callback === "function") {
          callback();
        }
      }, pageTransitionDelay);
    }

    function getPageCount() {
      return Math.max(1, Math.ceil(state.sessionItems.length / safePageSize));
    }

    function getResolvedCount() {
      return state.results.filter((item) => item.status === "correct").length;
    }

    function getResultCounts() {
      return {
        all: state.results.length,
        correct: state.results.filter((item) => item.status === "correct").length,
        wrong: state.results.filter((item) => item.status === "wrong").length
      };
    }

    function getCurrentPageItems(pageIndex = state.pageIndex) {
      const startIndex = pageIndex * safePageSize;
      return state.sessionItems.slice(startIndex, startIndex + safePageSize);
    }

    function setResultStatus(ids, status) {
      const targetIds = new Set(Array.isArray(ids) ? ids : []);

      state.results = state.results.map((item) => {
        if (!targetIds.has(item.id)) {
          return item;
        }

        return {
          ...item,
          status
        };
      });
    }

    function resetResultStatus(ids) {
      setResultStatus(ids, "pending");
    }

    function getFilteredResults(filter = state.resultFilter) {
      if (filter === "correct") {
        return state.results.filter((item) => item.status === "correct");
      }

      if (filter === "wrong") {
        return state.results.filter((item) => item.status === "wrong");
      }

      return state.results;
    }

    function setResultFilter(nextFilter, normalize = (value) => value) {
      const normalizedFilter = normalize(nextFilter);
      if (state.resultFilter === normalizedFilter) {
        return false;
      }

      state.resultFilter = normalizedFilter;
      render();
      return true;
    }

    function startRoundTimer() {
      if (typeof sharedTimer.resetTimer === "function") {
        syncRoundTimerState(true);

        if (roundTimerState.duration <= 0) {
          render();
          return;
        }

        sharedTimer.resetTimer(roundTimerState, {
          intervalMs: 100,
          onTick: () => {
            mirrorRoundTimerState();
            render();
          },
          onExpire: () => {
            mirrorRoundTimerState();
            handleTimeout();
          }
        });
        roundTimer = roundTimerState.timerId;
        mirrorRoundTimerState();
        return;
      }

      const activeDuration = getActiveDuration();

      stopRoundTimer();
      state.timeLeft = activeDuration;
      render();

      if (activeDuration <= 0) {
        return;
      }

      roundTimer = window.setInterval(() => {
        state.timeLeft = Math.max(0, state.timeLeft - 1);
        render();

        if (state.timeLeft === 0) {
          stopRoundTimer();
          handleTimeout();
        }
      }, 1000);
    }

    function finalizeCompletedPage() {
      state.isLocked = true;
      render();

      if (state.pageIndex + 1 >= getPageCount()) {
        setFeedback("");
        queueTransition(showResults);
        return;
      }

      setFeedback("");
      queueTransition(moveToNextPage);
    }

    function moveToNextPage() {
      state.pageIndex += 1;
      const nextItems = getCurrentPageItems(state.pageIndex);

      if (!nextItems.length) {
        showResults();
        return;
      }

      openPage(nextItems, { isInitialPage: false });
    }

    function showResults() {
      clearAllTimers();
      resetSelectedCards();
      state.showResults = true;
      state.isLocked = false;
      state.timedOut = false;
      setActionAvailability(true);
      render();
    }

    function queueWrongReset() {
      state.isLocked = true;
      render();
      clearWrongMatchTimer();

      wrongMatchTimer = window.setTimeout(() => {
        state.wrongLeft = null;
        state.wrongRight = null;
        state.isLocked = false;
        resetSelectedCards();
        render();
        wrongMatchTimer = null;
      }, wrongFlashDuration);
    }

    function handleSelection(card) {
      if (state.isLocked || state.timedOut || state.matchedIds.includes(card.id)) {
        return;
      }

      if (card.side === "left") {
        state.selectedLeft = state.selectedLeft === card.id ? null : card.id;
      } else {
        state.selectedRight = state.selectedRight === card.id ? null : card.id;
      }

      render();

      if (!state.selectedLeft || !state.selectedRight) {
        return;
      }

      if (state.selectedLeft === state.selectedRight) {
        state.matchedIds.push(state.selectedLeft);
        setResultStatus([state.selectedLeft], "correct");
        resetSelectedCards();
        render();

        if (state.matchedIds.length === state.pageItems.length) {
          stopRoundTimer();
          finalizeCompletedPage();
          return;
        }

        setFeedback("");
        return;
      }

      state.wrongLeft = state.selectedLeft;
      state.wrongRight = state.selectedRight;
      queueWrongReset();
    }

    function handleTimeout() {
      const remainingIds = state.pageItems
        .filter((item) => !state.matchedIds.includes(item.id))
        .map((item) => item.id);
      const isFinalPage = state.pageIndex + 1 >= getPageCount();

      setResultStatus(remainingIds, "wrong");
      state.timedOut = true;
      state.isLocked = true;
      resetSelectedCards();
      render();

      setFeedback(
        getTimeoutMessage({
          isFinalPage,
          remainingCount: remainingIds.length,
          pageIndex: state.pageIndex,
          pageCount: getPageCount()
        }),
        "is-fail"
      );
      queueTransition(isFinalPage ? showResults : moveToNextPage);
    }

    function enterReadyState(message = "") {
      clearAllTimers();
      state.sessionItems = [];
      state.pageItems = [];
      state.results = [];
      state.leftCards = [];
      state.rightCards = [];
      state.pageIndex = 0;
      state.resultFilter = "all";
      state.showResults = false;
      state.hasStarted = false;
      state.timeLeft = getActiveDuration();
      resetCurrentPageState();
      setFeedback(message);
      render();
    }

    function openPage(pageItems, { isInitialPage = true } = {}) {
      state.hasStarted = true;
      state.showResults = false;
      state.pageItems = Array.isArray(pageItems) ? pageItems : [];
      resetCurrentPageState();

      const cards = buildCardsFromPageItems(state.pageItems);
      state.leftCards = Array.isArray(cards.leftCards) ? cards.leftCards : [];
      state.rightCards = Array.isArray(cards.rightCards) ? cards.rightCards : [];
      setActionAvailability(true);
      setFeedback("");
      render();
      startRoundTimer();
      onPageOpened({ isInitialPage, pageItems: state.pageItems, state });
    }

    function startSession(items = getDefaultSessionItems()) {
      clearAllTimers();

      const sessionItems = Array.isArray(items) ? items : [];

      if (!sessionItems.length) {
        state.sessionItems = [];
        state.pageItems = [];
        state.results = [];
        state.pageIndex = 0;
        state.resultFilter = "all";
        state.showResults = false;
        state.hasStarted = false;
        state.isLocked = false;
        state.timedOut = false;
        syncRoundTimerState(true);
        setActionAvailability(false);
        setFeedback("");
        onUnavailable();
        render();
        return false;
      }

      state.sessionItems = sessionItems.map((item) => ({ ...item }));
      state.results = sessionItems.map((item) => ({
        ...mapResultItem(item),
        status: "pending"
      }));
      state.pageIndex = 0;
      state.resultFilter = "all";
      state.hasStarted = true;
      state.showResults = false;
      openPage(getCurrentPageItems(0), { isInitialPage: true });
      return true;
    }

    function replayCurrentPage() {
      const currentItems = [...state.pageItems];

      if (!currentItems.length) {
        return startSession();
      }

      resetResultStatus(currentItems.map((item) => item.id));
      openPage(currentItems, { isInitialPage: true });
      return true;
    }

    function replayCurrentSet() {
      const sessionItems = [...state.sessionItems];

      if (!sessionItems.length) {
        return startSession();
      }

      return startSession(sessionItems);
    }

    function startNewSession() {
      if (state.hasStarted || state.showResults) {
        enterReadyState();
        return false;
      }

      return startSession();
    }

  return {
    state,
    clearTransitionTimer,
    clearWrongMatchTimer,
    stopRoundTimer,
      clearAllTimers,
      resetCurrentPageState,
      resetSelectedCards,
      getPageCount,
      getResolvedCount,
      getResultCounts,
      getCurrentPageItems,
      setResultStatus,
      resetResultStatus,
      getFilteredResults,
      setResultFilter,
      startRoundTimer,
    openPage,
    startSession,
    replayCurrentPage,
    replayCurrentSet,
    enterReadyState,
    handleSelection,
    handleTimeout,
    startNewSession,
    moveToNextPage,
    showResults
  };
}

  function renderScreen({
    boardId,
    emptyId,
    playViewId,
    resultViewId,
    feedbackId,
    hasStarted,
    showResults,
    isReady,
    emptyReadyText = "준비됐다면 시작해볼까요?",
    emptyUnavailableText = "준비 중이에요.",
    renderSettings,
    renderActionCopy,
    renderStats,
    renderResults,
    renderBoard
  }) {
    const board = document.getElementById(boardId);
    const empty = document.getElementById(emptyId);
    const playView = document.getElementById(playViewId);
    const resultView = document.getElementById(resultViewId);
    const feedback = document.getElementById(feedbackId);
    const hasVisibleFeedback = Boolean(feedback?.textContent);
    const shouldShowPlayView = !showResults && (hasStarted || hasVisibleFeedback);
    const shouldShowEmpty = !hasStarted && !showResults && !hasVisibleFeedback;
    const shouldShowBoard = shouldShowPlayView || showResults || shouldShowEmpty;

    if (board) {
      board.hidden = !shouldShowBoard;
    }

    if (empty) {
      empty.hidden = !shouldShowEmpty;

      if (shouldShowEmpty) {
        empty.textContent = isReady ? emptyReadyText : emptyUnavailableText;
      }
    }

    if (playView) {
      playView.hidden = !shouldShowPlayView;
    }

    if (resultView) {
      resultView.hidden = !showResults;
    }

    if (typeof renderSettings === "function") {
      renderSettings();
    }

    if (typeof renderActionCopy === "function") {
      renderActionCopy();
    }

    if (typeof renderStats === "function") {
      renderStats();
    }

    if (showResults) {
      if (typeof renderResults === "function") {
        renderResults();
      }
      return;
    }

    if (typeof renderBoard === "function") {
      renderBoard();
    }
  }

  function attachSelectChangeListener(element, handler) {
    if (!element) {
      return;
    }

    if (hasBoundListener(element, "shared-select-change")) {
      return;
    }

    markBoundListener(element, "shared-select-change");
    element.addEventListener("change", (event) => {
      handler(event.target.value);
    });
  }

  function attachResultFilterButtons(buttons, handler) {
    Array.from(buttons || []).forEach((button) => {
      if (!button) {
        return;
      }

      if (hasBoundListener(button, "shared-result-filter-click")) {
        return;
      }

      markBoundListener(button, "shared-result-filter-click");
      button.addEventListener("click", () => {
        handler(button.dataset.resultFilter);
      });
    });
  }

  function attachSpinnerListeners({ spinner, options = [], getCurrentValue, handler }) {
    if (!spinner) {
      return;
    }

    spinner.querySelectorAll("[data-spinner-direction]").forEach((button) => {
      if (hasBoundListener(button, "shared-spinner-click")) {
        return;
      }

      markBoundListener(button, "shared-spinner-click");
      button.addEventListener("click", () => {
        const currentValue = getCurrentValue();
        const currentIndex = options.indexOf(currentValue);

        if (currentIndex < 0) {
          return;
        }

        const nextIndex = currentIndex + Number(button.dataset.spinnerDirection);

        if (nextIndex < 0 || nextIndex >= options.length) {
          return;
        }

        handler(options[nextIndex]);
      });
    });
  }

  function attachOptionsToggleListener(button, onToggle) {
    if (!button) {
      return;
    }

    if (hasBoundListener(button, "shared-options-toggle-click")) {
      return;
    }

    markBoundListener(button, "shared-options-toggle-click");
    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.dataset.japanoteOptionsIntent = isExpanded ? "close" : "open";
      onToggle();
    });
  }

  function attachStandardMatchEventListeners({
    newRoundButton,
    onStartNewRound,
    optionsToggleButton,
    onToggleOptions,
    selectConfigs = [],
    spinnerConfigs = [],
    resultFilterButtons = [],
    onResultFilterChange,
    bulkActionConfig,
    resultSaveConfig
  }) {
    if (newRoundButton && typeof onStartNewRound === "function") {
      if (!hasBoundListener(newRoundButton, "shared-new-round-click")) {
        markBoundListener(newRoundButton, "shared-new-round-click");
        newRoundButton.addEventListener("click", onStartNewRound);
      }
    }

    if (typeof onToggleOptions === "function") {
      attachOptionsToggleListener(optionsToggleButton, onToggleOptions);
    }

    selectConfigs.forEach(({ element, handler }) => {
      if (typeof handler === "function") {
        attachSelectChangeListener(element, handler);
      }
    });

    spinnerConfigs.forEach((config) => {
      attachSpinnerListeners(config);
    });

    if (typeof onResultFilterChange === "function") {
      attachResultFilterButtons(resultFilterButtons, onResultFilterChange);
    }

    if (bulkActionConfig) {
      attachBulkActionListener(bulkActionConfig);
    }

    if (resultSaveConfig) {
      attachResultSaveListener(resultSaveConfig);
    }
  }

  function attachBulkActionListener({ button, datasetKey, getFilteredResults, getItemId, onRemove, onSave, afterChange }) {
    if (!button) {
      return;
    }

    if (hasBoundListener(button, "shared-bulk-action-click")) {
      return;
    }

    markBoundListener(button, "shared-bulk-action-click");
    button.addEventListener("click", () => {
      const filteredResults = getFilteredResults();
      const uniqueIds = Array.from(new Set(filteredResults.map((item) => getItemId(item)).filter(Boolean)));

      if (!uniqueIds.length) {
        return;
      }

      if (button.dataset[datasetKey] === "remove") {
        uniqueIds.forEach((id) => {
          onRemove(id);
        });
      } else {
        uniqueIds.forEach((id) => {
          onSave(id);
        });
      }

      if (typeof afterChange === "function") {
        afterChange();
      }
    });
  }

  function attachResultSaveListener({ list, buttonSelector, getItemId, isSaved, onRemove, onSave, afterChange }) {
    if (!list) {
      return;
    }

    if (hasBoundListener(list, `shared-result-save-click-${buttonSelector}`)) {
      return;
    }

    markBoundListener(list, `shared-result-save-click-${buttonSelector}`);
    list.addEventListener("click", (event) => {
      const button = event.target.closest(buttonSelector);

      if (!button) {
        return;
      }

      const itemId = getItemId(button);

      if (isSaved(itemId)) {
        onRemove(itemId);
      } else {
        onSave(itemId);
      }

      if (typeof afterChange === "function") {
        afterChange();
      }
    });
  }

  function createSessionItems(items, requestedCount) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const totalCount = Math.min(Number(requestedCount) || 0, safeItems.length);
    return shuffleItems(safeItems).slice(0, totalCount);
  }

  function normalizeText(value) {
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

  function setFeedbackById(elementId, message, tone = "") {
    const feedback = document.getElementById(elementId);

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

  function setActionAvailabilityById(elementId, enabled) {
    const button = document.getElementById(elementId);

    if (button) {
      button.disabled = !enabled;
    }
  }

  function scrollElementIntoViewById(elementId) {
    const element = document.getElementById(elementId);

    if (!element?.scrollIntoView) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function createMatchCard({ state, onSelection }) {
    return function buildCard(card, selectedId) {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const matched = state.matchedIds.includes(card.id);
      const wrong =
        (card.side === "left" && state.wrongLeft === card.id) ||
        (card.side === "right" && state.wrongRight === card.id);

      button.type = "button";
      button.className = "match-card";
      label.className = "button-text-clamp match-card-label";
      label.textContent = card.value;
      button.appendChild(label);
      button.disabled = state.isLocked || matched || state.timedOut;

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
        onSelection(card);
      });

      return button;
    };
  }

  function renderUnavailableState({
    leftListId,
    rightListId,
    resultListId,
    resultEmptyId,
    state,
    engine,
    setActionAvailability,
    setFeedback,
    renderScreen,
    message
  }) {
    const leftList = document.getElementById(leftListId);
    const rightList = document.getElementById(rightListId);
    const resultList = document.getElementById(resultListId);
    const resultEmpty = document.getElementById(resultEmptyId);

    engine.clearAllTimers();
    state.sessionItems = [];
    state.pageItems = [];
    state.results = [];
    state.leftCards = [];
    state.rightCards = [];
    state.pageIndex = 0;
    state.hasStarted = false;
    state.showResults = false;
    engine.resetCurrentPageState();

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

    setActionAvailability(false);
    setFeedback(message, "is-fail");
    renderScreen();
  }

  function createPreferenceHandler({ preferences, key, normalize, savePreferences, renderSettings, enterReadyState, beforeApply }) {
    return function setPreference(value) {
      const nextValue = normalize(value);

      if (preferences[key] === nextValue) {
        return;
      }

      preferences[key] = nextValue;

      if (typeof beforeApply === "function") {
        beforeApply(nextValue);
      }

      savePreferences();
      renderSettings();
      enterReadyState();
    };
  }

  function createResultFilterHandler({ state, normalize, renderResults }) {
    return function setResultFilter(filter) {
      const nextFilter = normalize(filter);

      if (state.resultFilter === nextFilter) {
        return;
      }

      state.resultFilter = nextFilter;
      renderResults();
    };
  }

  function createStudyListManager({ storageKey, reviewKey, masteredKey }) {
    function loadState() {
      return loadStoredObject(storageKey);
    }

    function saveState(studyState) {
      saveStoredObject(storageKey, studyState);
    }

    function syncToApp(studyState) {
      if (typeof global.applyExternalStudyState === "function") {
        global.applyExternalStudyState(studyState);
        return;
      }

      dispatchStorageUpdated(storageKey, studyState, "local");
    }

    function getIds(studyState) {
      return {
        reviewIds: Array.isArray(studyState[reviewKey]) ? studyState[reviewKey] : [],
        masteredIds: Array.isArray(studyState[masteredKey]) ? studyState[masteredKey] : []
      };
    }

    function saveToReviewList(id) {
      if (!id) return;
      const studyState = loadState();
      const { reviewIds, masteredIds } = getIds(studyState);
      studyState[reviewKey] = Array.from(new Set([...reviewIds, id]));
      studyState[masteredKey] = masteredIds.filter((itemId) => itemId !== id);
      saveState(studyState);
      syncToApp(studyState);
    }

    function removeFromReviewList(id) {
      if (!id) return;
      const studyState = loadState();
      const { reviewIds } = getIds(studyState);
      studyState[reviewKey] = reviewIds.filter((itemId) => itemId !== id);
      saveState(studyState);
      syncToApp(studyState);
    }

    function isInReviewList(id) {
      if (!id) return false;
      const studyState = loadState();
      return Array.isArray(studyState[reviewKey]) && studyState[reviewKey].includes(id);
    }

    function saveToMasteredList(id) {
      if (!id) return;
      const studyState = loadState();
      const { reviewIds, masteredIds } = getIds(studyState);
      studyState[masteredKey] = Array.from(new Set([...masteredIds, id]));
      studyState[reviewKey] = reviewIds.filter((itemId) => itemId !== id);
      saveState(studyState);
      syncToApp(studyState);
    }

    function removeFromMasteredList(id) {
      if (!id) return;
      const studyState = loadState();
      const { masteredIds } = getIds(studyState);
      studyState[masteredKey] = masteredIds.filter((itemId) => itemId !== id);
      saveState(studyState);
      syncToApp(studyState);
    }

    function isInMasteredList(id) {
      if (!id) return false;
      const studyState = loadState();
      return Array.isArray(studyState[masteredKey]) && studyState[masteredKey].includes(id);
    }

    function getBuckets() {
      return getIds(loadState());
    }

    return {
      loadState,
      saveState,
      syncToApp,
      saveToReviewList,
      removeFromReviewList,
      isInReviewList,
      saveToMasteredList,
      removeFromMasteredList,
      isInMasteredList,
      getBuckets
    };
  }

  global.japanoteSharedMatchGame = {
    loadStoredObject,
    saveStoredObject,
    replaceObjectContents,
    dispatchStorageUpdated,
    attachStorageUpdateListener,
    initializeStandardMatchScreen,
    renderActionCopy,
    renderTimer,
    renderStats,
    renderSpinnerControl,
    renderSettingsPanel,
    renderStandardMatchSettings,
    renderBoard,
    renderBulkActionButtonState,
    createResultItemHeadMarkup,
    createResultActionButton,
    appendResultItem,
    renderResultsView,
    renderScreen,
    attachSelectChangeListener,
    attachResultFilterButtons,
    attachSpinnerListeners,
    attachOptionsToggleListener,
    attachStandardMatchEventListeners,
    attachBulkActionListener,
    attachResultSaveListener,
    createMatchGameEngine,
    shuffleItems,
    createSessionItems,
    normalizeText,
    createStudyListManager,
    setFeedbackById,
    setActionAvailabilityById,
    scrollElementIntoViewById,
    createMatchCard,
    renderUnavailableState,
    createPreferenceHandler,
    createResultFilterHandler
  };
})(globalThis);
