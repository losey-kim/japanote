(function (global) {
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

  function syncToggleButtonGroup(selector, activeValue, getValue) {
    document.querySelectorAll(selector).forEach((button) => {
      const value = typeof getValue === "function" ? getValue(button) : button.value;
      const active = value === activeValue;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderActionCopy({ buttonId, labelId, isResetState }) {
    const button = document.getElementById(buttonId);
    const label = document.getElementById(labelId);
    const icon = button?.querySelector(".material-symbols-rounded");

    if (button) {
      button.classList.toggle("primary-btn", !isResetState);
      button.classList.toggle("secondary-btn", isResetState);
    }

    if (label) {
      label.textContent = isResetState ? "다시 해볼까요?" : "시작해볼까요?";
    }

    if (icon) {
      icon.textContent = isResetState ? "autorenew" : "play_arrow";
    }
  }

  function renderTimer({ timerId, duration, timeLeft }) {
    const timer = document.getElementById(timerId);

    if (!timer) {
      return;
    }

    const warning = duration > 0 && timeLeft <= Math.max(10, Math.floor(duration / 3));
    const progress = duration > 0 ? Math.max(0, Math.min(1, timeLeft / duration)) : 0;
    const timerItem = timer.closest(".quiz-hud-item");

    timer.textContent = duration <= 0 ? "천천히" : `${timeLeft}초`;
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
    buttonGroups = [],
    refreshPool,
    updateActionAvailability
  }) {
    const optionsShell = document.getElementById(optionsShellId);
    const optionsToggle = document.getElementById(optionsToggleId);
    const optionsPanel = document.getElementById(optionsPanelId);
    const optionsSummary = document.getElementById(optionsSummaryId);

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
      optionsShell.classList.toggle("is-open", shouldShowOptionsPanel);
    }

    if (optionsToggle) {
      optionsToggle.disabled = isSettingsLocked;
      optionsToggle.setAttribute("aria-expanded", String(shouldShowOptionsPanel));
    }

    if (optionsPanel) {
      optionsPanel.hidden = !shouldShowOptionsPanel;
      optionsPanel.setAttribute("aria-hidden", String(!shouldShowOptionsPanel));
    }

    buttonGroups.forEach(({ selector, activeValue, getValue }) => {
      syncToggleButtonGroup(selector, activeValue, getValue);
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

  function renderResultFilterOptions({ selectId, filters, labels, counts, activeFilter }) {
    const select = document.getElementById(selectId);

    if (!select) {
      return;
    }

    select.innerHTML = filters
      .map((filter) => `<option value="${filter}">${labels[filter]} (${counts[filter] ?? 0})</option>`)
      .join("");
    select.value = activeFilter;
  }

  function renderResultsView({
    resultViewId,
    totalId,
    correctId,
    wrongId,
    emptyId,
    listId,
    filterSelectId,
    bulkActionButtonId,
    counts,
    filteredResults,
    activeFilter,
    filterLabels,
    renderFilterOptions,
    renderBulkActionButton,
    createItemMarkup
  }) {
    const resultView = document.getElementById(resultViewId);
    const total = document.getElementById(totalId);
    const correct = document.getElementById(correctId);
    const wrong = document.getElementById(wrongId);
    const empty = document.getElementById(emptyId);
    const list = document.getElementById(listId);
    const filterSelect = document.getElementById(filterSelectId);
    const bulkActionButton = document.getElementById(bulkActionButtonId);

    if (!resultView || !total || !correct || !wrong || !empty || !list || !filterSelect || !bulkActionButton) {
      return;
    }

    total.textContent = String(counts.all);
    correct.textContent = String(counts.correct);
    wrong.textContent = String(counts.wrong);

    if (typeof renderFilterOptions === "function") {
      renderFilterOptions(counts);
    }

    if (typeof renderBulkActionButton === "function") {
      renderBulkActionButton(filteredResults);
    }

    if (!filteredResults.length) {
      empty.hidden = false;
      empty.textContent = `${filterLabels[activeFilter]} 결과는 아직 없어요.`;
      list.innerHTML = "";
      return;
    }

    empty.hidden = true;
    list.innerHTML = filteredResults.map((item) => createItemMarkup(item)).join("");
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

    element.addEventListener("change", (event) => {
      handler(event.target.value);
    });
  }

  function attachDatasetButtonListeners(selector, datasetKey, handler) {
    document.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => {
        handler(button.dataset[datasetKey]);
      });
    });
  }

  function attachOptionsToggleListener(button, onToggle) {
    if (!button) {
      return;
    }

    button.addEventListener("click", onToggle);
  }

  function attachBulkActionListener({ button, datasetKey, getFilteredResults, getItemId, onRemove, onSave, afterChange }) {
    if (!button) {
      return;
    }

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

  global.japanoteSharedMatchGame = {
    loadStoredObject,
    saveStoredObject,
    replaceObjectContents,
    dispatchStorageUpdated,
    attachStorageUpdateListener,
    renderActionCopy,
    renderTimer,
    renderStats,
    renderSettingsPanel,
    renderBoard,
    renderResultFilterOptions,
    renderResultsView,
    renderScreen,
    attachSelectChangeListener,
    attachDatasetButtonListeners,
    attachOptionsToggleListener,
    attachBulkActionListener,
    attachResultSaveListener
  };
})(globalThis);
