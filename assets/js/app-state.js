/* Japanote — persisted UI state (split from app.js, phase 1) */
const storageKey = "jlpt-compass-state";
/** Bump when persisted shape changes; used for localStorage + future remote sync migration. */
const STATE_SCHEMA_VERSION = 4;
var state = null;
function getStudyStateStore() {
  if (globalThis.japanoteSync && typeof globalThis.japanoteSync.readValue === "function") {
    return globalThis.japanoteSync;
  }

  return null;
}

const contentLevels = ["N5", "N4", "N3"];
const allLevelValue = "all";
const selectablePracticeLevels = [allLevelValue, ...contentLevels];

const defaultState = {
  flashcardIndex: 0,
  flashcardRevealed: false,
  vocabTab: "study",
  vocabLevel: "N5",
  vocabView: "card",
  vocabFilter: "all",
  vocabPartFilter: "all",
  vocabOptionsOpen: false,
  vocabPage: 1,
  vocabQuizMode: "meaning",
  vocabQuizQuestionField: "reading",
  vocabQuizOptionField: "meaning",
  vocabQuizCount: 10,
  vocabQuizDuration: 15,
  vocabQuizOptionsOpen: false,
  vocabQuizStarted: false,
  vocabQuizResultFilter: "all",
  vocabQuizIndex: 0,
  vocabQuizFinished: false,
  vocabQuizAnswerMode: "choice",
  vocabQuizRetryOnWrong: false,
  kanjiPracticeQuestionField: "display",
  kanjiPracticeOptionField: "reading",
  kanjiPracticeQuizCount: 10,
  kanjiPracticeQuizDuration: 15,
  kanjiPracticeQuizOptionsOpen: false,
  kanjiPracticeQuizStarted: false,
  kanjiPracticeQuizFinished: false,
  kanjiMatchCount: 5,
  kanjiMatchDuration: 15,
  kanjiMatchOptionsOpen: false,
  kanjiOptionsOpen: false,
  kanjiTab: "list",
  kanjiView: "card",
  kanjiGrade: allLevelValue,
  kanjiCollectionFilter: "all",
  kanjiPage: 1,
  kanjiFlashcardIndex: 0,
  kanjiFlashcardRevealed: false,
  kanjiFlashcardRevealStep: 0,
  kanjiReviewIds: [],
  kanjiMasteredIds: [],
  basicPracticeTrack: "hiragana",
  basicPracticeIndexes: {
    hiragana: 0,
    katakana: 0,
    words: 0,
    particles: 0,
    kanji: 0,
    sentences: 0
  },
  masteredIds: [],
  reviewIds: [],
  grammarReviewIds: [],
  grammarMasteredIds: [],
  grammarTab: "list",
  grammarLevel: allLevelValue,
  grammarFilter: "all",
  grammarView: "card",
  grammarPage: 1,
  grammarFlashcardIndex: 0,
  grammarFlashcardRevealed: false,
  grammarPracticeOptionsOpen: false,
  grammarPracticeStarted: false,
  grammarPracticeLevel: "N5",
  grammarPracticeCount: 10,
  grammarPracticeDuration: 25,
  grammarPracticeSessionQuestionIndex: 0,
  grammarPracticeIndexes: { all: 0, N5: 0, N4: 0, N3: 0 },
  quizIndex: 0,
  quizLevel: "N5",
  quizMode: "meaning",
  quizSessionSize: 20,
  quizDuration: 15,
  quizOptionsOpen: false,
  quizSessionFinished: false,
  quizMistakes: [],
  quizSessionMistakeIds: [],
  quizCorrectCount: 0,
  quizAnsweredCount: 0,
  readingLevel: "N5",
  readingCount: 10,
  readingDuration: 45,
  readingOptionsOpen: false,
  readingStarted: false,
  readingSessionQuestionIndex: 0,
  readingIndexes: { all: 0, N5: 0, N4: 0, N3: 0 },
  charactersTab: "library",
  charactersLibraryTab: "hiragana",
  kanaSetupOpen: false,
  writingSetupOpen: false,
  lastStudyDate: null,
  streak: 0,
  vocabTodayReview: { date: null, signature: "", ids: [] },
  recentVocabWrongIds: [],
  vocabRecallMasteryCounts: {},
  vocabQuizTodayReviewActive: false,
  stateVersion: STATE_SCHEMA_VERSION
};

