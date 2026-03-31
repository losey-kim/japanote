const matchStorageKey = "japanote-match-state";
const studyStateStorageKey = "jlpt-compass-state";

function getMatchSyncStore() {
  if (globalThis.japanoteSync && typeof globalThis.japanoteSync.readValue === "function") {
    return globalThis.japanoteSync;
  }

  return null;
}

const matchSourceLevels = ["N5", "N4", "N3"];
const matchLevelOptions = [...matchSourceLevels, "all"];
const matchDurationOptions = [0, 10, 15, 20];
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
  optionsOpen: true
};

const fallbackMatchPool = [
  { id: "match-fallback-1", level: "N5", reading: "たべる", meaning: "먹다" },
  { id: "match-fallback-2", level: "N5", reading: "いく", meaning: "가다" },
  { id: "match-fallback-3", level: "N5", reading: "みる", meaning: "보다" },
  { id: "match-fallback-4", level: "N5", reading: "がっこう", meaning: "학교" },
  { id: "match-fallback-5", level: "N5", reading: "ともだち", meaning: "친구" }
];

const matchResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};

const matchFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 정했어요"
};

function loadMatchPreferences() {
  const syncStore = getMatchSyncStore();

  if (syncStore) {
    const saved = syncStore.readValue(matchStorageKey, null);

    if (saved && typeof saved === "object") {
      return {
        ...defaultMatchPreferences,
        ...saved
      };
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(matchStorageKey) || "{}");
    return {
      ...defaultMatchPreferences,
      ...saved
    };
  } catch (error) {
    return { ...defaultMatchPreferences };
  }
}

const matchPreferences = loadMatchPreferences();

function saveMatchPreferences() {
  const syncStore = getMatchSyncStore();

  if (syncStore) {
    syncStore.writeValue(matchStorageKey, matchPreferences);
    return;
  }

  localStorage.setItem(matchStorageKey, JSON.stringify(matchPreferences));
}

function loadSharedStudyState() {
  const syncStore = getMatchSyncStore();

  if (syncStore) {
    const saved = syncStore.readValue(studyStateStorageKey, null);
    return saved && typeof saved === "object" ? saved : {};
  }

  try {
    return JSON.parse(localStorage.getItem(studyStateStorageKey) || "{}");
  } catch (error) {
    return {};
  }
}

function saveSharedStudyState(studyState) {
  const syncStore = getMatchSyncStore();

  if (syncStore) {
    syncStore.writeValue(studyStateStorageKey, studyState);
    return;
  }

  localStorage.setItem(studyStateStorageKey, JSON.stringify(studyState));
}

function saveWordToMemorizationList(id) {
  if (!id) {
    return;
  }

  const studyState = loadSharedStudyState();
  const reviewIds = Array.isArray(studyState.reviewIds) ? studyState.reviewIds : [];
  const masteredIds = Array.isArray(studyState.masteredIds) ? studyState.masteredIds : [];

  studyState.reviewIds = Array.from(new Set([...reviewIds, id]));
  studyState.masteredIds = masteredIds.filter((itemId) => itemId !== id);
  saveSharedStudyState(studyState);
}

function removeWordFromMemorizationList(id) {
  if (!id) {
    return;
  }

  const studyState = loadSharedStudyState();
  const reviewIds = Array.isArray(studyState.reviewIds) ? studyState.reviewIds : [];

  studyState.reviewIds = reviewIds.filter((itemId) => itemId !== id);
  saveSharedStudyState(studyState);
}

function isWordSavedToMemorizationList(id) {
  if (!id) {
    return false;
  }

  const studyState = loadSharedStudyState();
  return Array.isArray(studyState.reviewIds) && studyState.reviewIds.includes(id);
}

function normalizeMatchText(value) {
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
  const activeDuration = Number(duration);
  return activeDuration <= 0 ? "천천히" : `${activeDuration}초`;
}

function getMatchOptionsSummaryText() {
  return [`${getMatchTotalCount()}문제`, getMatchDurationLabel()].join(" · ");
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
  const studyState = loadSharedStudyState();
  return {
    reviewIds: Array.isArray(studyState.reviewIds) ? studyState.reviewIds : [],
    masteredIds: Array.isArray(studyState.masteredIds) ? studyState.masteredIds : []
  };
}

function getMatchLevelSource(level) {
  const vocabRegistry = globalThis.japanoteContent?.vocab || {};
  let source = [];

  if (Array.isArray(vocabRegistry[level]) && vocabRegistry[level].length) {
    source = vocabRegistry[level];
  } else {
    const legacyKey = `jlpt${level}`;

    if (Array.isArray(vocabRegistry[legacyKey]) && vocabRegistry[legacyKey].length) {
      source = vocabRegistry[legacyKey];
    } else if (level === "N5" && Array.isArray(globalThis.jlptN5Vocab) && globalThis.jlptN5Vocab.length) {
      source = globalThis.jlptN5Vocab;
    }
  }

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

function shuffleMatchItems(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
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
let wrongMatchTimer = null;
let matchRoundTimer = null;
let matchTransitionTimer = null;

matchPreferences.level = getMatchLevel(matchPreferences.level);
matchPreferences.filter = getMatchFilter(matchPreferences.filter);
matchPreferences.part = getMatchPartFilter(matchPreferences.part, getBaseMatchPool(matchPreferences.level));
matchPreferences.totalCount = getMatchTotalCount(matchPreferences.totalCount);
matchPreferences.duration = getMatchDuration(matchPreferences.duration);
matchPreferences.optionsOpen = matchPreferences.optionsOpen !== false;

function clearMatchTransitionTimer() {
  if (!matchTransitionTimer) {
    return;
  }

  window.clearTimeout(matchTransitionTimer);
  matchTransitionTimer = null;
}

function stopMatchRoundTimer() {
  if (!matchRoundTimer) {
    return;
  }

  window.clearInterval(matchRoundTimer);
  matchRoundTimer = null;
}

function clearWrongMatchTimer() {
  if (!wrongMatchTimer) {
    return;
  }

  window.clearTimeout(wrongMatchTimer);
  wrongMatchTimer = null;
}

function clearAllMatchTimers() {
  clearMatchTransitionTimer();
  clearWrongMatchTimer();
  stopMatchRoundTimer();
}

function refreshMatchPool() {
  const basePool = getBaseMatchPool(matchPreferences.level);
  matchPreferences.part = getMatchPartFilter(matchPreferences.part, basePool);
  matchPool = filterMatchPool(basePool, matchPreferences.filter, matchPreferences.part);
}

function getMatchPageCount() {
  return Math.max(1, Math.ceil(matchState.sessionItems.length / matchPageSize));
}

function getMatchResolvedCount() {
  return matchState.results.filter((item) => item.status === "correct").length;
}

function getMatchResultCounts() {
  return {
    all: matchState.results.length,
    correct: matchState.results.filter((item) => item.status === "correct").length,
    wrong: matchState.results.filter((item) => item.status === "wrong").length
  };
}

function setMatchResultStatus(ids, status) {
  const targetIds = new Set(ids);

  matchState.results = matchState.results.map((item) => {
    if (!targetIds.has(item.id)) {
      return item;
    }

    return {
      ...item,
      status
    };
  });
}

function resetMatchResultStatus(ids) {
  setMatchResultStatus(ids, "pending");
}

function getCurrentPageItems(pageIndex = matchState.pageIndex) {
  const startIndex = pageIndex * matchPageSize;
  return matchState.sessionItems.slice(startIndex, startIndex + matchPageSize);
}

function resetSelectedCards() {
  matchState.selectedLeft = null;
  matchState.selectedRight = null;
}

function resetCurrentPageState() {
  clearAllMatchTimers();
  resetSelectedCards();
  matchState.wrongLeft = null;
  matchState.wrongRight = null;
  matchState.matchedIds = [];
  matchState.isLocked = false;
  matchState.timedOut = false;
  matchState.timeLeft = getMatchDuration(matchPreferences.duration);
}

function setMatchFeedback(message, tone = "") {
  const feedback = document.getElementById("match-feedback");

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

function renderMatchActionCopy() {
  const newRound = document.getElementById("match-new-round");
  const newRoundLabel = document.getElementById("match-new-round-label");
  const newRoundIcon = newRound?.querySelector(".material-symbols-rounded");
  const isResetState = matchState.hasStarted || matchState.showResults;

  if (newRound) {
    newRound.classList.toggle("primary-btn", !isResetState);
    newRound.classList.toggle("secondary-btn", isResetState);
  }

  if (newRoundLabel) {
    newRoundLabel.textContent = isResetState ? "다시 해볼까요?" : "시작해볼까요?";
  }

  if (newRoundIcon) {
    newRoundIcon.textContent = isResetState ? "autorenew" : "play_arrow";
  }
}

function renderMatchTimer() {
  const timer = document.getElementById("match-timer");
  const activeDuration = getMatchDuration(matchPreferences.duration);

  if (!timer) {
    return;
  }

  const warning = activeDuration > 0 && matchState.timeLeft <= Math.max(10, Math.floor(activeDuration / 3));
  const progress = activeDuration > 0 ? Math.max(0, Math.min(1, matchState.timeLeft / activeDuration)) : 0;
  const timerItem = timer.closest(".quiz-hud-item");

  timer.textContent = activeDuration <= 0 ? "천천히" : `${matchState.timeLeft}초`;
  timer.classList.toggle("is-warning", warning);

  if (!timerItem) {
    return;
  }

  if (typeof updateQuizTimerItem === "function") {
    updateQuizTimerItem(timerItem, progress, warning, activeDuration <= 0);
    return;
  }

  timerItem.classList.add("is-timer");
  timerItem.classList.toggle("is-warning", warning);
  timerItem.classList.toggle("is-static", activeDuration <= 0);
  timerItem.style.setProperty("--timer-progress", progress.toFixed(3));
}

function renderMatchStats() {
  const progress = document.getElementById("match-progress");
  const totalCount = matchState.sessionItems.length || getMatchTotalCount(matchPreferences.totalCount);

  if (progress) {
    progress.textContent = `${getMatchResolvedCount()} / ${totalCount}`;
  }

  renderMatchTimer();
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
  const optionsShell = document.getElementById("match-options-shell");
  const optionsToggle = document.getElementById("match-options-toggle");
  const optionsPanel = document.getElementById("match-options-panel");
  const optionsSummary = document.getElementById("match-options-summary");
  const levelSelect = document.getElementById("match-level-select");
  const filterSelect = document.getElementById("match-filter-select");
  const partSelect = document.getElementById("match-part-select");
  const basePool = getBaseMatchPool(matchPreferences.level);
  const filterCounts = getMatchFilterCounts(basePool);
  const activePart = getMatchPartFilter(matchPreferences.part, basePool);
  const availableParts = getAvailableMatchParts(basePool);
  const isSettingsLocked = matchState.hasStarted && !matchState.showResults;
  const shouldShowOptionsPanel = !isSettingsLocked && matchPreferences.optionsOpen !== false;

  if (optionsSummary) {
    optionsSummary.textContent = getMatchOptionsSummaryText();
  }

  if (levelSelect) {
    levelSelect.value = getMatchLevel(matchPreferences.level);
    levelSelect.disabled = isSettingsLocked;
  }

  populateMatchFilterSelect(filterSelect, filterCounts);
  populateMatchPartSelect(partSelect, availableParts, activePart);

  if (filterSelect) {
    filterSelect.disabled = isSettingsLocked;
  }

  if (partSelect) {
    partSelect.disabled = isSettingsLocked;
  }

  refreshMatchPool();
  setMatchActionAvailability(matchPool.length > 0);

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

  document.querySelectorAll("[data-match-count]").forEach((button) => {
    const active = Number(button.dataset.matchCount) === getMatchTotalCount(matchPreferences.totalCount);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-match-time]").forEach((button) => {
    const active = Number(button.dataset.matchTime) === getMatchDuration(matchPreferences.duration);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setMatchActionAvailability(startEnabled) {
  const newRound = document.getElementById("match-new-round");

  if (newRound) {
    newRound.disabled = !startEnabled;
  }
}

function createMatchCard(card, selectedId) {
  const button = document.createElement("button");
  const matched = matchState.matchedIds.includes(card.id);
  const wrong =
    (card.side === "left" && matchState.wrongLeft === card.id) ||
    (card.side === "right" && matchState.wrongRight === card.id);

  button.type = "button";
  button.className = "match-card";
  button.textContent = card.value;
  button.disabled = matched || matchState.isLocked || matchState.timedOut;

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
    handleMatchSelection(card);
  });

  return button;
}

function renderMatchBoard() {
  const leftList = document.getElementById("match-left-list");
  const rightList = document.getElementById("match-right-list");

  if (!leftList || !rightList) {
    return;
  }

  leftList.innerHTML = "";
  rightList.innerHTML = "";

  matchState.leftCards.forEach((card) => {
    leftList.appendChild(createMatchCard(card, matchState.selectedLeft));
  });
  matchState.rightCards.forEach((card) => {
    rightList.appendChild(createMatchCard(card, matchState.selectedRight));
  });

  renderMatchStats();
}

function getFilteredMatchResults(filter = getMatchResultFilter(matchState.resultFilter)) {
  if (filter === "correct") {
    return matchState.results.filter((item) => item.status === "correct");
  }

  if (filter === "wrong") {
    return matchState.results.filter((item) => item.status === "wrong");
  }

  return matchState.results;
}

function renderMatchBulkActionButton(results) {
  const bulkActionButton = document.getElementById("match-result-bulk-action");
  const bulkActionLabel = document.getElementById("match-result-bulk-label");
  const bulkActionIcon = bulkActionButton?.querySelector(".material-symbols-rounded");

  if (!bulkActionButton || !bulkActionLabel || !bulkActionIcon) {
    return;
  }

  const uniqueIds = Array.from(new Set(results.map((item) => item.id).filter(Boolean)));
  const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isWordSavedToMemorizationList(id));
  const actionLabel = allSaved ? "전체 빼기" : "전체 담기";
  const actionTitle =
    uniqueIds.length === 0
      ? "지금 담아둘 단어가 없어요."
      : allSaved
        ? "지금 보이는 단어를 다시 볼래요에서 모두 뺄게요."
        : "지금 보이는 단어를 다시 볼래요에 모두 담아둘게요.";

  bulkActionButton.disabled = uniqueIds.length === 0;
  bulkActionButton.dataset.matchBulkAction = allSaved ? "remove" : "save";
  bulkActionButton.setAttribute("aria-label", actionTitle);
  bulkActionButton.title = actionTitle;
  bulkActionLabel.textContent = actionLabel;
  bulkActionIcon.textContent = allSaved ? "delete_sweep" : "bookmark_add";
}

function renderMatchResultFilterOptions(counts) {
  const filterSelect = document.getElementById("match-result-filter");

  if (!filterSelect) {
    return;
  }

  filterSelect.innerHTML = matchResultFilterOptions
    .map(
      (filter) =>
        `<option value="${filter}">${matchResultFilterLabels[filter]} (${counts[filter]})</option>`
    )
    .join("");
  filterSelect.value = getMatchResultFilter(matchState.resultFilter);
}

function renderMatchResults() {
  const resultView = document.getElementById("match-result-view");
  const total = document.getElementById("match-result-total");
  const correct = document.getElementById("match-result-correct");
  const wrong = document.getElementById("match-result-wrong");
  const empty = document.getElementById("match-result-empty");
  const list = document.getElementById("match-result-list");
  const filterSelect = document.getElementById("match-result-filter");
  const bulkActionButton = document.getElementById("match-result-bulk-action");
  const counts = getMatchResultCounts();
  const filteredResults = getFilteredMatchResults();

  if (!resultView || !total || !correct || !wrong || !empty || !list || !filterSelect || !bulkActionButton) {
    return;
  }

  total.textContent = String(counts.all);
  correct.textContent = String(counts.correct);
  wrong.textContent = String(counts.wrong);
  renderMatchResultFilterOptions(counts);
  renderMatchBulkActionButton(filteredResults);

  if (!filteredResults.length) {
    empty.hidden = false;
    empty.textContent = `${matchResultFilterLabels[getMatchResultFilter(matchState.resultFilter)]} 결과는 아직 없어요.`;
    list.innerHTML = "";
    return;
  }

  empty.hidden = true;
  list.innerHTML = filteredResults
    .map((item) => {
      const saved = isWordSavedToMemorizationList(item.id);
      const statusLabel = item.status === "correct" ? "정답" : "오답";
      const actionLabel = saved ? "다시 볼래요에서 빼기" : "다시 볼래요에 담기";
      const actionIcon = saved ? "delete" : "bookmark_add";

      return `
        <article class="match-result-item is-${item.status}">
          <div class="match-result-item-head">
            <div class="match-result-item-badges">
              <span class="match-result-badge is-${item.status}">${statusLabel}</span>
              <span class="match-result-level">${formatMatchLevelLabel(item.level)}</span>
            </div>
            <button
              class="secondary-btn match-save-btn icon-only-btn${saved ? " is-saved" : ""}"
              type="button"
              data-match-save="${item.id}"
              aria-label="${actionLabel}"
              aria-pressed="${saved ? "true" : "false"}"
              title="${actionLabel}"
            >
              <span class="material-symbols-rounded" aria-hidden="true">${actionIcon}</span>
            </button>
          </div>
          <div class="match-result-item-main">
            <strong>${item.reading}</strong>
            <p>${item.meaning}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMatchScreen() {
  const board = document.getElementById("match-board");
  const empty = document.getElementById("match-empty");
  const playView = document.getElementById("match-play-view");
  const resultView = document.getElementById("match-result-view");
  const feedback = document.getElementById("match-feedback");
  const hasVisibleFeedback = Boolean(feedback?.textContent);
  const shouldShowPlayView = !matchState.showResults && (matchState.hasStarted || hasVisibleFeedback);
  const shouldShowEmpty = !matchState.hasStarted && !matchState.showResults && !hasVisibleFeedback;
  const shouldShowBoard = shouldShowPlayView || matchState.showResults || shouldShowEmpty;

  if (board) {
    board.hidden = !shouldShowBoard;
  }

  if (empty) {
    empty.hidden = !shouldShowEmpty;

    if (shouldShowEmpty) {
      empty.textContent = "준비됐다면 시작해볼까요?";
    }
  }

  if (playView) {
    playView.hidden = !shouldShowPlayView;
  }

  if (resultView) {
    resultView.hidden = !matchState.showResults;
  }

  renderMatchSettings();
  renderMatchActionCopy();
  renderMatchStats();

  if (matchState.showResults) {
    renderMatchResults();
  } else {
    renderMatchBoard();
  }
}

function startMatchRoundTimer() {
  const activeDuration = getMatchDuration(matchPreferences.duration);

  stopMatchRoundTimer();
  matchState.timeLeft = activeDuration;
  renderMatchTimer();

  if (activeDuration <= 0) {
    return;
  }

  matchRoundTimer = window.setInterval(() => {
    matchState.timeLeft = Math.max(0, matchState.timeLeft - 1);
    renderMatchTimer();

    if (matchState.timeLeft === 0) {
      stopMatchRoundTimer();
      handleMatchTimeout();
    }
  }, 1000);
}

function enterMatchReadyState(message = "") {
  clearAllMatchTimers();
  matchState.sessionItems = [];
  matchState.pageItems = [];
  matchState.results = [];
  matchState.leftCards = [];
  matchState.rightCards = [];
  matchState.pageIndex = 0;
  matchState.resultFilter = "all";
  matchState.showResults = false;
  matchState.hasStarted = false;
  resetCurrentPageState();
  setMatchActionAvailability(true);
  setMatchFeedback(message);
  renderMatchScreen();
}

function openMatchPage(pageItems) {
  matchState.hasStarted = true;
  matchState.showResults = false;
  matchState.pageItems = pageItems;
  resetCurrentPageState();
  matchState.leftCards = shuffleMatchItems(
    pageItems.map((item) => ({
      id: item.id,
      value: item.reading,
      side: "left"
    }))
  );
  matchState.rightCards = shuffleMatchItems(
    pageItems.map((item) => ({
      id: item.id,
      value: item.meaning,
      side: "right"
    }))
  );
  setMatchActionAvailability(true);
  setMatchFeedback("");
  renderMatchScreen();
  startMatchRoundTimer();
}

function showMatchResults() {
  clearAllMatchTimers();
  resetSelectedCards();
  matchState.showResults = true;
  matchState.isLocked = false;
  matchState.timedOut = false;
  setMatchActionAvailability(true);
  renderMatchScreen();
}

function queueMatchPageTransition(callback) {
  clearMatchTransitionTimer();
  matchTransitionTimer = window.setTimeout(() => {
    matchTransitionTimer = null;
    callback();
  }, matchPageTransitionDelay);
}

function moveToNextMatchPage() {
  matchState.pageIndex += 1;
  const nextItems = getCurrentPageItems(matchState.pageIndex);

  if (!nextItems.length) {
    showMatchResults();
    return;
  }

  openMatchPage(nextItems);
}

function buildMatchSessionItems() {
  refreshMatchPool();

  if (!matchPool.length) {
    return [];
  }

  const totalCount = Math.min(getMatchTotalCount(matchPreferences.totalCount), matchPool.length);
  return shuffleMatchItems(matchPool).slice(0, totalCount);
}

function startMatchSession(items = buildMatchSessionItems()) {
  clearAllMatchTimers();

  if (!items.length) {
    renderMatchUnavailableState("단어를 불러오는 중이에요. 잠시 후 다시 해볼까요?");
    return;
  }

  matchState.sessionItems = items.map((item) => ({ ...item }));
  matchState.results = items.map((item) => ({
    id: item.id,
    level: item.level,
    reading: item.reading,
    meaning: item.meaning,
    status: "pending"
  }));
  matchState.pageIndex = 0;
  matchState.resultFilter = "all";
  matchState.hasStarted = true;
  openMatchPage(getCurrentPageItems(0));
}

function replayCurrentMatchPage() {
  const currentItems = [...matchState.pageItems];

  if (!currentItems.length) {
    startMatchSession();
    return;
  }

  resetMatchResultStatus(currentItems.map((item) => item.id));
  openMatchPage(currentItems);
}

function replayCurrentMatchSet() {
  const sessionItems = [...matchState.sessionItems];

  if (!sessionItems.length) {
    startMatchSession();
    return;
  }

  startMatchSession(sessionItems);
}

function renderMatchUnavailableState(message) {
  const leftList = document.getElementById("match-left-list");
  const rightList = document.getElementById("match-right-list");
  const resultList = document.getElementById("match-result-list");
  const resultEmpty = document.getElementById("match-result-empty");

  clearAllMatchTimers();
  matchState.sessionItems = [];
  matchState.pageItems = [];
  matchState.results = [];
  matchState.leftCards = [];
  matchState.rightCards = [];
  matchState.pageIndex = 0;
  matchState.hasStarted = false;
  matchState.showResults = false;
  resetCurrentPageState();

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

  setMatchActionAvailability(false);
  setMatchFeedback(message, "is-fail");
  renderMatchScreen();
}

function finalizeCompletedMatchPage() {
  matchState.isLocked = true;
  renderMatchBoard();

  if (matchState.pageIndex + 1 >= getMatchPageCount()) {
    setMatchFeedback("");
    queueMatchPageTransition(showMatchResults);
    return;
  }

  setMatchFeedback("");
  queueMatchPageTransition(moveToNextMatchPage);
}

function handleSuccessfulMatch(id) {
  matchState.matchedIds.push(id);
  setMatchResultStatus([id], "correct");

  if (matchState.matchedIds.length === matchState.pageItems.length) {
    stopMatchRoundTimer();
    finalizeCompletedMatchPage();
    return;
  }

  setMatchFeedback("");
}

function handleFailedMatch() {
  setMatchFeedback("");
}

function queueFailedMatchReset() {
  matchState.isLocked = true;
  renderMatchBoard();

  clearWrongMatchTimer();
  wrongMatchTimer = window.setTimeout(() => {
    matchState.wrongLeft = null;
    matchState.wrongRight = null;
    matchState.isLocked = false;
    resetSelectedCards();
    renderMatchBoard();
    wrongMatchTimer = null;
  }, matchWrongFlashDuration);
}

function handleMatchSelection(card) {
  if (matchState.isLocked || matchState.timedOut || matchState.matchedIds.includes(card.id)) {
    return;
  }

  if (card.side === "left") {
    matchState.selectedLeft = matchState.selectedLeft === card.id ? null : card.id;
  } else {
    matchState.selectedRight = matchState.selectedRight === card.id ? null : card.id;
  }

  renderMatchBoard();

  if (!matchState.selectedLeft || !matchState.selectedRight) {
    return;
  }

  if (matchState.selectedLeft === matchState.selectedRight) {
    handleSuccessfulMatch(matchState.selectedLeft);
    resetSelectedCards();
    renderMatchBoard();
    return;
  }

  matchState.wrongLeft = matchState.selectedLeft;
  matchState.wrongRight = matchState.selectedRight;
  handleFailedMatch();
  queueFailedMatchReset();
}

function handleMatchTimeout() {
  const remainingIds = matchState.pageItems
    .filter((item) => !matchState.matchedIds.includes(item.id))
    .map((item) => item.id);

  setMatchResultStatus(remainingIds, "wrong");
  matchState.timedOut = true;
  matchState.isLocked = true;
  resetSelectedCards();
  renderMatchBoard();

  if (matchState.pageIndex + 1 >= getMatchPageCount()) {
    setMatchFeedback("아깝네요! 시간이 끝났어요. 남은 단어는 틀린 문제로 넘기고 결과로 갈게요.", "is-fail");
    queueMatchPageTransition(showMatchResults);
    return;
  }

  setMatchFeedback("아깝네요! 시간이 끝났어요. 지금 보이는 단어는 틀린 문제로 넘기고 다음으로 갈게요.", "is-fail");
  queueMatchPageTransition(moveToNextMatchPage);
}

function startNewMatchSession() {
  if (matchState.hasStarted || matchState.showResults) {
    enterMatchReadyState();
    return;
  }

  startMatchSession();
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

function setMatchFilterPreference(filter) {
  const nextFilter = getMatchFilter(filter);

  if (matchPreferences.filter === nextFilter) {
    return;
  }

  matchPreferences.filter = nextFilter;
  saveMatchPreferences();
  renderMatchSettings();
  enterMatchReadyState();
}

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

function setMatchTotalCount(totalCount) {
  const nextCount = getMatchTotalCount(totalCount);

  if (matchPreferences.totalCount === nextCount) {
    return;
  }

  matchPreferences.totalCount = nextCount;
  saveMatchPreferences();
  renderMatchSettings();
  enterMatchReadyState();
}

function setMatchDuration(duration) {
  const nextDuration = getMatchDuration(duration);

  if (matchPreferences.duration === nextDuration) {
    return;
  }

  matchPreferences.duration = nextDuration;
  saveMatchPreferences();
  renderMatchSettings();
  enterMatchReadyState();
}

function setMatchResultFilter(filter) {
  const nextFilter = getMatchResultFilter(filter);

  if (matchState.resultFilter === nextFilter) {
    return;
  }

  matchState.resultFilter = nextFilter;
  renderMatchResults();
}

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
  const resultFilterSelect = document.getElementById("match-result-filter");
  const resultBulkAction = document.getElementById("match-result-bulk-action");
  const resultList = document.getElementById("match-result-list");

  if (newRound) {
    newRound.addEventListener("click", startNewMatchSession);
  }

  if (optionsToggle) {
    optionsToggle.addEventListener("click", () => {
      matchPreferences.optionsOpen = !matchPreferences.optionsOpen;
      saveMatchPreferences();
      renderMatchSettings();
    });
  }

  if (levelSelect) {
    levelSelect.addEventListener("change", (event) => {
      setMatchLevel(event.target.value);
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", (event) => {
      setMatchFilterPreference(event.target.value);
    });
  }

  if (partSelect) {
    partSelect.addEventListener("change", (event) => {
      setMatchPartPreference(event.target.value);
    });
  }

  document.querySelectorAll("[data-match-count]").forEach((button) => {
    button.addEventListener("click", () => {
      setMatchTotalCount(button.dataset.matchCount);
    });
  });

  document.querySelectorAll("[data-match-time]").forEach((button) => {
    button.addEventListener("click", () => {
      setMatchDuration(button.dataset.matchTime);
    });
  });

  if (resultFilterSelect) {
    resultFilterSelect.addEventListener("change", (event) => {
      setMatchResultFilter(event.target.value);
    });
  }

  if (resultBulkAction) {
    resultBulkAction.addEventListener("click", () => {
      const filteredResults = getFilteredMatchResults();
      const uniqueIds = Array.from(new Set(filteredResults.map((item) => item.id).filter(Boolean)));

      if (!uniqueIds.length) {
        return;
      }

      if (resultBulkAction.dataset.matchBulkAction === "remove") {
        uniqueIds.forEach((id) => {
          removeWordFromMemorizationList(id);
        });
      } else {
        uniqueIds.forEach((id) => {
          saveWordToMemorizationList(id);
        });
      }

      renderMatchResults();
    });
  }

  if (resultList) {
    resultList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-match-save]");

      if (!button) {
        return;
      }

      if (isWordSavedToMemorizationList(button.dataset.matchSave)) {
        removeWordFromMemorizationList(button.dataset.matchSave);
      } else {
        saveWordToMemorizationList(button.dataset.matchSave);
      }

      renderMatchResults();
    });
  }
}

renderMatchSettings();
attachMatchEventListeners();
window.addEventListener("japanote:storage-updated", (event) => {
  if (event.detail?.source !== "remote") {
    return;
  }

  if (event.detail.key === matchStorageKey) {
    const nextPreferences = loadMatchPreferences();
    Object.keys(matchPreferences).forEach((key) => {
      delete matchPreferences[key];
    });
    Object.assign(matchPreferences, nextPreferences);
    renderMatchSettings();
    enterMatchReadyState();
    return;
  }

  if (event.detail.key === studyStateStorageKey) {
    renderMatchSettings();
    enterMatchReadyState();
  }
});
enterMatchReadyState();