function loadState() {
  const syncStore = getStudyStateStore();

  if (syncStore) {
    const saved = syncStore.readValue(storageKey, null);

    if (saved && typeof saved === "object") {
      return {
        ...defaultState,
        ...saved,
        basicPracticeIndexes: {
          ...defaultState.basicPracticeIndexes,
          ...(saved?.basicPracticeIndexes || {})
        },
        readingIndexes: { ...defaultState.readingIndexes, ...(saved?.readingIndexes || {}) },
        grammarPracticeIndexes: {
          ...defaultState.grammarPracticeIndexes,
          ...(saved?.grammarPracticeIndexes || {})
        }
      };
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return {
      ...defaultState,
      ...saved,
      basicPracticeIndexes: {
        ...defaultState.basicPracticeIndexes,
        ...(saved?.basicPracticeIndexes || {})
      },
      readingIndexes: { ...defaultState.readingIndexes, ...(saved?.readingIndexes || {}) },
      grammarPracticeIndexes: {
        ...defaultState.grammarPracticeIndexes,
        ...(saved?.grammarPracticeIndexes || {})
      }
    };
  } catch (error) {
    return { ...defaultState };
  }
}

function normalizeBasicPracticeState(inputState) {
  const nextState = { ...inputState };
  const savedIndexes = { ...(inputState?.basicPracticeIndexes || {}) };

  if (nextState.basicPracticeTrack === "kana" || !basicPracticeSets[nextState.basicPracticeTrack]) {
    nextState.basicPracticeTrack = "hiragana";
  }

  // 기존 단일 kana 트랙 데이터를 히라가나/카타카나 분리 구조로 읽을 때만 옮긴다.
  nextState.basicPracticeIndexes = {
    ...defaultState.basicPracticeIndexes,
    ...savedIndexes,
    hiragana: savedIndexes.hiragana ?? savedIndexes.kana ?? 0,
    katakana: savedIndexes.katakana ?? 0
  };
  delete nextState.basicPracticeIndexes.kana;

  return nextState;
}

function getUniqueStudyIdList(ids) {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
}

function normalizeStudyStatusState({ reviewIds = [], masteredIds = [], migratedMasteredIds = [] }) {
  const nextMasteredIds = getUniqueStudyIdList([...(Array.isArray(masteredIds) ? masteredIds : []), ...migratedMasteredIds]);
  const masteredIdSet = new Set(nextMasteredIds);
  const nextReviewIds = getUniqueStudyIdList(reviewIds).filter((id) => !masteredIdSet.has(id));

  return {
    reviewIds: nextReviewIds,
    masteredIds: nextMasteredIds
  };
}

function normalizeVocabRecallMasteryCounts(source) {
  const raw = source && typeof source === "object" ? source : {};

  return Object.entries(raw).reduce((map, [id, value]) => {
    const normalizedId = String(id || "").trim();
    const normalizedCount = Number(value);

    if (!normalizedId || !Number.isFinite(normalizedCount) || normalizedCount <= 0) {
      return map;
    }

    map[normalizedId] = Math.min(3, Math.max(1, Math.floor(normalizedCount)));
    return map;
  }, {});
}

function normalizeLoadedState(inputState) {
  const nextState = normalizeBasicPracticeState(inputState);

  nextState.quizLevel = getQuizLevel(nextState.quizLevel);
  nextState.quizMode = getQuizMode(nextState.quizMode);
  nextState.quizSessionSize = getQuizSessionSize(nextState.quizSessionSize);
  nextState.quizDuration = getQuizDuration(nextState.quizDuration);
  nextState.quizSessionFinished = false;
  nextState.quizIndex = 0;
  nextState.quizMistakes = Array.isArray(nextState.quizMistakes) ? nextState.quizMistakes : [];
  nextState.quizSessionMistakeIds = [];
  ({
    reviewIds: nextState.reviewIds,
    masteredIds: nextState.masteredIds
  } = normalizeStudyStatusState({
    reviewIds: nextState.reviewIds,
    masteredIds: nextState.masteredIds
  }));
  ({
    reviewIds: nextState.kanjiReviewIds,
    masteredIds: nextState.kanjiMasteredIds
  } = normalizeStudyStatusState({
    reviewIds: nextState.kanjiReviewIds,
    masteredIds: nextState.kanjiMasteredIds
  }));
  // 기존 문법 체크 기록을 잃지 않도록 schema v1의 done 목록을 mastered 목록으로 한 번만 이관한다.
  ({
    reviewIds: nextState.grammarReviewIds,
    masteredIds: nextState.grammarMasteredIds
  } = normalizeStudyStatusState({
    reviewIds: nextState.grammarReviewIds,
    masteredIds: nextState.grammarMasteredIds,
    migratedMasteredIds: nextState.grammarDoneIds
  }));
  nextState.vocabTab = getVocabTab(nextState.vocabTab);
  nextState.vocabLevel = getVocabLevel(nextState.vocabLevel);
  nextState.vocabView = ["card", "list"].includes(nextState.vocabView) ? nextState.vocabView : "card";
  if (isVocabPagePath()) {
    const hashTab = window.location.hash.replace(/^#/, "").toLowerCase();

    if (["quiz", "match"].includes(hashTab)) {
      nextState.vocabTab = hashTab;
    }
  }
  nextState.vocabFilter = ["all", "review", "mastered", "unmarked"].includes(nextState.vocabFilter)
    ? nextState.vocabFilter
    : "all";
  nextState.vocabPartFilter =
    normalizeQuizText(nextState.vocabPartFilter) === vocabPartAllValue
      ? vocabPartAllValue
      : normalizeQuizText(nextState.vocabPartFilter);
  nextState.vocabPage = Number.isFinite(Number(nextState.vocabPage)) ? Math.max(1, Number(nextState.vocabPage)) : 1;
  nextState.vocabQuizMode = getVocabQuizMode(nextState.vocabQuizMode);
  nextState.vocabQuizQuestionField = getVocabQuizQuestionField(nextState.vocabQuizQuestionField, nextState.vocabQuizMode);
  nextState.vocabQuizOptionField = getVocabQuizOptionField(
    nextState.vocabQuizOptionField,
    nextState.vocabQuizQuestionField,
    nextState.vocabQuizMode
  );
  nextState.vocabQuizCount = getVocabQuizCount(nextState.vocabQuizCount);
  nextState.vocabQuizDuration = getVocabQuizDuration(nextState.vocabQuizDuration);
  nextState.vocabQuizOptionsOpen = false;
  nextState.vocabQuizStarted = false;
  nextState.vocabQuizResultFilter = ["all", "correct", "wrong"].includes(nextState.vocabQuizResultFilter)
    ? nextState.vocabQuizResultFilter
    : "all";
  nextState.vocabQuizIndex = 0;
  nextState.vocabQuizFinished = false;
  nextState.vocabQuizTodayReviewActive = false;
  nextState.vocabQuizAnswerMode = ["choice", "recall"].includes(nextState.vocabQuizAnswerMode)
    ? nextState.vocabQuizAnswerMode
    : "choice";
  nextState.vocabQuizRetryOnWrong = typeof nextState.vocabQuizRetryOnWrong === "boolean" ? nextState.vocabQuizRetryOnWrong : false;
  const savedRecentWrong = Array.isArray(nextState.recentVocabWrongIds) ? nextState.recentVocabWrongIds.filter(Boolean) : [];
  const recentWrongSeen = new Set();
  const recentWrongOrdered = [];
  savedRecentWrong.forEach((id) => {
    if (!id || recentWrongSeen.has(id)) {
      return;
    }

    recentWrongSeen.add(id);
    recentWrongOrdered.push(id);
  });
  nextState.recentVocabWrongIds = recentWrongOrdered.slice(0, 30);
  nextState.vocabRecallMasteryCounts = normalizeVocabRecallMasteryCounts(nextState.vocabRecallMasteryCounts);
  const savedTodayReview = nextState.vocabTodayReview;
  nextState.vocabTodayReview =
    savedTodayReview && typeof savedTodayReview === "object"
      ? {
          date: typeof savedTodayReview.date === "string" ? savedTodayReview.date : null,
          signature: typeof savedTodayReview.signature === "string" ? savedTodayReview.signature : "",
          ids: getUniqueStudyIdList(savedTodayReview.ids || [])
        }
      : { date: null, signature: "", ids: [] };
  nextState.kanjiPracticeQuestionField = getKanjiPracticeQuestionField(nextState.kanjiPracticeQuestionField);
  nextState.kanjiPracticeOptionField = getKanjiPracticeOptionField(
    nextState.kanjiPracticeOptionField,
    nextState.kanjiPracticeQuestionField
  );
  nextState.kanjiPracticeQuizCount = getKanjiPracticeQuizCount(nextState.kanjiPracticeQuizCount);
  nextState.kanjiPracticeQuizDuration = getKanjiPracticeQuizDuration(nextState.kanjiPracticeQuizDuration);
  nextState.kanjiPracticeQuizOptionsOpen = false;
  nextState.kanjiPracticeQuizStarted = false;
  nextState.kanjiPracticeQuizFinished = false;
  nextState.kanjiMatchCount = kanjiMatchCountOptions.includes(Number(nextState.kanjiMatchCount))
    ? Number(nextState.kanjiMatchCount)
    : 5;
  nextState.kanjiMatchDuration = getQuizDuration(nextState.kanjiMatchDuration);
  nextState.kanjiMatchOptionsOpen = false;
  nextState.kanjiOptionsOpen = false;
  nextState.kanjiTab = getKanjiTab(nextState.kanjiTab);
  nextState.kanjiView = ["card", "list"].includes(nextState.kanjiView) ? nextState.kanjiView : "card";
  nextState.kanjiGrade = getKanjiGrade(nextState.kanjiGrade);
  nextState.kanjiCollectionFilter = getKanjiCollectionFilter(nextState.kanjiCollectionFilter);
  nextState.kanjiPage = Number.isFinite(Number(nextState.kanjiPage)) ? Math.max(1, Number(nextState.kanjiPage)) : 1;
  nextState.kanjiFlashcardIndex = Number.isFinite(Number(nextState.kanjiFlashcardIndex))
    ? Math.max(0, Number(nextState.kanjiFlashcardIndex))
    : 0;
  nextState.kanjiFlashcardRevealStep = Number.isFinite(Number(nextState.kanjiFlashcardRevealStep))
    ? Math.min(Math.max(Math.floor(Number(nextState.kanjiFlashcardRevealStep)), 0), 2)
    : nextState.kanjiFlashcardRevealed === true
      ? 2
      : 0;
  nextState.kanjiFlashcardRevealed = nextState.kanjiFlashcardRevealStep > 0;
  nextState.grammarLevel = getGrammarLevel(nextState.grammarLevel);
  nextState.grammarFilter = getGrammarFilter(nextState.grammarFilter);
  nextState.grammarView = getGrammarView(nextState.grammarView);
  nextState.grammarPage = Number.isFinite(Number(nextState.grammarPage)) ? Math.max(1, Number(nextState.grammarPage)) : 1;
  nextState.grammarFlashcardIndex = Number.isFinite(Number(nextState.grammarFlashcardIndex))
    ? Math.max(0, Number(nextState.grammarFlashcardIndex))
    : 0;
  nextState.grammarFlashcardRevealed = nextState.grammarFlashcardRevealed === true;
  nextState.grammarPracticeOptionsOpen = false;
  nextState.grammarPracticeStarted = false;
  nextState.grammarPracticeLevel = getGrammarPracticeLevel(nextState.grammarPracticeLevel);
  nextState.grammarPracticeCount = getGrammarPracticeCount(nextState.grammarPracticeCount);
  nextState.grammarPracticeSessionQuestionIndex = Number.isFinite(Number(nextState.grammarPracticeSessionQuestionIndex))
    ? Math.max(0, Number(nextState.grammarPracticeSessionQuestionIndex))
    : 0;
  nextState.grammarPracticeDuration = getGrammarPracticeDuration(nextState.grammarPracticeDuration);
  nextState.readingLevel = getReadingLevel(nextState.readingLevel);
  nextState.readingCount = getReadingCount(nextState.readingCount);
  nextState.readingSessionQuestionIndex = Number.isFinite(Number(nextState.readingSessionQuestionIndex))
    ? Math.max(0, Number(nextState.readingSessionQuestionIndex))
    : 0;
  nextState.readingDuration = getReadingDuration(nextState.readingDuration);
  nextState.readingStarted = false;
  nextState.charactersTab = getCharactersTab(nextState.charactersTab ?? nextState.charactersPracticeTab);
  nextState.charactersLibraryTab = getCharactersLibraryTab(nextState.charactersLibraryTab);
  nextState.grammarTab = getGrammarTab(nextState.grammarTab);
  nextState.kanaSetupOpen = false;
  nextState.writingSetupOpen = false;
  nextState.quizOptionsOpen = false;
  nextState.vocabOptionsOpen = false;
  nextState.readingOptionsOpen = false;
  refreshDynamicVocabContent("N5");
  refreshQuizContent(nextState.quizLevel);
  refreshVocabPageContent(nextState.vocabLevel);
  nextState.vocabPartFilter = getVocabPartFilter(nextState.vocabPartFilter);
  activeQuizQuestions = createQuizSession(nextState.quizMode, nextState.quizSessionSize, nextState.quizLevel);

  const loadedSchemaVersion = Number(nextState.stateVersion);
  const fromVersion =
    Number.isFinite(loadedSchemaVersion) && loadedSchemaVersion >= 1
      ? Math.floor(loadedSchemaVersion)
      : 1;
  if (fromVersion < STATE_SCHEMA_VERSION) {
    delete nextState.grammarDoneIds;
  }
  nextState.stateVersion = STATE_SCHEMA_VERSION;

  return nextState;
}

const JAPANOTE_PATH_PAGE_ID_KEY = "japanote_path_page_id";

/**
 * F5(새로고침)·뒤로/앞으로(bfcache 복원 등)일 때 true — in-page 탭은 localStorage 그대로.
 * top nav 링크로 .html이 새로 뜬 경우(navigate)는 false — 섹션 기본 탭으로 맞춤(해시/딥링크 제외).
 */
function isJapanoteNavigationReloadOrBackForward() {
  if (typeof performance === "undefined") {
    return false;
  }

  try {
    const entries = performance.getEntriesByType("navigation");
    if (entries && entries.length > 0 && entries[0].type) {
      return entries[0].type === "reload" || entries[0].type === "back_forward";
    }
  } catch (error) {
    // ignore
  }

  if (typeof performance.navigation !== "undefined" && performance.navigation !== null) {
    // legacy: 1=reload, 2=back/forward
    return performance.navigation.type === 1 || performance.navigation.type === 2;
  }

  return false;
}

/**
 * Top nav로 다른 .html로 넘어온 경우(navigate) 서브탭(단어 퀴즈, 문자 퀴즈 등)을 기본으로 맞춤.
 * 같은 URL 새로고침(F5)은 Performance API로 감지해 localStorage에 저장된 탭 유지.
 * URL hash가 #quiz / #match면(공유·북마크) 단어 쪽은 유지.
 */
function getJapanotePathPageId() {
  const p = (typeof window !== "undefined" && window.location?.pathname
    ? String(window.location.pathname)
    : ""
  ).toLowerCase();
  if (p.includes("vocab.html")) {
    return "vocab";
  }
  if (p.includes("characters.html")) {
    return "characters";
  }
  if (p.includes("kanji.html")) {
    return "kanji";
  }
  if (p.includes("grammar.html")) {
    return "grammar";
  }
  if (p.includes("reading.html")) {
    return "reading";
  }
  return "other";
}

function applyDefaultSubTabsForCurrentPathPage() {
  const current = getJapanotePathPageId();
  if (current === "vocab") {
    const h = String(window.location.hash || "")
      .replace(/^#/, "")
      .toLowerCase();
    if (!["quiz", "match"].includes(h)) {
      state.vocabTab = "study";
    }
  } else if (current === "characters") {
    state.charactersTab = "library";
  } else if (current === "kanji") {
    state.kanjiTab = "list";
  } else if (current === "grammar") {
    state.grammarTab = "list";
  }
}

function applyCrossPageTabResets() {
  if (typeof window === "undefined" || !state) {
    return;
  }
  let store = null;
  try {
    store = window.sessionStorage;
  } catch (error) {
    return;
  }
  if (!store) {
    return;
  }

  const current = getJapanotePathPageId();
  const prev = store.getItem(JAPANOTE_PATH_PAGE_ID_KEY) || "";

  if (isJapanoteNavigationReloadOrBackForward()) {
    store.setItem(JAPANOTE_PATH_PAGE_ID_KEY, current);
    return;
  }

  if (!prev || prev !== current) {
    applyDefaultSubTabsForCurrentPathPage();
    saveState();
  }
  store.setItem(JAPANOTE_PATH_PAGE_ID_KEY, current);
}

function saveState() {
  const syncStore = getStudyStateStore();

  if (syncStore) {
    syncStore.writeValue(storageKey, state);
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures so UI interactions still work in restricted environments.
  }
}
