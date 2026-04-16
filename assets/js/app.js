const storageKey = "jlpt-compass-state";
/** Bump when persisted shape changes; used for localStorage + future remote sync migration. */
const STATE_SCHEMA_VERSION = 2;
let state = null;

function getStudyStateStore() {
  if (globalThis.japanoteSync && typeof globalThis.japanoteSync.readValue === "function") {
    return globalThis.japanoteSync;
  }

  return null;
}

const contentLevels = ["N5", "N4", "N3"];
const allLevelValue = "all";
const selectablePracticeLevels = [allLevelValue, ...contentLevels];
let grammarContent = normalizeGrammarContent({});
let readingContent = normalizeReadingContent({});
let kanaContent = normalizeKanaContent({});
let kanaStrokeSvgs = normalizeKanaStrokeContent({});
let kanjiDataRows = normalizeKanjiRows([]);
let grammarItems = [];
let grammarPracticeEntriesByLevel = {};
let readingSets = {};
let kanaStudyDecks = {
  hiragana: [],
  katakana: []
};
let writingPracticePools = {
  hiragana: [],
  katakana: []
};
let kanaDerivedCollectionsReady = false;
const studyViewHelpers = globalThis.japanoteStudyViewHelpers || {};
const sharedTimer = globalThis.japanoteSharedTimer || {};
const sharedResultUi = globalThis.japanoteSharedMatchGame || {};
const applyStudyActionButtonState = studyViewHelpers.applyStudyActionButtonState;
const createStudyListCardMarkup = studyViewHelpers.createStudyListCardMarkup;
const syncStudyViewButtons = studyViewHelpers.syncStudyViewButtons;
const renderPagedStudyList = studyViewHelpers.renderPagedStudyList;
const getStudyPageCount = studyViewHelpers.getStudyPageCount;
const setElementHidden = studyViewHelpers.setElementHidden;
const scrollElementIntoView = studyViewHelpers.scrollElementIntoView;
const scrollToElementById = studyViewHelpers.scrollToElementById;
const applyPageHeading = studyViewHelpers.applyPageHeading;
const syncTabButtonsAndPanels = studyViewHelpers.syncTabButtonsAndPanels;
const syncStudyViewPanels = studyViewHelpers.syncStudyViewPanels;
const renderStudyCatalogSection = studyViewHelpers.renderStudyCatalogSection;

function getVocabStore() {
  if (globalThis.japanoteVocabStore && typeof globalThis.japanoteVocabStore.ensureLevels === "function") {
    return globalThis.japanoteVocabStore;
  }

  return null;
}

function getRequestedVocabLevels(level = "N5") {
  if (level === allLevelValue) {
    return [...contentLevels];
  }

  return contentLevels.includes(level) ? [level] : ["N5"];
}

function ensureVocabLevelsLoaded(level = "N5") {
  const vocabStore = getVocabStore();
  const requestedLevels = Array.isArray(level)
    ? Array.from(new Set(level.filter((itemLevel) => contentLevels.includes(itemLevel))))
    : getRequestedVocabLevels(level);

  if (!vocabStore) {
    return Promise.resolve([]);
  }

  return vocabStore.ensureLevels(requestedLevels);
}

function getLevelContentSets(source) {
  return contentLevels.reduce((sets, level) => {
    sets[level] = Array.isArray(source?.[level]) ? source[level] : [];
    return sets;
  }, {});
}

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

function normalizeReadingContent(payload) {
  const normalized = payload || {};

  return {
    sets: getLevelContentSets(normalized.sets || {})
  };
}

function normalizeKanaLibraryGroup(payload) {
  const group = payload && typeof payload === "object" ? payload : {};
  return {
    title: normalizeQuizText(group.title),
    items: Array.isArray(group.items)
      ? group.items
          .map((item) => {
            const normalizedItem = item && typeof item === "object" ? item : {};
            const reading = normalizeQuizText(normalizedItem.reading);
            const char = normalizeQuizText(normalizedItem.char);

            if (!reading || !char) {
              return null;
            }

            return {
              reading,
              char,
              quiz: normalizedItem.quiz !== false,
              group: normalizeQuizText(normalizedItem.group || group.title)
            };
          })
          .filter(Boolean)
      : []
  };
}

function normalizeKanaLibrary(payload) {
  return Array.isArray(payload) ? payload.map((group) => normalizeKanaLibraryGroup(group)) : [];
}

function normalizeKanaContent(payload) {
  const normalized = payload && typeof payload === "object" ? payload : {};

  return {
    library: {
      hiragana: normalizeKanaLibrary(normalized.library?.hiragana),
      katakana: normalizeKanaLibrary(normalized.library?.katakana)
    },
    tracks: {
      hiragana: normalizeBasicPracticeTrackOrNull(normalized.tracks?.hiragana),
      katakana: normalizeBasicPracticeTrackOrNull(normalized.tracks?.katakana)
    }
  };
}

function normalizeKanaStrokeContent(payload) {
  return payload && typeof payload === "object" ? payload : {};
}

function normalizeKanjiRows(payload) {
  return Array.isArray(payload) ? payload.filter((row) => Array.isArray(row)) : [];
}

function dispatchSupplementaryContentLoaded() {
  if (typeof window === "undefined" || typeof window.CustomEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("japanote:supplementary-content-loaded", {
      detail: {
        kanjiRows: [...kanjiDataRows],
        grammarItems: [...grammarItems]
      }
    })
  );
}

function normalizeBasicPracticeTrack(payload) {
  const track = payload && typeof payload === "object" ? payload : {};
  return {
    label: typeof track.label === "string" ? track.label : "",
    heading: typeof track.heading === "string" ? track.heading : "",
    items: Array.isArray(track.items) ? track.items : []
  };
}

function normalizeBasicPracticeTrackOrNull(payload) {
  return payload && typeof payload === "object" ? normalizeBasicPracticeTrack(payload) : null;
}

function getContentDataUrl(fileName) {
  if (typeof window === "undefined" || !window.location) {
    return fileName;
  }

  return new URL(`data/${fileName}`, window.location.href).toString();
}

function isFileProtocol() {
  return typeof window !== "undefined" && window.location && window.location.protocol === "file:";
}

function isSuccessfulResponse(response) {
  return response.status >= 200 && response.status < 300;
}

function parseJsonPayload(payloadText, fallbackLabel) {
  try {
    const parsed = typeof payloadText === "string" ? JSON.parse(payloadText) : payloadText;

    if (parsed === undefined || parsed === null) {
      throw new Error(`응답 데이터가 비어 있어요.`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse ${fallbackLabel}: ${error.message}`);
  }
}

function fetchJsonDataWithXhr(fileName, fallbackLabel) {
  const requestUrl = getContentDataUrl(fileName);

  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest !== "function") {
      reject(new Error(`XHR is not available for ${fallbackLabel}.`));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("GET", requestUrl, true);
    request.responseType = "text";

    request.onload = () => {
      const isLoaded = request.status === 0 || isSuccessfulResponse(request);

      if (!isLoaded) {
        reject(new Error(`Failed to load ${fallbackLabel} (${request.status})`));
        return;
      }

      try {
        resolve(parseJsonPayload(request.responseText, fallbackLabel));
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to load ${fallbackLabel} (XHR).`));
    };

    request.ontimeout = () => {
      reject(new Error(`Timed out while loading ${fallbackLabel} (XHR).`));
    };

    request.send();
  });
}

function fetchJsonData(fileName, fallbackLabel) {
  const requestUrl = getContentDataUrl(fileName);

  return fetch(requestUrl, {
    cache: "default",
    credentials: "same-origin"
  }).then((response) => {
    if (!isSuccessfulResponse(response)) {
      throw new Error(`Failed to load ${fallbackLabel} (${response.status})`);
    }

    return response.json();
  }).catch(() => {
    return fetchJsonDataWithXhr(fileName, fallbackLabel);
  });
}

function refreshGrammarContentState(payload) {
  const normalized = normalizeGrammarContent(payload || {});
  grammarContent = normalized;
  grammarItems = normalized.items;
  grammarPracticeEntriesByLevel = getLevelContentSets(normalized.practiceEntriesByLevel);
  grammarPracticeEntriesByLevel[allLevelValue] = getAllPracticeSets(grammarPracticeEntriesByLevel);
  globalThis.JAPANOTE_GRAMMAR_ITEMS = [...grammarItems];
}

function refreshReadingContentState(payload) {
  const normalized = normalizeReadingContent(payload || {});
  readingContent = normalized;
  readingSets = getLevelContentSets(normalized.sets);
  readingSets[allLevelValue] = getAllPracticeSets(readingSets);
}

function refreshKanaContentState(payload) {
  const normalized = normalizeKanaContent(payload || {});
  kanaContent = normalized;
  kanaStudyDecks = {
    hiragana: normalizeKanaLibrary(normalized.library?.hiragana),
    katakana: normalizeKanaLibrary(normalized.library?.katakana)
  };

  if (normalized.tracks.hiragana) {
    basicPracticeSets.hiragana = normalized.tracks.hiragana;
  } else {
    delete basicPracticeSets.hiragana;
  }

  if (normalized.tracks.katakana) {
    basicPracticeSets.katakana = normalized.tracks.katakana;
  } else {
    delete basicPracticeSets.katakana;
  }

  delete basicPracticeSets.kana;

  if (kanaDerivedCollectionsReady) {
    refreshWritingPracticePools();
  }
}

function refreshKanaStrokeContent(payload) {
  kanaStrokeSvgs = normalizeKanaStrokeContent(payload || {});
}

function refreshKanjiRows(payload) {
  kanjiDataRows = normalizeKanjiRows(payload || []);
  globalThis.JAPANOTE_KANJI_DATA = [...kanjiDataRows];
}

function normalizeQuizQuestionList(payload) {
  const candidate = Array.isArray(payload) ? payload : [];
  return candidate.length ? candidate : [];
}

function refreshBasicPracticeSets(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  basicPracticeSets = {
    ...basicPracticeSets,
    words: normalizeBasicPracticeTrack(source.words),
    particles: normalizeBasicPracticeTrackOrNull(source.particles),
    kanji: normalizeBasicPracticeTrackOrNull(source.kanji),
    sentences: normalizeBasicPracticeTrackOrNull(source.sentences)
  };
}

function refreshFallbackFlashcards(payload) {
  fallbackFlashcards = normalizeQuizQuestionList(payload?.flashcards);
  flashcards = [...fallbackFlashcards];
  vocabListItems = [...fallbackFlashcards];
}

function refreshQuizQuestions(payload) {
  quizQuestions = normalizeQuizQuestionList(payload?.questions);
}

function isCharactersPage() {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(document.getElementById("hiragana-table") || document.getElementById("writing-practice-shell"));
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

function loadReadingDataFromJson() {
  return fetchJsonData("reading.json", "reading.json")
    .then((payload) => {
      refreshReadingContentState(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load reading.json. Using empty reading data.", error);
      refreshReadingContentState(readingContent);
      return null;
    });
}

function loadKanaDataFromJson() {
  if (!isCharactersPage()) {
    refreshKanaContentState(kanaContent);
    return Promise.resolve(null);
  }

  return fetchJsonData("kana.json", "kana.json")
    .then((payload) => {
      refreshKanaContentState(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load kana.json. Using empty kana data.", error);
      refreshKanaContentState({});
      return null;
    });
}

function loadKanaStrokeDataFromJson() {
  if (!isCharactersPage()) {
    refreshKanaStrokeContent(kanaStrokeSvgs);
    return Promise.resolve(null);
  }

  return fetchJsonData("kana-strokes.json", "kana-strokes.json")
    .then((payload) => {
      refreshKanaStrokeContent(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load kana-strokes.json. Using empty kana stroke data.", error);
      refreshKanaStrokeContent({});
      return null;
    });
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

function loadBasicPracticeSetsFromJson() {
  return fetchJsonData("basic-practice.json", "basic-practice.json")
    .then((payload) => {
      refreshBasicPracticeSets(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load basic-practice.json. Using empty basic practice data.", error);
      refreshBasicPracticeSets({});
      return null;
    });
}

function loadFallbackFlashcardsFromJson() {
  return fetchJsonData("fallback-flashcards.json", "fallback-flashcards.json")
    .then((payload) => {
      refreshFallbackFlashcards(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load fallback-flashcards.json. Using empty flashcard data.", error);
      refreshFallbackFlashcards({});
      return null;
    });
}

function loadQuizQuestionsFromJson() {
  return fetchJsonData("quiz-questions.json", "quiz-questions.json")
    .then((payload) => {
      refreshQuizQuestions(payload || {});
      return payload;
    })
    .catch((error) => {
      console.warn("Failed to load quiz-questions.json. Using empty quiz data.", error);
      refreshQuizQuestions({});
      return null;
    });
}

function loadSupplementaryContentData() {
  return Promise.all([
    loadGrammarDataFromJson(),
    loadReadingDataFromJson(),
    loadKanaDataFromJson(),
    loadKanaStrokeDataFromJson(),
    loadKanjiDataFromJson(),
    loadBasicPracticeSetsFromJson(),
    loadFallbackFlashcardsFromJson(),
    loadQuizQuestionsFromJson()
  ]).then(() => {
    refreshKanjiPracticeSet();
  });
}

refreshGrammarContentState(grammarContent);
refreshReadingContentState(readingContent);
refreshKanaStrokeContent(kanaStrokeSvgs);
refreshKanjiRows(kanjiDataRows);

function getAllPracticeSets(levelSets = {}) {
  return contentLevels.reduce((items, level) => items.concat(levelSets[level] || []), []);
}

function withTaggedVocabLevel(items, level) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    _level: item?._level || item?.level || level
  }));
}

function getDynamicVocabSourceForLevel(level) {
  const vocabStore = getVocabStore();
  const items = vocabStore && typeof vocabStore.getLevelItems === "function" ? vocabStore.getLevelItems(level) : [];
  return withTaggedVocabLevel(items, level);
}

function getDynamicVocabSource(level = "N5") {
  return getRequestedVocabLevels(level).reduce((items, itemLevel) => {
    return items.concat(getDynamicVocabSourceForLevel(itemLevel));
  }, []);
}

let fallbackFlashcards = [];


let flashcards = [...fallbackFlashcards];
let vocabListItems = [...fallbackFlashcards];
const vocabPageSize = 20;
const kanjiPageSize = 20;
const grammarPageSize = 20;
const vocabQuizSessionSize = 12;
const studyCardOrderCache = {
  vocab: { signature: "", ids: [] },
  kanji: { signature: "", ids: [] },
  grammar: { signature: "", ids: [] }
};

function buildStudyCardSignature(items) {
  if (!Array.isArray(items)) {
    return "";
  }

  // 비동기 데이터 동기화 과정에서 source 배열 순서만 달라져도 카드가 다시 섞이면
  // 같은 목록인데 첫 카드가 다른 단어로 바뀌어 보이므로, 시그니처는 ID 집합 기준으로 고정한다.
  return items
    .map((item) => item?.id || "")
    .sort()
    .join("|");
}

function shuffleStudyCardIds(ids) {
  const nextIds = [...ids];

  for (let index = nextIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextIds[index], nextIds[swapIndex]] = [nextIds[swapIndex], nextIds[index]];
  }

  return nextIds;
}

function getOrderedStudyCards(key, items) {
  const source = Array.isArray(items) ? items : [];
  const orderState = studyCardOrderCache[key];

  if (!orderState || source.length <= 1) {
    return source;
  }

  const signature = buildStudyCardSignature(source);

  if (orderState.signature !== signature) {
    orderState.signature = signature;
    orderState.ids = shuffleStudyCardIds(source.map((item) => item.id));
  }

  const orderMap = new Map(orderState.ids.map((id, index) => [id, index]));

  return [...source].sort((left, right) => {
    const leftIndex = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

let basicPracticeSets = {};
refreshKanaContentState(kanaContent);


let quizQuestions = [];


let dynamicQuizSource = getDynamicVocabSource("N5");
const quizModeLabels = {
  meaning: "뜻 맞히기",
  reading: "읽기 맞히기"
};
const vocabQuizFieldLabels = {
  reading: "히라가나·가타카나",
  word: "한자",
  meaning: "뜻"
};
const vocabQuizFieldOptions = ["reading", "word", "meaning"];
const vocabQuizResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const grammarPracticeResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const readingPracticeResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const quizSessionSizeOptions = [10, 20];
const kanjiPracticeQuizCountOptions = [5, 10, 15, 20];
const kanjiMatchCountOptions = [5, 10, 15, 20];
const vocabQuizCountOptions = [5, 10, 15, 20];
const grammarPracticeCountOptions = [5, 10, 15, 20];
const readingCountOptions = [5, 10, 15, 20];
const quizDurationOptions = [10, 15, 20, 0];
const grammarPracticeDurationOptions = [15, 25, 35, 0];
const readingDurationOptions = [45, 60, 90, 0];
const kanjiQuizFieldOptions = ["display", "reading", "meaning"];
const kanjiQuizFieldLabels = {
  display: "한자",
  reading: "발음",
  meaning: "\uB73B"
};
const vocabPartAllValue = allLevelValue;
const selectableStudyLevels = [...contentLevels, allLevelValue];
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

function normalizeQuizText(value) {
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

function normalizeQuizDisplay(value) {
  return normalizeQuizText(value).replace(/\s*·\s*/g, " / ");
}

function normalizeStudyLevelValue(level, fallback = "") {
  const text = normalizeQuizText(level);
  const upper = text.toUpperCase();

  if (!text) {
    return fallback;
  }

  if (upper === allLevelValue.toUpperCase()) {
    return allLevelValue;
  }

  const matchedLevel = upper.match(/^N?([1-5])$/);
  return matchedLevel ? `N${matchedLevel[1]}` : text;
}

function formatStudyLevelLabel(level, fallback = "") {
  const normalizedLevel = normalizeStudyLevelValue(level, fallback);
  return normalizedLevel === allLevelValue ? "전체" : normalizedLevel;
}

function formatQuizLineBreaks(value) {
  return normalizeQuizText(value).replace(/\s*;\s*/g, "\n");
}

function applyDisplayTextSize(element) {
  if (!element) return;
  const box = element.closest(".basic-practice-display-box");
  if (!box) return;
  const len = (element.textContent || "").replace(/\s/g, "").length;
  if (len <= 4) {
    delete box.dataset.textSize;
  } else if (len <= 10) {
    box.dataset.textSize = "md";
  } else {
    box.dataset.textSize = "sm";
  }
}

function hasFinalConsonant(char) {
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function softenCopulaEnding(text) {
  return text
    .replace(/([가-힣])이었습니다\./g, (_, char) => `${char}이었어요.`)
    .replace(/([가-힣])였습니다\./g, (_, char) => `${char}였어요.`)
    .replace(/([가-힣])입니다\./g, (_, char) => `${char}${hasFinalConsonant(char) ? "이에요." : "예요."}`)
    .replace(/([가-힣])입니다/g, (_, char) => `${char}${hasFinalConsonant(char) ? "이에요" : "예요"}`);
}

function softenVisibleKoreanCopy(value) {
  return softenCopulaEnding(normalizeQuizText(value))
    .replace(/무엇인가요\?/g, "뭘까요?")
    .replace(/무엇을까요\?/g, "뭘까요?")
    .replace(/같습니다\./g, "같아요.")
    .replace(/씁니다\./g, "써요.")
    .replace(/됩니다\./g, "돼요.")
    .replace(/보입니다\./g, "보여요.")
    .replace(/맞습니다\./g, "맞아요.")
    .replace(/갑니다\./g, "가요.")
    .replace(/옵니다\./g, "와요.")
    .replace(/삽니다\./g, "사요.")
    .replace(/합니다\./g, "해요.")
    .replace(/마십니다\./g, "마셔요.")
    .replace(/읽습니다\./g, "읽어요.")
    .replace(/만납니다\./g, "만나요.")
    .replace(/나옵니다\./g, "나와요.")
    .replace(/익힙니다\./g, "익혀요.")
    .replace(/배웁니다\./g, "배워요.")
    .replace(/좋아합니다\./g, "좋아해요.")
    .replace(/그쳤습니다\./g, "그쳤어요.")
    .replace(/피했습니다\./g, "피했어요.")
    .replace(/생각합니다\./g, "생각해요.")
    .replace(/말합니다\./g, "말해요.")
    .replace(/묻습니다\./g, "묻고 있어요.");
}

function softenExplanationCopy(value) {
  return softenVisibleKoreanCopy(value);
}

function getQuizDisplayWord(item) {
  return normalizeQuizDisplay(item.pron || item.showEntry || item.show_entry || item.entry);
}

function getQuizReading(item) {
  return normalizeQuizText(item.entry || item.showEntry || item.show_entry).replace(/-/g, "");
}

function getQuizMeaning(item) {
  if (!Array.isArray(item.means)) {
    return "";
  }

  return normalizeQuizText(item.means.find((value) => normalizeQuizText(value)) || "");
}

function getQuizPart(item) {
  if (!Array.isArray(item.parts)) {
    return "";
  }

  return normalizeQuizText(item.parts[0] || "");
}

function getQuizSessionSize(value) {
  return Number(value) === 10 ? 10 : 20;
}

function getQuizMode(value = state?.quizMode) {
  return value === "reading" ? "reading" : "meaning";
}

function getVocabQuizMode(value = state?.vocabQuizMode) {
  return value === "word" ? "word" : "meaning";
}

function getVocabQuizField(value, fallback = "reading") {
  return vocabQuizFieldOptions.includes(value) ? value : fallback;
}

function getLegacyVocabQuizQuestionField(mode = state?.vocabQuizMode) {
  return getVocabQuizMode(mode) === "word" ? "meaning" : "reading";
}

function getLegacyVocabQuizOptionField(mode = state?.vocabQuizMode) {
  return getVocabQuizMode(mode) === "word" ? "word" : "meaning";
}

function getDefaultVocabQuizOptionField(questionField) {
  return getVocabQuizField(questionField) === "meaning" ? "word" : "meaning";
}

function getDefaultVocabQuizQuestionField(optionField) {
  return getVocabQuizField(optionField) === "meaning" ? "reading" : "meaning";
}

function getVocabQuizQuestionField(value = state?.vocabQuizQuestionField, legacyMode = state?.vocabQuizMode) {
  return getVocabQuizField(value, getLegacyVocabQuizQuestionField(legacyMode));
}

function getVocabQuizOptionField(
  value = state?.vocabQuizOptionField,
  questionField = getVocabQuizQuestionField(),
  legacyMode = state?.vocabQuizMode
) {
  const normalizedQuestionField = getVocabQuizQuestionField(questionField, legacyMode);
  let nextField = getVocabQuizField(value, getLegacyVocabQuizOptionField(legacyMode));

  if (nextField === normalizedQuestionField) {
    nextField = getDefaultVocabQuizOptionField(normalizedQuestionField);
  }

  if (nextField === normalizedQuestionField) {
    nextField = vocabQuizFieldOptions.find((field) => field !== normalizedQuestionField) || "meaning";
  }

  return nextField;
}

function getVocabQuizFieldLabel(field) {
  return vocabQuizFieldLabels[getVocabQuizField(field)];
}

function getLevelLabel(level) {
  return formatStudyLevelLabel(level, "N5");
}

function getLevelSummaryLabel(level) {
  return level === allLevelValue ? "전체 난이도" : getLevelLabel(level);
}

function getDurationLabel(duration) {
  return Number(duration) <= 0 ? "천천히" : `${Number(duration)}초`;
}

function getQuizLevel(level = state?.quizLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectableStudyLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getQuizLevelLabel(level = state?.quizLevel) {
  return getLevelLabel(getQuizLevel(level));
}

function getQuizDuration(value = state?.quizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getVocabQuizCount(value = state?.vocabQuizCount) {
  const numericValue = Number(value);
  return vocabQuizCountOptions.includes(numericValue) ? numericValue : 10;
}

function getKanjiPracticeQuizCount(value = state?.kanjiPracticeQuizCount) {
  const numericValue = Number(value);
  return kanjiPracticeQuizCountOptions.includes(numericValue) ? numericValue : 10;
}

function getVocabQuizDuration(value = state?.vocabQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getKanjiPracticeQuizDuration(value = state?.kanjiPracticeQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getGrammarPracticeCount(value = state?.grammarPracticeCount) {
  const numericValue = Number(value);
  return grammarPracticeCountOptions.includes(numericValue) ? numericValue : 10;
}

function getReadingCount(value = state?.readingCount) {
  const numericValue = Number(value);
  return readingCountOptions.includes(numericValue) ? numericValue : 10;
}

function getGrammarPracticeLevel(level = state?.grammarPracticeLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getGrammarPracticeDuration(value = state?.grammarPracticeDuration) {
  const numericValue = Number(value);
  return grammarPracticeDurationOptions.includes(numericValue) ? numericValue : 25;
}

function getReadingLevel(level = state?.readingLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getReadingDuration(value = state?.readingDuration) {
  const numericValue = Number(value);
  return readingDurationOptions.includes(numericValue) ? numericValue : 45;
}

function getCharactersTab(value) {
  return ["library", "quiz", "writing"].includes(value) ? value : "library";
}

function getCharactersLibraryTab(value) {
  return value === "katakana" ? "katakana" : "hiragana";
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

function getVocabTab(value = state?.vocabTab) {
  return ["study", "quiz", "match"].includes(value) ? value : "study";
}

function getKanjiTab(value = state?.kanjiTab) {
  return ["list", "practice", "match"].includes(value) ? value : "list";
}

function getWritingPracticeOrder(value) {
  return value === "random" ? "random" : "sequence";
}

function shuffleQuizArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function uniqueQuizValues(values) {
  return values.filter((value, index, source) => source.indexOf(value) === index);
}

function buildDynamicQuizPool(items) {
  const normalizedItems = items
    .map((item) => ({
      id: normalizeQuizText(item.entry_id || item.id),
      level: formatStudyLevelLabel(item._level || item.level, "N5"),
      word: getQuizDisplayWord(item),
      reading: getQuizReading(item),
      meaning: getQuizMeaning(item),
      part: getQuizPart(item)
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return normalizedItems.filter(
    (item, index, source) =>
      source.findIndex(
        (candidate) =>
          candidate.word === item.word &&
          candidate.reading === item.reading &&
          candidate.meaning === item.meaning
      ) === index
  );
}

let dynamicQuizPool = buildDynamicQuizPool(dynamicQuizSource);

function getFallbackVocabItems(level = "N5") {
  const normalizedLevel = getVocabLevel(level);

  if (normalizedLevel === allLevelValue) {
    const mixedLevelItems = fallbackFlashcards.filter((item) => contentLevels.includes(item.level));
    return mixedLevelItems.length ? mixedLevelItems : fallbackFlashcards.filter((item) => item.level === "N5");
  }

  const fallbackItems = fallbackFlashcards.filter((item) => item.level === normalizedLevel);

  return fallbackItems.length ? fallbackItems : fallbackFlashcards.filter((item) => item.level === "N5");
}

function buildDynamicFlashcardPool(items, level = "N5") {
  const normalizedLevel = getVocabLevel(level);
  const cards = items
    .map((item) => ({
      id: item.id,
      level: formatStudyLevelLabel(item.level, normalizedLevel),
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      part: item.part || ""
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  // 카드 보기의 랜덤 순서는 getOrderedStudyCards가 한 번만 관리한다.
  // 여기서도 다시 섞어버리면 원격 동기화/재렌더마다 첫 카드가 다른 단어로 튄다.
  return cards.length ? cards : getFallbackVocabItems(normalizedLevel);
}

function buildDynamicVocabListPool(items, level = "N5") {
  const normalizedLevel = getVocabLevel(level);
  const cards = items
    .map((item) => ({
      id: item.id,
      level: formatStudyLevelLabel(item.level, normalizedLevel),
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      part: item.part || ""
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return cards.length ? cards : getFallbackVocabItems(normalizedLevel);
}

function getVocabQuizItemValue(item, field) {
  const normalizedField = getVocabQuizField(field);

  if (normalizedField === "meaning") {
    return normalizeQuizText(item.meaning);
  }

  if (normalizedField === "word") {
    return normalizeQuizDisplay(item.word || item.reading);
  }

  return normalizeQuizText(item.reading || item.word);
}

function getVocabQuizDisplaySub(item, questionField, optionField) {
  const normalizedQuestionField = getVocabQuizField(questionField);
  const reading = getVocabQuizItemValue(item, "reading");

  if (normalizedQuestionField === "meaning") {
    return item.part || "";
  }

  if (normalizedQuestionField === "word" && reading !== getVocabQuizItemValue(item, "word")) {
    return reading;
  }

  return "";
}

function getVocabQuizExplanation(item) {
  const word = getVocabQuizItemValue(item, "word");
  const reading = getVocabQuizItemValue(item, "reading");
  const meaning = getVocabQuizItemValue(item, "meaning");

  if (word && word !== reading) {
    return `${reading}는 ${word}, 뜻은 ${meaning}예요.`;
  }

  return `${reading}의 뜻은 ${meaning}예요.`;
}

function buildWordPracticeQuestionSet(items, level = "N5", fallbackItems = [], config = {}) {
  const tones = ["tone-coral", "tone-mint", "tone-gold", "tone-sky"];
  const levelLabel = getLevelLabel(level);
  const questionField = getVocabQuizQuestionField(config.questionField, config.mode);
  const optionField = getVocabQuizOptionField(config.optionField, questionField, config.mode);
  const count = Math.max(1, Number(config.count) || vocabQuizSessionSize);
  const seedItems = shuffleQuizArray(items);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const item = seedItems[index];
    const questionIndex = questions.length;
    const display = getVocabQuizItemValue(item, questionField);
    const displaySub = getVocabQuizDisplaySub(item, questionField, optionField);
    const correctOption = getVocabQuizItemValue(item, optionField);
    const distractors = uniqueQuizValues(
      shuffleQuizArray(
        items
          .filter((candidate) => candidate.id !== item.id)
          .map((candidate) => getVocabQuizItemValue(candidate, optionField))
          .filter((value) => value && value !== correctOption)
      )
    ).slice(0, 3);

    if (!display || !correctOption || distractors.length < 3) {
      continue;
    }

    const options = shuffleQuizArray([correctOption, ...distractors]);
    const answer = options.indexOf(correctOption);
    const questionLabel = getVocabQuizFieldLabel(questionField);
    const optionLabel = getVocabQuizFieldLabel(optionField);
    const title = item.part ? `${item.part} ${optionLabel} 퀴즈` : `${levelLabel} ${optionLabel} 퀴즈`;
    const note = `${questionLabel}를 보고 ${optionLabel}를 골라봐요.`;
    const prompt = `이 ${questionLabel}에 맞는 ${optionLabel}, 어떤 걸까요?`;
    const explanation = getVocabQuizExplanation(item);

    questions.push({
      id: `bp-dw-${questionField}-${optionField}-${item.id}-${questionIndex}`,
      source: `${levelLabel} 단어 ${questionIndex + 1}`,
      level: item.level || levelLabel,
      title,
      note,
      prompt,
      display,
      displaySub,
      options,
      answer,
      explanation,
      sourceId: item.id,
      questionField,
      optionField,
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      tone: tones[questionIndex % tones.length]
    });
  }

  return questions.length ? questions : fallbackItems;
}

function buildDynamicWordPracticeItems(items, level = "N5") {
  return buildWordPracticeQuestionSet(items, level, basicPracticeSets.words?.items ?? []);
}

function getVocabLevel(level = state?.vocabLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectableStudyLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getVocabLevelLabel(level = state?.vocabLevel) {
  return getLevelLabel(getVocabLevel(level));
}

function refreshDynamicVocabContent(level = "N5") {
  const activeLevel = getVocabLevel(level);
  const activeSource = getDynamicVocabSource(activeLevel);
  const activePool = buildDynamicQuizPool(activeSource);
  if (!basicPracticeSets.words) {
    basicPracticeSets.words = normalizeBasicPracticeTrack({});
  }
  basicPracticeSets.words.items = buildDynamicWordPracticeItems(activePool, activeLevel);
}

function refreshQuizContent(level = "N5") {
  const activeLevel = getQuizLevel(level);
  dynamicQuizSource = getDynamicVocabSource(activeLevel);
  dynamicQuizPool = buildDynamicQuizPool(dynamicQuizSource);
}

function refreshVocabPageContent(level = "N5") {
  const activeLevel = getVocabLevel(level);
  const activeVocabSource = getDynamicVocabSource(activeLevel);
  const activeVocabPool = buildDynamicQuizPool(activeVocabSource);

  flashcards = buildDynamicFlashcardPool(activeVocabPool, activeLevel);
  vocabListItems = buildDynamicVocabListPool(activeVocabPool, activeLevel);
}

function syncDynamicVocabCollections() {
  refreshDynamicVocabContent("N5");
  refreshQuizContent(state?.quizLevel || "N5");
  refreshVocabPageContent(state?.vocabLevel || "N5");
}

function preloadRelevantVocabData() {
  const requestedLevels = Array.from(
    new Set(
      getRequestedVocabLevels("N5")
        .concat(getRequestedVocabLevels(getVocabLevel(state?.vocabLevel)))
        .concat(getRequestedVocabLevels(getQuizLevel(state?.quizLevel)))
    )
  );

  return ensureVocabLevelsLoaded(requestedLevels);
}

function completeVocabLoad(request) {
  return request
    .then(() => {
      handleLoadedVocabLevels();
    })
    .catch((error) => {
      console.error("Failed to load vocab data.", error);
      return [];
    });
}

function loadRelevantVocabData() {
  return completeVocabLoad(preloadRelevantVocabData());
}

function loadVocabDataForLevel(level) {
  return completeVocabLoad(ensureVocabLevelsLoaded(level));
}

function handleLoadedVocabLevels() {
  if (!state) {
    return;
  }

  syncDynamicVocabCollections();

  if (state.quizIndex === 0 && !state.quizSessionFinished) {
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
  }

  if (!state.vocabQuizStarted) {
    activeVocabQuizQuestions = [];
    activeVocabQuizSignature = "";
    activeVocabQuizResults = [];
  }

  renderAll();
}

const kanaQuizSettings = {
  mode: "hiragana",
  count: 10,
  duration: 5
};
const kanaQuizCountOptions = [10, 20, 30, "all"];
const kanaQuizDurationOptions = [5, 10, 15, 0];

const kanaQuizSheetState = {
  open: false,
  mode: "hiragana",
  sessionIndex: 0,
  sessionItems: [],
  answered: false,
  finished: false,
  results: [],
  resultFilter: "all"
};

const kanaQuizResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};

function getStudyPracticeResultEmptyMessage(activeFilter) {
  if (activeFilter === "correct") {
    return "아직 정답 결과가 없어요. 문제를 더 풀어볼까요?";
  }

  if (activeFilter === "wrong") {
    return "지금은 오답이 없어요. 이 흐름 좋네요.";
  }

  return "아직 결과가 없어요. 문제를 풀고 다시 확인해봐요.";
}

function getKanaQuizModeLabel(mode) {
  if (mode === "random") {
    return "랜덤";
  }

  return mode === "katakana" ? "카타카나" : "히라가나";
}

const vocabFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 봤어요"
};

const grammarFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "미분류"
};

/** Mirrors assets/js/app-copy.js when that script is absent or fails. */
const japanoteCopyFallback = {
  vocab: {
    study: {
      N5: {
        title: "N5 단어를 차근차근 익혀봐요",
        description: "자주 쓰는 단어를 익히고, 퀴즈와 짝 맞추기로 다시 복습해봐요."
      },
      N4: {
        title: "N4 단어를 차근차근 익혀봐요",
        description: "조금 더 넓어진 표현을 익히고, 퀴즈로 다시 확인해봐요."
      },
      N3: {
        title: "N3 단어를 차근차근 익혀봐요",
        description: "실전에서 자주 만나는 N3 단어를 익히고 복습해봐요."
      },
      all: {
        title: "전체 단어를 한 번에 익혀봐요",
        description: "N5부터 N3까지 섞어서 단어를 익히고 다시 복습해봐요."
      }
    },
    quiz: {
      N5: {
        title: "N5 단어 퀴즈로 가볍게 확인해봐요",
        description: "익힌 단어를 문제로 다시 확인해봐요."
      },
      N4: {
        title: "N4 단어 퀴즈로 감각을 올려봐요",
        description: "N4 단어를 뜻과 표현으로 다시 확인해봐요."
      },
      N3: {
        title: "N3 단어 퀴즈로 실전 감각을 익혀봐요",
        description: "실전에서 자주 나오는 단어를 문제로 점검해봐요."
      },
      all: {
        title: "전체 단어 퀴즈로 한 번에 복습해봐요",
        description: "N5부터 N3까지 섞어서 문제로 다시 확인해봐요."
      }
    },
    match: {
      title: "단어 짝 맞추기로 가볍게 복습해봐요",
      description: "단어와 뜻을 연결하면서 배운 내용을 다시 확인해봐요."
    }
  },
  kanji: {
    list: {
      title: "기초 한자를 차근차근 익혀봐요",
      description: "자주 나오는 한자를 보고, 퀴즈와 짝 맞추기로 가볍게 복습해봐요."
    },
    practice: {
      title: "한자 퀴즈로 다시 확인해봐요",
      description: "배운 한자를 문제로 다시 확인해봐요."
    },
    match: {
      title: "한자 짝 맞추기로 가볍게 복습해봐요",
      description: "한자와 뜻, 읽기를 연결하면서 다시 익혀봐요."
    }
  }
};

function getJapanoteCopy() {
  const fromGlobal = globalThis.japanoteCopy;
  return fromGlobal && typeof fromGlobal === "object" ? fromGlobal : japanoteCopyFallback;
}

function resolveHeadingNode(node, fallback) {
  const title =
    node && typeof node.title === "string" && node.title.length > 0 ? node.title : fallback.title;
  const description =
    node && typeof node.description === "string" ? node.description : fallback.description;
  return { title, description };
}

function buildLevelHeadingMap(sourceLevels, fallbackLevels) {
  return {
    N5: resolveHeadingNode(sourceLevels?.N5, fallbackLevels.N5),
    N4: resolveHeadingNode(sourceLevels?.N4, fallbackLevels.N4),
    N3: resolveHeadingNode(sourceLevels?.N3, fallbackLevels.N3),
    all: resolveHeadingNode(sourceLevels?.all, fallbackLevels.all)
  };
}

const japanoteCopyRoot = getJapanoteCopy();
const vocabHeadingCopy = buildLevelHeadingMap(
  japanoteCopyRoot.vocab?.study,
  japanoteCopyFallback.vocab.study
);
const quizHeadingCopy = buildLevelHeadingMap(
  japanoteCopyRoot.vocab?.quiz,
  japanoteCopyFallback.vocab.quiz
);
const matchHeadingCopy = resolveHeadingNode(
  japanoteCopyRoot.vocab?.match,
  japanoteCopyFallback.vocab.match
);

function getVocabItemPart(item) {
  return normalizeQuizText(item?.part) || "기타";
}

function getKanaQuizPool(mode) {
  if (mode === "random") {
    return [
      ...(basicPracticeSets.hiragana?.items || []),
      ...(basicPracticeSets.katakana?.items || [])
    ];
  }

  return basicPracticeSets[mode]?.items || [];
}

function getKanaQuizCountValue(value, total) {
  if (value === "all") {
    return total;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(10, total);
  }

  return Math.min(parsed, total);
}

function buildKanaQuizSession(mode = kanaQuizSettings.mode) {
  const pool = getKanaQuizPool(mode);
  const count = getKanaQuizCountValue(kanaQuizSettings.count, pool.length);
  return shuffleQuizArray(pool).slice(0, count);
}

function getKanaQuizSheetCurrentItem() {
  const items = kanaQuizSheetState.sessionItems;
  const index = kanaQuizSheetState.sessionIndex;

  if (!items.length || index >= items.length) {
    return null;
  }

  return {
    mode: kanaQuizSheetState.mode,
    index,
    total: items.length,
    item: items[index]
  };
}

function getKanaQuizCountLabel(count) {
  return String(count) === "all" ? "전부" : `${count}문제`;
}

function getKanaQuizDurationLabel(duration) {
  return Number(duration) <= 0 ? "천천히" : `${duration}초`;
}

function getKanaQuizResultFilter(value = kanaQuizSheetState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(kanaQuizResultFilterLabels, value) ? value : "all";
}

function getKanaQuizResultCounts() {
  return {
    all: kanaQuizSheetState.results.length,
    correct: kanaQuizSheetState.results.filter((item) => item.status === "correct").length,
    wrong: kanaQuizSheetState.results.filter((item) => item.status === "wrong").length
  };
}

function getFilteredKanaQuizResults(filter = getKanaQuizResultFilter(kanaQuizSheetState.resultFilter)) {
  const activeFilter = getKanaQuizResultFilter(filter);

  if (activeFilter === "all") {
    return [...kanaQuizSheetState.results];
  }

  return kanaQuizSheetState.results.filter((item) => item.status === activeFilter);
}

function setKanaQuizResult(current, selectedIndex, correct, timedOut = false) {
  const reading = current.item.options[current.item.answer] || current.item.displaySub || "";
  const selected = timedOut ? "" : current.item.options[selectedIndex] || "";
  const result = {
    id: current.item.id,
    source: current.item.source,
    char: current.item.display,
    reading,
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const existingIndex = kanaQuizSheetState.results.findIndex((item) => item.id === current.item.id);

  if (existingIndex >= 0) {
    kanaQuizSheetState.results[existingIndex] = result;
    return;
  }

  kanaQuizSheetState.results.push(result);
}

function renderKanaQuizResultFilterOptions(counts) {
  syncResultFilterButtons({
    resultViewId: "kana-quiz-result-view",
    activeValue: getKanaQuizResultFilter(kanaQuizSheetState.resultFilter)
  });
}

function renderKanaQuizResults() {
  const total = document.getElementById("kana-quiz-result-total");
  const correct = document.getElementById("kana-quiz-result-correct-count");
  const wrong = document.getElementById("kana-quiz-result-wrong-count");
  const empty = document.getElementById("kana-quiz-result-empty");
  const list = document.getElementById("kana-quiz-result-list");
  const counts = getKanaQuizResultCounts();
  const filteredResults = getFilteredKanaQuizResults();

  if (!total || !correct || !wrong || !empty || !list) {
    return;
  }

  total.textContent = String(counts.all);
  correct.textContent = String(counts.correct);
  wrong.textContent = String(counts.wrong);
  renderKanaQuizResultFilterOptions(counts);

  if (!filteredResults.length) {
    empty.hidden = false;
    empty.textContent = getStudyPracticeResultEmptyMessage(getKanaQuizResultFilter(kanaQuizSheetState.resultFilter));
    list.innerHTML = "";
    return;
  }

  empty.hidden = true;
  list.innerHTML = filteredResults
    .map((item) => {
      const statusLabel = item.timedOut ? "시간초과" : item.status === "correct" ? "정답" : "오답";
      const detail =
        item.status === "correct"
          ? `정답: ${formatQuizLineBreaks(item.reading)}`
          : `선택: ${formatQuizLineBreaks(item.selected || "미응답")} · 정답: ${formatQuizLineBreaks(item.reading)}`;

      return `
        <article class="match-result-item is-${item.status}">
          <div class="match-result-item-head">
            <div class="match-result-item-badges">
              <span class="match-result-badge is-${item.status}">${statusLabel}</span>
              <span class="match-result-level">${formatQuizLineBreaks(item.source || getKanaQuizModeLabel(kanaQuizSheetState.mode))}</span>
            </div>
          </div>
          <div class="match-result-item-main">
            <strong>${formatQuizLineBreaks(item.char)} · ${formatQuizLineBreaks(item.reading)}</strong>
            <p>${detail}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderKanaQuizSetup() {
  const setupShell = document.getElementById("kana-setup-shell");
  const setupToggle = document.getElementById("kana-setup-toggle");
  const setupPanel = document.getElementById("kana-setup-panel");
  const setupSummary = document.getElementById("kana-setup-summary");
  const startButton = document.getElementById("kana-setup-start");
  const startLabel = document.getElementById("kana-setup-start-label");
  const countSpinner = document.querySelector('[data-spinner-id="kana-quiz-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kana-quiz-time"]');
  const isOpen = state.kanaSetupOpen === true;
  const modeButtons = document.querySelectorAll("[data-kana-mode]");
  const isSettingsLocked = kanaQuizSheetState.open && !kanaQuizSheetState.finished;
  const canStart = getKanaQuizPool(kanaQuizSettings.mode).length > 0;
  const summaryText = [
    getKanaQuizModeLabel(kanaQuizSettings.mode),
    getKanaQuizCountLabel(kanaQuizSettings.count),
    getKanaQuizDurationLabel(kanaQuizSettings.duration)
  ].join(" · ");

  syncSelectionButtonState(modeButtons, (button) => button.dataset.kanaMode, kanaQuizSettings.mode);
  modeButtons.forEach((button) => {
    button.disabled = isSettingsLocked;
  });
  if (getCharactersTab(state.charactersTab) === "quiz") {
    renderCharactersPageHeader("quiz");
  }
  renderStudyOptionsControls({
    shell: setupShell,
    toggle: setupToggle,
    panel: setupPanel,
    summary: setupSummary,
    summaryText,
    isLocked: isSettingsLocked,
    isOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: kanaQuizCountOptions,
        activeValue: kanaQuizSettings.count,
        formatValue: getKanaQuizCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: kanaQuizDurationOptions,
        activeValue: kanaQuizSettings.duration,
        formatValue: getKanaQuizDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: kanaQuizSheetState.open,
      canStart
    }
  });
}

function startKanaQuizSession(mode = kanaQuizSettings.mode) {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("kana-quiz-result-view");
  const nextMode = ["hiragana", "katakana", "random"].includes(mode) ? mode : "hiragana";
  kanaQuizSettings.mode = nextMode;
  kanaQuizSheetState.mode = nextMode;
  kanaQuizSheetState.sessionItems = buildKanaQuizSession(nextMode);
  kanaQuizSheetState.sessionIndex = 0;
  kanaQuizSheetState.answered = false;
  kanaQuizSheetState.finished = false;
  kanaQuizSheetState.open = true;
  kanaQuizSheetState.results = [];
  kanaQuizSheetState.resultFilter = "all";

  setQuizSessionDuration("kana", Number(kanaQuizSettings.duration));
  resetQuizSessionScore("kana");

  renderKanaQuizSetup();
  renderQuizSessionHud("kana");
  renderKanaQuizSheet();
  resetQuizSessionTimer("kana", handleKanaQuizTimeout);
}

function openKanaQuizSheet(mode) {
  state.charactersTab = "quiz";
  saveState();
  renderCharactersPageLayout();
  startKanaQuizSession(mode);

  const quizPanel = document.getElementById("characters-tab-panel-quiz");
  if (quizPanel) {
    quizPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function closeKanaQuizSheet() {
  kanaQuizSheetState.open = false;
  stopQuizSessionTimer("kana");
  renderKanaQuizSetup();
  renderKanaQuizSheet();
}

function renderKanaQuizSheet() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const practiceView = document.getElementById("kana-quiz-practice-view");
  const card = document.getElementById("kana-quiz-card");
  const empty = document.getElementById("kana-quiz-empty");
  const resultView = document.getElementById("kana-quiz-result-view");
  const source = document.getElementById("kana-quiz-sheet-source");
  const progress = document.getElementById("kana-quiz-sheet-progress");
  const promptBox = document.getElementById("kana-quiz-sheet-copy");
  const note = document.getElementById("kana-quiz-sheet-note");
  const prompt = document.getElementById("kana-quiz-sheet-prompt");
  const display = document.getElementById("kana-quiz-sheet-display");
  const displaySub = document.getElementById("kana-quiz-sheet-display-sub");
  const options = document.getElementById("kana-quiz-options");
  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  const next = document.getElementById("kana-quiz-next");

  if (!practiceView || !card || !empty || !resultView || !source || !progress || !promptBox || !note || !prompt || !display || !displaySub || !options || !feedback || !explanation || !next) {
    return;
  }

  const current = getKanaQuizSheetCurrentItem();

  empty.hidden = kanaQuizSheetState.open;
  practiceView.hidden = !kanaQuizSheetState.open || kanaQuizSheetState.finished;
  practiceView.setAttribute("aria-hidden", String(practiceView.hidden));
  card.hidden = !kanaQuizSheetState.open || kanaQuizSheetState.finished;
  resultView.hidden = !kanaQuizSheetState.open || !kanaQuizSheetState.finished;
  resultView.setAttribute("aria-hidden", String(resultView.hidden));

  if (!kanaQuizSheetState.open) {
    feedback.textContent = "";
    explanation.textContent = "";
    explanation.hidden = true;
    return;
  }

  if (kanaQuizSheetState.finished) {
    renderKanaQuizResults();
    return;
  }

  if (!current) {
    source.textContent = "-";
    progress.textContent = "-";
    promptBox.hidden = true;
    note.hidden = true;
    note.textContent = "";
    prompt.textContent = "";
    display.textContent = "-";
    displaySub.textContent = "";
    options.innerHTML = "";
    options.hidden = false;
    feedback.textContent = "";
    explanation.textContent = "";
    explanation.hidden = true;
    next.disabled = true;
    return;
  }

  source.textContent = formatQuizLineBreaks(current.item.source);
  progress.textContent = `${current.index + 1} / ${current.total}`;
  promptBox.hidden = true;
  note.hidden = true;
  note.textContent = "";
  prompt.textContent = "";
  display.textContent = formatQuizLineBreaks(current.item.display || "-");
  displaySub.textContent = "";
  feedback.textContent = "";
  explanation.textContent = "";
  explanation.hidden = true;
  options.hidden = false;
  next.disabled = true;
  next.textContent =
    current.index + 1 >= current.total ? "결과 보러 갈까요?" : "다음 문제 볼까요?";

  options.innerHTML = "";
  current.item.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    const label = document.createElement("span");
    button.type = "button";
    button.className = "basic-practice-option kana-quiz-option";
    button.dataset.kanaQuizOption = String(optionIndex);
    label.className = "button-text-clamp";
    label.textContent = formatQuizLineBreaks(option);
    button.appendChild(label);
    button.addEventListener("click", () => handleKanaQuizSheetAnswer(optionIndex));
    options.appendChild(button);
  });
}

function finalizeKanaQuizAnswer(correct) {
  kanaQuizSheetState.answered = true;
  finalizeQuizSession("kana", correct);

  const next = document.getElementById("kana-quiz-next");
  if (next) {
    next.disabled = false;
    next.focus();
  }
}

function handleKanaQuizSheetAnswer(index) {
  const current = getKanaQuizSheetCurrentItem();
  if (!current || kanaQuizSheetState.answered || quizSessions.kana.isPaused) {
    return;
  }

  const optionButtons = document.querySelectorAll("[data-kana-quiz-option]");
  const correct = index === current.item.answer;

  optionButtons.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.item.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  if (feedback) {
    feedback.textContent = "";
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.hidden = true;
  }

  setKanaQuizResult(current, index, correct);
  finalizeKanaQuizAnswer(correct);
}

function handleKanaQuizTimeout() {
  const current = getKanaQuizSheetCurrentItem();
  if (!current || kanaQuizSheetState.answered) {
    return;
  }

  const optionButtons = document.querySelectorAll("[data-kana-quiz-option]");
  optionButtons.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.item.answer) {
      item.classList.add("is-correct");
    }
  });

  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  if (feedback) {
    feedback.textContent = "";
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.hidden = true;
  }

  setKanaQuizResult(current, -1, false, true);
  finalizeKanaQuizAnswer(false);
}

function nextKanaQuizSheetQuestion() {
  const current = getKanaQuizSheetCurrentItem();

  if (kanaQuizSheetState.finished || !current) {
    startKanaQuizSession(kanaQuizSettings.mode);
    return;
  }

  if (!kanaQuizSheetState.answered) {
    const feedback = document.getElementById("kana-quiz-feedback");
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 넘어가요.";
    }
    return;
  }

  if (current.index + 1 >= current.total) {
    kanaQuizSheetState.finished = true;
    renderKanaQuizSheet();
    return;
  }

  kanaQuizSheetState.sessionIndex += 1;
  kanaQuizSheetState.answered = false;
  renderKanaQuizSheet();
  resetQuizSessionTimer("kana", handleKanaQuizTimeout);
}

// kana.json이 바뀌면 문자표, 문자 퀴즈, 따라쓰기 풀이도 같은 원본으로 다시 맞춘다.
function refreshWritingPracticePools() {
  writingPracticePools = {
    hiragana: buildWritingPracticePool("hiragana"),
    katakana: buildWritingPracticePool("katakana")
  };
}

const dynamicKanjiItems = buildKanjiPracticeItemsFromData();
if (dynamicKanjiItems.length) {
  basicPracticeSets.kanji = {
    label: "한자",
    heading: "학년별 배당 한자",
    items: dynamicKanjiItems
  };
}

const basicPracticeTrackOrder = ["hiragana", "katakana", "words", "particles", "kanji", "sentences"];
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

refreshKanjiPracticeSet();

const basicPracticeTrackLabels = {
  hiragana: "히라가나",
  katakana: "카타카나",
  words: "단어",
  particles: "문법",
  kanji: "한자",
  sentences: "독해"
};

function getAvailableBasicPracticeTracks() {
  const switcher = document.getElementById("basic-practice-switcher");
  const configured = switcher?.dataset?.basicTracks;

  if (!configured) {
    return basicPracticeTrackOrder.filter((key) => basicPracticeSets[key]);
  }

  const tracks = configured
    .split(",")
    .map((item) => item.trim())
    .filter((key) => key && basicPracticeSets[key]);

  return tracks.length ? tracks : basicPracticeTrackOrder.filter((key) => basicPracticeSets[key]);
}
function renderKanaLibrary() {
  const sections = [
    {
      targetId: "hiragana-table",
      track: "hiragana"
    },
    {
      targetId: "katakana-table",
      track: "katakana"
    }
  ];

  sections.forEach((section) => {
    const container = document.getElementById(section.targetId);
    if (!container) {
      return;
    }

    const deck = kanaStudyDecks[section.track] || [];
    container.innerHTML = deck
      .map(
        (group) => `
          <section class="kana-group">
            <h4>${group.title}</h4>
            <div class="kana-grid">
              ${group.items
                .map(
                  (item) => `
                    <button class="kana-tile${item.quiz ? "" : " is-muted"}" type="button" data-writing-char="${item.char}" data-writing-script="${section.track}" aria-label="${item.char} 따라쓰기 바로 열기">
                      <strong>${item.char}</strong>
                      <span>${item.reading}</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  });

  document.querySelectorAll("[data-writing-char]").forEach((button) => {
    if (button.dataset.writingBound === "true") {
      return;
    }

    button.dataset.writingBound = "true";
    button.addEventListener("click", () => {
      openWritingPracticeForCharacter(button.dataset.writingChar, button.dataset.writingScript);
    });
  });
}

function getCharactersPageHeading(tab = getCharactersTab(state.charactersTab)) {
  if (tab === "writing") {
    return {
      title: "문자를 직접 따라쓰며 손에 익혀봐요",
      description: ""
    };
  }

  if (tab === "quiz") {
    return {
      title: `${getKanaQuizModeLabel(kanaQuizSettings.mode)} 퀴즈, 풀어볼까요?`,
      description: ""
    };
  }

  return {
    title: "히라가나랑 카타카나를 한눈에 봐요",
    description: "문자를 누르면 바로 따라쓰기로 이어져요."
  };
}

function renderCharactersPageHeader(tab = getCharactersTab(state.charactersTab)) {
  applyPageHeading(
    document.getElementById("characters-page-title"),
    document.getElementById("characters-page-copy"),
    getCharactersPageHeading(tab)
  );
}

function renderCharactersPageLayout() {
  const activeTab = getCharactersTab(state.charactersTab);
  const libraryTab = getCharactersLibraryTab(state.charactersLibraryTab);

  renderCharactersPageHeader(activeTab);

  document.querySelectorAll("[data-characters-tab]").forEach((button) => {
    const isActive = button.dataset.charactersTab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-characters-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.charactersTabPanel === activeTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  document.querySelectorAll("[data-characters-library-tab]").forEach((button) => {
    const isActive = button.dataset.charactersLibraryTab === libraryTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-characters-library-panel]").forEach((panel) => {
    const isActive = panel.dataset.charactersLibraryPanel === libraryTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (activeTab === "writing" && document.getElementById("writing-practice-shell")) {
    scheduleWritingPracticeLayout(false);
  }
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const writingPracticeSettings = {
  mode: "hiragana",
  order: "sequence"
};

const writingPracticeSvgTemplateCache = new Map();

const writingPracticeState = {
  sessionItems: [],
  sessionIndex: 0,
  guideVisible: true,
  answerVisible: false,
  isAnimating: false,
  isTransitioning: false,
  animationToken: 0,
  layoutFrame: null,
  pointerId: null,
  isDrawing: false,
  strokes: [],
  score: null,
  feedback: "연한 글자를 따라 천천히 써봐요.",
  tip: "가이드가 잘 보이게 천천히 크게 써봐요.",
  slotEntries: [],
  targetCanvas: document.createElement("canvas"),
  overlayHasInk: false,
  overlayBounds: null,
  hasVectorGuide: false,
  renderSeed: 0,
  layoutObserver: null
};

function getWritingPracticeDefaultFeedback() {
  return "연한 글자를 따라 천천히 써봐요.";
}

function getWritingPracticeDefaultTip() {
  return "가이드가 잘 보이게 천천히 크게 써봐요.";
}

function beginWritingPracticeTransition() {
  writingPracticeState.isTransitioning = true;
}

function endWritingPracticeTransition() {
  writingPracticeState.isTransitioning = false;
}

function getWritingPracticeModeLabel(mode = writingPracticeSettings.mode) {
  if (mode === "random") {
    return "랜덤";
  }

  return mode === "katakana" ? "카타카나" : "히라가나";
}

function getWritingPracticeOrderLabel(order = writingPracticeSettings.order) {
  return getWritingPracticeOrder(order) === "random" ? "랜덤 순서" : "순서대로";
}

function renderWritingPracticeSetup() {
  const setupShell = document.getElementById("writing-setup-shell");
  const setupToggle = document.getElementById("writing-setup-toggle");
  const setupPanel = document.getElementById("writing-setup-panel");
  const setupSummary = document.getElementById("writing-setup-summary");
  const isOpen = state.writingSetupOpen === true;
  const summaryText = [
    getWritingPracticeModeLabel(writingPracticeSettings.mode),
    getWritingPracticeOrderLabel(writingPracticeSettings.order)
  ].join(" · ");

  renderOpenableSettingsSection({
    shell: setupShell,
    toggle: setupToggle,
    panel: setupPanel,
    summary: setupSummary,
    summaryText,
    isOpen
  });
}

function buildWritingPracticePool(script) {
  const label = script === "katakana" ? "카타카나" : "히라가나";
  const deck = kanaStudyDecks[script] || [];

  return deck.flatMap((group, groupIndex) =>
    group.items
      .filter((item) => item.quiz !== false)
      .map((item, itemIndex) => ({
        id: `writing-${script}-${groupIndex}-${itemIndex}`,
        script,
        group: group.title,
        char: item.char,
        reading: item.reading,
        source: `${label} · ${group.title}`
      }))
  );
}

kanaDerivedCollectionsReady = true;
refreshWritingPracticePools();

function buildWritingPracticeSession(mode = writingPracticeSettings.mode, order = writingPracticeSettings.order) {
  const nextOrder = getWritingPracticeOrder(order);
  const items =
    mode === "random"
      ? [...writingPracticePools.hiragana, ...writingPracticePools.katakana]
      : [...(writingPracticePools[mode] || writingPracticePools.hiragana)];

  return nextOrder === "random" ? shuffleQuizArray(items) : items;
}

function ensureWritingPracticeSession() {
  if (!writingPracticeState.sessionItems.length) {
    writingPracticeState.sessionItems = buildWritingPracticeSession(
      writingPracticeSettings.mode,
      writingPracticeSettings.order
    );
    writingPracticeState.sessionIndex = 0;
  }
}

function getCurrentWritingPracticeItem() {
  ensureWritingPracticeSession();

  if (!writingPracticeState.sessionItems.length) {
    return null;
  }

  return writingPracticeState.sessionItems[writingPracticeState.sessionIndex] || null;
}

function cancelWritingPracticeAnimation() {
  writingPracticeState.animationToken += 1;
  writingPracticeState.isAnimating = false;
}

function resetWritingPracticeRound() {
  cancelWritingPracticeAnimation();
  writingPracticeState.pointerId = null;
  writingPracticeState.isDrawing = false;
  writingPracticeState.guideVisible = true;
  writingPracticeState.answerVisible = false;
  writingPracticeState.strokes = [];
  resetWritingOverlayCanvas();
  writingPracticeState.score = null;
  writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
  writingPracticeState.tip = getWritingPracticeDefaultTip();
}

const writingPracticeCompoundFollowers = new Set(["ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ"]);

function splitWritingPracticeUnits(text = "") {
  return Array.from(text).reduce((units, character) => {
    if (writingPracticeCompoundFollowers.has(character) && units.length) {
      units[units.length - 1] += character;
      return units;
    }

    units.push(character);
    return units;
  }, []);
}

function rewriteSvgReference(value, idMap) {
  if (!value) {
    return value;
  }

  if (value.startsWith("url(#") && value.endsWith(")")) {
    const id = value.slice(5, -1);
    return idMap.has(id) ? `url(#${idMap.get(id)})` : value;
  }

  if (value.startsWith("#")) {
    const id = value.slice(1);
    return idMap.has(id) ? `#${idMap.get(id)}` : value;
  }

  return value;
}

function uniquifyWritingSvgIds(svg, prefix) {
  const idMap = new Map();

  svg.querySelectorAll("[id]").forEach((element) => {
    const originalId = element.id;
    const nextId = `${prefix}-${originalId}`;
    idMap.set(originalId, nextId);
    element.id = nextId;
  });

  svg.querySelectorAll("*").forEach((element) => {
    ["clip-path", "href", "xlink:href", "mask", "filter"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      const nextValue = rewriteSvgReference(value, idMap);

      if (nextValue !== value) {
        element.setAttribute(attribute, nextValue);
      }
    });
  });
}

function parseWritingPracticeSvg(rawSvg) {
  if (!rawSvg) {
    return null;
  }

  const cachedTemplate = writingPracticeSvgTemplateCache.get(rawSvg);

  if (cachedTemplate) {
    return cachedTemplate.cloneNode(true);
  }

  const parsed = new DOMParser().parseFromString(rawSvg.trim(), "image/svg+xml");
  const svg = parsed.documentElement;

  if (!svg || svg.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
    return null;
  }

  const template = document.importNode(svg, true);
  writingPracticeSvgTemplateCache.set(rawSvg, template);
  return template.cloneNode(true);
}

function getWritingSvgViewBox(svg, fallbackViewBox = { x: 0, y: 0, width: 1024, height: 1024 }) {
  const baseViewBox = {
    x: Number.isFinite(fallbackViewBox?.x) ? fallbackViewBox.x : 0,
    y: Number.isFinite(fallbackViewBox?.y) ? fallbackViewBox.y : 0,
    width: Number.isFinite(fallbackViewBox?.width) && fallbackViewBox.width > 0 ? fallbackViewBox.width : 1024,
    height: Number.isFinite(fallbackViewBox?.height) && fallbackViewBox.height > 0 ? fallbackViewBox.height : 1024
  };
  const groups = [
    svg.querySelector('g[data-strokesvg="shadows"]'),
    svg.querySelector('g[data-strokesvg="strokes"]')
  ].filter(Boolean);
  let minX = baseViewBox.x;
  let minY = baseViewBox.y;
  let maxX = baseViewBox.x + baseViewBox.width;
  let maxY = baseViewBox.y + baseViewBox.height;
  let hasMeasuredBounds = false;

  groups.forEach((group) => {
    if (!group || typeof group.getBBox !== "function") {
      return;
    }

    try {
      const box = group.getBBox();

      if (!box || (!box.width && !box.height)) {
        return;
      }

      hasMeasuredBounds = true;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    } catch (error) {
      // Hidden or not-yet-rendered SVG nodes may fail to measure; keep the original viewBox.
    }
  });

  if (!hasMeasuredBounds) {
    return {
      viewBox: baseViewBox,
      hasMeasuredBounds
    };
  }

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padX = Math.max(24, contentWidth * 0.08);
  const padY = Math.max(28, contentHeight * 0.1);

  return {
    viewBox: {
      x: minX - padX,
      y: minY - padY,
      width: contentWidth + padX * 2,
      height: contentHeight + padY * 2
    },
    hasMeasuredBounds
  };
}

function applyWritingSvgViewBox(entry) {
  if (!entry?.svg || entry.viewBoxMeasured) {
    return;
  }

  const { viewBox: nextViewBox, hasMeasuredBounds } = getWritingSvgViewBox(entry.svg, entry.baseViewBox || entry.viewBox);
  entry.viewBox = nextViewBox;
  entry.viewBoxMeasured = hasMeasuredBounds;
  entry.svg.setAttribute("viewBox", `${nextViewBox.x} ${nextViewBox.y} ${nextViewBox.width} ${nextViewBox.height}`);
}

function refreshWritingPracticeViewBoxes() {
  writingPracticeState.slotEntries.forEach((entry) => {
    applyWritingSvgViewBox(entry);
  });
}

function collectWritingTargetClipMasks(svg, path) {
  const clipValue = path.getAttribute("clip-path");

  if (!clipValue || !clipValue.startsWith("url(#") || !clipValue.endsWith(")")) {
    return [];
  }

  const clipId = clipValue.slice(5, -1);
  const clipElement = svg.querySelector(`[id="${clipId}"]`);

  if (!clipElement) {
    return [];
  }

  const clipPaths = Array.from(clipElement.querySelectorAll("path"));

  clipElement.querySelectorAll("use").forEach((useElement) => {
    const href = useElement.getAttribute("href") || useElement.getAttribute("xlink:href");

    if (!href || !href.startsWith("#")) {
      return;
    }

    const referencedPath = svg.querySelector(`[id="${href.slice(1)}"]`);

    if (referencedPath instanceof SVGPathElement) {
      clipPaths.push(referencedPath);
    }
  });

  return clipPaths
    .map((clipPath) => clipPath.getAttribute("d"))
    .filter(Boolean)
    .map((pathData) => {
      try {
        return new Path2D(pathData);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function collectWritingTargetSegments(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return [];
  }

  return Array.from(strokesGroup.querySelectorAll("path"))
    .map((path) => {
      const pathData = path.getAttribute("d");

      if (!pathData) {
        return null;
      }

      try {
        return {
          pathMask: new Path2D(pathData),
          clipMasks: collectWritingTargetClipMasks(svg, path)
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function getWritingTargetStrokeWidth(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return 128;
  }

  const inlineWidth = Number.parseFloat(strokesGroup.style?.strokeWidth || "");

  if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
    return inlineWidth;
  }

  const attributeWidth = Number.parseFloat(strokesGroup.getAttribute("stroke-width") || "");
  return Number.isFinite(attributeWidth) && attributeWidth > 0 ? attributeWidth : 128;
}

function collectWritingStrokeEntries(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return [];
  }

  return Array.from(strokesGroup.children)
    .map((child) => {
      const paths =
        child.tagName.toLowerCase() === "path" ? [child] : Array.from(child.querySelectorAll("path"));

      if (!paths.length) {
        return null;
      }

      const measuredPaths = paths.map((path) => {
        const length = path.getTotalLength();
        path.dataset.length = String(length);
        return path;
      });

      const maxLength = Math.max(...measuredPaths.map((path) => Number(path.dataset.length || 0)));

      return {
        duration: clampValue(Math.round(maxLength / 2.9), 280, 760),
        paths: measuredPaths
      };
    })
    .filter(Boolean);
}

function setWritingStrokeEntriesState(revealed = false, opacity = 0) {
  writingPracticeState.slotEntries.forEach((entry) => {
    entry.strokeEntries.forEach((strokeEntry) => {
      strokeEntry.paths.forEach((path) => {
        const length = Number(path.dataset.length || 0);
        path.style.transition = "none";
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = revealed ? "0" : `${length}`;
        path.style.opacity = opacity > 0 ? String(opacity) : "0";
      });
    });
  });
}

function buildWritingPracticeStage(current) {
  const layer = document.getElementById("writing-svg-layer");
  const stageEmpty = document.getElementById("writing-practice-stage-empty");

  if (!layer || !stageEmpty || !current) {
    return;
  }

  const units = splitWritingPracticeUnits(current.char);
  const renderPrefix = `writing-${current.id}-${writingPracticeState.renderSeed + 1}`;

  writingPracticeState.renderSeed += 1;
  writingPracticeState.slotEntries = [];
  writingPracticeState.hasVectorGuide = false;

  layer.innerHTML = "";
  layer.style.setProperty("--slot-count", String(units.length || 1));

  units.forEach((unit, unitIndex) => {
    const characters = Array.from(unit);
    const slot = document.createElement("div");
    slot.className = "writing-character-slot";
    slot.dataset.char = unit;
    slot.classList.toggle("is-compound", characters.length > 1);
    slot.style.setProperty("--glyph-count", String(characters.length));

    characters.forEach((character, glyphIndex) => {
      const glyph = document.createElement("div");
      glyph.className = "writing-character-glyph";
      glyph.classList.toggle("is-leading", glyphIndex === 0);
      glyph.classList.toggle("is-trailing", glyphIndex === characters.length - 1);
      glyph.classList.toggle("is-small", glyphIndex > 0 && writingPracticeCompoundFollowers.has(character));
      glyph.dataset.char = character;
      slot.appendChild(glyph);

      const rawSvg = kanaStrokeSvgs[character];

      if (!rawSvg) {
        const fallback = document.createElement("div");
        fallback.className = "writing-character-fallback";
        fallback.textContent = character;
        glyph.appendChild(fallback);
        writingPracticeState.slotEntries.push({
          char: character,
          unit,
          slot,
          glyph,
          svg: null,
          baseViewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBoxMeasured: true,
          shadowPaths: [],
          targetSegments: [],
          targetStrokeWidth: 128,
          strokeEntries: []
        });
        return;
      }

      const svg = parseWritingPracticeSvg(rawSvg);

      if (!svg) {
        const fallback = document.createElement("div");
        fallback.className = "writing-character-fallback";
        fallback.textContent = character;
        glyph.appendChild(fallback);
        writingPracticeState.slotEntries.push({
          char: character,
          unit,
          slot,
          glyph,
          svg: null,
          baseViewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBoxMeasured: true,
          shadowPaths: [],
          targetSegments: [],
          targetStrokeWidth: 128,
          strokeEntries: []
        });
        return;
      }

      glyph.appendChild(svg);
      svg.classList.add("writing-character-svg");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      uniquifyWritingSvgIds(svg, `${renderPrefix}-${unitIndex}-${glyphIndex}`);

      const baseViewBox = svg.viewBox?.baseVal
        ? {
            x: svg.viewBox.baseVal.x,
            y: svg.viewBox.baseVal.y,
            width: svg.viewBox.baseVal.width || 1024,
            height: svg.viewBox.baseVal.height || 1024
          }
        : { x: 0, y: 0, width: 1024, height: 1024 };

      const shadowPaths = Array.from(svg.querySelectorAll('g[data-strokesvg="shadows"] path'))
        .map((path) => path.getAttribute("d"))
        .filter(Boolean);
      const targetSegments = collectWritingTargetSegments(svg);
      const targetStrokeWidth = getWritingTargetStrokeWidth(svg);

      writingPracticeState.hasVectorGuide = writingPracticeState.hasVectorGuide || shadowPaths.length > 0;

      const { viewBox, hasMeasuredBounds } = getWritingSvgViewBox(svg, baseViewBox);
      svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
      const strokeEntries = collectWritingStrokeEntries(svg);

      writingPracticeState.slotEntries.push({
        char: character,
        unit,
        slot,
        glyph,
        svg,
        baseViewBox,
        viewBox,
        viewBoxMeasured: hasMeasuredBounds,
        shadowPaths,
        targetSegments,
        targetStrokeWidth,
        strokeEntries
      });
    });

    layer.appendChild(slot);
  });

  stageEmpty.hidden = writingPracticeState.hasVectorGuide;
  stageEmpty.textContent = writingPracticeState.hasVectorGuide
    ? ""
    : "따라쓰기 데이터를 준비하지 못했어요.";
  setWritingStrokeEntriesState(false, 0);
}

function updateWritingPracticeStageState() {
  const stage = document.getElementById("writing-practice-stage");

  if (!stage) {
    return;
  }

  stage.classList.toggle("is-guide-hidden", !writingPracticeState.guideVisible);
  stage.classList.toggle("is-answer-visible", writingPracticeState.answerVisible);
}

function getWritingPracticeStrokeCount() {
  return writingPracticeState.slotEntries.reduce((count, entry) => count + entry.strokeEntries.length, 0);
}

function updateWritingPracticeControls() {
  const guideToggle = document.getElementById("writing-guide-toggle");
  const revealToggle = document.getElementById("writing-practice-reveal");
  const prevButton = document.getElementById("writing-practice-prev");
  const clearButton = document.getElementById("writing-practice-clear");
  const scoreButton = document.getElementById("writing-practice-score-btn");
  const replayButton = document.getElementById("writing-practice-replay");
  const nextButton = document.getElementById("writing-practice-next");
  const isBusy = writingPracticeState.isAnimating || writingPracticeState.isTransitioning;

  const syncButtonState = (button, label, disabled) => {
    if (!button) {
      return;
    }

    if (typeof label === "string" && button.textContent !== label) {
      button.textContent = label;
    }

    if (button.disabled !== disabled) {
      button.disabled = disabled;
    }
  };

  if (guideToggle) {
    guideToggle.disabled = !writingPracticeState.hasVectorGuide || isBusy;
    const isGuideVisible = writingPracticeState.guideVisible;
    const guideLabel = guideToggle.querySelector(".writing-practice-guide-label");
    const guideIcon = guideToggle.querySelector(".writing-practice-guide-icon");

    if (guideLabel) {
      guideLabel.textContent = "가이드";
    }

    if (guideIcon) {
      guideIcon.textContent = isGuideVisible ? "visibility_off" : "visibility";
      guideIcon.setAttribute("aria-label", isGuideVisible ? "숨김" : "표시");
    }

    guideToggle.setAttribute("aria-label", `가이드 ${isGuideVisible ? "숨기기" : "보기"}`);
  }

  if (revealToggle) {
    syncButtonState(
      revealToggle,
      writingPracticeState.answerVisible ? "정답 숨길래요" : "정답 볼래요",
      !writingPracticeState.hasVectorGuide || isBusy
    );
  }

  if (prevButton) {
    syncButtonState(prevButton, null, !writingPracticeState.sessionItems.length || isBusy);
  }

  if (clearButton) {
    syncButtonState(clearButton, null, writingPracticeState.strokes.length === 0 || isBusy);
  }

  if (scoreButton) {
    syncButtonState(scoreButton, null, !writingPracticeState.hasVectorGuide || isBusy);
  }

  if (replayButton) {
    syncButtonState(replayButton, null, !writingPracticeState.hasVectorGuide || isBusy);
  }

  if (nextButton) {
    syncButtonState(nextButton, null, !writingPracticeState.sessionItems.length || isBusy);
  }
}

function updateWritingPracticePanel() {
  const current = getCurrentWritingPracticeItem();
  const source = document.getElementById("writing-practice-source");
  const progress = document.getElementById("writing-practice-progress");
  const strokes = document.getElementById("writing-practice-strokes");
  const character = document.getElementById("writing-practice-char");
  const reading = document.getElementById("writing-practice-reading");
  const score = document.getElementById("writing-practice-score");
  const feedback = document.getElementById("writing-practice-feedback");
  const prompt = document.getElementById("writing-practice-prompt");
  const tip = document.getElementById("writing-practice-tip");

  syncSelectionButtonState(
    document.querySelectorAll("[data-writing-mode]"),
    (button) => button.dataset.writingMode,
    writingPracticeSettings.mode
  );
  syncSelectionButtonState(
    document.querySelectorAll("[data-writing-order]"),
    (button) => button.dataset.writingOrder,
    writingPracticeSettings.order
  );

  renderWritingPracticeSetup();

  if (!current) {
    if (source) {
      source.textContent = "-";
    }
    if (progress) {
      progress.textContent = "-";
    }
    if (strokes) {
      strokes.textContent = "-";
    }
    if (character) {
      character.textContent = "-";
    }
    if (reading) {
      reading.textContent = "-";
    }
    if (score) {
      score.textContent = "-";
    }
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }
    if (prompt) {
      prompt.textContent = "가이드를 따라 천천히 써보고, 끝나면 점수를 확인해봐요.";
    }
    if (tip) {
      tip.textContent = getWritingPracticeDefaultTip();
    }
    updateWritingPracticeStageState();
    updateWritingPracticeControls();
    return;
  }

  const total = writingPracticeState.sessionItems.length;

  if (source) {
    source.textContent = current.source;
  }
  if (progress) {
    progress.textContent = `${writingPracticeState.sessionIndex + 1} / ${total}`;
  }
  if (strokes) {
    strokes.textContent = `${getWritingPracticeStrokeCount()}획`;
  }
  if (character) {
    character.textContent = current.char;
  }
  if (reading) {
    reading.textContent = current.reading;
  }
  if (score) {
    score.textContent = writingPracticeState.score === null ? "-" : `${writingPracticeState.score}점`;
  }
  if (feedback) {
    feedback.hidden = writingPracticeState.score === null;
    feedback.textContent = writingPracticeState.score === null ? "" : writingPracticeState.feedback;
  }
  if (prompt) {
    prompt.textContent = `「${current.char}」를 칸 안에 맞춰 써보고, 끝나면 점수를 확인해봐요.`;
  }
  if (tip) {
    tip.textContent = writingPracticeState.tip;
  }

  updateWritingPracticeStageState();
  updateWritingPracticeControls();
}

function getWritingCanvasReferenceRect(canvas) {
  const layer = document.getElementById("writing-svg-layer");
  const layerRect = layer?.getBoundingClientRect();

  if (layerRect?.width && layerRect?.height) {
    return layerRect;
  }

  return canvas.getBoundingClientRect();
}

function getWritingCanvasScaleRatio(canvas) {
  const rect = canvas.getBoundingClientRect();
  return canvas.width / Math.max(rect.width, 1);
}

function getWritingBrushWidth(canvas) {
  const referenceRect = getWritingCanvasReferenceRect(canvas);
  const scaleRatio = getWritingCanvasScaleRatio(canvas);
  const cssBrushWidth = clampValue(Math.round(Math.min(referenceRect.width, referenceRect.height) * 0.018), 6, 14);
  return Math.max(1, Math.round(cssBrushWidth * scaleRatio));
}

function drawWritingStroke(ctx, canvas, points) {
  if (!points.length) {
    return;
  }

  const absolutePoints = points.map((point) => ({
    x: point.x * canvas.width,
    y: point.y * canvas.height
  }));

  if (absolutePoints.length === 1) {
    const radius = getWritingBrushWidth(canvas) * 0.5;
    ctx.beginPath();
    ctx.arc(absolutePoints[0].x, absolutePoints[0].y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(absolutePoints[0].x, absolutePoints[0].y);

  for (let index = 1; index < absolutePoints.length; index += 1) {
    ctx.lineTo(absolutePoints[index].x, absolutePoints[index].y);
  }

  ctx.stroke();
}

function getWritingOverlayBounds(canvas, strokes) {
  if (!canvas || !strokes.length) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  strokes.forEach((stroke) => {
    stroke.forEach((point) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  const padding = getWritingBrushWidth(canvas);

  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(canvas.width, maxX + padding) - Math.max(0, minX - padding),
    height: Math.min(canvas.height, maxY + padding) - Math.max(0, minY - padding)
  };
}

function clearWritingOverlayRegion(ctx, canvas, bounds) {
  if (!ctx || !canvas) {
    return;
  }

  if (!bounds) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function resetWritingOverlayCanvas() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = canvas?.getContext("2d");

  if (canvas && ctx) {
    clearWritingOverlayRegion(ctx, canvas, null);
  }

  writingPracticeState.overlayHasInk = false;
  writingPracticeState.overlayBounds = null;
}

function renderWritingOverlay() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = canvas?.getContext("2d");

  if (!canvas || !ctx) {
    return;
  }

  const hasStrokes = writingPracticeState.strokes.some((stroke) => stroke.length);

  if (!hasStrokes && !writingPracticeState.overlayHasInk) {
    return;
  }

  const nextBounds = hasStrokes ? getWritingOverlayBounds(canvas, writingPracticeState.strokes) : null;
  const previousBounds = writingPracticeState.overlayBounds;
  const clearBounds =
    previousBounds && nextBounds
      ? {
          x: Math.min(previousBounds.x, nextBounds.x),
          y: Math.min(previousBounds.y, nextBounds.y),
          width: Math.max(previousBounds.x + previousBounds.width, nextBounds.x + nextBounds.width) - Math.min(previousBounds.x, nextBounds.x),
          height: Math.max(previousBounds.y + previousBounds.height, nextBounds.y + nextBounds.height) - Math.min(previousBounds.y, nextBounds.y)
        }
      : previousBounds || nextBounds;

  clearWritingOverlayRegion(ctx, canvas, clearBounds);

  if (!hasStrokes) {
    writingPracticeState.overlayHasInk = false;
    writingPracticeState.overlayBounds = null;
    return;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(30, 35, 49, 0.94)";
  ctx.fillStyle = "rgba(30, 35, 49, 0.94)";
  ctx.lineWidth = getWritingBrushWidth(canvas);

  writingPracticeState.strokes.forEach((stroke) => {
    drawWritingStroke(ctx, canvas, stroke);
  });
  writingPracticeState.overlayHasInk = true;
  writingPracticeState.overlayBounds = nextBounds;
}

function renderWritingPracticeTargetMask() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = writingPracticeState.targetCanvas.getContext("2d");

  if (!canvas || !ctx) {
    return;
  }

  writingPracticeState.targetCanvas.width = canvas.width;
  writingPracticeState.targetCanvas.height = canvas.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!writingPracticeState.hasVectorGuide) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const scaleRatio = canvas.width / Math.max(canvasRect.width, 1);
  ctx.fillStyle = "#ffffff";

  writingPracticeState.slotEntries.forEach((entry) => {
    if (!entry.svg || !entry.targetSegments.length) {
      return;
    }

    const svgRect = entry.svg.getBoundingClientRect();

    if (!svgRect.width || !svgRect.height) {
      return;
    }

    const x = (svgRect.left - canvasRect.left) * scaleRatio;
    const y = (svgRect.top - canvasRect.top) * scaleRatio;
    const width = svgRect.width * scaleRatio;
    const height = svgRect.height * scaleRatio;
    const scale = Math.min(width / entry.viewBox.width, height / entry.viewBox.height);
    const offsetX = x + (width - entry.viewBox.width * scale) / 2 - entry.viewBox.x * scale;
    const offsetY = y + (height - entry.viewBox.height * scale) / 2 - entry.viewBox.y * scale;
    const guideStrokeWidth = (entry.targetStrokeWidth || 128) * scale;
    const targetStrokeWidth = Math.max(getWritingBrushWidth(canvas) * 2.2, guideStrokeWidth * 0.34);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, targetStrokeWidth / Math.max(scale, 0.0001));
    entry.targetSegments.forEach((segment) => {
      ctx.save();

      if (segment.clipMasks.length) {
        segment.clipMasks.forEach((clipMask) => {
          ctx.clip(clipMask);
        });
      }

      ctx.stroke(segment.pathMask);
      ctx.restore();
    });
    ctx.restore();
  });
}

function syncWritingPracticeCanvas() {
  const canvas = document.getElementById("writing-overlay-canvas");

  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  const nextWidth = Math.max(1, Math.round(rect.width * ratio));
  const nextHeight = Math.max(1, Math.round(rect.height * ratio));
  const resized = canvas.width !== nextWidth || canvas.height !== nextHeight;

  if (resized) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    writingPracticeState.overlayHasInk = false;
    writingPracticeState.overlayBounds = null;
  }

  refreshWritingPracticeViewBoxes();
  renderWritingOverlay();
}

function observeWritingPracticeLayout() {
  if (writingPracticeState.layoutObserver || typeof ResizeObserver !== "function") {
    return;
  }

  writingPracticeState.layoutObserver = new ResizeObserver(() => {
    if (!document.getElementById("writing-practice-shell") || getCharactersTab(state.charactersTab) !== "writing") {
      return;
    }

    scheduleWritingPracticeLayout(false);
  });

  const stage = document.getElementById("writing-practice-stage");

  if (stage) {
    writingPracticeState.layoutObserver.observe(stage);
  }
}

function scheduleWritingPracticeLayout(replay = false) {
  beginWritingPracticeTransition();

  if (writingPracticeState.layoutFrame) {
    cancelAnimationFrame(writingPracticeState.layoutFrame);
  }

  writingPracticeState.layoutFrame = window.requestAnimationFrame(() => {
    writingPracticeState.layoutFrame = window.requestAnimationFrame(() => {
      writingPracticeState.layoutFrame = null;
      syncWritingPracticeCanvas();
      updateWritingPracticeStageState();
      endWritingPracticeTransition();

      if (replay && writingPracticeState.hasVectorGuide) {
        replayWritingStrokeAnimation();
      }
    });
  });
}

function getWritingPracticeScoreResult(score, coverage, precision) {
  if (score >= 90) {
    return {
      score,
      feedback: "거의 맞았어요. 획 모양이 안정적으로 들어왔어요.",
      tip: "이 감각으로 다음 글자도 이어가보세요."
    };
  }

  if (score >= 78) {
    if (coverage < precision) {
      return {
        score,
        feedback: "모양은 좋아요. 다만 빠진 부분이 조금 있어요.",
        tip: "획의 끝점을 한 번만 더 길게 빼보면 더 닮아져요."
      };
    }

    return {
      score,
      feedback: "대체로 잘 맞아요. 가이드 밖으로 나온 부분만 조금 줄여보세요.",
      tip: "선을 조금 더 천천히 눌러 쓰면 점수가 더 올라가요."
    };
  }

  if (score >= 62) {
    if (coverage < 0.55) {
      return {
        score,
        feedback: "형태는 잡혔지만 빠진 획이 아직 보여요.",
        tip: "획순 다시 보기로 시작점과 끝점을 확인해보세요."
      };
    }

    return {
      score,
      feedback: "전체 윤곽은 보이기 시작했어요. 조금만 더 안쪽으로 모아 써보세요.",
      tip: "가이드 안에서 크기를 조금 줄이면 훨씬 비슷해져요."
    };
  }

  if (coverage < 0.42) {
    return {
      score,
      feedback: "빠진 부분이 많아요. 획을 끝까지 이어서 써보면 좋아요.",
      tip: "정답 모양을 보고 흐름을 익힌 뒤, 화면을 꽉 채운다는 느낌으로 다시 써봐요."
    };
  }

  if (precision < 0.34) {
    return {
      score,
      feedback: "획이 가이드 밖으로 많이 벗어났어요.",
      tip: "한 번에 빨리 쓰기보다 짧게 끊어가며 맞춰보세요."
    };
  }

  return {
    score,
    feedback: "첫 형태는 잡혔어요. 다시 한 번 천천히 써보면 금방 올라가요.",
    tip: "가이드를 켠 상태로 크기와 간격부터 먼저 맞춰보세요."
  };
}

function buildWritingPracticeMask(data) {
  const mask = new Uint8Array(Math.floor(data.length / 4));
  let activePixels = 0;

  for (let dataIndex = 3, maskIndex = 0; dataIndex < data.length; dataIndex += 4, maskIndex += 1) {
    const isActive = data[dataIndex] > 32 ? 1 : 0;
    mask[maskIndex] = isActive;
    activePixels += isActive;
  }

  return {
    mask,
    activePixels
  };
}

function buildWritingPracticeIntegralMask(mask, width, height) {
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));

  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    const maskRowOffset = (y - 1) * width;
    const integralRowOffset = y * stride;
    const previousRowOffset = (y - 1) * stride;

    for (let x = 1; x <= width; x += 1) {
      rowSum += mask[maskRowOffset + x - 1];
      integral[integralRowOffset + x] = integral[previousRowOffset + x] + rowSum;
    }
  }

  return integral;
}

function hasWritingPracticeMaskHit(integral, width, height, x, y, radius) {
  const stride = width + 1;
  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const right = Math.min(width - 1, x + radius);
  const bottom = Math.min(height - 1, y + radius);
  const x1 = left;
  const y1 = top;
  const x2 = right + 1;
  const y2 = bottom + 1;
  const sum =
    integral[y2 * stride + x2] -
    integral[y1 * stride + x2] -
    integral[y2 * stride + x1] +
    integral[y1 * stride + x1];

  return sum > 0;
}

function countWritingPracticeMaskMatches(mask, activePixels, targetIntegral, width, height, radius) {
  if (!activePixels) {
    return 0;
  }

  let matches = 0;
  let index = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, index += 1) {
      if (!mask[index]) {
        continue;
      }

      if (hasWritingPracticeMaskHit(targetIntegral, width, height, x, y, radius)) {
        matches += 1;
      }
    }
  }

  return matches;
}

function scoreWritingPractice() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  const canvas = document.getElementById("writing-overlay-canvas");
  const userCtx = canvas?.getContext("2d");
  const targetCtx = writingPracticeState.targetCanvas.getContext("2d");

  if (!canvas || !userCtx || !targetCtx || !writingPracticeState.hasVectorGuide) {
    return;
  }

  if (!writingPracticeState.strokes.some((stroke) => stroke.length)) {
    writingPracticeState.feedback = "아직 쓴 획이 없어요. 먼저 한 번 써볼까요?";
    writingPracticeState.tip = "글자를 칸 안에 크게 한 번 쓴 뒤 점수를 눌러보세요.";
    updateWritingPracticePanel();
    return;
  }

  renderWritingPracticeTargetMask();

  const userData = userCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const targetData = targetCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const { mask: userMask, activePixels: userPixels } = buildWritingPracticeMask(userData);
  const { mask: targetMask, activePixels: targetPixels } = buildWritingPracticeMask(targetData);

  if (!targetPixels || !userPixels) {
    writingPracticeState.feedback = "아직 비교할 선이 충분하지 않아요. 조금 더 크게 써보세요.";
    writingPracticeState.tip = "획을 한두 번 더 보강한 뒤 다시 점수를 눌러보세요.";
    updateWritingPracticePanel();
    return;
  }

  const toleranceRadius = clampValue(Math.round(getWritingBrushWidth(canvas) * 0.9), 6, 16);
  const userIntegral = buildWritingPracticeIntegralMask(userMask, canvas.width, canvas.height);
  const targetIntegral = buildWritingPracticeIntegralMask(targetMask, canvas.width, canvas.height);
  const coveredTargetPixels = countWritingPracticeMaskMatches(targetMask, targetPixels, userIntegral, canvas.width, canvas.height, toleranceRadius);
  const alignedUserPixels = countWritingPracticeMaskMatches(userMask, userPixels, targetIntegral, canvas.width, canvas.height, toleranceRadius);
  const coverage = coveredTargetPixels / targetPixels;
  const precision = alignedUserPixels / userPixels;
  const easedCoverage = Math.sqrt(coverage);
  const easedPrecision = Math.sqrt(precision);
  const score = clampValue(Math.round((easedCoverage * 0.58 + easedPrecision * 0.42) * 100), 0, 100);
  const result = getWritingPracticeScoreResult(score, easedCoverage, easedPrecision);

  writingPracticeState.score = result.score;
  writingPracticeState.feedback = result.feedback;
  writingPracticeState.tip = result.tip;

  updateWritingPracticePanel();
  updateStudyStreak();
  saveState();
  renderStats();
}

function getWritingCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: clampValue((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampValue((event.clientY - rect.top) / rect.height, 0, 1)
  };
}

function handleWritingPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!getCurrentWritingPracticeItem()) {
    return;
  }

  const canvas = event.currentTarget;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  writingPracticeState.pointerId = event.pointerId;
  writingPracticeState.isDrawing = true;

  if (writingPracticeState.score !== null) {
    writingPracticeState.score = null;
    writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
    writingPracticeState.tip = getWritingPracticeDefaultTip();
  }

  const point = getWritingCanvasPoint(event, canvas);
  writingPracticeState.strokes.push([point]);
  renderWritingOverlay();
  updateWritingPracticePanel();
}

function handleWritingPointerMove(event) {
  if (!writingPracticeState.isDrawing || writingPracticeState.pointerId !== event.pointerId) {
    return;
  }

  const canvas = event.currentTarget;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  event.preventDefault();

  const point = getWritingCanvasPoint(event, canvas);
  const currentStroke = writingPracticeState.strokes[writingPracticeState.strokes.length - 1];

  if (!currentStroke) {
    return;
  }

  const lastPoint = currentStroke[currentStroke.length - 1];

  if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.0022) {
    return;
  }

  currentStroke.push(point);
  renderWritingOverlay();
}

function finishWritingPointer(event) {
  if (writingPracticeState.pointerId !== event.pointerId) {
    return;
  }

  const canvas = event.currentTarget;

  if (canvas instanceof HTMLCanvasElement && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  writingPracticeState.pointerId = null;
  writingPracticeState.isDrawing = false;
  updateWritingPracticeControls();
}

function waitForWritingAnimation(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

async function replayWritingStrokeAnimation() {
  if (!writingPracticeState.hasVectorGuide || writingPracticeState.isAnimating) {
    return;
  }

  cancelWritingPracticeAnimation();
  const token = writingPracticeState.animationToken;
  writingPracticeState.isAnimating = true;
  setWritingStrokeEntriesState(false, 0);
  updateWritingPracticeControls();

  for (const entry of writingPracticeState.slotEntries) {
    for (const strokeEntry of entry.strokeEntries) {
      if (token !== writingPracticeState.animationToken) {
        return;
      }

      strokeEntry.paths.forEach((path) => {
        const length = Number(path.dataset.length || 0);
        path.style.transition = "none";
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        path.style.opacity = "1";
      });

      strokeEntry.paths[0]?.getBoundingClientRect();

      strokeEntry.paths.forEach((path) => {
        path.style.transition = `stroke-dashoffset ${strokeEntry.duration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease`;
        path.style.strokeDashoffset = "0";
      });

      await waitForWritingAnimation(strokeEntry.duration + 90);
    }
  }

  if (token !== writingPracticeState.animationToken) {
    return;
  }

  writingPracticeState.isAnimating = false;
  setWritingStrokeEntriesState(true, writingPracticeState.answerVisible ? 0.88 : 0.18);
  updateWritingPracticeControls();
}

function clearWritingPracticeCanvas(resetStatus = true) {
  writingPracticeState.strokes = [];

  if (resetStatus) {
    writingPracticeState.score = null;
    writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
    writingPracticeState.tip = getWritingPracticeDefaultTip();
  }

  renderWritingOverlay();
  updateWritingPracticePanel();
}

function startWritingPracticeSession(mode = writingPracticeSettings.mode, order = writingPracticeSettings.order) {
  const nextMode = ["hiragana", "katakana", "random"].includes(mode) ? mode : "hiragana";
  const nextOrder = getWritingPracticeOrder(order);
  writingPracticeSettings.mode = nextMode;
  writingPracticeSettings.order = nextOrder;
  writingPracticeState.sessionItems = buildWritingPracticeSession(nextMode, nextOrder);
  writingPracticeState.sessionIndex = 0;
  resetWritingPracticeRound();
  renderWritingPractice();
}

function nextWritingPracticeItem() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!writingPracticeState.sessionItems.length) {
    startWritingPracticeSession(writingPracticeSettings.mode, writingPracticeSettings.order);
    return;
  }

  if (writingPracticeState.sessionIndex + 1 >= writingPracticeState.sessionItems.length) {
    writingPracticeState.sessionItems = buildWritingPracticeSession(
      writingPracticeSettings.mode,
      writingPracticeSettings.order
    );
    writingPracticeState.sessionIndex = 0;
  } else {
    writingPracticeState.sessionIndex += 1;
  }

  resetWritingPracticeRound();
  renderWritingPractice();
}

function previousWritingPracticeItem() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!writingPracticeState.sessionItems.length) {
    startWritingPracticeSession(writingPracticeSettings.mode, writingPracticeSettings.order);
    return;
  }

  if (writingPracticeState.sessionIndex <= 0) {
    writingPracticeState.sessionIndex = writingPracticeState.sessionItems.length - 1;
  } else {
    writingPracticeState.sessionIndex -= 1;
  }

  resetWritingPracticeRound();
  renderWritingPractice();
}

function openWritingPracticeForCharacter(char, script) {
  if (!char) {
    return;
  }

  const nextMode = script === "katakana" ? "katakana" : "hiragana";
  const nextItems = buildWritingPracticeSession(nextMode, writingPracticeSettings.order);
  const nextIndex = nextItems.findIndex((item) => item.char === char);

  state.charactersTab = "writing";
  writingPracticeSettings.mode = nextMode;
  writingPracticeState.sessionItems = nextItems;
  writingPracticeState.sessionIndex = nextIndex >= 0 ? nextIndex : 0;
  resetWritingPracticeRound();
  saveState();
  renderWritingPractice();
  renderCharactersPageLayout();
}

function toggleWritingGuide() {
  writingPracticeState.guideVisible = !writingPracticeState.guideVisible;
  updateWritingPracticePanel();
}

function toggleWritingAnswer() {
  if (!writingPracticeState.hasVectorGuide) {
    return;
  }

  cancelWritingPracticeAnimation();
  writingPracticeState.answerVisible = !writingPracticeState.answerVisible;

  if (writingPracticeState.answerVisible) {
    writingPracticeState.guideVisible = true;
    writingPracticeState.tip = "정답 모양을 켰어요. 획순을 보고 같은 흐름으로 다시 써봐요.";
    setWritingStrokeEntriesState(true, 0.88);
    updateWritingPracticePanel();
    return;
  }

  writingPracticeState.tip =
    writingPracticeState.score === null ? getWritingPracticeDefaultTip() : writingPracticeState.tip;
  setWritingStrokeEntriesState(false, 0);
  updateWritingPracticePanel();
}

function renderWritingPractice() {
  const shell = document.getElementById("writing-practice-shell");

  if (!shell) {
    return;
  }

  ensureWritingPracticeSession();

  const current = getCurrentWritingPracticeItem();

  if (!current) {
    endWritingPracticeTransition();
    updateWritingPracticePanel();
    return;
  }

  buildWritingPracticeStage(current);
  updateWritingPracticePanel();

  if (getCharactersTab(state.charactersTab) === "writing") {
    scheduleWritingPracticeLayout(false);
  }
}

function createQuizMeta(item, mode, promptKind) {
  return {
    mode,
    promptKind,
    sourceId: item.id,
    level: item.level,
    word: item.word,
    reading: item.reading,
    meaning: item.meaning,
    part: item.part
  };
}

function buildWordToMeaningQuizQuestion(item, pool, index) {
  const correctMeaning = item.meaning;
  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.meaning !== correctMeaning)
        .map((candidate) => candidate.meaning)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  const label = item.part ? ` (${item.part})` : "";

  return {
    id: `quiz-meaning-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 히라가나, 뜻이 뭘까요? ${item.reading}${label}`,
    options: shuffleQuizArray([correctMeaning, ...distractors.slice(0, 3)]),
    answer: correctMeaning,
    meta: createQuizMeta(item, "meaning", "word-to-meaning")
  };
}

function buildMeaningToWordQuizQuestion(item, pool, index) {
  const correctWord = item.word;
  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.word !== correctWord)
        .map((candidate) => candidate.word)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  return {
    id: `quiz-word-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 뜻에 맞는 일본어 단어는 뭘까요? ${item.meaning}`,
    options: shuffleQuizArray([correctWord, ...distractors.slice(0, 3)]),
    answer: correctWord,
    meta: createQuizMeta(item, "meaning", "meaning-to-word")
  };
}

function buildReadingQuizQuestion(item, pool, index) {
  if (!item.word || !item.reading || item.word === item.reading) {
    return null;
  }

  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.reading !== item.reading)
        .map((candidate) => candidate.reading)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  const label = item.part ? ` (${item.part})` : "";

  return {
    id: `quiz-reading-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 단어, 어떻게 읽을까요? ${item.word}${label}`,
    options: shuffleQuizArray([item.reading, ...distractors.slice(0, 3)]),
    answer: item.reading,
    meta: createQuizMeta(item, "reading", "word-to-reading")
  };
}

function buildMeaningQuizSession(pool, count) {
  const seedItems = shuffleQuizArray(pool);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const question = buildWordToMeaningQuizQuestion(seedItems[index], pool, questions.length);

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

function buildReadingQuizSession(pool, count) {
  const readingPool = pool.filter((item) => item.word && item.reading && item.word !== item.reading);
  const seedItems = shuffleQuizArray(readingPool);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const question = buildReadingQuizQuestion(seedItems[index], readingPool, questions.length);

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

function createFallbackQuizSession(count, mode = state.quizMode, level = state.quizLevel) {
  const activeLevel = getQuizLevel(level);
  const sessionMode = getQuizMode(mode);
  const fallbackPool = buildDynamicQuizPool(getFallbackVocabItems(activeLevel));
  const fallbackQuestions =
    sessionMode === "reading"
      ? buildReadingQuizSession(fallbackPool, count)
      : buildMeaningQuizSession(fallbackPool, count);

  if (fallbackQuestions.length) {
    return fallbackQuestions;
  }

  const levelQuestions =
    activeLevel === allLevelValue
      ? quizQuestions.filter((question) => contentLevels.includes(question.level))
      : quizQuestions.filter((question) => question.level === activeLevel);
  const sourceQuestions = levelQuestions.length
    ? levelQuestions
    : quizQuestions.filter((question) => question.level === "N5");

  return shuffleQuizArray(sourceQuestions)
    .slice(0, Math.min(count, sourceQuestions.length))
    .map((question) => ({
      ...question,
      meta: {
        mode: "meaning",
        promptKind: "fallback",
        sourceId: question.id,
        word: question.answer,
        reading: "",
        meaning: question.answer,
        part: ""
      }
    }));
}

function createQuizSession(mode, size, level = state.quizLevel) {
  const activeLevel = getQuizLevel(level);
  const sessionMode = getQuizMode(mode);
  const questionCount = getQuizSessionSize(size);
  const activeSource = getDynamicVocabSource(activeLevel);
  const activePool = buildDynamicQuizPool(activeSource);
  const dynamicQuestions =
    sessionMode === "reading"
      ? buildReadingQuizSession(activePool, questionCount)
      : buildMeaningQuizSession(activePool, questionCount);

  return dynamicQuestions.length
    ? dynamicQuestions
    : createFallbackQuizSession(questionCount, sessionMode, activeLevel);
}

let activeQuizQuestions = [];
let activeVocabQuizQuestions = [];
let activeVocabQuizSignature = "";
let activeVocabQuizResults = [];
let activeVocabQuizChallengePayload = null;
let activeKanjiPracticeQuestions = [];
let activeGrammarPracticeQuestions = [];
let activeReadingPracticeQuestions = [];
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
const grammarPracticeState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};
const readingPracticeState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};

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

state = normalizeLoadedState(loadState());
let pendingExternalStudyState = null;

const quizSessions = {
  basic: {
    duration: 18,
    timeLeft: 18,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "basic-timer",
    pauseButtonElement: "basic-pause",
    correctElement: "basic-correct",
    wrongElement: "basic-wrong",
    streakElement: "basic-streak"
  },
  vocab: {
    duration: state.vocabQuizDuration,
    timeLeft: state.vocabQuizDuration,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "vocab-quiz-timer",
    pauseButtonElement: "vocab-quiz-pause",
    correctElement: "vocab-quiz-correct",
    wrongElement: "vocab-quiz-wrong",
    streakElement: "vocab-quiz-streak"
  },
  grammar: {
    duration: state.grammarPracticeDuration,
    timeLeft: state.grammarPracticeDuration,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "grammar-timer",
    pauseButtonElement: "grammar-pause",
    correctElement: "grammar-correct",
    wrongElement: "grammar-wrong",
    streakElement: "grammar-streak"
  },
  reading: {
    duration: state.readingDuration,
    timeLeft: state.readingDuration,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "reading-timer",
    pauseButtonElement: "reading-pause",
    correctElement: "reading-correct",
    wrongElement: "reading-wrong",
    streakElement: "reading-streak"
  },
  quiz: {
    duration: state.quizDuration,
    timeLeft: state.quizDuration,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "quiz-timer",
    pauseButtonElement: "quiz-pause",
    correctElement: "quiz-correct",
    wrongElement: "quiz-wrong",
    streakElement: "quiz-streak"
  },
  kana: {
    duration: 5,
    timeLeft: 5,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "kana-quiz-timer",
    pauseButtonElement: "kana-quiz-pause",
    correctElement: "kana-quiz-correct",
    wrongElement: "kana-quiz-wrong",
    streakElement: "kana-quiz-streak"
  },
  kanjiPractice: {
    duration: state.kanjiPracticeQuizDuration,
    timeLeft: state.kanjiPracticeQuizDuration,
    correct: 0,
    wrong: 0,
    streak: 0,
    isPaused: false,
    onExpire: null,
    timerId: null,
    timerElement: "kanji-practice-timer",
    pauseButtonElement: "kanji-practice-pause",
    correctElement: "kanji-practice-correct",
    wrongElement: "kanji-practice-wrong",
    streakElement: "kanji-practice-streak"
  }
};

const quizSessionOptionSelectors = {
  basic: "#basic-practice-options .basic-practice-option",
  vocab: "#vocab-quiz-options .basic-practice-option",
  grammar: "#grammar-practice-options .grammar-practice-option",
  reading: "#reading-options .reading-option",
  quiz: "#quiz-options .quiz-option",
  kana: "[data-kana-quiz-option]",
  kanjiPractice: "#kanji-practice-options .basic-practice-option"
};

function syncQuizSessionAnswerLock(key) {
  const session = quizSessions[key];
  const selector = quizSessionOptionSelectors[key];

  if (!session || !selector) {
    return;
  }

  document.querySelectorAll(selector).forEach((element) => {
    if (!("disabled" in element)) {
      return;
    }

    const pauseLocked = element.dataset.pauseLocked === "true";

    if (session.isPaused) {
      if (!element.disabled) {
        element.disabled = true;
        element.dataset.pauseLocked = "true";
      }
      return;
    }

    if (pauseLocked) {
      element.disabled = false;
      delete element.dataset.pauseLocked;
    }
  });
}

function syncQuizSessionPausedCardState(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const pauseButton = document.getElementById(session.pauseButtonElement);
  const timer = document.getElementById(session.timerElement);
  const card = (pauseButton || timer)?.closest(
    ".basic-practice-card, .grammar-practice-card, .reading-card, .quiz-card"
  );

  if (card) {
    card.classList.toggle("is-quiz-paused", session.isPaused);
  }
}

function syncQuizSessionInteractionState(key) {
  syncQuizSessionAnswerLock(key);
  syncQuizSessionPausedCardState(key);
}

function stopQuizSessionTimer(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  if (typeof sharedTimer.stopTimer === "function") {
    sharedTimer.stopTimer(session);
    return;
  }

  if (Number.isFinite(session.deadlineAt)) {
    syncQuizSessionClock(session);
  }

  if (session.timerId) {
    window.clearInterval(session.timerId);
  }

  session.timerId = null;
  session.deadlineAt = null;
}

function getQuizSessionRemainingMs(session) {
  if (typeof sharedTimer.getRemainingMs === "function") {
    return sharedTimer.getRemainingMs(session);
  }

  if (!session) {
    return 0;
  }

  if (Number.isFinite(session.timeLeftMs)) {
    return Math.max(0, Number(session.timeLeftMs));
  }

  return Math.max(0, (Number(session.timeLeft) || 0) * 1000);
}

function getQuizSessionDisplaySeconds(session, remainingMs = getQuizSessionRemainingMs(session)) {
  if (typeof sharedTimer.getDisplaySeconds === "function") {
    return sharedTimer.getDisplaySeconds(session, remainingMs);
  }

  if (!session || session.duration <= 0 || remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function formatQuizSessionClock(totalSeconds) {
  if (typeof sharedTimer.formatClock === "function") {
    return sharedTimer.formatClock(totalSeconds);
  }

  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function syncQuizSessionClock(session) {
  if (typeof sharedTimer.syncTimer === "function") {
    sharedTimer.syncTimer(session);
    return;
  }

  if (!session || session.duration <= 0 || !Number.isFinite(session.deadlineAt)) {
    return;
  }

  const remainingMs = Math.max(0, session.deadlineAt - Date.now());
  session.timeLeftMs = remainingMs;
  session.timeLeft = getQuizSessionDisplaySeconds(session, remainingMs);
}

function formatQuizSessionTimerText(session) {
  if (typeof sharedTimer.createSnapshot === "function") {
    return sharedTimer.createSnapshot(session).text;
  }

  if (!session || session.duration <= 0) {
    return "천천히";
  }

  const remainingMs = getQuizSessionRemainingMs(session);
  return formatQuizSessionClock(getQuizSessionDisplaySeconds(session, remainingMs));
}

function updateQuizTimerItem(timerItem, progress, warning, isStatic, instant = false) {
  if (typeof sharedTimer.updateTimerItem === "function") {
    sharedTimer.updateTimerItem(
      timerItem,
      {
        progress,
        isWarning: warning,
        isStatic
      },
      instant
    );
    return;
  }

  const nextProgress = progress.toFixed(3);
  const hud = timerItem.closest(".quiz-hud");
  const progressHost = hud || timerItem;
  const previousProgress = Number(progressHost.dataset.timerProgress || "1");
  const shouldReset = instant || progress > previousProgress + 0.01;

  timerItem.classList.add("is-timer");
  if (hud) {
    hud.classList.add("has-timer");
  }

  [timerItem, hud].forEach((target) => {
    if (!target) {
      return;
    }

    target.classList.toggle("is-warning", warning);
    target.classList.toggle("is-static", isStatic);

    if (shouldReset) {
      target.classList.add("is-resetting");
    }

    target.style.setProperty("--timer-progress", nextProgress);
    target.dataset.timerProgress = nextProgress;
  });

  if (shouldReset) {
    window.requestAnimationFrame(() => {
      timerItem.classList.remove("is-resetting");
      if (hud) {
        hud.classList.remove("is-resetting");
      }
    });
  }
}

function resetQuizSessionScore(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  session.correct = 0;
  session.wrong = 0;
  session.streak = 0;
}

function consumeQuizSessionExpire(session) {
  if (!session || typeof session.onExpire !== "function") {
    return;
  }

  const onExpire = session.onExpire;
  session.onExpire = null;
  onExpire();
}

function startQuizSessionInterval(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  if (typeof sharedTimer.startTimer === "function") {
    sharedTimer.startTimer(session, {
      intervalMs: 100,
      onTick: () => {
        renderQuizSessionHud(key);
      },
      onExpire: () => {
        session.isPaused = false;
        renderQuizSessionHud(key);
        consumeQuizSessionExpire(session);
      }
    });
    return;
  }

  const remainingMs = getQuizSessionRemainingMs(session);

  if (session.duration <= 0 || session.isPaused || remainingMs <= 0) {
    session.timeLeftMs = Math.max(0, remainingMs);
    session.timeLeft = getQuizSessionDisplaySeconds(session, remainingMs);
    session.deadlineAt = null;
    renderQuizSessionHud(key);

    if (remainingMs <= 0 && typeof session.onExpire === "function" && session.duration > 0 && !session.isPaused) {
      const onExpire = session.onExpire;
      session.onExpire = null;
      onExpire();
    }

    return;
  }

  session.deadlineAt = Date.now() + remainingMs;
  session.timeLeftMs = remainingMs;
  session.timeLeft = getQuizSessionDisplaySeconds(session, remainingMs);
  session.timerId = window.setInterval(() => {
    syncQuizSessionClock(session);
    renderQuizSessionHud(key);

    if (getQuizSessionRemainingMs(session) === 0) {
      stopQuizSessionTimer(key);
      session.isPaused = false;
      renderQuizSessionHud(key);

      if (typeof session.onExpire === "function") {
        const onExpire = session.onExpire;
        session.onExpire = null;
        onExpire();
      }
    }
  }, 100);

  renderQuizSessionHud(key);
}

function pauseQuizSession(key) {
  const session = quizSessions[key];

  if (!session || session.duration <= 0 || session.isPaused || !session.timerId) {
    return;
  }

  if (typeof sharedTimer.pauseTimer === "function") {
    sharedTimer.pauseTimer(session, {
      onTick: () => {
        renderQuizSessionHud(key);
      }
    });
    return;
  }

  stopQuizSessionTimer(key);
  session.isPaused = true;
  renderQuizSessionHud(key);
}

function resumeQuizSession(key) {
  const session = quizSessions[key];

  if (!session || session.duration <= 0 || !session.isPaused) {
    return;
  }

  session.isPaused = false;
  startQuizSessionInterval(key);
}

function toggleQuizSessionPause(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  if (session.isPaused) {
    resumeQuizSession(key);
    return;
  }

  pauseQuizSession(key);
}

function renderQuizSessionHud(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  syncQuizSessionInteractionState(key);

  const timer = document.getElementById(session.timerElement);
  const pauseButton = document.getElementById(session.pauseButtonElement);
  const correct = document.getElementById(session.correctElement);
  const wrong = document.getElementById(session.wrongElement);
  const streak = document.getElementById(session.streakElement);

  if (!timer && !pauseButton && !correct && !wrong && !streak) {
    return;
  }

  syncQuizSessionClock(session);

  if (timer) {
    if (typeof sharedTimer.renderTimer === "function") {
      sharedTimer.renderTimer({
        timerId: session.timerElement,
        timerState: session
      });
    } else {
      const remainingMs = getQuizSessionRemainingMs(session);
      const warning =
        session.duration > 0 && remainingMs <= Math.max(5, Math.floor(session.duration / 3)) * 1000;
      const timerItem = timer.closest(".quiz-hud-item");
      const progress =
        session.duration > 0
          ? Math.max(
            0,
            Math.min(
              1,
              remainingMs / (session.duration * 1000)
            )
          )
          : 0;
      const shouldFreezeProgress = !session.timerId || progress <= 0;

      timer.textContent = formatQuizSessionTimerText(session);
      timer.classList.toggle(
        "is-warning",
        warning
      );

      if (timerItem) {
        updateQuizTimerItem(timerItem, progress, warning, session.duration <= 0, shouldFreezeProgress);
      }
    }
  }

  if (correct) {
    correct.textContent = String(session.correct);
  }

  if (wrong) {
    wrong.textContent = String(session.wrong);
  }

  if (pauseButton) {
    const canPause = session.duration > 0 && (Boolean(session.timerId) || session.isPaused);
    const nextLabel = session.isPaused ? "다시 시작" : "일시정지";
    pauseButton.disabled = !canPause;
    pauseButton.classList.toggle("is-paused", session.isPaused);
    pauseButton.setAttribute("aria-label", nextLabel);
    pauseButton.setAttribute("title", nextLabel);
  }

  if (streak) {
    streak.textContent = String(session.streak);
  }
}

function setQuizSessionDuration(key, duration) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const nextDuration = Math.max(0, Number(duration) || 0);
  stopQuizSessionTimer(key);

  if (typeof sharedTimer.setDuration === "function") {
    sharedTimer.setDuration(session, nextDuration);
  } else {
    session.duration = nextDuration;
    session.timeLeft = nextDuration;
    session.timeLeftMs = nextDuration * 1000;
  }

  session.isPaused = false;
  session.deadlineAt = null;
  renderQuizSessionHud(key);
}

function resetQuizSessionTimer(key, onExpire) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const timer = document.getElementById(session.timerElement);

  if (!timer) {
    stopQuizSessionTimer(key);
    return;
  }

  stopQuizSessionTimer(key);
  session.onExpire = typeof onExpire === "function" ? onExpire : null;

  if (typeof sharedTimer.resetTimer === "function") {
    sharedTimer.resetTimer(session, {
      intervalMs: 100,
      onTick: () => {
        renderQuizSessionHud(key);
      },
      onExpire: () => {
        session.isPaused = false;
        renderQuizSessionHud(key);
        consumeQuizSessionExpire(session);
      }
    });
    return;
  }

  session.isPaused = false;
  session.timeLeft = session.duration;
  session.timeLeftMs = session.duration * 1000;
  session.deadlineAt = null;

  if (session.duration <= 0) {
    renderQuizSessionHud(key);
    return;
  }

  startQuizSessionInterval(key);
}

function finalizeQuizSession(key, correct) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  stopQuizSessionTimer(key);
  session.isPaused = false;

  if (correct) {
    session.correct += 1;
    session.streak += 1;
  } else {
    session.wrong += 1;
    session.streak = 0;
  }

  renderQuizSessionHud(key);
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

function resetStateDrivenQuizSessions() {
  stopQuizSessionTimer("vocab");
  stopQuizSessionTimer("grammar");
  stopQuizSessionTimer("reading");
  stopQuizSessionTimer("quiz");
  stopQuizSessionTimer("kanjiPractice");
  resetQuizSessionScore("vocab");
  resetQuizSessionScore("grammar");
  resetQuizSessionScore("reading");
  resetQuizSessionScore("quiz");
  resetQuizSessionScore("kanjiPractice");
  setQuizSessionDuration("vocab", state.vocabQuizDuration);
  setQuizSessionDuration("grammar", state.grammarPracticeDuration);
  setQuizSessionDuration("reading", state.readingDuration);
  setQuizSessionDuration("quiz", state.quizDuration);
  setQuizSessionDuration("kanjiPractice", state.kanjiPracticeQuizDuration);
}

function hasBlockingStudySession() {
  const legacyQuizOpen =
    Boolean(document.getElementById("quiz-question")) &&
    Array.isArray(activeQuizQuestions) &&
    activeQuizQuestions.length > 0 &&
    state?.quizSessionFinished === false;

  return Boolean(
    legacyQuizOpen ||
    state?.vocabQuizStarted ||
    state?.kanjiPracticeQuizStarted ||
    state?.grammarPracticeStarted ||
    state?.readingStarted ||
    kanaQuizSheetState?.open === true
  );
}

function flushPendingExternalStudyStateIfIdle() {
  if (!pendingExternalStudyState || hasBlockingStudySession()) {
    return false;
  }

  const nextState = pendingExternalStudyState;
  pendingExternalStudyState = null;
  applyExternalStudyState(nextState, { force: true });
  return true;
}

function applyExternalStudyState(nextState, options = {}) {
  if (!options.force && hasBlockingStudySession()) {
    pendingExternalStudyState = nextState && typeof nextState === "object"
      ? JSON.parse(JSON.stringify(nextState))
      : nextState;
    return;
  }

  const panelOpenKeys = [
    "quizOptionsOpen",
    "vocabOptionsOpen",
    "readingOptionsOpen",
    "vocabQuizOptionsOpen",
    "kanjiPracticeQuizOptionsOpen",
    "kanjiMatchOptionsOpen",
    "kanjiOptionsOpen",
    "grammarPracticeOptionsOpen",
    "kanaSetupOpen",
    "writingSetupOpen"
  ];
  const runtimeSessionKeys = [
    "quizIndex",
    "quizSessionFinished",
    "vocabQuizStarted",
    "vocabQuizIndex",
    "vocabQuizFinished",
    "kanjiPracticeQuizStarted",
    "kanjiPracticeQuizFinished",
    "grammarPracticeStarted",
    "grammarPracticeSessionQuestionIndex",
    "readingStarted",
    "readingSessionQuestionIndex"
  ];
  const activeSessionStateKeys = new Set();
  const preservedPanels = {};
  const preservedRuntimeSessions = {};
  const preservedFlashcardIds =
    state && typeof state === "object"
      ? {
          vocab: getCurrentStudyFlashcardId({
            getCards: getVisibleFlashcards,
            indexKey: "flashcardIndex"
          }),
          kanji: getCurrentStudyFlashcardId({
            getCards: getVisibleKanjiCards,
            indexKey: "kanjiFlashcardIndex"
          }),
          grammar: getCurrentStudyFlashcardId({
            getCards: getVisibleGrammarCards,
            indexKey: "grammarFlashcardIndex"
          })
        }
      : {};

  if (state && typeof state === "object") {
    for (const key of panelOpenKeys) {
      preservedPanels[key] = state[key];
    }

    for (const key of runtimeSessionKeys) {
      preservedRuntimeSessions[key] = state[key];
    }

    if (!state.quizSessionFinished) {
      [
        "quizLevel",
        "quizMode",
        "quizSessionSize",
        "quizDuration",
        "quizAnsweredCount",
        "quizCorrectCount",
        "quizMistakes",
        "quizSessionMistakeIds"
      ].forEach((key) => activeSessionStateKeys.add(key));
    }

    if (state.vocabQuizStarted && !state.vocabQuizFinished) {
      [
        "vocabLevel",
        "vocabFilter",
        "vocabPartFilter",
        "vocabQuizMode",
        "vocabQuizQuestionField",
        "vocabQuizOptionField",
        "vocabQuizCount",
        "vocabQuizDuration",
        "vocabQuizResultFilter",
        "masteredIds",
        "reviewIds"
      ].forEach((key) => activeSessionStateKeys.add(key));
    }

    if (state.kanjiPracticeQuizStarted && !state.kanjiPracticeQuizFinished) {
      [
        "kanjiPracticeQuestionField",
        "kanjiPracticeOptionField",
        "kanjiPracticeQuizCount",
        "kanjiPracticeQuizDuration",
        "kanjiGrade",
        "kanjiCollectionFilter",
        "kanjiMasteredIds",
        "kanjiReviewIds",
        "basicPracticeIndexes"
      ].forEach((key) => activeSessionStateKeys.add(key));
    }

    if (state.grammarPracticeStarted) {
      [
        "grammarFilter",
        "grammarPracticeLevel",
        "grammarPracticeCount",
        "grammarPracticeDuration",
        "grammarPracticeIndexes",
        "grammarReviewIds",
        "grammarMasteredIds"
      ].forEach((key) => activeSessionStateKeys.add(key));
    }

    if (state.readingStarted) {
      [
        "readingLevel",
        "readingCount",
        "readingDuration",
        "readingIndexes"
      ].forEach((key) => activeSessionStateKeys.add(key));
    }
  }

  const nextMergedState = {
    ...defaultState,
    ...(nextState || {})
  };

  activeSessionStateKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
      nextMergedState[key] = state[key];
    }
  });

  state = normalizeLoadedState(nextMergedState);
  pendingExternalStudyState = null;

  for (const key of panelOpenKeys) {
    if (Object.prototype.hasOwnProperty.call(preservedPanels, key)) {
      state[key] = preservedPanels[key];
    }
  }

  for (const key of runtimeSessionKeys) {
    if (Object.prototype.hasOwnProperty.call(preservedRuntimeSessions, key)) {
      state[key] = preservedRuntimeSessions[key];
    }
  }

  resetStateDrivenQuizSessions();
  // 원격 상태가 바뀌면서 단어 레벨도 함께 달라질 수 있어서, 필요한 단어 데이터가 준비된 뒤 한 번만 다시 그린다.
  preloadRelevantVocabData()
    .catch((error) => {
      console.error("Failed to preload vocab data for external study state.", error);
      return [];
    })
    .finally(() => {
      syncDynamicVocabCollections();
      // 원격 동기화 뒤에도 같은 카드가 아직 보이는 목록 안에 있으면 그 카드를 유지한다.
      syncStudyFlashcardIndexToCardId({
        currentCardId: preservedFlashcardIds.vocab,
        getCards: getVisibleFlashcards,
        indexKey: "flashcardIndex"
      });
      syncStudyFlashcardIndexToCardId({
        currentCardId: preservedFlashcardIds.kanji,
        getCards: getVisibleKanjiCards,
        indexKey: "kanjiFlashcardIndex"
      });
      syncStudyFlashcardIndexToCardId({
        currentCardId: preservedFlashcardIds.grammar,
        getCards: getVisibleGrammarCards,
        indexKey: "grammarFlashcardIndex"
      });
      renderAll();
    });
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateStudyStreak() {
  const today = getLocalDateKey();

  if (state.lastStudyDate === today) {
    return;
  }

  if (!state.lastStudyDate) {
    state.streak = 1;
  } else {
    const last = new Date(state.lastStudyDate);
    const current = new Date(today);
    const diffDays = Math.round((current - last) / 86400000);
    state.streak = diffDays === 1 ? state.streak + 1 : 1;
  }

  state.lastStudyDate = today;
  saveState();
}

function getCurrentBasicPracticeSet() {
  const trackKey = basicPracticeSets[state.basicPracticeTrack] ? state.basicPracticeTrack : "hiragana";
  const track = basicPracticeSets[trackKey];
  const currentIndex = state.basicPracticeIndexes[trackKey] % track.items.length;
  return track.items[currentIndex];
}

function renderBasicPractice() {
  const switcher = document.getElementById("basic-practice-switcher");
  const card = document.querySelector("#basic-drill .basic-practice-card");
  const optionsContainer = document.getElementById("basic-practice-options");
  const trackLabel = document.getElementById("basic-practice-track");
  const source = document.getElementById("basic-practice-source");
  const progress = document.getElementById("basic-practice-progress");
  const title = document.getElementById("basic-practice-title");
  const note = document.getElementById("basic-practice-note");
  const prompt = document.getElementById("basic-practice-prompt");
  const display = document.getElementById("basic-practice-display");
  const displaySub = document.getElementById("basic-practice-display-sub");
  const feedback = document.getElementById("basic-practice-feedback");
  const explanation = document.getElementById("basic-practice-explanation");
  const availableTracks = getAvailableBasicPracticeTracks();
  const fallbackTrack = availableTracks[0] || "hiragana";
  const trackKey =
    basicPracticeSets[state.basicPracticeTrack] && availableTracks.includes(state.basicPracticeTrack)
      ? state.basicPracticeTrack
      : fallbackTrack;
  if (state.basicPracticeTrack !== trackKey) {
    state.basicPracticeTrack = trackKey;
  }
  const track = basicPracticeSets[trackKey];
  const current = getCurrentBasicPracticeSet();

  if (
    !switcher ||
    !card ||
    !optionsContainer ||
    !trackLabel ||
    !source ||
    !progress ||
    !title ||
    !note ||
    !prompt ||
    !display ||
    !displaySub ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  switcher.innerHTML = "";

  availableTracks.forEach((key) => {
    const value = basicPracticeSets[key];
    if (!value) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${state.basicPracticeTrack === key ? " is-active" : ""}`;
    button.textContent = basicPracticeTrackLabels[key] || value.label;
    button.addEventListener("click", () => {
      state.basicPracticeTrack = key;
      saveState();
      renderBasicPractice();
    });
    switcher.appendChild(button);
  });

  trackLabel.textContent = basicPracticeTrackLabels[trackKey] || track.label;
  source.textContent = formatQuizLineBreaks(current.source);
  progress.textContent =
    `${(state.basicPracticeIndexes[trackKey] % track.items.length) + 1} / ${track.items.length}`;
  title.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.title));
  note.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.note));
  prompt.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.prompt));
  display.textContent = formatQuizLineBreaks(current.display);
  displaySub.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.displaySub || ""));
  feedback.textContent = "";
  explanation.textContent = formatQuizLineBreaks(softenExplanationCopy(current.explanation || ""));

  card.className = `basic-practice-card ${current.tone || "tone-coral"}`;

  optionsContainer.innerHTML = "";
  current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "basic-practice-option";
    button.textContent = formatQuizLineBreaks(option);
    button.addEventListener("click", () => handleBasicPracticeAnswer(index));
    optionsContainer.appendChild(button);
  });

  resetQuizSessionTimer("basic", handleBasicPracticeTimeout);
}

function handleBasicPracticeAnswer(index) {
  const current = getCurrentBasicPracticeSet();
  const options = document.querySelectorAll("#basic-practice-options .basic-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered || quizSessions.basic.isPaused) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("basic", correct);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === index) {
      item.classList.add("is-selected");
    }
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  document.getElementById("basic-practice-feedback").textContent = correct
    ? ""
    : "";
  document.getElementById("basic-practice-explanation").textContent = softenExplanationCopy(current.explanation);

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleBasicPracticeTimeout() {
  const current = getCurrentBasicPracticeSet();
  const options = document.querySelectorAll("#basic-practice-options .basic-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("basic", false);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
  });

  document.getElementById("basic-practice-feedback").textContent = "";
  document.getElementById("basic-practice-explanation").textContent = softenExplanationCopy(current.explanation);

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextBasicPracticeSet() {
  const trackKey = basicPracticeSets[state.basicPracticeTrack] ? state.basicPracticeTrack : "hiragana";
  const track = basicPracticeSets[trackKey];
  state.basicPracticeIndexes[trackKey] =
    (state.basicPracticeIndexes[trackKey] + 1) % track.items.length;
  saveState();
  renderBasicPractice();
}

const studyListConfig = {
  vocab: { reviewIdsKey: "reviewIds", masteredIdsKey: "masteredIds" },
  kanji: { reviewIdsKey: "kanjiReviewIds", masteredIdsKey: "kanjiMasteredIds" },
  grammar: { reviewIdsKey: "grammarReviewIds", masteredIdsKey: "grammarMasteredIds" }
};

function getStudyListConfig(kind) {
  return studyListConfig[kind] || studyListConfig.vocab;
}

function getStudyListIds(kind, idType) {
  const config = getStudyListConfig(kind);
  const ids = state?.[config[`${idType}IdsKey`]];
  return Array.isArray(ids) ? ids : [];
}

function ensureReviewList(kind, id) {
  const config = getStudyListConfig(kind);
  const reviewIds = getStudyListIds(kind, "review");
  if (!reviewIds.includes(id)) {
    state[config.reviewIdsKey].push(id);
  }
}

function ensureMasteredList(kind, id) {
  const config = getStudyListConfig(kind);
  const masteredIds = getStudyListIds(kind, "mastered");
  if (!masteredIds.includes(id)) {
    state[config.masteredIdsKey].push(id);
  }
}

function removeFromStudyReviewList(kind, id) {
  const config = getStudyListConfig(kind);
  state[config.reviewIdsKey] = getStudyListIds(kind, "review").filter((itemId) => itemId !== id);
}

function removeFromStudyMasteredList(kind, id) {
  const config = getStudyListConfig(kind);
  state[config.masteredIdsKey] = getStudyListIds(kind, "mastered").filter((itemId) => itemId !== id);
}

function isSavedToReviewList(kind, id) {
  return Boolean(id) && getStudyListIds(kind, "review").includes(id);
}

function isSavedToMasteredList(kind, id) {
  return Boolean(id) && getStudyListIds(kind, "mastered").includes(id);
}

function getStudyListStatus(kind, id) {
  if (isSavedToMasteredList(kind, id)) {
    return "mastered";
  }

  if (isSavedToReviewList(kind, id)) {
    return "review";
  }

  return "unmarked";
}

function setStudyListStatus(kind, id, status) {
  if (!id || !status) {
    return;
  }

  if (status === "unmarked") {
    removeFromStudyReviewList(kind, id);
    removeFromStudyMasteredList(kind, id);
    return;
  }

  if (status === "review") {
    ensureReviewList(kind, id);
    removeFromStudyMasteredList(kind, id);
    return;
  }

  if (status === "mastered") {
    ensureMasteredList(kind, id);
    removeFromStudyReviewList(kind, id);
  }
}

function getNextStudyListStatus(current) {
  if (current === "unmarked") {
    return "review";
  }

  if (current === "review") {
    return "mastered";
  }

  return "unmarked";
}

function getStudyListStatusCycleMessage(status) {
  switch (status) {
    case "unmarked":
      return "아직 안 봤어요로 바꿨어요";
    case "review":
      return "다시 볼래요로 바꿨어요";
    case "mastered":
      return "익혔어요로 바꿨어요";
    default:
      return "";
  }
}

function getStudyListStatusIconName(status) {
  switch (status) {
    case "unmarked":
      return "radio_button_unchecked";
    case "review":
      return "replay";
    case "mastered":
      return "check_circle";
    default:
      return "radio_button_unchecked";
  }
}

function getStudyListStatusShortLabel(status) {
  switch (status) {
    case "unmarked":
      return "아직 안 봤어요";
    case "review":
      return "다시 볼래요";
    case "mastered":
      return "익혔어요";
    default:
      return "상태 없음";
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

function getStudyResultCounts(results) {
  const safeResults = Array.isArray(results) ? results : [];

  return {
    all: safeResults.length,
    correct: safeResults.filter((item) => item.status === "correct").length,
    wrong: safeResults.filter((item) => item.status === "wrong").length
  };
}

function getFilteredStudyResults(results, filter = "all") {
  const safeResults = Array.isArray(results) ? results : [];

  if (filter === "all") {
    return [...safeResults];
  }

  return safeResults.filter((item) => item.status === filter);
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
    saveLabel: "모두 다시 보기",
    removeLabel: "다시 보기 해제",
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
    saveLabel: "모두 익히기",
    removeLabel: "익힘 해제",
    emptyTitle: "지금 표시 중인 한자가 없어요.",
    saveTitle: "지금 보이는 한자를 모두 익힘으로 표시해요.",
    removeTitle: "지금 보이는 한자의 익힘 표시를 모두 해제해요.",
    saveIcon: "check_circle",
    removeIcon: "remove_done"
  });
}

function renderKanjiPracticeBulkActionButton(results) {
  return renderKanjiPracticeBulkActionButtons(results);
  const reviewActionButton = document.getElementById("kanji-practice-result-bulk-action");
  const masteredActionButton = document.getElementById("kanji-practice-result-mastered-action");
  const bulkActionLabel = document.getElementById("kanji-practice-result-bulk-label");
  const bulkActionIcon = bulkActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: bulkActionButton,
    label: bulkActionLabel,
    icon: bulkActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isKanjiSavedToReviewList,
    datasetKey: "kanjiPracticeBulkAction",
    saveActionValue: "save-review",
    removeActionValue: "remove-review",
    saveLabel: "전체 다시 볼래요",
    removeLabel: "전체 빼기",
    emptyTitle: "지금은 담을 한자가 없어요.",
    saveTitle: "지금 보이는 한자를 다시 볼래요에 모두 담을게요.",
    removeTitle: "지금 보이는 한자를 다시 볼래요에서 모두 뺄게요."
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

function createStudyStatusBadgesMarkup(review, mastered) {
  return [
    review ? '<span class="vocab-review-badge">다시 볼래요</span>' : "",
    mastered ? '<span class="vocab-mastered-badge">익혔어요!</span>' : ""
  ]
    .filter(Boolean)
    .join("");
}

function createStudyStatusButtonsMarkup({
  id,
  groupClassName,
  buttonClassName,
  reviewAttribute,
  masteredAttribute,
  reviewSelected,
  masteredSelected
}) {
  return `
    <div class="${groupClassName}">
      <button class="secondary-btn ${buttonClassName}${reviewSelected ? " is-selected-review" : ""}" type="button" ${reviewAttribute}="${id}" aria-pressed="${reviewSelected ? "true" : "false"}">다시 볼래요</button>
      <button class="secondary-btn ${buttonClassName}${masteredSelected ? " is-selected-mastered" : ""}" type="button" ${masteredAttribute}="${id}" aria-pressed="${masteredSelected ? "true" : "false"}">익혔어요!</button>
    </div>
  `;
}

function renderStudyFlashcardComponent({
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
  revealWhenEmpty = false,
  levelText,
  wordText,
  readingText = "",
  meaningText = "",
  hintText = "",
  hideReading = false,
  hideMeaning = false,
  toggleLabel = "",
  toggleOpenLabel,
  toggleClosedLabel,
  toggleEmptyLabel,
  prevDisabled = false,
  nextDisabled = false,
  actionButtons = []
}) {
  if (!flashcard || !toggle || !level || !word || !reading || !meaning || !hint) {
    return;
  }

  level.textContent = formatQuizLineBreaks(levelText || "");
  word.textContent = formatQuizLineBreaks(wordText || "");
  reading.textContent = formatQuizLineBreaks(readingText || "");
  reading.hidden = hideReading || !normalizeQuizText(readingText || "");
  meaning.textContent = formatQuizLineBreaks(meaningText || "");
  meaning.hidden = hideMeaning || !normalizeQuizText(meaningText || "");
  hint.textContent = hintText;

  flashcard.classList.toggle("is-revealed", isRevealed || (revealWhenEmpty && !hasCards));
  flashcard.classList.toggle("is-empty", !hasCards);
  toggle.disabled = !hasCards;
  toggle.setAttribute("aria-expanded", String(isRevealed));
  toggle.setAttribute(
    "aria-label",
    hasCards ? (toggleLabel || (isRevealed ? toggleOpenLabel : toggleClosedLabel)) : toggleEmptyLabel
  );

  if (prev) {
    prev.disabled = !hasCards || prevDisabled;
  }

  if (next) {
    next.disabled = !hasCards || nextDisabled;
  }

  actionButtons.forEach((action) => {
    applyStudyActionButtonState(
      action.button,
      action.selected,
      action.selectedClass,
      action.idleClass,
      !hasCards || action.disabled === true
    );
  });
}

function renderStatefulStudyList({
  list,
  pageInfo,
  prev,
  next,
  items,
  pageKey,
  pageSize,
  emptyMessage,
  renderItem
}) {
  renderPagedStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    page: state[pageKey],
    pageSize,
    emptyMessage,
    onPageChange: (page) => {
      state[pageKey] = page;
      saveState();
    },
    renderItem
  });
}

function renderStudyViewWithStats(render) {
  render();
  renderStats();
}

function toggleStudyFlashcardReveal(revealedKey, render) {
  state[revealedKey] = !state[revealedKey];
  updateStudyStreak();
  saveState();
  render();
}

function moveStudyFlashcard(step, { getCards, indexKey, revealedKey, render }) {
  const cards = getCards();

  if (!cards.length) {
    return;
  }

  state[indexKey] = (state[indexKey] + step + cards.length) % cards.length;
  state[revealedKey] = false;
  saveState();
  render();
}

function clampStudyPage(pageKey, items, pageSize) {
  state[pageKey] = Math.min(Math.max(state[pageKey], 1), getStudyPageCount(items, pageSize));
}

function resetStudyCatalogPointers({ pageKey, indexKey, revealedKey }) {
  state[pageKey] = 1;
  state[indexKey] = 0;
  state[revealedKey] = false;
}

function getCurrentStudyFlashcardId({ getCards, indexKey }) {
  const cards = typeof getCards === "function" ? getCards() : [];

  if (!cards.length) {
    return "";
  }

  const currentIndex = Math.max(0, Number(state?.[indexKey]) || 0) % cards.length;
  return cards[currentIndex]?.id || "";
}

function syncStudyFlashcardIndexToCardId({ currentCardId, getCards, indexKey }) {
  const nextCards = typeof getCards === "function" ? getCards() : [];

  if (!nextCards.length) {
    state[indexKey] = 0;
    return;
  }

  const nextVisibleIndex = nextCards.findIndex((item) => item.id === currentCardId);

  if (nextVisibleIndex !== -1) {
    state[indexKey] = nextVisibleIndex;
    return;
  }

  state[indexKey] = Math.min(Math.max(Number(state[indexKey]) || 0, 0), nextCards.length - 1);
}

function syncStudyFlashcardIndexAfterUpdate({ currentCardId, previousIndex, getCards, indexKey }) {
  const nextCards = getCards();
  const currentVisibleIndex = nextCards.findIndex((item) => item.id === currentCardId);

  if (!nextCards.length) {
    state[indexKey] = 0;
    return;
  }

  if (currentVisibleIndex !== -1) {
    state[indexKey] = nextCards.length > 1 ? (currentVisibleIndex + 1) % nextCards.length : currentVisibleIndex;
    return;
  }

  state[indexKey] = Math.min(previousIndex, nextCards.length - 1);
}

function updateStudyCatalogState({
  stateKey,
  nextValue,
  resetPointers,
  invalidate,
  afterChange,
  render
}) {
  if (state[stateKey] === nextValue) {
    return;
  }

  state[stateKey] = nextValue;

  if (typeof resetPointers === "function") {
    resetPointers();
  }

  if (typeof invalidate === "function") {
    invalidate();
  }

  if (typeof afterChange === "function") {
    afterChange(nextValue);
  }

  saveState();
  render();
}

function updateSimpleStateAndRender(stateKey, nextValue, render) {
  if (state[stateKey] === nextValue) {
    return;
  }

  state[stateKey] = nextValue;
  saveState();
  render();
}

function markStudyFlashcardStatus({
  getCards,
  indexKey,
  revealedKey,
  saveItem,
  syncIndexAfterUpdate,
  render
}) {
  const cards = getCards();

  if (!cards.length) {
    return;
  }

  const currentIndex = state[indexKey] % cards.length;
  const currentCard = cards[currentIndex];

  saveItem(currentCard.id);
  updateStudyStreak();
  state[revealedKey] = false;
  syncIndexAfterUpdate(currentCard.id, currentIndex);
  saveState();
  render();
}

function renderCollapsibleSettingsSection({
  shell,
  toggle,
  panel,
  summary,
  summaryText,
  isLocked,
  shouldShowPanel
}) {
  if (summary) {
    summary.textContent = summaryText;
  }

  if (shell) {
    shell.classList.toggle("is-open", shouldShowPanel);
  }

  if (toggle) {
    toggle.disabled = isLocked;
    toggle.setAttribute("aria-expanded", String(shouldShowPanel));
  }

  if (panel) {
    panel.hidden = !shouldShowPanel;
    panel.setAttribute("aria-hidden", String(!shouldShowPanel));
  }
}

function renderOpenableSettingsSection({ shell, toggle, panel, summary, summaryText, isOpen }) {
  renderCollapsibleSettingsSection({
    shell,
    toggle,
    panel,
    summary,
    summaryText,
    isLocked: false,
    shouldShowPanel: isOpen
  });
}

function syncSelectionButtonState(buttons, getValue, activeValue) {
  buttons.forEach((button) => {
    const active = getValue(button) === activeValue;

    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderRestartableActionButton(button, label, isStarted, canStart) {
  if (button) {
    button.classList.toggle("primary-btn", !isStarted);
    button.classList.toggle("secondary-btn", isStarted);
    button.disabled = !canStart;
  }

  if (label) {
    label.textContent = isStarted ? "다시 해볼까요?" : "시작해볼까요?";
  }

  setActionButtonIcon(button, isStarted ? "autorenew" : "play_arrow");
}

function formatQuestionCountLabel(count) {
  return `${Number(count)}문제`;
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

function renderSpinnerControls(configs = []) {
  configs.forEach((config) => {
    renderSpinnerControl(config);
  });
}

function applySelectFieldState({ element, value, populate, disabled }) {
  if (!element) {
    return;
  }

  if (typeof populate === "function") {
    populate(element, value);
  } else if (value !== undefined) {
    element.value = value;
  }

  element.disabled = Boolean(disabled);
}

function renderStudyOptionsControls({
  shell,
  toggle,
  panel,
  summary,
  summaryText,
  isLocked,
  isOpen,
  spinnerConfigs = [],
  selectConfigs = [],
  actionButton
}) {
  renderCollapsibleSettingsSection({
    shell,
    toggle,
    panel,
    summary,
    summaryText,
    isLocked,
    shouldShowPanel: !isLocked && isOpen
  });

  if (actionButton) {
    renderRestartableActionButton(actionButton.button, actionButton.label, actionButton.isStarted, actionButton.canStart);
  }

  renderSpinnerControls(spinnerConfigs);

  selectConfigs.forEach(({ element, value, populate, disabled = isLocked }) => {
    applySelectFieldState({
      element,
      value,
      populate,
      disabled
    });
  });
}

function renderStudyCatalogControls({
  summary,
  summaryText,
  viewSelector,
  viewAttribute,
  activeView,
  selectConfigs = []
}) {
  if (summary) {
    summary.textContent = summaryText;
  }

  if (viewSelector && viewAttribute) {
    syncStudyViewButtons(viewSelector, viewAttribute, activeView);
  }

  selectConfigs.forEach(({ element, populate }) => {
    if (typeof populate === "function") {
      populate(element);
    }
  });
}

function renderChoiceOptionButtons({
  container,
  options = [],
  buttonClassName,
  getButtonText = (option) => option,
  getOptionValue = (_, index) => index,
  formatText = (text) => String(text ?? ""),
  onSelect,
  datasetKey,
  setPressedState = false
}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  options.forEach((option, index) => {
    const value = getOptionValue(option, index);
    const button = document.createElement("button");
    const label = document.createElement("span");

    button.type = "button";
    button.className = buttonClassName;
    label.className = "button-text-clamp";
    label.textContent = formatText(getButtonText(option, index, value));
    button.appendChild(label);

    if (datasetKey) {
      button.dataset[datasetKey] = String(value);
    }

    if (setPressedState) {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(value, option, index);
      }
    });
    container.appendChild(button);
  });
}

function applyChoiceOptionFeedback({
  options,
  isCorrectOption,
  isSelectedOption = () => false,
  markSelected = true,
  setPressedState = false
}) {
  options.forEach((item, optionIndex) => {
    const isSelected = isSelectedOption(item, optionIndex);
    const isCorrect = isCorrectOption(item, optionIndex);

    item.disabled = true;

    if (setPressedState) {
      item.setAttribute("aria-pressed", String(isSelected));
    }

    if (markSelected && isSelected) {
      item.classList.add("is-selected");
    }

    if (isCorrect) {
      item.classList.add("is-correct");
    }

    if (isSelected && !isCorrect) {
      item.classList.add("is-wrong");
    }
  });
}

function hasAnsweredChoiceOptions(options) {
  return Array.from(options).some((item) => item.disabled);
}

function hasAnsweredAllChoiceOptions(options) {
  const list = Array.from(options);
  return list.length > 0 && list.every((item) => item.disabled);
}

function createBoundListenerAttributeName(bindingKind) {
  const safeKind = String(bindingKind || "listener")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");

  return `data-japanote-bound-${safeKind}`;
}

function hasBoundListener(element, bindingKind) {
  if (!element) {
    return false;
  }

  const attributeName = createBoundListenerAttributeName(bindingKind);
  return element.hasAttribute(attributeName);
}

function markBoundListener(element, bindingKind) {
  if (!element) {
    return;
  }

  element.setAttribute(createBoundListenerAttributeName(bindingKind), "true");
}

function attachStateSpinner({
  spinner,
  options = [],
  getCurrentValue,
  setValue,
  invalidate,
  render
}) {
  if (!spinner) {
    return;
  }

  spinner.querySelectorAll("[data-spinner-direction]").forEach((button) => {
    if (hasBoundListener(button, "spinner-click")) {
      return;
    }

    markBoundListener(button, "spinner-click");
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

      const nextValue = options[nextIndex];

      if (currentValue === nextValue) {
        return;
      }

      setValue(nextValue);
      invalidate();
      saveState();
      render();
    });
  });
}

function attachStateOptionsToggle(button, stateKey, render) {
  if (!button) {
    return;
  }

  if (hasBoundListener(button, "options-toggle-click")) {
    return;
  }

  markBoundListener(button, "options-toggle-click");
  button.addEventListener("click", () => {
    state[stateKey] = !state[stateKey];
    saveState();
    render();
  });
}

function attachValueButtonListeners(buttons, getValue, onChange) {
  buttons.forEach((button) => {
    if (hasBoundListener(button, "value-button-click")) {
      return;
    }

    markBoundListener(button, "value-button-click");
    button.addEventListener("click", () => {
      onChange(getValue(button), button);
    });
  });
}

function attachSelectValueListener(element, handler) {
  if (!element) {
    return;
  }

  if (hasBoundListener(element, "select-change")) {
    return;
  }

  markBoundListener(element, "select-change");
  element.addEventListener("change", () => {
    handler(element.value);
  });
}

function attachClickListener(element, handler) {
  if (!element) {
    return;
  }

  if (hasBoundListener(element, "click")) {
    return;
  }

  markBoundListener(element, "click");
  element.addEventListener("click", handler);
}

function attachLinkedFieldSelectors({
  questionSelect,
  optionSelect,
  getQuestionField,
  getOptionField,
  normalizeQuestionField,
  normalizeOptionField,
  normalizeStoredQuestionField,
  normalizeStoredOptionField,
  getDefaultOptionField,
  getDefaultQuestionField,
  questionStateKey,
  optionStateKey,
  invalidate,
  render
}) {
  if (questionSelect) {
    if (!hasBoundListener(questionSelect, "linked-question-change")) {
      markBoundListener(questionSelect, "linked-question-change");
      questionSelect.addEventListener("change", () => {
        const previousQuestionField = getQuestionField();
        const previousOptionField = getOptionField();
        const nextQuestionField = normalizeQuestionField(questionSelect.value);

        if (previousQuestionField === nextQuestionField) {
          return;
        }

        state[questionStateKey] = nextQuestionField;

        if (previousOptionField === nextQuestionField) {
          state[optionStateKey] =
            previousQuestionField !== nextQuestionField
              ? previousQuestionField
              : getDefaultOptionField(nextQuestionField);
        }

        state[optionStateKey] = normalizeStoredOptionField(state[optionStateKey], state[questionStateKey]);
        invalidate();
        saveState();
        render();
      });
    }
  }

  if (optionSelect) {
    if (!hasBoundListener(optionSelect, "linked-option-change")) {
      markBoundListener(optionSelect, "linked-option-change");
      optionSelect.addEventListener("change", () => {
        const previousQuestionField = getQuestionField();
        const previousOptionField = getOptionField();
        const nextOptionField = normalizeOptionField(optionSelect.value, previousOptionField);

        if (previousOptionField === nextOptionField) {
          return;
        }

        state[optionStateKey] = nextOptionField;

        if (previousQuestionField === nextOptionField) {
          state[questionStateKey] =
            previousOptionField !== nextOptionField
              ? previousOptionField
              : getDefaultQuestionField(nextOptionField);
        }

        state[questionStateKey] = normalizeStoredQuestionField(state[questionStateKey]);
        state[optionStateKey] = normalizeStoredOptionField(state[optionStateKey], state[questionStateKey]);
        invalidate();
        saveState();
        render();
      });
    }
  }
}

function syncResultFilterButtons({ resultViewId, activeValue }) {
  const resultView = document.getElementById(resultViewId);

  if (!resultView) {
    return;
  }

  resultView.querySelectorAll("[data-result-filter]").forEach((button) => {
    const isActive = button.dataset.resultFilter === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getUniqueStudyResultIds(results, getId = (item) => item?.id) {
  return Array.from(
    new Set((Array.isArray(results) ? results : []).map((item) => getId(item)).filter(Boolean))
  );
}

function renderResultBulkActionButton({
  button,
  label,
  icon,
  results,
  getId,
  isSaved,
  datasetKey,
  saveActionValue = "save",
  removeActionValue = "remove",
  saveLabel,
  removeLabel,
  emptyTitle,
  saveTitle,
  removeTitle,
  saveIcon = "bookmark_add",
  removeIcon = "delete_sweep"
}) {
  if (!button || !label || !icon) {
    return;
  }

  const uniqueIds = getUniqueStudyResultIds(results, getId);
  const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isSaved(id));
  const actionTitle =
    uniqueIds.length === 0
      ? emptyTitle
      : allSaved
        ? removeTitle
        : saveTitle;

  button.disabled = uniqueIds.length === 0;
  button.dataset[datasetKey] = allSaved ? removeActionValue : saveActionValue;
  button.setAttribute("aria-label", actionTitle);
  button.title = actionTitle;
  label.textContent = allSaved ? removeLabel : saveLabel;
  icon.textContent = allSaved ? removeIcon : saveIcon;
}

function renderSharedStudyResults({
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
  getEmptyText,
  renderItems
}) {
  if (typeof sharedResultUi.renderResultsView !== "function") {
    return;
  }

  sharedResultUi.renderResultsView({
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
    getEmptyText,
    renderItems
  });
}

function attachResultFilterButtonListeners({
  buttons,
  getNextValue,
  getCurrentValue,
  setValue,
  shouldSaveState = false,
  render
}) {
  Array.from(buttons || []).forEach((button) => {
    if (!button) {
      return;
    }

    if (hasBoundListener(button, "result-filter-click")) {
      return;
    }

    markBoundListener(button, "result-filter-click");
    button.addEventListener("click", () => {
      const nextValue = getNextValue(button.dataset.resultFilter);

      if (getCurrentValue() === nextValue) {
        return;
      }

      setValue(nextValue);

      if (shouldSaveState) {
        saveState();
      }

      render();
    });
  });
}

function attachBulkResultActionListener({
  button,
  getResults,
  getId = (item) => item?.id,
  datasetKey,
  removeActionValue = "remove",
  removeItem,
  saveItem,
  shouldSaveState = true,
  render
}) {
  if (!button) {
    return;
  }

  if (hasBoundListener(button, "bulk-action-click")) {
    return;
  }

  markBoundListener(button, "bulk-action-click");
  button.addEventListener("click", () => {
    const uniqueIds = getUniqueStudyResultIds(getResults(), getId);

    if (!uniqueIds.length) {
      return;
    }

    const shouldRemove = button.dataset[datasetKey] === removeActionValue;

    uniqueIds.forEach((id) => {
      if (shouldRemove) {
        removeItem(id);
      } else {
        saveItem(id);
      }
    });

    if (shouldSaveState) {
      saveState();
    }

    render();
  });
}

function attachToggleResultActionListener({
  list,
  actions = [],
  selector,
  getId,
  isSelected,
  selectItem,
  unselectItem,
  shouldSaveState = true,
  shouldUpdateStudyStreak = false,
  render
}) {
  if (!list) {
    return;
  }

  if (hasBoundListener(list, "toggle-result-click")) {
    return;
  }

  markBoundListener(list, "toggle-result-click");
  list.addEventListener("click", (event) => {
    const actionConfigs = Array.isArray(actions) && actions.length
      ? actions
      : [
        {
          selector,
          getId,
          isSelected,
          selectItem,
          unselectItem
        }
      ];
    const matchedAction = actionConfigs.find((config) => {
      const candidate = event.target.closest(config.selector);
      return candidate && list.contains(candidate);
    });

    if (!matchedAction) {
      return;
    }

    const button = event.target.closest(matchedAction.selector);
    const id = matchedAction.getId(button);

    if (!id) {
      return;
    }

    // 결과 화면 상태 버튼은 같은 항목의 학습 상태를 교체할 수 있어서
    // 각 버튼이 자신이 담당하는 상태만 토글해도 최종 상태는 하나만 남도록 처리한다.
    if (matchedAction.isSelected(id)) {
      matchedAction.unselectItem(id);
    } else {
      matchedAction.selectItem(id);
    }

    if (shouldUpdateStudyStreak) {
      updateStudyStreak();
    }

    if (shouldSaveState) {
      saveState();
    }

    render();
  });
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
              actionLabel: reviewSelected ? "다시 보기 해제" : "다시 보기로 표시",
              datasetName: "kanjiResultReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? "익힘 해제" : "익힘으로 표시",
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

function setActionButtonIcon(button, iconName) {
  const icon = button?.querySelector(".material-symbols-rounded");

  if (icon) {
    icon.textContent = iconName;
  }
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
    state.basicPracticeIndexes.kanji >= questionCount - 1 ? "결과 볼까요?" : "다음 한자 볼까요?";
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
        ? "준비됐다면 시작해볼까요?"
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
    kanjiPracticeState.results.length >= totalQuestions ? "결과 볼까요?" : "다음 한자 볼까요?";
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
    kanjiPracticeState.results.length >= totalQuestions ? "결과 볼까요?" : "다음 한자 볼까요?";
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

function getVocabFilter(filter = state.vocabFilter) {
  return Object.prototype.hasOwnProperty.call(vocabFilterLabels, filter) ? filter : "all";
}

function getAvailableVocabParts(items = vocabListItems) {
  if (!Array.isArray(items)) {
    return [];
  }

  const counts = items.reduce((map, item) => {
    const part = getVocabItemPart(item);
    map.set(part, (map.get(part) || 0) + 1);
    return map;
  }, new Map());

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "ko");
    })
    .map(([value, count]) => ({ value, count }));
}

function getVocabPartFilter(part = state.vocabPartFilter, items = vocabListItems) {
  const normalizedPart = normalizeQuizText(part);

  if (!normalizedPart || normalizedPart === vocabPartAllValue) {
    return vocabPartAllValue;
  }

  const exists = getAvailableVocabParts(items).some((item) => item.value === normalizedPart);
  return exists ? normalizedPart : vocabPartAllValue;
}

function getVocabPartSummaryLabel(part = state.vocabPartFilter) {
  const activePart = getVocabPartFilter(part);
  return activePart === vocabPartAllValue ? "전체 품사" : activePart;
}

function getVocabView(view = state.vocabView) {
  return view === "list" ? "list" : "card";
}

function getVocabViewLabel(view = state.vocabView) {
  const labels = {
    card: "카드",
    list: "목록"
  };

  return labels[getVocabView(view)];
}

function invalidateVocabQuizSession() {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("vocab-quiz-result-view");
  activeVocabQuizQuestions = [];
  activeVocabQuizSignature = "";
  activeVocabQuizResults = [];
  activeVocabQuizChallengePayload = null;
  state.vocabQuizStarted = false;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  resetQuizSessionScore("vocab");
  setQuizSessionDuration("vocab", getVocabQuizDuration());
  stopQuizSessionTimer("vocab");
}

function isVocabPagePath() {
  return window.location.pathname.endsWith("vocab.html") || window.location.pathname.endsWith("/vocab.html");
}

function getVocabQuizConfigLabel(
  questionField = state?.vocabQuizQuestionField,
  optionField = state?.vocabQuizOptionField
) {
  return `${getVocabQuizFieldLabel(questionField)} → ${getVocabQuizFieldLabel(optionField)}`;
}

function getVocabQuizResultFilter(value = state.vocabQuizResultFilter) {
  return ["all", "correct", "wrong"].includes(value) ? value : "all";
}

function getVocabQuizOptionsSummaryText() {
  return [
    getVocabQuizConfigLabel(),
    `${getVocabQuizCount()}문제`,
    getDurationLabel(getVocabQuizDuration())
  ].join(" · ");
}

function syncVocabLocationHash(tab = state.vocabTab) {
  if (!isVocabPagePath()) {
    return;
  }

  const activeTab = getVocabTab(tab);
  const nextHash = activeTab === "quiz" ? "#quiz" : activeTab === "match" ? "#match" : "";
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) {
    return;
  }

  try {
    window.history.replaceState(null, "", nextUrl);
  } catch (error) {
    if (nextHash) {
      window.location.hash = nextHash;
      return;
    }

    if (window.location.hash) {
      try {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch (innerError) {
        window.location.hash = "";
      }
    }
  }
}

function setVocabTab(tab) {
  const nextTab = getVocabTab(tab);

  if (state.vocabTab === nextTab) {
    return;
  }

  state.vocabTab = nextTab;

  if (nextTab !== "quiz") {
    stopQuizSessionTimer("vocab");
  }

  renderVocabTabLayout();

  saveState();

  try {
    renderVocabPage();
  } catch (error) {
    console.error("Failed to render vocab tab.", error);
    renderVocabTabLayout();
  }

  const activePanel = document.querySelector(`[data-vocab-tab-panel="${nextTab}"]`);
  if (activePanel?.scrollIntoView) {
    activePanel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function setVocabView(view) {
  const nextView = getVocabView(view);
  updateStudyCatalogState({
    stateKey: "vocabView",
    nextValue: nextView,
    render: renderVocabPage
  });
}

function getVocabEmptyMessage(filter = state.vocabFilter, part = state.vocabPartFilter) {
  const activeFilter = getVocabFilter(filter);

  if (activeFilter === "review") {
    return "다시 볼 단어가 아직 없어요. 카드에서 담아두면 여기서 다시 볼 수 있어요.";
  }

  if (activeFilter === "mastered") {
    return "익힌 단어가 아직 없어요. 익혔어요를 눌러두면 여기 모여요.";
  }

  if (activeFilter === "unmarked") {
    return "이 상태의 단어는 지금 없어요. 다른 모아보기로 바꿔보세요.";
  }

  return "아직 보여줄 단어가 없어요. 다른 레벨이나 품사로 바꿔볼까요?";
}

function filterVocabItems(items, filter = state.vocabFilter, partFilter = state.vocabPartFilter) {
  const activeFilter = getVocabFilter(filter);
  const activePartFilter = getVocabPartFilter(partFilter, items);

  if (!Array.isArray(items)) {
    return [];
  }

  const filteredByPart =
    activePartFilter === vocabPartAllValue
      ? items
      : items.filter((item) => getVocabItemPart(item) === activePartFilter);

  if (activeFilter === "review") {
    return filteredByPart.filter((item) => state.reviewIds.includes(item.id));
  }

  if (activeFilter === "mastered") {
    return filteredByPart.filter((item) => state.masteredIds.includes(item.id));
  }

  if (activeFilter === "unmarked") {
    return filteredByPart.filter((item) => !state.reviewIds.includes(item.id) && !state.masteredIds.includes(item.id));
  }

  return filteredByPart;
}

function getVocabFilterCounts() {
  return {
    all: filterVocabItems(vocabListItems, "all", state.vocabPartFilter).length,
    review: filterVocabItems(vocabListItems, "review", state.vocabPartFilter).length,
    mastered: filterVocabItems(vocabListItems, "mastered", state.vocabPartFilter).length,
    unmarked: filterVocabItems(vocabListItems, "unmarked", state.vocabPartFilter).length
  };
}

function getVocabSummaryText(count) {
  const activeFilter = getVocabFilter();
  const activeLevel = getVocabLevel();
  const levelLabel = getLevelSummaryLabel(activeLevel);
  const activePart = getVocabPartFilter();
  const partLabel = activePart === vocabPartAllValue ? "단어" : `${activePart} 단어`;

  if (activeFilter === "review") {
    return `${levelLabel} 다시 볼 ${partLabel} ${count}개예요`;
  }

  if (activeFilter === "mastered") {
    return `${levelLabel} 익힌 ${partLabel} ${count}개 모였어요`;
  }

  if (activeFilter === "unmarked") {
    return `${levelLabel} 아직 안 정한 ${partLabel} ${count}개예요`;
  }

  return `${levelLabel} ${activePart === vocabPartAllValue ? "단어" : partLabel} ${count}개예요`;
}

function resetVocabStudyPointers() {
  resetStudyCatalogPointers({
    pageKey: "vocabPage",
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed"
  });
}

function setVocabLevel(level) {
  const nextLevel = getVocabLevel(level);
  if (state.vocabLevel === nextLevel) {
    return;
  }

  state.vocabLevel = nextLevel;
  resetVocabStudyPointers();
  invalidateVocabQuizSession();
  refreshVocabPageContent(nextLevel);
  state.vocabPartFilter = getVocabPartFilter(state.vocabPartFilter);
  saveState();
  renderVocabPage();
  loadVocabDataForLevel(nextLevel);
}

function setVocabFilter(filter) {
  const nextFilter = getVocabFilter(filter);
  updateStudyCatalogState({
    stateKey: "vocabFilter",
    nextValue: nextFilter,
    resetPointers: resetVocabStudyPointers,
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
}

function setVocabPartFilter(part) {
  const nextPart = getVocabPartFilter(part);
  updateStudyCatalogState({
    stateKey: "vocabPartFilter",
    nextValue: nextPart,
    resetPointers: resetVocabStudyPointers,
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
}

function syncFlashcardIndexAfterVocabUpdate(currentCardId, previousIndex) {
  syncStudyFlashcardIndexAfterUpdate({
    currentCardId,
    previousIndex,
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex"
  });
}

function getVisibleFlashcards() {
  return getOrderedStudyCards("vocab", filterVocabItems(flashcards));
}

function getVisibleVocabList() {
  return filterVocabItems(vocabListItems);
}

function getVocabQuizItems() {
  return getVisibleVocabList();
}

function getVocabPageCount(items) {
  return getStudyPageCount(items, vocabPageSize);
}

function clampVocabPage(items) {
  clampStudyPage("vocabPage", items, vocabPageSize);
}

function getVocabQuizSignature(items = getVocabQuizItems()) {
  return [
    getVocabLevel(),
    getVocabFilter(),
    getVocabPartFilter(),
    getVocabQuizQuestionField(),
    getVocabQuizOptionField(),
    getVocabQuizCount(),
    items.map((item) => item.id).join("|")
  ].join("::");
}

function getVocabQuizSourceLabel() {
  return [getVocabLevelLabel(), vocabFilterLabels[getVocabFilter()], getVocabPartSummaryLabel()].join(" · ");
}

function getCurrentVocabQuizQuestion() {
  return activeVocabQuizQuestions[state.vocabQuizIndex] || activeVocabQuizQuestions[0] || null;
}

function resetVocabQuizSessionStats() {
  resetQuizSessionScore("vocab");
  setQuizSessionDuration("vocab", getVocabQuizDuration());
  renderQuizSessionHud("vocab");
}

function restoreChallengeVocabQuizSession() {
  const payload = activeVocabQuizChallengePayload;

  if (!payload || !Array.isArray(payload.questions) || !payload.questions.length) {
    return false;
  }

  activeVocabQuizSignature = `challenge::${payload.challengeId || Date.now()}`;
  activeVocabQuizQuestions = cloneChallengeSessionData(payload.questions);
  activeVocabQuizResults = [];
  state.vocabQuizStarted = true;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  resetVocabQuizSessionStats();
  saveState();
  return true;
}

function startNewVocabQuizSession(force = false) {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("vocab-quiz-result-view");
  const items = getVocabQuizItems();
  const nextSignature = getVocabQuizSignature(items);

  if (!force && nextSignature === activeVocabQuizSignature && activeVocabQuizQuestions.length) {
    state.vocabQuizStarted = true;
    return true;
  }

  const nextQuestions = buildWordPracticeQuestionSet(items, getVocabLevel(), [], {
    questionField: getVocabQuizQuestionField(),
    optionField: getVocabQuizOptionField(),
    count: getVocabQuizCount()
  });

  activeVocabQuizSignature = nextSignature;
  activeVocabQuizQuestions = nextQuestions;
  activeVocabQuizResults = [];
  state.vocabQuizStarted = nextQuestions.length > 0;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  resetVocabQuizSessionStats();
  saveState();
  return nextQuestions.length > 0;
}

function ensureVocabQuizSession(force = false) {
  if (!state.vocabQuizStarted) {
    return false;
  }

  if (activeVocabQuizChallengePayload) {
    const currentIndex = Number.isFinite(Number(state.vocabQuizIndex)) ? Number(state.vocabQuizIndex) : 0;

    if (
      force ||
      !activeVocabQuizQuestions.length ||
      currentIndex < 0 ||
      currentIndex >= activeVocabQuizQuestions.length
    ) {
      return restoreChallengeVocabQuizSession();
    }

    return true;
  }

  const nextSignature = getVocabQuizSignature();

  if (
    force ||
    nextSignature !== activeVocabQuizSignature ||
    (activeVocabQuizQuestions.length > 0 && state.vocabQuizIndex >= activeVocabQuizQuestions.length)
  ) {
    return startNewVocabQuizSession(true);
  }

  return true;
}

function getVocabQuizEmptyText(items = getVocabQuizItems()) {
  if (!items.length) {
    return getVocabEmptyMessage();
  }

  if (items.length < 4) {
    return "선택한 단어가 4개보다 적어서 퀴즈를 만들기 어려워요. 모아보기나 품사를 조금 넓혀봐요.";
  }

  return "선택한 단어로는 퀴즈를 만들기 어려워요. 다른 모아보기도 골라봐요.";
}

function saveWordToReviewList(id) {
  setStudyListStatus("vocab", id, "review");
}

function removeWordFromReviewList(id) {
  removeFromStudyReviewList("vocab", id);
}

function isWordSavedToReviewList(id) {
  return isSavedToReviewList("vocab", id);
}

function saveWordToMasteredList(id) {
  setStudyListStatus("vocab", id, "mastered");
}

function removeWordFromMasteredList(id) {
  removeFromStudyMasteredList("vocab", id);
}

function isWordSavedToMasteredList(id) {
  return isSavedToMasteredList("vocab", id);
}

function getWordVocabStatus(id) {
  return getStudyListStatus("vocab", id);
}

function setWordVocabStatus(id, status) {
  setStudyListStatus("vocab", id, status);
}

function getNextVocabStatus(current) {
  return getNextStudyListStatus(current);
}

function getVocabStatusCycleMessage(status) {
  return getStudyListStatusCycleMessage(status);
}

function getVocabStatusIconName(status) {
  return getStudyListStatusIconName(status);
}

function getVocabStatusShortLabel(status) {
  return getStudyListStatusShortLabel(status);
}

let japanoteToastHideTimer = null;
let japanoteToastRemoveTimer = null;

function showJapanoteToast(message) {
  if (!message) {
    return;
  }

  let el = document.getElementById("japanote-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "japanote-toast";
    el.className = "japanote-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.hidden = false;
  el.classList.add("is-visible");

  if (japanoteToastHideTimer) {
    clearTimeout(japanoteToastHideTimer);
  }

  if (japanoteToastRemoveTimer) {
    clearTimeout(japanoteToastRemoveTimer);
  }

  japanoteToastHideTimer = window.setTimeout(() => {
    el.classList.remove("is-visible");
    japanoteToastRemoveTimer = window.setTimeout(() => {
      el.hidden = true;
    }, 280);
  }, 2600);
}

function createStudyListStatusCycleButtonMarkup(id, kind) {
  const statusConfigMap = {
    vocab: { idAttr: "data-vocab-word-id", cycleAttr: "data-vocab-cycle", getStatus: getWordVocabStatus },
    kanji: { idAttr: "data-kanji-list-id", cycleAttr: "data-kanji-cycle", getStatus: getKanjiListStatus },
    grammar: { idAttr: "data-grammar-list-id", cycleAttr: "data-grammar-cycle", getStatus: getGrammarListStatus }
  };
  const statusConfig = statusConfigMap[kind] || statusConfigMap.vocab;
  const idAttr = statusConfig.idAttr;
  const cycleAttr = statusConfig.cycleAttr;
  const status = statusConfig.getStatus(id);
  const icon = getStudyListStatusIconName(status);
  const label = getStudyListStatusShortLabel(status);
  const nextStatus = getNextStudyListStatus(status);
  const nextLabel = getStudyListStatusShortLabel(nextStatus);

  return `
    <div class="vocab-list-status-icons">
      <button type="button" class="vocab-status-icon-btn is-${status}" ${idAttr}="${id}" ${cycleAttr} aria-label="지금 ${label}. 누르면 ${nextLabel}로 바꿔요" title="눌러서 바꿔요 (${label} → ${nextLabel})">
        <span class="material-symbols-rounded" aria-hidden="true">${icon}</span>
      </button>
    </div>
  `;
}

function createVocabListStatusIconsMarkup(id) {
  return createStudyListStatusCycleButtonMarkup(id, "vocab");
}

function createKanjiListStatusIconsMarkup(id) {
  return createStudyListStatusCycleButtonMarkup(id, "kanji");
}

function createGrammarListStatusIconsMarkup(id) {
  return createStudyListStatusCycleButtonMarkup(id, "grammar");
}

function getVocabQuizResultCounts() {
  return getStudyResultCounts(activeVocabQuizResults);
}

function getFilteredVocabQuizResults() {
  return getFilteredStudyResults(activeVocabQuizResults, getVocabQuizResultFilter());
}

function renderVocabQuizBulkActionButtons(results) {
  const reviewActionButton = document.getElementById("vocab-quiz-result-bulk-action");
  const reviewActionLabel = document.getElementById("vocab-quiz-result-bulk-label");
  const reviewActionIcon = reviewActionButton?.querySelector(".material-symbols-rounded");
  const masteredActionButton = document.getElementById("vocab-quiz-result-mastered-action");
  const masteredActionLabel = document.getElementById("vocab-quiz-result-mastered-label");
  const masteredActionIcon = masteredActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: reviewActionButton,
    label: reviewActionLabel,
    icon: reviewActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isWordSavedToReviewList,
    datasetKey: "vocabQuizBulkAction",
    saveLabel: "모두 다시 보기",
    removeLabel: "다시 보기 해제",
    emptyTitle: "지금 표시 중인 단어가 없어요.",
    saveTitle: "지금 보이는 단어를 모두 다시 볼 항목으로 표시해요.",
    removeTitle: "지금 보이는 단어의 다시 보기 표시를 모두 해제해요."
  });
  renderResultBulkActionButton({
    button: masteredActionButton,
    label: masteredActionLabel,
    icon: masteredActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isWordSavedToMasteredList,
    datasetKey: "vocabQuizMasteredBulkAction",
    saveActionValue: "save-mastered",
    removeActionValue: "remove-mastered",
    saveLabel: "모두 익히기",
    removeLabel: "익힘 해제",
    emptyTitle: "지금 표시 중인 단어가 없어요.",
    saveTitle: "지금 보이는 단어를 모두 익힘으로 표시해요.",
    removeTitle: "지금 보이는 단어의 익힘 표시를 모두 해제해요.",
    saveIcon: "check_circle",
    removeIcon: "remove_done"
  });
}

function recordVocabQuizResult(question, selectedIndex, correct, timedOut = false) {
  if (!question) {
    return;
  }

  activeVocabQuizResults.push({
    id: question.sourceId || question.id,
    status: correct ? "correct" : "wrong",
    level: question.level || getVocabLevelLabel(),
    questionField: getVocabQuizField(question.questionField, getVocabQuizQuestionField()),
    optionField: getVocabQuizField(question.optionField, getVocabQuizOptionField()),
    word: question.word || "",
    reading: question.reading || "",
    meaning: question.meaning || "",
    selectedOption: selectedIndex >= 0 ? question.options[selectedIndex] || "" : "",
    answerOption: question.options[question.answer] || "",
    timedOut
  });
}

function renderVocabQuizResults() {
  const counts = getVocabQuizResultCounts();
  const filteredResults = getFilteredVocabQuizResults();
  renderSharedStudyResults({
    resultViewId: "vocab-quiz-result-view",
    totalId: "vocab-quiz-result-total",
    correctId: "vocab-quiz-result-correct",
    wrongId: "vocab-quiz-result-wrong",
    emptyId: "vocab-quiz-result-empty",
    listId: "vocab-quiz-result-list",
    bulkActionButtonId: "vocab-quiz-result-bulk-action",
    counts,
    filteredResults,
    activeFilter: getVocabQuizResultFilter(),
    filterLabels: vocabQuizResultFilterLabels,
    renderBulkActionButton: renderVocabQuizBulkActionButtons,
    getEmptyText: ({ activeFilter }) => getStudyPracticeResultEmptyMessage(activeFilter),
    renderItems: (results, container) => {
      results.forEach((item) => {
        const saved = isWordSavedToReviewList(item.id);
        const reviewSelected = saved;
        const masteredSelected = isWordSavedToMasteredList(item.id);

        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.level || getVocabLevelLabel(),
          titleText: item.reading ? `${item.word} · ${item.reading}` : item.word,
          descriptionText: item.meaning,
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? "다시 보기 해제" : "다시 보기로 표시",
              datasetName: "vocabQuizReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? "익힘 해제" : "익힘으로 표시",
              datasetName: "vocabQuizMastered",
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

function revealVocabQuizAnswer(question, selectedIndex, correct) {
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === question.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === selectedIndex
  });
}

function finalizeVocabQuizQuestion(selectedIndex, timedOut = false) {
  const question = getCurrentVocabQuizQuestion();
  const feedback = document.getElementById("vocab-quiz-feedback");
  const explanation = document.getElementById("vocab-quiz-explanation");
  const nextButton = document.getElementById("vocab-quiz-next");

  if (!question || !feedback || !explanation || !nextButton) {
    return;
  }

  const correct = selectedIndex === question.answer;
  const isLastQuestion = state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1;

  finalizeQuizSession("vocab", correct);
  state.quizAnsweredCount += 1;

  if (correct) {
    state.quizCorrectCount += 1;
  }

  recordVocabQuizResult(question, selectedIndex, correct, timedOut);
  revealVocabQuizAnswer(question, selectedIndex, correct);
  feedback.textContent = correct
    ? ""
    : "";
  explanation.textContent = softenExplanationCopy(question.explanation || "");
  nextButton.disabled = false;
  nextButton.hidden = false;
  nextButton.textContent = isLastQuestion ? "결과 볼까요?" : "다음 문제 볼까요?";

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleVocabQuizAnswer(index) {
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || quizSessions.vocab.isPaused) {
    return;
  }

  finalizeVocabQuizQuestion(index, false);
}

function handleVocabQuizTimeout() {
  const question = getCurrentVocabQuizQuestion();
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || !question) {
    return;
  }

  finalizeVocabQuizQuestion(-1, true);
}

function nextVocabQuizQuestion() {
  if (state.vocabQuizFinished) {
    invalidateVocabQuizSession();
    saveState();
    renderVocabPage();
    return;
  }

  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const answered = Array.from(options).length > 0 && Array.from(options).every((item) => item.disabled);

  if (!answered) {
    return;
  }

  if (state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1) {
    state.vocabQuizFinished = true;
    stopQuizSessionTimer("vocab");
    saveState();
    renderVocabQuiz();
    return;
  }

  state.vocabQuizIndex += 1;
  saveState();
  renderVocabQuiz();
}

function restartVocabQuiz() {
  if (state.vocabQuizStarted) {
    invalidateVocabQuizSession();
    saveState();
    renderVocabPage();
    return;
  }

  const started = startNewVocabQuizSession(true);
  renderVocabPage();

  if (started) {
    scrollToElementById("vocab-quiz-card");
  }
}

function renderFlashcard() {
  const activeFilter = getVocabFilter();
  const activeLevel = getVocabLevel();
  const activePart = getVocabPartFilter();
  const cards = getVisibleFlashcards();
  const flashcard = document.getElementById("flashcard");
  const flashcardToggle = document.getElementById("flashcard-toggle");
  const flashcardPrev = document.getElementById("flashcard-prev");
  const flashcardNext = document.getElementById("flashcard-next");
  const flashcardAgain = document.getElementById("flashcard-again");
  const flashcardMastered = document.getElementById("flashcard-mastered");
  const level = document.getElementById("flashcard-level");
  const word = document.getElementById("flashcard-word");
  const reading = document.getElementById("flashcard-reading");
  const meaning = document.getElementById("flashcard-meaning");
  const hint = document.getElementById("flashcard-hint");

  if (!flashcard || !flashcardToggle || !level || !word || !reading || !meaning || !hint) {
    return;
  }

  const emptyWordLabel = "아직 보여줄 단어가 없어요.";
  const emptyReadingLabel = "다른 레벨이나 품사로 바꿔볼까요?";
  const emptyMeaningLabel =
    activePart === vocabPartAllValue ? "" : "이 품사로는 지금 맞는 단어가 없어요. 다른 품사도 둘러볼까요?";
  const emptyCardMap = {
    all: {
      level: activeLevel,
      word: emptyWordLabel,
      reading: emptyReadingLabel,
      meaning: emptyMeaningLabel,
      id: "empty-all"
    },
    review: {
      level: "REVIEW",
      word: "다시 볼 단어가 아직 없어요.",
      reading: "카드에서 담아두면 여기서 다시 볼 수 있어요.",
      meaning: activePart === vocabPartAllValue ? "" : "다른 품사로 바꿔볼까요?",
      id: "empty-review"
    },
    mastered: {
      level: "MASTERED",
      word: "익힌 단어가 아직 없어요.",
      reading: "익혔어요를 눌러두면 여기 모여요.",
      meaning: activePart === vocabPartAllValue ? "" : "이 품사에서 익힌 단어가 생기면 여기로 모여요.",
      id: "empty-mastered"
    },
    unmarked: {
      level: "UNMARKED",
      word: "이 상태의 단어는 지금 없어요.",
      reading: "다른 모아보기로 바꿔보세요.",
      meaning: activePart === vocabPartAllValue ? "" : "다른 품사나 레벨도 함께 볼까요?",
      id: "empty-unmarked"
    }
  };
  const hasCards = cards.length > 0;
  const currentIndex = hasCards ? state.flashcardIndex % cards.length : 0;
  const currentCard = hasCards ? cards[currentIndex] : emptyCardMap[activeFilter] || emptyCardMap.all;
  const review = hasCards && isWordSavedToReviewList(currentCard.id);
  const mastered = hasCards && isWordSavedToMasteredList(currentCard.id);
  const isRevealed = hasCards && state.flashcardRevealed;
  const hintText = hasCards
    ? isRevealed
      ? review
        ? "다시 볼래요에 담긴 단어예요"
        : mastered
          ? "익혔어요에 담긴 단어예요"
          : "지금 상태를 바로 정할 수 있어요"
      : "눌러서 뜻을 확인해볼까요?"
    : activeFilter === "review"
      ? "카드에서 담아두면 여기서 다시 볼 수 있어요."
      : activeFilter === "mastered"
        ? "익혔어요를 눌러두면 여기 모여요."
        : activeFilter === "unmarked"
          ? "다른 모아보기로 바꿔볼까요?"
          : "다른 레벨이나 품사로 바꿔볼까요?";

  renderStudyFlashcardComponent({
    flashcard,
    toggle: flashcardToggle,
    prev: flashcardPrev,
    next: flashcardNext,
    level,
    word,
    reading,
    meaning,
    hint,
    hasCards,
    isRevealed,
    revealWhenEmpty: true,
    levelText: formatStudyLevelLabel(currentCard.level, "N5"),
    wordText: currentCard.word || "",
    readingText: currentCard.reading || "",
    meaningText: currentCard.meaning || "",
    hintText,
    toggleOpenLabel: "뜻을 다시 가릴까요?",
    toggleClosedLabel: "뜻을 확인해볼까요?",
    toggleEmptyLabel: "다른 레벨이나 품사로 바꿔볼까요?",
    prevDisabled: cards.length <= 1,
    nextDisabled: cards.length <= 1,
    actionButtons: [
      {
        button: flashcardAgain,
        selected: review,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      },
      {
        button: flashcardMastered,
        selected: mastered,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      }
    ]
  });
}

function renderVocabList() {
  const list = document.getElementById("vocab-list");
  const pageInfo = document.getElementById("vocab-page-info");
  const prev = document.getElementById("vocab-page-prev");
  const next = document.getElementById("vocab-page-next");
  const activeFilter = getVocabFilter();
  const items = getVisibleVocabList();

  renderStatefulStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    pageKey: "vocabPage",
    pageSize: vocabPageSize,
    emptyMessage: getVocabEmptyMessage(activeFilter),
    renderItem: (item, displayIndex) => {
      const vocabLevel = item.level || "";

      return createStudyListCardMarkup({
        index: displayIndex,
        headMetaMarkup: vocabLevel ? `<span class="vocab-list-index">${vocabLevel}</span>` : "",
        headRightMarkup: createVocabListStatusIconsMarkup(item.id),
        titleText: formatQuizLineBreaks(item.word),
        subtitleText: formatQuizLineBreaks(item.reading),
        descriptionMarkup: `<p class="vocab-list-meaning">${formatQuizLineBreaks(item.meaning)}</p>`
      });
    }
  });
}

function renderVocabTabLayout() {
  syncTabButtonsAndPanels({
    buttonSelector: "[data-vocab-tab]",
    panelSelector: "[data-vocab-tab-panel]",
    buttonAttribute: "vocabTab",
    panelAttribute: "vocabTabPanel",
    activeValue: getVocabTab()
  });
}

function populateVocabFilterSelect(select, counts) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  Object.entries(vocabFilterLabels).forEach(([filter, label]) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${label} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getVocabFilter();
}

function populateContentLevelSelect(select, activeLevel, { includeAll = false } = {}) {
  if (!select) {
    return;
  }

  const levelOptions = includeAll ? [allLevelValue, ...contentLevels] : [...contentLevels];
  select.innerHTML = "";

  levelOptions.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level === allLevelValue ? "전체" : level;
    select.appendChild(option);
  });

  select.value = levelOptions.includes(activeLevel) ? activeLevel : levelOptions[0];
}

function populateVocabLevelSelect(select) {
  populateContentLevelSelect(select, getVocabLevel(), { includeAll: true });
}

function populateVocabPartSelect(select, availableParts, activePart) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  const partOptions = [{ value: vocabPartAllValue, count: vocabListItems.length }, ...availableParts];
  partOptions.forEach((partOption) => {
    const option = document.createElement("option");
    const label = partOption.value === vocabPartAllValue ? "전체 품사" : partOption.value;

    option.value = partOption.value;
    option.textContent = `${label} (${partOption.count})`;
    select.appendChild(option);
  });

  select.value = activePart;
}

function populateVocabQuizFieldSelect(select, activeField) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  vocabQuizFieldOptions.forEach((field) => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = getVocabQuizFieldLabel(field);
    select.appendChild(option);
  });

  select.value = getVocabQuizField(activeField);
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

function renderVocabStudyControls(counts, availableParts, activePart) {
  const levelSelect = document.getElementById("vocab-level-select");
  const filterSelect = document.getElementById("vocab-filter-select");
  const partSelect = document.getElementById("vocab-part-select");
  const activeView = getVocabView();

  renderStudyCatalogControls({
    viewSelector: "[data-vocab-view]",
    viewAttribute: "data-vocab-view",
    activeView,
    selectConfigs: [
      {
        element: levelSelect,
        populate: populateVocabLevelSelect
      },
      {
        element: filterSelect,
        populate: (element) => populateVocabFilterSelect(element, counts)
      },
      {
        element: partSelect,
        populate: (element) => populateVocabPartSelect(element, availableParts, activePart)
      }
    ]
  });
}

function renderVocabQuizControls(counts, availableParts, activePart) {
  const optionsShell = document.getElementById("vocab-quiz-options-shell");
  const optionsToggle = document.getElementById("vocab-quiz-options-toggle");
  const optionsPanel = document.getElementById("vocab-quiz-options-panel");
  const optionsSummary = document.getElementById("vocab-quiz-options-summary");
  const questionFieldSelect = document.getElementById("vocab-quiz-question-field");
  const optionFieldSelect = document.getElementById("vocab-quiz-option-field");
  const levelSelect = document.getElementById("vocab-quiz-level-select");
  const filterSelect = document.getElementById("vocab-quiz-filter-select");
  const partSelect = document.getElementById("vocab-quiz-part-select");
  const countSpinner = document.querySelector('[data-spinner-id="vocab-quiz-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="vocab-quiz-time"]');
  const isOptionsOpen = state.vocabQuizOptionsOpen === true;
  const activeQuestionField = getVocabQuizQuestionField();
  const activeOptionField = getVocabQuizOptionField();
  const activeCount = getVocabQuizCount();
  const activeDuration = getVocabQuizDuration();
  const isSettingsLocked = state.vocabQuizStarted && !state.vocabQuizFinished;
  const isFilterLocked = state.vocabQuizStarted && !state.vocabQuizFinished;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getVocabQuizOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: vocabQuizCountOptions,
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
        populate: populateVocabQuizFieldSelect
      },
      {
        element: optionFieldSelect,
        value: activeOptionField,
        populate: populateVocabQuizFieldSelect
      },
      {
        element: levelSelect,
        populate: (element) => populateVocabLevelSelect(element),
        disabled: isFilterLocked
      },
      {
        element: filterSelect,
        populate: (element) => populateVocabFilterSelect(element, counts),
        disabled: isFilterLocked
      },
      {
        element: partSelect,
        populate: (element) => populateVocabPartSelect(element, availableParts, activePart),
        disabled: isFilterLocked
      }
    ]
  });
}

function renderVocabQuiz() {
  const view = document.getElementById("vocab-quiz");
  const resultView = document.getElementById("vocab-quiz-result-view");
  const empty = document.getElementById("vocab-quiz-empty");
  const card = document.getElementById("vocab-quiz-card");
  const track = document.getElementById("vocab-quiz-track");
  const source = document.getElementById("vocab-quiz-source");
  const progress = document.getElementById("vocab-quiz-progress");
  const title = document.getElementById("vocab-quiz-title");
  const note = document.getElementById("vocab-quiz-note");
  const prompt = document.getElementById("vocab-quiz-prompt");
  const display = document.getElementById("vocab-quiz-display");
  const displaySub = document.getElementById("vocab-quiz-display-sub");
  const options = document.getElementById("vocab-quiz-options");
  const feedback = document.getElementById("vocab-quiz-feedback");
  const explanation = document.getElementById("vocab-quiz-explanation");
  const restart = document.getElementById("vocab-quiz-restart");
  const restartLabel = document.getElementById("vocab-quiz-restart-label");
  const next = document.getElementById("vocab-quiz-next");
  const items = getVocabQuizItems();
  const canStart = items.length >= 4;

  if (
    !view ||
    !resultView ||
    !empty ||
    !card ||
    !track ||
    !source ||
    !progress ||
    !title ||
    !note ||
    !prompt ||
    !display ||
    !displaySub ||
    !options ||
    !feedback ||
    !explanation ||
    !restart ||
    !restartLabel ||
    !next
  ) {
    return;
  }

  if (!state.vocabQuizStarted) {
    stopQuizSessionTimer("vocab");
    resetQuizSessionScore("vocab");
    setQuizSessionDuration("vocab", getVocabQuizDuration());
    view.hidden = false;
    resultView.hidden = true;
    empty.hidden = false;
    empty.textContent = canStart
      ? "준비됐다면 시작해볼까요?"
      : getVocabQuizEmptyText(items);
    card.hidden = true;
    progress.textContent = `0 / ${getVocabQuizCount()}`;
    restart.classList.add("primary-btn");
    restart.classList.remove("secondary-btn");
    restart.disabled = !canStart;
    restartLabel.textContent = "시작해볼까요?";
    setActionButtonIcon(restart, "play_arrow");
    next.hidden = true;
    next.disabled = true;
    renderQuizSessionHud("vocab");
    return;
  }

  // 결과 화면에서 학습 상태를 바꿔도 방금 끝낸 세션 결과는 그대로 볼 수 있어야 해서
  // 문제 풀 서명이 달라지기 전에 완료 상태를 먼저 렌더링한다.
  if (state.vocabQuizFinished) {
    const total = activeVocabQuizQuestions.length;

    stopQuizSessionTimer("vocab");
    renderQuizSessionHud("vocab");
    view.hidden = true;
    resultView.hidden = false;
    empty.hidden = true;
    card.hidden = true;
    progress.textContent = `${total} / ${total}`;
    restart.classList.add("secondary-btn");
    restart.classList.remove("primary-btn");
    restart.disabled = false;
    next.hidden = true;
    next.disabled = false;
    restartLabel.textContent = "다시 해볼까요?";
    setActionButtonIcon(restart, "autorenew");
    renderVocabQuizResults();
    return;
  }

  ensureVocabQuizSession();
  const question = getCurrentVocabQuizQuestion();

  if (!question) {
    stopQuizSessionTimer("vocab");
    setQuizSessionDuration("vocab", getVocabQuizDuration());
    view.hidden = false;
    resultView.hidden = true;
    empty.hidden = false;
    empty.textContent = getVocabQuizEmptyText(items);
    card.hidden = true;
    progress.textContent = "0 / 0";
    restart.classList.add("primary-btn");
    restart.classList.remove("secondary-btn");
    restart.disabled = !canStart;
    restartLabel.textContent = "시작해볼까요?";
    setActionButtonIcon(restart, "play_arrow");
    state.vocabQuizStarted = false;
    renderQuizSessionHud("vocab");
    return;
  }

  view.hidden = false;
  resultView.hidden = true;
  empty.hidden = true;
  card.hidden = false;
  track.textContent = getVocabQuizConfigLabel();
  source.textContent = getVocabQuizSourceLabel();
  restart.classList.add("secondary-btn");
  restart.classList.remove("primary-btn");
  restart.disabled = false;
  restartLabel.textContent = "다시 해볼까요?";
  setActionButtonIcon(restart, "autorenew");

  if (state.vocabQuizFinished) {
    const total = activeVocabQuizQuestions.length;

    stopQuizSessionTimer("vocab");
    renderQuizSessionHud("vocab");
    view.hidden = true;
    resultView.hidden = false;
    progress.textContent = `${total} / ${total}`;
    next.hidden = true;
    next.disabled = false;
    restartLabel.textContent = "다시 해볼까요?";
    setActionButtonIcon(restart, "autorenew");
    renderVocabQuizResults();
    return;
  }

  renderQuizSessionHud("vocab");
  card.className = `basic-practice-card vocab-quiz-card ${question.tone || "tone-coral"}`;
  progress.textContent = `${state.vocabQuizIndex + 1} / ${activeVocabQuizQuestions.length}`;
  title.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.title));
  note.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.note));
  prompt.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.prompt));
  display.textContent = formatQuizLineBreaks(question.display);
  displaySub.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.displaySub || ""));
  applyDisplayTextSize(display);
  feedback.textContent = "";
  explanation.textContent = "";
  next.hidden = false;
  next.disabled = true;
  next.textContent =
    state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1 ? "결과 볼까요?" : "다음 문제 볼까요?";

  renderChoiceOptionButtons({
    container: options,
    options: question.options,
    buttonClassName: "basic-practice-option",
    formatText: (option) => formatQuizLineBreaks(softenVisibleKoreanCopy(option)),
    onSelect: handleVocabQuizAnswer
  });

  resetQuizSessionTimer("vocab", handleVocabQuizTimeout);
}

function renderVocabPage() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const cardView = document.getElementById("vocab-card-view");
  const listView = document.getElementById("vocab-list-view");
  const summary = document.getElementById("vocab-summary");
  const headingTitle = document.getElementById("vocab-heading-title");
  const headingCopy = document.getElementById("vocab-heading-copy");
  const items = getVisibleVocabList();
  const counts = getVocabFilterCounts();
  const activeLevel = getVocabLevel();
  const activePart = getVocabPartFilter();
  const activeTab = getVocabTab();
  const activeHeadingMap = activeTab === "quiz" ? quizHeadingCopy : vocabHeadingCopy;
  const heading = activeTab === "match" ? matchHeadingCopy : activeHeadingMap[activeLevel] || activeHeadingMap.N5;
  const availableParts = getAvailableVocabParts();

  applyPageHeading(headingTitle, headingCopy, heading);

  if (summary) {
    summary.textContent = getVocabSummaryText(items.length);
  }

  renderVocabTabLayout();
  renderVocabStudyControls(counts, availableParts, activePart);
  renderVocabQuizControls(counts, availableParts, activePart);
  renderStudyCatalogSection({
    cardView,
    listView,
    activeView: getVocabView(),
    renderFlashcard: renderFlashcard,
    renderList: renderVocabList
  });

  if (activeTab === "quiz") {
    syncVocabLocationHash("quiz");
    renderVocabQuiz();
  } else {
    stopQuizSessionTimer("vocab");
    syncVocabLocationHash(activeTab);
  }
}

function toggleFlashcardReveal() {
  toggleStudyFlashcardReveal("flashcardRevealed", () => {
    renderStudyViewWithStats(renderVocabPage);
  });
}

function moveFlashcard(step) {
  moveStudyFlashcard(step, {
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    render: renderVocabPage
  });
}

function markFlashcardForReview() {
  markStudyFlashcardStatus({
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    saveItem: saveWordToReviewList,
    syncIndexAfterUpdate: syncFlashcardIndexAfterVocabUpdate,
    render: renderAll
  });
}

function markFlashcardMastered() {
  markStudyFlashcardStatus({
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    saveItem: saveWordToMasteredList,
    syncIndexAfterUpdate: syncFlashcardIndexAfterVocabUpdate,
    render: renderAll
  });
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
  if (item.explanation) {
    return item.explanation;
  }

  if (item.sentence && item.sentence !== item.title) {
    return item.sentence;
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
    saveLabel: "모두 다시 보기",
    removeLabel: "다시 보기 해제",
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
    saveLabel: "모두 익히기",
    removeLabel: "익힘 해제",
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

  return "지금 보여줄 문법이 없어요. 다른 레벨이나 모아보기로 바꿔볼까요?";
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
      : "눌러서 설명을 확인해볼까요?"
    : "다른 레벨이나 모아보기로 바꿔볼까요?";

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
    toggleEmptyLabel: "다른 레벨이나 모아보기로 바꿔볼까요?",
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

function getPracticeLevelIndex(indexes, activeLevel) {
  const rawIndex = Number.isFinite(Number(indexes?.[activeLevel])) ? Number(indexes[activeLevel]) : 0;

  return Number.isFinite(rawIndex) ? rawIndex : 0;
}

function buildFixedPracticeSessionItems(items = [], count = 0, startIndex = 0, allowRepeat = false) {
  const pool = Array.isArray(items) ? items.filter(Boolean) : [];
  const requestedCount = Math.max(0, Number(count) || 0);
  const rawStartIndex = Number.isFinite(Number(startIndex)) ? Math.max(0, Number(startIndex)) : 0;

  if (!pool.length || !requestedCount) {
    return [];
  }

  // 세션 시작 시 현재 인덱스 기준으로 문제 배열을 고정해 두면 진행 중 렌더마다 문제가 바뀌지 않는다.
  const questionCount = allowRepeat ? requestedCount : Math.min(requestedCount, pool.length);
  const normalizedStartIndex = rawStartIndex % pool.length;

  return Array.from({ length: questionCount }, (_, offset) => pool[(normalizedStartIndex + offset) % pool.length]);
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
      results.forEach((item) => {
        const reviewSelected = isGrammarSavedToReviewList(item.id);
        const masteredSelected = isGrammarSavedToMasteredList(item.id);

        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.source || "문법",
          titleText: item.title || item.sentence || "-",
          descriptionText: getGrammarPracticeResultDetail(item),
          actionButtons: [
            {
              itemId: item.id,
              selected: reviewSelected,
              actionLabel: reviewSelected ? "다시 보기 해제" : "다시 보기로 표시",
              datasetName: "grammarPracticeReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? "익힘 해제" : "익힘으로 표시",
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
    empty.textContent = sets?.length ? "준비되면 시작해볼까요?" : getGrammarEmptyMessage(getGrammarFilter(), activeLevel);
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
    empty.textContent = sets?.length ? "준비되면 시작해볼까요?" : getGrammarEmptyMessage(getGrammarFilter(), activeLevel);
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
  nextButton.textContent = currentSessionIndex >= questionCount - 1 ? "결과 보기" : "다음 문제 보기";
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
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 문제 보기";
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
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 문제 보기";
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

function getQuizQuestion() {
  if (!activeQuizQuestions.length) {
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
  }

  return activeQuizQuestions[state.quizIndex] || activeQuizQuestions[0];
}

function getQuizAccuracyValue(correct = quizSessions.quiz.correct, total = activeQuizQuestions.length) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function getQuizModeLabel(mode = state.quizMode) {
  return quizModeLabels[getQuizMode(mode)];
}

function getQuizOptionsSummaryText() {
  return [
    getQuizLevelLabel(),
    getQuizModeLabel(),
    `${getQuizSessionSize(state.quizSessionSize)}문제`,
    getDurationLabel(getQuizDuration())
  ].join(" · ");
}

function setQuizLevel(level) {
  const nextLevel = getQuizLevel(level);

  if (state.quizLevel === nextLevel) {
    return;
  }

  state.quizLevel = nextLevel;
  refreshQuizContent(nextLevel);
  startNewQuizSession();
  loadVocabDataForLevel(nextLevel);
}

function setQuizDuration(duration) {
  const nextDuration = getQuizDuration(duration);

  if (state.quizDuration === nextDuration) {
    return;
  }

  state.quizDuration = nextDuration;
  startNewQuizSession();
}

function getQuizNextButton() {
  return document.getElementById("quiz-next");
}

function getQuizRestartButton() {
  return document.getElementById("quiz-restart");
}

function setQuizActionState({ nextLabel, nextDisabled = false, nextHidden = false, restartHidden = false }) {
  const nextButton = getQuizNextButton();
  const restartButton = getQuizRestartButton();

  if (nextButton) {
    nextButton.textContent = nextLabel;
    nextButton.disabled = nextDisabled;
    nextButton.hidden = nextHidden;
  }

  if (restartButton) {
    restartButton.hidden = restartHidden;
  }
}

function renderQuizControls() {
  const optionsShell = document.getElementById("quiz-options-shell");
  const optionsToggle = document.getElementById("quiz-options-toggle");
  const optionsPanel = document.getElementById("quiz-options-panel");
  const optionsSummary = document.getElementById("quiz-options-summary");
  const headingTitle = document.getElementById("quiz-heading-title");
  const headingCopy = document.getElementById("quiz-heading-copy");
  const activeLevel = getQuizLevel();
  const heading = quizHeadingCopy[activeLevel] || quizHeadingCopy.N5;
  const sizeButtons = document.querySelectorAll("[data-quiz-size]");
  const modeButtons = document.querySelectorAll("[data-quiz-mode]");
  const levelButtons = document.querySelectorAll("[data-quiz-level]");
  const timeButtons = document.querySelectorAll("[data-quiz-time]");
  const isOptionsOpen = state.quizOptionsOpen === true;

  if (headingTitle) {
    headingTitle.textContent = heading.title;
  }

  if (headingCopy) {
    headingCopy.textContent = heading.description;
  }

  renderOpenableSettingsSection({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getQuizOptionsSummaryText(),
    isOpen: isOptionsOpen
  });
  syncSelectionButtonState(levelButtons, (button) => button.dataset.quizLevel, activeLevel);
  syncSelectionButtonState(sizeButtons, (button) => Number(button.dataset.quizSize), state.quizSessionSize);
  syncSelectionButtonState(modeButtons, (button) => button.dataset.quizMode, state.quizMode);
  syncSelectionButtonState(timeButtons, (button) => Number(button.dataset.quizTime), getQuizDuration());
}

function renderQuizResult() {
  const result = document.getElementById("quiz-result");
  const score = document.getElementById("quiz-result-score");
  const accuracy = document.getElementById("quiz-result-accuracy");
  const wrong = document.getElementById("quiz-result-wrong");
  const copy = document.getElementById("quiz-result-copy");

  if (!result || !score || !accuracy || !wrong || !copy) {
    return;
  }

  const total = activeQuizQuestions.length;
  const correct = quizSessions.quiz.correct;
  const wrongCount = total - correct;

  result.hidden = false;
  score.textContent = `${correct} / ${total}`;
  accuracy.textContent = `${getQuizAccuracyValue(correct, total)}%`;
  wrong.textContent = `${wrongCount}개`;
  copy.textContent =
    wrongCount === 0
      ? `${getQuizModeLabel()} ${total}문제, 전부 맞혔어요!`
      : `${getQuizModeLabel()} ${total}문제까지 왔어요. 틀린 문제는 다시 볼까요?`;
}

function renderQuizMistakes() {
  const empty = document.getElementById("quiz-note-empty");
  const list = document.getElementById("quiz-note-list");

  if (!empty || !list) {
    return;
  }

  if (!state.quizMistakes.length) {
    empty.hidden = false;
    list.innerHTML = "";
    return;
  }

  empty.hidden = true;
  list.innerHTML = state.quizMistakes
    .map(
      (item) => `
        <article class="quiz-note-item">
          <div class="quiz-note-item-head">
            <span>${item.modeLabel}</span>
            <strong>${item.word || item.correctAnswer}</strong>
          </div>
          <p class="quiz-note-item-prompt">${item.prompt}</p>
          <p class="quiz-note-item-meta">정답 · ${item.correctAnswer}</p>
          <p class="quiz-note-item-meta">내 답 · ${item.userAnswer}</p>
          <p class="quiz-note-item-meta">읽기 · ${item.reading || "-"}</p>
          <p class="quiz-note-item-meta">뜻 · ${item.meaning || "-"}</p>
        </article>
      `
    )
    .join("");
}

function resetQuizSessionStats() {
  resetQuizSessionScore("quiz");
  setQuizSessionDuration("quiz", state.quizDuration);
  renderQuizSessionHud("quiz");
}

function startNewQuizSession() {
  state.quizLevel = getQuizLevel(state.quizLevel);
  state.quizMode = getQuizMode(state.quizMode);
  state.quizSessionSize = getQuizSessionSize(state.quizSessionSize);
  state.quizDuration = getQuizDuration(state.quizDuration);
  state.quizIndex = 0;
  state.quizSessionFinished = false;
  state.quizSessionMistakeIds = [];
  refreshQuizContent(state.quizLevel);
  activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
  resetQuizSessionStats();
  saveState();
  renderQuiz();
}

function getQuizFeedbackText(question, correct, userAnswer) {
  const readingText = question.meta?.reading ? ` 읽기 · ${question.meta.reading}` : "";
  const meaningText = question.meta?.meaning ? ` 뜻 · ${question.meta.meaning}` : "";

  if (correct) {
    return "";
  }

  return `아깝네요! 정답은 "${question.answer}"예요.${question.meta?.mode === "reading" ? meaningText : readingText} ${
    userAnswer === "시간 초과" ? "시간 초과로 남겨둘게요." : ""
  }`.trim();
}

function rememberQuizMistake(question, userAnswer) {
  const noteId = `${question.meta?.mode || "meaning"}:${question.meta?.sourceId || question.id}`;
  const note = {
    id: noteId,
    modeLabel: getQuizModeLabel(question.meta?.mode),
    prompt: question.question,
    word: question.meta?.word || "",
    reading: question.meta?.reading || "",
    meaning: question.meta?.meaning || "",
    correctAnswer: question.answer,
    userAnswer,
    updatedAt: new Date().toISOString()
  };

  state.quizMistakes = [note, ...state.quizMistakes.filter((item) => item.id !== noteId)].slice(0, 30);

  if (!state.quizSessionMistakeIds.includes(noteId)) {
    state.quizSessionMistakeIds.push(noteId);
  }
}

function legacyRevealQuizAnswer(question, selectedOption, correct) {
  const answerIndex = question.options.indexOf(selectedOption);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item) => {
    item.disabled = true;

    if (item.textContent === question.answer || item.textContent === selectedOption) {
      item.classList.add("is-correct");
    }
  });
}

function legacyRevealQuizAnswerWithIndex(question, selectedIndex, correct) {
  const answerIndex = question.options.indexOf(question.answer);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item, optionIndex) => {
    item.disabled = true;

    if (optionIndex === answerIndex) {
      item.classList.add("is-correct");
    }

    if (!correct && selectedIndex === optionIndex) {
      item.classList.add("is-wrong");
    }
  });
}

function legacyFinalizeQuizQuestion(question, selectedOption, correct) {
  const feedback = document.getElementById("quiz-feedback");
  const lastQuestion = state.quizIndex >= activeQuizQuestions.length - 1;

  state.quizAnsweredCount += 1;
  finalizeQuizSession("quiz", correct);

  if (correct) {
    state.quizCorrectCount += 1;
  } else {
    rememberQuizMistake(question, selectedOption || "시간 초과");
  }

  if (feedback) {
    feedback.textContent = lastQuestion
      ? `${getQuizFeedbackText(question, correct, selectedOption || "시간 초과")} 마지막 문제예요. 결과 보러 가볼까요?`
      : getQuizFeedbackText(question, correct, selectedOption || "시간 초과");
  }

  legacyRevealQuizAnswer(question, selectedOption, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? "결과 보러 갈까요?" : "다음 문제 볼까요?",
    nextDisabled: false,
    nextHidden: false,
    restartHidden: false
  });

  updateStudyStreak();
  saveState();
  renderStats();
  renderQuizMistakes();
}

function renderQuiz() {
  const result = document.getElementById("quiz-result");
  const optionsContainer = document.getElementById("quiz-options");
  const level = document.getElementById("quiz-level");
  const progress = document.getElementById("quiz-progress");
  const questionText = document.getElementById("quiz-question");
  const feedback = document.getElementById("quiz-feedback");

  renderQuizControls();
  renderQuizMistakes();

  if (!optionsContainer || !level || !progress || !questionText || !feedback) {
    return;
  }

  if (state.quizSessionFinished) {
    stopQuizSessionTimer("quiz");
    level.textContent = `${getQuizLevelLabel()} · ${getQuizModeLabel()}`;
    progress.textContent = `${activeQuizQuestions.length} / ${activeQuizQuestions.length}`;
    questionText.textContent = "이번 퀴즈 끝!";
    feedback.textContent = `${activeQuizQuestions.length}문제까지 잘 풀었어요.`;
    optionsContainer.innerHTML = "";
    optionsContainer.hidden = true;
    setQuizActionState({
      nextLabel: "다음 문제 볼까요?",
      nextDisabled: true,
      nextHidden: true,
      restartHidden: false
    });
    renderQuizResult();
    return;
  }

  const question = getQuizQuestion();

  if (!question) {
    return;
  }

  if (result) {
    result.hidden = true;
  }

  level.textContent = `${getQuizLevelLabel()} · ${getQuizModeLabel()}`;
  progress.textContent = `${state.quizIndex + 1} / ${activeQuizQuestions.length}`;
  questionText.textContent = softenVisibleKoreanCopy(question.question);
  feedback.textContent = "";
  optionsContainer.hidden = false;
  optionsContainer.innerHTML = "";

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: question.options,
    buttonClassName: "quiz-option",
    formatText: softenVisibleKoreanCopy,
    getOptionValue: (_, index) => index,
    onSelect: (index) => handleQuizAnswer(question, index),
    setPressedState: true
  });

  setQuizActionState({
    nextLabel:
      state.quizIndex >= activeQuizQuestions.length - 1
        ? "결과 보러 갈까요?"
        : "다음 문제 볼까요?",
    nextDisabled: true,
    nextHidden: false,
    restartHidden: false
  });
  resetQuizSessionTimer("quiz", handleQuizTimeout);
}

function revealQuizAnswer(question, selectedOptionOrIndex, correct) {
  const answerIndex = question.options.indexOf(question.answer);
  const selectedIndex = Number.isFinite(selectedOptionOrIndex)
    ? selectedOptionOrIndex
    : question.options.indexOf(selectedOptionOrIndex);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item, optionIndex) => {
    item.disabled = true;

    if (optionIndex === answerIndex) {
      item.classList.add("is-correct");
    }

    if (!correct && optionIndex === selectedIndex) {
      item.classList.add("is-wrong");
    }
  });
}

function finalizeQuizQuestion(question, selectedOptionOrIndex, correct) {
  const feedback = document.getElementById("quiz-feedback");
  const lastQuestion = state.quizIndex >= activeQuizQuestions.length - 1;
  const selectedOption = Number.isFinite(selectedOptionOrIndex)
    ? question.options[selectedOptionOrIndex] ?? ""
    : selectedOptionOrIndex || "";

  state.quizAnsweredCount += 1;
  finalizeQuizSession("quiz", correct);

  if (correct) {
    state.quizCorrectCount += 1;
  } else {
    rememberQuizMistake(question, selectedOption);
  }

  if (feedback) {
    feedback.textContent = lastQuestion
      ? `${getQuizFeedbackText(question, correct, selectedOption)} 문제를 처리했습니다.`
      : getQuizFeedbackText(question, correct, selectedOption);
  }

  revealQuizAnswer(question, selectedOptionOrIndex, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? "결과 확인" : "다음 문제 풀이",
    nextDisabled: false,
    nextHidden: false,
    restartHidden: false
  });

  updateStudyStreak();
  saveState();
  renderStats();
  renderQuizMistakes();
}

function handleQuizAnswer(question, option) {
  const selectedIndex = Number.isFinite(option) ? option : question.options.indexOf(option);
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || quizSessions.quiz.isPaused) {
    return;
  }

  const correctAnswer = question.options.indexOf(question.answer);
  finalizeQuizQuestion(question, selectedIndex, selectedIndex === correctAnswer);
}

function handleQuizTimeout() {
  const question = getQuizQuestion();
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || !question) {
    return;
  }

  finalizeQuizQuestion(question, -1, false);
}

function nextQuiz() {
  const options = document.querySelectorAll(".quiz-option");
  const answered = hasAnsweredAllChoiceOptions(options);
  const feedback = document.getElementById("quiz-feedback");

  if (state.quizSessionFinished) {
    startNewQuizSession();
    return;
  }

  if (!answered) {
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 넘어가요.";
    }
    return;
  }

  if (state.quizIndex >= activeQuizQuestions.length - 1) {
    state.quizSessionFinished = true;
    saveState();
    renderQuiz();
    return;
  }

  state.quizIndex += 1;
  saveState();
  renderQuiz();
}

function clearQuizMistakes() {
  state.quizMistakes = [];
  state.quizSessionMistakeIds = [];
  saveState();
  renderQuizMistakes();
}

function getReadingOptionsSummaryText() {
  return [
    getLevelSummaryLabel(getReadingLevel()),
    formatQuestionCountLabel(getReadingCount()),
    getDurationLabel(getReadingDuration())
  ].join(" · ");
}

function setReadingLevel(level) {
  const nextLevel = getReadingLevel(level);

  if (state.readingLevel === nextLevel) {
    return;
  }

  state.readingLevel = nextLevel;
  invalidateReadingPracticeSession();
  saveState();
  renderReadingPractice();
}

function setReadingDuration(duration) {
  const nextDuration = getReadingDuration(duration);

  if (state.readingDuration === nextDuration) {
    return;
  }

  state.readingDuration = nextDuration;
  saveState();
  renderReadingPractice();
}

function invalidateReadingPracticeSession() {
  resetReadingPracticeSessionState();
}

function resetReadingPracticeSessionState() {
  activeReadingPracticeQuestions = [];
  readingPracticeState.results = [];
  readingPracticeState.showResults = false;
  readingPracticeState.resultFilter = "all";
  state.readingStarted = false;
  state.readingSessionQuestionIndex = 0;
  resetQuizSessionScore("reading");
  setQuizSessionDuration("reading", getReadingDuration());
  stopQuizSessionTimer("reading");
}

function renderReadingControls() {
  const optionsShell = document.getElementById("reading-options-shell");
  const optionsToggle = document.getElementById("reading-options-toggle");
  const optionsPanel = document.getElementById("reading-options-panel");
  const optionsSummary = document.getElementById("reading-options-summary");
  const levelSelect = document.getElementById("reading-level-select");
  const countSpinner = document.querySelector('[data-spinner-id="reading-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="reading-time"]');
  const startButton = document.getElementById("reading-start");
  const startLabel = document.getElementById("reading-start-label");
  const activeLevel = getReadingLevel(state.readingLevel);
  const activeCount = getReadingCount(state.readingCount);
  const activeDuration = getReadingDuration(state.readingDuration);
  const isOptionsOpen = state.readingOptionsOpen === true;
  const canStart = (readingSets[activeLevel] || []).length > 0;
  const isSettingsLocked = state.readingStarted;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getReadingOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: readingCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: readingDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateContentLevelSelect(element, activeLevel, { includeAll: true })
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.readingStarted || readingPracticeState.showResults,
      canStart: state.readingStarted || readingPracticeState.showResults || canStart
    }
  });
}

function buildReadingPracticeQuestionSet(level = state?.readingLevel, count = state?.readingCount) {
  const activeLevel = getReadingLevel(level);
  const sets = readingSets[activeLevel] || [];
  const questionCount = getReadingCount(count);
  const startIndex = getPracticeLevelIndex(state.readingIndexes, activeLevel);

  return buildFixedPracticeSessionItems(sets, questionCount, startIndex, true);
}

function startNewReadingPracticeSession() {
  const activeLevel = getReadingLevel(state.readingLevel);

  resetReadingPracticeSessionState();
  state.readingLevel = activeLevel;
  activeReadingPracticeQuestions = buildReadingPracticeQuestionSet(activeLevel, state.readingCount);

  if (!activeReadingPracticeQuestions.length) {
    state.readingStarted = false;
    return false;
  }

  state.readingStarted = true;
  return true;
}

function ensureReadingPracticeSession(force = false) {
  if (!state.readingStarted) {
    return false;
  }

  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (
    force ||
    !activeReadingPracticeQuestions.length ||
    currentSessionIndex < 0 ||
    currentSessionIndex >= activeReadingPracticeQuestions.length
  ) {
    const started = startNewReadingPracticeSession();
    saveState();
    return started;
  }

  return true;
}

function getCurrentReadingSet() {
  const currentIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  return activeReadingPracticeQuestions[currentIndex] || activeReadingPracticeQuestions[0] || null;
}

function getReadingPracticeResultFilter(value = readingPracticeState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(readingPracticeResultFilterLabels, value) ? value : "all";
}

function getReadingPracticeResultCounts() {
  return getStudyResultCounts(readingPracticeState.results);
}

function getFilteredReadingPracticeResults(filter = getReadingPracticeResultFilter(readingPracticeState.resultFilter)) {
  return getFilteredStudyResults(readingPracticeState.results, getReadingPracticeResultFilter(filter));
}

function setReadingPracticeResult(current, selectedIndex, correct, timedOut = false) {
  // 독해는 문제 수가 지문 수보다 많을 수 있어 같은 지문이 다시 나와도 세션 결과를 덮어쓰지 않게 한다.
  const resultId = `${current.id || "reading"}-${state.readingSessionQuestionIndex}`;
  const answerText = current.options[current.answer] || "";
  const selected = timedOut ? "" : current.options[selectedIndex] || "";
  const result = {
    id: resultId,
    source: current.source || `${getReadingLevel(state.readingLevel)} 독해`,
    title: current.title || "",
    question: current.question || "",
    explanation: current.explanation || "",
    answerText,
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const currentResultIndex = readingPracticeState.results.findIndex((item) => item.id === resultId);

  if (currentResultIndex >= 0) {
    readingPracticeState.results[currentResultIndex] = result;
    return;
  }

  readingPracticeState.results.push(result);
}

function getReadingPracticeResultDetail(item) {
  const parts = [];

  if (item.question) {
    parts.push(softenVisibleKoreanCopy(item.question));
  }

  if (item.status === "wrong") {
    if (item.timedOut) {
      parts.push("시간 초과");
    } else {
      parts.push(`선택 ${softenVisibleKoreanCopy(item.selected || "미응답")}`);
    }
    parts.push(`정답 ${softenVisibleKoreanCopy(item.answerText)}`);
  }

  if (item.explanation) {
    parts.push(softenExplanationCopy(item.explanation));
  }

  return parts.join(" · ");
}

function renderReadingPracticeResults() {
  const counts = getReadingPracticeResultCounts();
  const filteredResults = getFilteredReadingPracticeResults();

  renderSharedStudyResults({
    resultViewId: "reading-practice-result-view",
    totalId: "reading-practice-result-total",
    correctId: "reading-practice-result-correct",
    wrongId: "reading-practice-result-wrong",
    emptyId: "reading-practice-result-empty",
    listId: "reading-practice-result-list",
    counts,
    filteredResults,
    activeFilter: getReadingPracticeResultFilter(readingPracticeState.resultFilter),
    filterLabels: readingPracticeResultFilterLabels,
    getEmptyText: ({ activeFilter }) => getStudyPracticeResultEmptyMessage(activeFilter),
    renderItems: (results, container) => {
      results.forEach((item) => {
        sharedResultUi.appendResultItem({
          container,
          status: item.status,
          levelText: item.source || "독해",
          titleText: item.title || item.question || "-",
          descriptionText: getReadingPracticeResultDetail(item)
        });
      });
    }
  });
}

function renderReadingPractice() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  const empty = document.getElementById("reading-empty");
  const practiceView = document.getElementById("reading-practice-view");
  const resultView = document.getElementById("reading-practice-result-view");
  const readingCard = document.querySelector(".reading-card");
  const passage = document.getElementById("reading-passage");
  const optionsContainer = document.getElementById("reading-options");
  const nextButton = document.getElementById("reading-next");
  const progress = document.getElementById("reading-progress");
  const question = document.getElementById("reading-question");
  const feedback = document.getElementById("reading-feedback");
  const explanation = document.getElementById("reading-explanation");
  state.readingLevel = getReadingLevel(state.readingLevel);
  state.readingDuration = getReadingDuration(state.readingDuration);
  renderReadingControls();
  const sets = readingSets[state.readingLevel] || [];
  const activeCount = state.readingStarted ? activeReadingPracticeQuestions.length : getReadingCount(state.readingCount);
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (
    !empty ||
    !practiceView ||
    !resultView ||
    !readingCard ||
    !passage ||
    !optionsContainer ||
    !nextButton ||
    !progress ||
    !question ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  if (readingPracticeState.showResults) {
    stopQuizSessionTimer("reading");
    renderQuizSessionHud("reading");
    empty.hidden = true;
    practiceView.hidden = true;
    resultView.hidden = false;
    renderReadingPracticeResults();
    return;
  }

  if (!state.readingStarted) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = sets.length
      ? "준비됐다면 시작해볼까요?"
      : "아직 보여줄 독해가 없어요. 다른 레벨로 바꿔보세요.";
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  if (!ensureReadingPracticeSession()) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = "아직 보여줄 독해가 없어요. 다른 레벨로 바꿔보세요.";
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  const current = getCurrentReadingSet();
  const questionCount = activeReadingPracticeQuestions.length;

  if (currentSessionIndex >= activeCount) {
    readingPracticeState.showResults = true;
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  if (!current || !questionCount) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = "아직 보여줄 독해가 없어요. 다른 레벨로 바꿔보세요.";
    practiceView.hidden = true;
    resultView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  empty.hidden = true;
  practiceView.hidden = false;
  resultView.hidden = true;

  progress.textContent = `${currentSessionIndex + 1} / ${questionCount}`;
  question.textContent = softenVisibleKoreanCopy(current.question);
  feedback.textContent = "";
  explanation.textContent = "";
  nextButton.textContent = currentSessionIndex >= questionCount - 1 ? "결과 보기" : "다음 글 보기";
  nextButton.disabled = true;
  delete optionsContainer.dataset.answered;

  readingCard.className = `reading-card ${current.tone}`;

  passage.className = `reading-passage${current.passageStyle === "note" ? " is-note" : ""}`;
  passage.innerHTML = current.passage.map((line) => `<p>${line}</p>`).join("");

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "reading-option",
    formatText: softenVisibleKoreanCopy,
    onSelect: handleReadingAnswer,
    setPressedState: true
  });

  setQuizSessionDuration("reading", state.readingDuration);
  resetQuizSessionTimer("reading", handleReadingTimeout);
}

function handleReadingAnswer(index) {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = activeReadingPracticeQuestions.length;
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered || quizSessions.reading.isPaused) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("reading", correct);
  setReadingPracticeResult(current, index, correct, false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    markSelected: true,
    setPressedState: true
  });

  document.getElementById("reading-feedback").textContent = correct
    ? ""
    : "";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 글 보기";
    nextButton.disabled = false;
  }
  const optionsContainer = document.getElementById("reading-options");

  if (optionsContainer) {
    optionsContainer.dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleReadingTimeout() {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = activeReadingPracticeQuestions.length;
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("reading", false);
  setReadingPracticeResult(current, -1, false, true);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    markSelected: true,
    setPressedState: true
  });

  document.getElementById("reading-feedback").textContent = "";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 글 보기";
    nextButton.disabled = false;
  }
  if (document.getElementById("reading-options")) {
    document.getElementById("reading-options").dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextReadingSet() {
  const nextButton = document.getElementById("reading-next");
  const activeLevel = getReadingLevel(state.readingLevel);
  const sets = readingSets[activeLevel] || [];
  const questionLimit = activeReadingPracticeQuestions.length;
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (!sets.length || !nextButton || nextButton.disabled) {
    return;
  }

  if (currentSessionIndex >= questionLimit - 1) {
    readingPracticeState.showResults = true;
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  state.readingLevel = activeLevel;
  state.readingSessionQuestionIndex = currentSessionIndex + 1;
  state.readingIndexes[activeLevel] = (state.readingIndexes[activeLevel] + 1) % sets.length;
  saveState();
  renderReadingPractice();
}

function restartReadingPractice() {
  if (state.readingStarted) {
    invalidateReadingPracticeSession();
    saveState();
    renderReadingPractice();
    return;
  }

  startNewReadingPracticeSession();
  saveState();
  renderReadingPractice();
}

function renderStats() {
  const accuracy = state.quizAnsweredCount
    ? Math.round((state.quizCorrectCount / state.quizAnsweredCount) * 100)
    : 0;
  const streak = document.getElementById("streak-value");
  const mastered = document.getElementById("mastered-count");
  const grammar = document.getElementById("grammar-count");
  const quiz = document.getElementById("quiz-accuracy");

  if (streak) {
    streak.textContent = `${state.streak}일`;
  }
  if (mastered) {
    mastered.textContent = `${state.masteredIds.length}개`;
  }
  if (grammar) {
    grammar.textContent = `${state.grammarMasteredIds.length}개`;
  }
  if (quiz) {
    quiz.textContent = `${accuracy}%`;
  }
}

function attachStudyFlashcardListeners({
  toggle,
  prev,
  next,
  review,
  mastered,
  onToggle,
  onMove,
  onReview,
  onMastered
}) {
  attachClickListener(toggle, onToggle);
  attachClickListener(prev, () => onMove(-1));
  attachClickListener(next, () => onMove(1));
  attachClickListener(review, onReview);
  attachClickListener(mastered, onMastered);
}

function attachStudyPaginationListeners({ prev, next, getPage, setPage, getPageCount, render }) {
  attachClickListener(prev, () => {
    if (getPage() <= 1) {
      return;
    }

    setPage(getPage() - 1);
    saveState();
    render();
  });

  attachClickListener(next, () => {
    const pageCount = getPageCount();

    if (getPage() >= pageCount) {
      return;
    }

    setPage(getPage() + 1);
    saveState();
    render();
  });
}

function attachStudyStatusListListeners({
  list,
  reviewSelector,
  masteredSelector,
  getReviewId,
  getMasteredId,
  toggleReview,
  toggleMastered,
  shouldUpdateStudyStreak = true,
  render
}) {
  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const reviewButton = event.target.closest(reviewSelector);
    const masteredButton = event.target.closest(masteredSelector);

    if (!reviewButton && !masteredButton) {
      return;
    }

    if (reviewButton) {
      toggleReview(getReviewId(reviewButton));
    } else if (masteredButton) {
      toggleMastered(getMasteredId(masteredButton));
    }

    if (shouldUpdateStudyStreak) {
      updateStudyStreak();
    }

    saveState();
    render();
  });
}

function attachStudyListStatusIconListeners({ list, kind, render }) {
  if (!list) {
    return;
  }

  const statusConfigMap = {
    vocab: {
      selector: "[data-vocab-cycle]",
      getId: (button) => button.dataset.vocabWordId,
      getStatus: getWordVocabStatus,
      setStatus: setWordVocabStatus
    },
    kanji: {
      selector: "[data-kanji-cycle]",
      getId: (button) => button.dataset.kanjiListId,
      getStatus: getKanjiListStatus,
      setStatus: setKanjiListStatus
    },
    grammar: {
      selector: "[data-grammar-cycle]",
      getId: (button) => button.dataset.grammarListId,
      getStatus: getGrammarListStatus,
      setStatus: setGrammarListStatus
    }
  };
  const statusConfig = statusConfigMap[kind] || statusConfigMap.vocab;

  list.addEventListener("click", (event) => {
    const button = event.target.closest(statusConfig.selector);
    if (!button || !list.contains(button)) {
      return;
    }

    const id = statusConfig.getId(button);
    if (!id) {
      return;
    }

    const nextStatus = getNextStudyListStatus(statusConfig.getStatus(id));
    statusConfig.setStatus(id, nextStatus);
    showJapanoteToast(getStudyListStatusCycleMessage(nextStatus));
    updateStudyStreak();
    saveState();
    render();
  });
}

function attachVocabListStatusIconListeners({ list, render }) {
  return attachStudyListStatusIconListeners({ list, kind: "vocab", render });
}

function attachKanjiListStatusIconListeners({ list, render }) {
  return attachStudyListStatusIconListeners({ list, kind: "kanji", render });
}

function attachGrammarListStatusIconListeners({ list, render }) {
  return attachStudyListStatusIconListeners({ list, kind: "grammar", render });
}

function attachStudyCatalogListeners({
  optionsToggle,
  optionsStateKey,
  renderOptions,
  viewButtons,
  getViewValue,
  setView,
  flashcardListeners,
  paginationListeners,
  statusListListeners,
  selectListeners = []
}) {
  if (optionsToggle && optionsStateKey && typeof renderOptions === "function") {
    attachStateOptionsToggle(optionsToggle, optionsStateKey, renderOptions);
  }

  if (viewButtons && typeof getViewValue === "function" && typeof setView === "function") {
    attachValueButtonListeners(viewButtons, getViewValue, setView);
  }

  if (flashcardListeners) {
    attachStudyFlashcardListeners(flashcardListeners);
  }

  if (paginationListeners) {
    attachStudyPaginationListeners(paginationListeners);
  }

  if (statusListListeners) {
    attachStudyStatusListListeners(statusListListeners);
  }

  selectListeners.forEach(({ element, handler }) => {
    attachSelectValueListener(element, handler);
  });
}

function attachVocabStudyListeners({
  flashcardToggle,
  flashcardPrev,
  flashcardNext,
  flashcardAgain,
  flashcardMastered,
  vocabList,
  vocabTabButtons,
  vocabViewButtons,
  vocabLevelSelect,
  vocabFilterSelect,
  vocabPartSelect,
  vocabPagePrev,
  vocabPageNext
}) {
  attachStudyCatalogListeners({
    viewButtons: vocabViewButtons,
    getViewValue: (button) => button.dataset.vocabView,
    setView: setVocabView,
    flashcardListeners: {
      toggle: flashcardToggle,
      prev: flashcardPrev,
      next: flashcardNext,
      review: flashcardAgain,
      mastered: flashcardMastered,
      onToggle: toggleFlashcardReveal,
      onMove: moveFlashcard,
      onReview: markFlashcardForReview,
      onMastered: markFlashcardMastered
    },
    paginationListeners: {
      prev: vocabPagePrev,
      next: vocabPageNext,
      getPage: () => state.vocabPage,
      setPage: (page) => {
        state.vocabPage = page;
      },
      getPageCount: () => getVocabPageCount(getVisibleVocabList()),
      render: renderVocabPage
    },
    selectListeners: [
      { element: vocabLevelSelect, handler: setVocabLevel },
      { element: vocabFilterSelect, handler: setVocabFilter },
      { element: vocabPartSelect, handler: setVocabPartFilter }
    ]
  });
  attachVocabListStatusIconListeners({ list: vocabList, render: renderAll });
  attachValueButtonListeners(vocabTabButtons, (button) => button.dataset.vocabTab, setVocabTab);
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

function attachEventListeners() {
  const flashcardToggle = document.getElementById("flashcard-toggle");
  const flashcardPrev = document.getElementById("flashcard-prev");
  const flashcardNext = document.getElementById("flashcard-next");
  const flashcardAgain = document.getElementById("flashcard-again");
  const flashcardMastered = document.getElementById("flashcard-mastered");
  const vocabTabButtons = document.querySelectorAll("[data-vocab-tab]");
  const vocabViewButtons = document.querySelectorAll("[data-vocab-view]");
  const vocabLevelSelect = document.getElementById("vocab-level-select");
  const vocabFilterSelect = document.getElementById("vocab-filter-select");
  const vocabPartSelect = document.getElementById("vocab-part-select");
  const vocabList = document.getElementById("vocab-list");
  const vocabPagePrev = document.getElementById("vocab-page-prev");
  const vocabPageNext = document.getElementById("vocab-page-next");
  const vocabQuizOptionsToggle = document.getElementById("vocab-quiz-options-toggle");
  const vocabQuizQuestionField = document.getElementById("vocab-quiz-question-field");
  const vocabQuizOptionField = document.getElementById("vocab-quiz-option-field");
  const vocabQuizCountSpinner = document.querySelector('[data-spinner-id="vocab-quiz-count"]');
  const vocabQuizTimeSpinner = document.querySelector('[data-spinner-id="vocab-quiz-time"]');
  const vocabQuizLevelSelect = document.getElementById("vocab-quiz-level-select");
  const vocabQuizFilterSelect = document.getElementById("vocab-quiz-filter-select");
  const vocabQuizPartSelect = document.getElementById("vocab-quiz-part-select");
  const vocabQuizResultFilter = document.querySelectorAll("#vocab-quiz-result-view [data-result-filter]");
  const vocabQuizResultBulkAction = document.getElementById("vocab-quiz-result-bulk-action");
  const vocabQuizResultMasteredAction = document.getElementById("vocab-quiz-result-mastered-action");
  const vocabQuizResultList = document.getElementById("vocab-quiz-result-list");
  const vocabQuizNext = document.getElementById("vocab-quiz-next");
  const vocabQuizRestart = document.getElementById("vocab-quiz-restart");
  const quizNext = document.getElementById("quiz-next");
  const quizRestart = document.getElementById("quiz-restart");
  const quizClearMistakes = document.getElementById("quiz-clear-mistakes");
  const quizOptionsToggle = document.getElementById("quiz-options-toggle");
  const quizLevelButtons = document.querySelectorAll("[data-quiz-level]");
  const quizSizeButtons = document.querySelectorAll("[data-quiz-size]");
  const quizModeButtons = document.querySelectorAll("[data-quiz-mode]");
  const quizTimeButtons = document.querySelectorAll("[data-quiz-time]");
  const grammarPracticeOptionsToggle = document.getElementById("grammar-practice-options-toggle");
  const grammarPracticeLevelSelect = document.getElementById("grammar-practice-level-select");
  const grammarPracticeFilterSelect = document.getElementById("grammar-practice-filter-select");
  const grammarPracticeCountSpinner = document.querySelector('[data-spinner-id="grammar-practice-count"]');
  const grammarPracticeTimeSpinner = document.querySelector('[data-spinner-id="grammar-practice-time"]');
  const grammarPracticeStart = document.getElementById("grammar-practice-start");
  const grammarPracticeResultBulkAction = document.getElementById("grammar-practice-result-bulk-action");
  const grammarPracticeResultMasteredAction = document.getElementById("grammar-practice-result-mastered-action");
  const grammarPracticeResultFilter = document.querySelectorAll("#grammar-practice-result-view [data-result-filter]");
  const grammarPracticeResultList = document.getElementById("grammar-practice-result-list");
  const grammarViewButtons = document.querySelectorAll("[data-grammar-view]");
  const grammarLevelSelect = document.getElementById("grammar-level-select");
  const grammarFilterSelect = document.getElementById("grammar-filter-select");
  const grammarList = document.getElementById("grammar-list");
  const grammarPagePrev = document.getElementById("grammar-page-prev");
  const grammarPageNext = document.getElementById("grammar-page-next");
  const grammarFlashcardToggle = document.getElementById("grammar-flashcard-toggle");
  const grammarFlashcardPrev = document.getElementById("grammar-flashcard-prev");
  const grammarFlashcardNext = document.getElementById("grammar-flashcard-next");
  const grammarFlashcardReview = document.getElementById("grammar-flashcard-review");
  const grammarFlashcardMastered = document.getElementById("grammar-flashcard-mastered");
  const readingOptionsToggle = document.getElementById("reading-options-toggle");
  const readingLevelSelect = document.getElementById("reading-level-select");
  const readingCountSpinner = document.querySelector('[data-spinner-id="reading-count"]');
  const readingTimeSpinner = document.querySelector('[data-spinner-id="reading-time"]');
  const readingStart = document.getElementById("reading-start");
  const readingPracticeResultFilter = document.querySelectorAll("#reading-practice-result-view [data-result-filter]");
  const readingNext = document.getElementById("reading-next");
  const basicPracticeNext = document.getElementById("basic-practice-next");
  const kanjiList = document.getElementById("kanji-list");
  const kanjiOptionsToggle = document.getElementById("kanji-options-toggle");
  const kanjiGradeButtons = document.querySelectorAll("[data-kanji-grade-option]");
  const kanjiViewButtons = document.querySelectorAll("[data-kanji-view]");
  const kanjiCollectionSelect = document.getElementById("kanji-collection-select");
  const kanjiGradeSelect = document.getElementById("kanji-grade-select");
  const kanjiPagePrev = document.getElementById("kanji-page-prev");
  const kanjiPageNext = document.getElementById("kanji-page-next");
  const kanjiFlashcardToggle = document.getElementById("kanji-flashcard-toggle");
  const kanjiFlashcardPrev = document.getElementById("kanji-flashcard-prev");
  const kanjiFlashcardNext = document.getElementById("kanji-flashcard-next");
  const kanjiFlashcardReview = document.getElementById("kanji-flashcard-review");
  const kanjiFlashcardMastered = document.getElementById("kanji-flashcard-mastered");
  const kanjiPracticeOptionsToggle = document.getElementById("kanji-practice-options-toggle");
  const kanjiPracticeQuestionField = document.getElementById("kanji-practice-question-field");
  const kanjiPracticeOptionField = document.getElementById("kanji-practice-option-field");
  const kanjiPracticeCollectionSelect = document.getElementById("kanji-practice-collection-select");
  const kanjiPracticeGradeSelect = document.getElementById("kanji-practice-grade-select");
  const kanjiPracticeStart = document.getElementById("kanji-practice-start");
  const kanjiPracticeCountSpinner = document.querySelector('[data-spinner-id="kanji-practice-count"]');
  const kanjiPracticeTimeSpinner = document.querySelector('[data-spinner-id="kanji-practice-time"]');
  const kanjiPracticeNext = document.getElementById("kanji-practice-next");
  const kanjiPracticeRestart = document.getElementById("kanji-practice-restart");
  const kanjiPracticeResultBulkAction = document.getElementById("kanji-practice-result-bulk-action");
  const kanjiPracticeResultMasteredAction = document.getElementById("kanji-practice-result-mastered-action");
  const kanjiPracticeResultFilter = document.querySelectorAll("#kanji-practice-result-view [data-result-filter]");
  const kanjiPracticeResultList = document.getElementById("kanji-practice-result-list");
  const kanjiTabButtons = document.querySelectorAll("[data-kanji-tab]");
  const grammarPracticeNext = document.getElementById("grammar-practice-next");
  const kanaQuizNext = document.getElementById("kana-quiz-next");
  const kanaQuizRestart = document.getElementById("kana-quiz-restart");
  const kanaQuizResultFilter = document.querySelectorAll("#kana-quiz-result-view [data-result-filter]");
  const kanaSetupToggle = document.getElementById("kana-setup-toggle");
  const kanaModeButtons = document.querySelectorAll("[data-kana-mode]");
  const kanaCountSpinner = document.querySelector('[data-spinner-id="kana-quiz-count"]');
  const kanaTimeSpinner = document.querySelector('[data-spinner-id="kana-quiz-time"]');
  const kanaSetupStart = document.getElementById("kana-setup-start");
  const charactersTabButtons = document.querySelectorAll("[data-characters-tab]");
  const charactersLibraryTabButtons = document.querySelectorAll("[data-characters-library-tab]");
  const grammarTabButtons = document.querySelectorAll("[data-grammar-tab]");
  const writingSetupToggle = document.getElementById("writing-setup-toggle");
  const writingModeButtons = document.querySelectorAll("[data-writing-mode]");
  const writingOrderButtons = document.querySelectorAll("[data-writing-order]");
  const writingReplay = document.getElementById("writing-practice-replay");
  const writingGuideToggle = document.getElementById("writing-guide-toggle");
  const writingRevealToggle = document.getElementById("writing-practice-reveal");
  const writingPrev = document.getElementById("writing-practice-prev");
  const writingClear = document.getElementById("writing-practice-clear");
  const writingScore = document.getElementById("writing-practice-score-btn");
  const writingNext = document.getElementById("writing-practice-next");
  const writingCanvas = document.getElementById("writing-overlay-canvas");

  attachVocabStudyListeners({
    flashcardToggle,
    flashcardPrev,
    flashcardNext,
    flashcardAgain,
    flashcardMastered,
    vocabList,
    vocabTabButtons,
    vocabViewButtons,
    vocabLevelSelect,
    vocabFilterSelect,
    vocabPartSelect,
    vocabPagePrev,
    vocabPageNext
  });
  attachStateOptionsToggle(vocabQuizOptionsToggle, "vocabQuizOptionsOpen", renderVocabPage);
  attachLinkedFieldSelectors({
    questionSelect: vocabQuizQuestionField,
    optionSelect: vocabQuizOptionField,
    getQuestionField: getVocabQuizQuestionField,
    getOptionField: getVocabQuizOptionField,
    normalizeQuestionField: getVocabQuizQuestionField,
    normalizeOptionField: (value, previousOptionField) => getVocabQuizField(value, previousOptionField),
    normalizeStoredQuestionField: getVocabQuizQuestionField,
    normalizeStoredOptionField: getVocabQuizOptionField,
    getDefaultOptionField: getDefaultVocabQuizOptionField,
    getDefaultQuestionField: getDefaultVocabQuizQuestionField,
    questionStateKey: "vocabQuizQuestionField",
    optionStateKey: "vocabQuizOptionField",
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  attachStateSpinner({
    spinner: vocabQuizCountSpinner,
    options: vocabQuizCountOptions,
    getCurrentValue: () => state.vocabQuizCount,
    setValue: (value) => {
      state.vocabQuizCount = value;
    },
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  attachStateSpinner({
    spinner: vocabQuizTimeSpinner,
    options: quizDurationOptions,
    getCurrentValue: () => state.vocabQuizDuration,
    setValue: (value) => {
      state.vocabQuizDuration = value;
    },
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  attachSelectValueListener(vocabQuizLevelSelect, setVocabLevel);
  attachSelectValueListener(vocabQuizFilterSelect, setVocabFilter);
  attachSelectValueListener(vocabQuizPartSelect, setVocabPartFilter);
  attachResultFilterButtonListeners({
    buttons: vocabQuizResultFilter,
    getNextValue: getVocabQuizResultFilter,
    getCurrentValue: getVocabQuizResultFilter,
    setValue: (value) => {
      state.vocabQuizResultFilter = value;
    },
    shouldSaveState: true,
    render: renderVocabQuizResults
  });
  attachBulkResultActionListener({
    button: vocabQuizResultBulkAction,
    getResults: getFilteredVocabQuizResults,
    datasetKey: "vocabQuizBulkAction",
    removeItem: removeWordFromReviewList,
    saveItem: saveWordToReviewList,
    render: renderVocabPage
  });
  attachBulkResultActionListener({
    button: vocabQuizResultMasteredAction,
    getResults: getFilteredVocabQuizResults,
    datasetKey: "vocabQuizMasteredBulkAction",
    removeActionValue: "remove-mastered",
    removeItem: removeWordFromMasteredList,
    saveItem: saveWordToMasteredList,
    render: renderVocabPage
  });
  attachToggleResultActionListener({
    list: vocabQuizResultList,
    actions: [
      {
        selector: "[data-vocab-quiz-review]",
        getId: (button) => button.dataset.vocabQuizReview,
        isSelected: isWordSavedToReviewList,
        selectItem: saveWordToReviewList,
        unselectItem: removeWordFromReviewList
      },
      {
        selector: "[data-vocab-quiz-mastered]",
        getId: (button) => button.dataset.vocabQuizMastered,
        isSelected: isWordSavedToMasteredList,
        selectItem: saveWordToMasteredList,
        unselectItem: removeWordFromMasteredList
      }
    ],
    render: renderVocabPage
  });
  attachClickListener(vocabQuizNext, nextVocabQuizQuestion);
  attachClickListener(vocabQuizRestart, restartVocabQuiz);
  attachClickListener(quizNext, nextQuiz);
  attachClickListener(quizRestart, startNewQuizSession);
  attachClickListener(quizClearMistakes, clearQuizMistakes);
  attachStateOptionsToggle(quizOptionsToggle, "quizOptionsOpen", renderQuizControls);
  attachValueButtonListeners(quizLevelButtons, (button) => button.dataset.quizLevel, setQuizLevel);
  attachValueButtonListeners(quizSizeButtons, (button) => getQuizSessionSize(button.dataset.quizSize), (nextSize) => {
    if (state.quizSessionSize === nextSize) {
      return;
    }

    state.quizSessionSize = nextSize;
    startNewQuizSession();
  });
  attachValueButtonListeners(quizModeButtons, (button) => getQuizMode(button.dataset.quizMode), (nextMode) => {
    if (state.quizMode === nextMode) {
      return;
    }

    state.quizMode = nextMode;
    startNewQuizSession();
  });
  attachValueButtonListeners(quizTimeButtons, (button) => button.dataset.quizTime, setQuizDuration);
  attachGrammarStudyListeners({
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
  });
  attachStateOptionsToggle(grammarPracticeOptionsToggle, "grammarPracticeOptionsOpen", renderGrammarPracticeControls);
  attachSelectValueListener(grammarPracticeLevelSelect, setGrammarPracticeLevel);
  attachSelectValueListener(grammarPracticeFilterSelect, setGrammarFilter);
  attachStateSpinner({
    spinner: grammarPracticeCountSpinner,
    options: grammarPracticeCountOptions,
    getCurrentValue: () => state.grammarPracticeCount,
    setValue: (value) => {
      state.grammarPracticeCount = value;
    },
    invalidate: () => {
      invalidateGrammarPracticeSession();
    },
    render: renderGrammarPractice
  });
  attachStateSpinner({
    spinner: grammarPracticeTimeSpinner,
    options: grammarPracticeDurationOptions,
    getCurrentValue: () => state.grammarPracticeDuration,
    setValue: (value) => {
      state.grammarPracticeDuration = value;
    },
    invalidate: () => {
      setQuizSessionDuration("grammar", state.grammarPracticeDuration);
    },
    render: renderGrammarPractice
  });
  attachClickListener(grammarPracticeStart, restartGrammarPractice);
  attachBulkResultActionListener({
    button: grammarPracticeResultBulkAction,
    getResults: getFilteredGrammarPracticeResults,
    datasetKey: "grammarPracticeBulkAction",
    removeActionValue: "remove-review",
    removeItem: removeGrammarFromReviewList,
    saveItem: saveGrammarToReviewList,
    render: renderGrammarPractice
  });
  attachBulkResultActionListener({
    button: grammarPracticeResultMasteredAction,
    getResults: getFilteredGrammarPracticeResults,
    datasetKey: "grammarPracticeMasteredBulkAction",
    removeActionValue: "remove-mastered",
    removeItem: removeGrammarFromMasteredList,
    saveItem: saveGrammarToMasteredList,
    render: renderGrammarPractice
  });
  attachResultFilterButtonListeners({
    buttons: grammarPracticeResultFilter,
    getNextValue: getGrammarPracticeResultFilter,
    getCurrentValue: () => getGrammarPracticeResultFilter(grammarPracticeState.resultFilter),
    setValue: (value) => {
      grammarPracticeState.resultFilter = value;
    },
    render: renderGrammarPracticeResults
  });
  attachToggleResultActionListener({
    list: grammarPracticeResultList,
    actions: [
      {
        selector: "[data-grammar-practice-review]",
        getId: (button) => button.dataset.grammarPracticeReview,
        isSelected: isGrammarSavedToReviewList,
        selectItem: saveGrammarToReviewList,
        unselectItem: removeGrammarFromReviewList
      },
      {
        selector: "[data-grammar-practice-mastered]",
        getId: (button) => button.dataset.grammarPracticeMastered,
        isSelected: isGrammarSavedToMasteredList,
        selectItem: saveGrammarToMasteredList,
        unselectItem: removeGrammarFromMasteredList
      }
    ],
    render: renderGrammarPractice
  });
  attachStateOptionsToggle(readingOptionsToggle, "readingOptionsOpen", renderReadingControls);
  attachSelectValueListener(readingLevelSelect, setReadingLevel);
  attachStateSpinner({
    spinner: readingCountSpinner,
    options: readingCountOptions,
    getCurrentValue: () => state.readingCount,
    setValue: (value) => {
      state.readingCount = value;
    },
    invalidate: () => {
      invalidateReadingPracticeSession();
    },
    render: renderReadingPractice
  });
  attachStateSpinner({
    spinner: readingTimeSpinner,
    options: readingDurationOptions,
    getCurrentValue: () => state.readingDuration,
    setValue: (value) => {
      state.readingDuration = value;
    },
    invalidate: () => {
      setQuizSessionDuration("reading", state.readingDuration);
    },
    render: renderReadingPractice
  });
  attachClickListener(readingStart, restartReadingPractice);
  attachResultFilterButtonListeners({
    buttons: readingPracticeResultFilter,
    getNextValue: getReadingPracticeResultFilter,
    getCurrentValue: () => getReadingPracticeResultFilter(readingPracticeState.resultFilter),
    setValue: (value) => {
      readingPracticeState.resultFilter = value;
    },
    render: renderReadingPracticeResults
  });
  attachClickListener(readingNext, nextReadingSet);
  attachClickListener(basicPracticeNext, nextBasicPracticeSet);
  attachKanjiStudyListeners({
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
  });
  attachStateOptionsToggle(kanjiPracticeOptionsToggle, "kanjiPracticeQuizOptionsOpen", renderKanjiPracticeControls);
  attachLinkedFieldSelectors({
    questionSelect: kanjiPracticeQuestionField,
    optionSelect: kanjiPracticeOptionField,
    getQuestionField: getKanjiPracticeQuestionField,
    getOptionField: getKanjiPracticeOptionField,
    normalizeQuestionField: getKanjiPracticeQuestionField,
    normalizeOptionField: (value, previousOptionField) => getKanjiPracticeQuizField(value, previousOptionField),
    normalizeStoredQuestionField: getKanjiPracticeQuestionField,
    normalizeStoredOptionField: getKanjiPracticeOptionField,
    getDefaultOptionField: getDefaultKanjiPracticeOptionField,
    getDefaultQuestionField: getDefaultKanjiPracticeQuestionField,
    questionStateKey: "kanjiPracticeQuestionField",
    optionStateKey: "kanjiPracticeOptionField",
    invalidate: invalidateKanjiPracticeSession,
    render: renderKanjiPageLayout
  });
  attachSelectValueListener(kanjiPracticeCollectionSelect, setKanjiCollectionFilter);
  attachSelectValueListener(kanjiPracticeGradeSelect, setKanjiGrade);
  attachClickListener(kanjiPracticeStart, () => {
    if (state.kanjiPracticeQuizStarted) {
      invalidateKanjiPracticeSession();
      saveState();
      renderKanjiPageLayout();
      return;
    }

    if (!startNewKanjiPracticeSession()) {
      renderKanjiPageLayout();
      return;
    }

    saveState();
    renderKanjiPageLayout();
    scrollToElementById("kanji-practice-card");
  });
  attachStateSpinner({
    spinner: kanjiPracticeCountSpinner,
    options: kanjiPracticeQuizCountOptions,
    getCurrentValue: () => state.kanjiPracticeQuizCount,
    setValue: (value) => {
      state.kanjiPracticeQuizCount = value;
    },
    invalidate: invalidateKanjiPracticeSession,
    render: renderKanjiPageLayout
  });
  attachStateSpinner({
    spinner: kanjiPracticeTimeSpinner,
    options: quizDurationOptions,
    getCurrentValue: () => state.kanjiPracticeQuizDuration,
    setValue: (value) => {
      state.kanjiPracticeQuizDuration = value;
    },
    invalidate: invalidateKanjiPracticeSession,
    render: renderKanjiPageLayout
  });
  attachClickListener(kanjiPracticeNext, nextKanjiPracticeSet);
  attachClickListener(kanjiPracticeRestart, restartKanjiPractice);
  attachBulkResultActionListener({
    button: kanjiPracticeResultBulkAction,
    getResults: getFilteredKanjiPracticeResults,
    datasetKey: "kanjiPracticeBulkAction",
    removeActionValue: "remove-review",
    removeItem: removeKanjiFromReviewList,
    saveItem: saveKanjiToReviewList,
    render: renderKanjiPageLayout
  });
  attachBulkResultActionListener({
    button: kanjiPracticeResultMasteredAction,
    getResults: getFilteredKanjiPracticeResults,
    datasetKey: "kanjiPracticeMasteredBulkAction",
    removeActionValue: "remove-mastered",
    removeItem: removeKanjiFromMasteredList,
    saveItem: saveKanjiToMasteredList,
    render: renderKanjiPageLayout
  });
  attachResultFilterButtonListeners({
    buttons: kanjiPracticeResultFilter,
    getNextValue: getKanjiPracticeResultFilter,
    getCurrentValue: () => getKanjiPracticeResultFilter(kanjiPracticeState.resultFilter),
    setValue: (value) => {
      kanjiPracticeState.resultFilter = value;
    },
    render: renderKanjiPracticeResults
  });
  attachToggleResultActionListener({
    list: kanjiPracticeResultList,
    actions: [
      {
        selector: "[data-kanji-result-review]",
        getId: (button) => button.dataset.kanjiResultReview,
        isSelected: isKanjiSavedToReviewList,
        selectItem: saveKanjiToReviewList,
        unselectItem: removeKanjiFromReviewList
      },
      {
        selector: "[data-kanji-result-mastered]",
        getId: (button) => button.dataset.kanjiResultMastered,
        isSelected: isKanjiSavedToMasteredList,
        selectItem: saveKanjiToMasteredList,
        unselectItem: removeKanjiFromMasteredList
      }
    ],
    render: renderKanjiPageLayout
  });
  attachValueButtonListeners(kanjiTabButtons, (button) => button.dataset.kanjiTab, setKanjiTab);
  attachClickListener(grammarPracticeNext, nextGrammarPracticeSet);
  attachClickListener(kanaQuizNext, nextKanaQuizSheetQuestion);
  attachStateOptionsToggle(kanaSetupToggle, "kanaSetupOpen", renderKanaQuizSetup);
  attachValueButtonListeners(kanaModeButtons, (button) => button.dataset.kanaMode || "hiragana", (nextMode) => {
    kanaQuizSettings.mode = nextMode;
    renderKanaQuizSetup();
  });
  attachStateSpinner({
    spinner: kanaCountSpinner,
    options: kanaQuizCountOptions,
    getCurrentValue: () => kanaQuizSettings.count,
    setValue: (nextValue) => {
      kanaQuizSettings.count = nextValue;
    },
    render: renderKanaQuizSetup
  });
  attachStateSpinner({
    spinner: kanaTimeSpinner,
    options: kanaQuizDurationOptions,
    getCurrentValue: () => kanaQuizSettings.duration,
    setValue: (nextValue) => {
      kanaQuizSettings.duration = nextValue;
    },
    render: renderKanaQuizSetup
  });
  attachClickListener(kanaSetupStart, () => {
    if (kanaQuizSheetState.open) {
      closeKanaQuizSheet();
      return;
    }

    startKanaQuizSession(kanaQuizSettings.mode);
  });
  attachClickListener(kanaQuizRestart, () => {
    startKanaQuizSession(kanaQuizSettings.mode);
  });
  Object.entries(quizSessions).forEach(([key, session]) => {
    attachClickListener(document.getElementById(session.pauseButtonElement), () => {
      toggleQuizSessionPause(key);
    });
  });
  attachResultFilterButtonListeners({
    buttons: kanaQuizResultFilter,
    getNextValue: getKanaQuizResultFilter,
    getCurrentValue: () => getKanaQuizResultFilter(kanaQuizSheetState.resultFilter),
    setValue: (value) => {
      kanaQuizSheetState.resultFilter = value;
    },
    render: renderKanaQuizResults
  });
  attachValueButtonListeners(
    charactersTabButtons,
    (button) => getCharactersTab(button.dataset.charactersTab),
    (nextTab) => updateSimpleStateAndRender("charactersTab", nextTab, renderCharactersPageLayout)
  );
  attachValueButtonListeners(
    charactersLibraryTabButtons,
    (button) => getCharactersLibraryTab(button.dataset.charactersLibraryTab),
    (nextTab) => updateSimpleStateAndRender("charactersLibraryTab", nextTab, renderCharactersPageLayout)
  );
  attachValueButtonListeners(
    grammarTabButtons,
    (button) => getGrammarTab(button.dataset.grammarTab),
    (nextTab) => updateSimpleStateAndRender("grammarTab", nextTab, renderGrammarPageLayout)
  );
  attachValueButtonListeners(writingModeButtons, (button) => button.dataset.writingMode || "hiragana", (nextMode) => {
    if (nextMode === writingPracticeSettings.mode) {
      return;
    }

    startWritingPracticeSession(nextMode);
  });
  attachStateOptionsToggle(writingSetupToggle, "writingSetupOpen", renderWritingPracticeSetup);
  attachValueButtonListeners(
    writingOrderButtons,
    (button) => getWritingPracticeOrder(button.dataset.writingOrder),
    (nextOrder) => {
      if (nextOrder === writingPracticeSettings.order) {
        return;
      }

      startWritingPracticeSession(writingPracticeSettings.mode, nextOrder);
    }
  );
  attachClickListener(writingReplay, replayWritingStrokeAnimation);
  attachClickListener(writingGuideToggle, toggleWritingGuide);
  attachClickListener(writingRevealToggle, toggleWritingAnswer);
  attachClickListener(writingPrev, previousWritingPracticeItem);
  attachClickListener(writingClear, () => {
    clearWritingPracticeCanvas(true);
  });
  attachClickListener(writingScore, scoreWritingPractice);
  attachClickListener(writingNext, nextWritingPracticeItem);
  if (writingCanvas) {
    writingCanvas.addEventListener("pointerdown", handleWritingPointerDown);
    writingCanvas.addEventListener("pointermove", handleWritingPointerMove);
    writingCanvas.addEventListener("pointerup", finishWritingPointer);
    writingCanvas.addEventListener("pointercancel", finishWritingPointer);
  }
  observeWritingPracticeLayout();
  window.addEventListener("resize", () => {
    if (!document.getElementById("writing-practice-shell") || getCharactersTab(state.charactersTab) !== "writing") {
      return;
    }

    scheduleWritingPracticeLayout(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && kanaQuizSheetState.open) {
      closeKanaQuizSheet();
    }
  });
}

function renderAll() {
  if (flushPendingExternalStudyStateIfIdle()) {
    return;
  }

  renderReadingPractice();
  renderKanjiPageLayout();
  renderKanaQuizSetup();
  renderKanaLibrary();
  renderWritingPractice();
  renderCharactersPageLayout();
  renderBasicPractice();
  renderKanaQuizSheet();
  renderQuizSessionHud("kana");
  renderVocabPage();
  renderGrammarPage();
  renderQuiz();
  renderStats();
}

const japanoteChallengeLinks = window.japanoteChallengeLinks;

function cloneChallengeSessionData(payload) {
  return JSON.parse(JSON.stringify(payload));
}

if (japanoteChallengeLinks && typeof japanoteChallengeLinks.registerProvider === "function") {
  japanoteChallengeLinks.registerProvider({
    resultViewId: "vocab-quiz-result-view",
    kind: "vocab-quiz",
    getTargetHash: () => "#quiz",
    getApplyMessage: () => "친구가 보낸 단어 퀴즈가 열렸어요.",
    createPayload: () => {
      if (!activeVocabQuizQuestions.length) {
        return null;
      }

      return {
        config: {
          level: getVocabLevel(),
          filter: getVocabFilter(),
          part: getVocabPartFilter(),
          questionField: getVocabQuizQuestionField(),
          optionField: getVocabQuizOptionField(),
          count: getVocabQuizCount(),
          duration: getVocabQuizDuration()
        },
        questions: cloneChallengeSessionData(activeVocabQuizQuestions)
      };
    },
    applyPayload: (payload) => {
      if (!Array.isArray(payload?.questions) || !payload.questions.length) {
        return false;
      }

      invalidateVocabQuizSession();
      state.vocabTab = "quiz";
      syncVocabLocationHash("quiz");
      state.vocabLevel = getVocabLevel(payload.config?.level);
      state.vocabFilter = getVocabFilter(payload.config?.filter);
      state.vocabPartFilter = getVocabPartFilter(payload.config?.part);
      state.vocabQuizQuestionField = getVocabQuizQuestionField(payload.config?.questionField);
      state.vocabQuizOptionField = getVocabQuizOptionField(
        payload.config?.optionField,
        state.vocabQuizQuestionField
      );
      state.vocabQuizCount = getVocabQuizCount(payload.config?.count);
      state.vocabQuizDuration = getVocabQuizDuration(payload.config?.duration);
      activeVocabQuizChallengePayload = cloneChallengeSessionData(payload);
      restoreChallengeVocabQuizSession();
      renderVocabPage();
      scrollToElementById("vocab-quiz-card");
      return true;
    }
  });

  japanoteChallengeLinks.registerProvider({
    resultViewId: "grammar-practice-result-view",
    kind: "grammar-practice",
    getApplyMessage: () => "친구가 보낸 문법 도전이 열렸어요.",
    createPayload: () => {
      if (!activeGrammarPracticeQuestions.length) {
        return null;
      }

      return {
        config: {
          level: getGrammarPracticeLevel(state.grammarPracticeLevel),
          filter: getGrammarFilter(state.grammarFilter),
          count: getGrammarPracticeCount(state.grammarPracticeCount),
          duration: getGrammarPracticeDuration(state.grammarPracticeDuration)
        },
        questions: cloneChallengeSessionData(activeGrammarPracticeQuestions)
      };
    },
    applyPayload: (payload) => {
      if (!Array.isArray(payload?.questions) || !payload.questions.length) {
        return false;
      }

      resetGrammarPracticeSessionState();
      state.grammarTab = "practice";
      state.grammarPracticeLevel = getGrammarPracticeLevel(payload.config?.level);
      state.grammarFilter = getGrammarFilter(payload.config?.filter);
      state.grammarPracticeCount = getGrammarPracticeCount(payload.config?.count);
      state.grammarPracticeDuration = getGrammarPracticeDuration(payload.config?.duration);
      activeGrammarPracticeQuestions = cloneChallengeSessionData(payload.questions);
      grammarPracticeState.results = [];
      grammarPracticeState.showResults = false;
      grammarPracticeState.resultFilter = "all";
      state.grammarPracticeStarted = true;
      state.grammarPracticeSessionQuestionIndex = 0;
      setQuizSessionDuration("grammar", state.grammarPracticeDuration);
      saveState();
      renderGrammarPageLayout();
      document.querySelector('[data-grammar-tab-panel="practice"]')?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return true;
    }
  });

  japanoteChallengeLinks.registerProvider({
    resultViewId: "kanji-practice-result-view",
    kind: "kanji-practice",
    getApplyMessage: () => "친구가 보낸 한자 도전이 열렸어요.",
    createPayload: () => {
      if (!activeKanjiPracticeQuestions.length) {
        return null;
      }

      return {
        config: {
          collectionFilter: getKanjiCollectionFilter(),
          grade: getKanjiGrade(),
          questionField: getKanjiPracticeQuestionField(),
          optionField: getKanjiPracticeOptionField(),
          count: getKanjiPracticeQuizCount(),
          duration: getKanjiPracticeQuizDuration()
        },
        questions: cloneChallengeSessionData(activeKanjiPracticeQuestions)
      };
    },
    applyPayload: (payload) => {
      if (!Array.isArray(payload?.questions) || !payload.questions.length) {
        return false;
      }

      resetKanjiPracticeSessionState(true);
      state.kanjiTab = "practice";
      state.kanjiCollectionFilter = getKanjiCollectionFilter(payload.config?.collectionFilter);
      state.kanjiGrade = getKanjiGrade(payload.config?.grade);
      state.kanjiPracticeQuestionField = getKanjiPracticeQuestionField(payload.config?.questionField);
      state.kanjiPracticeOptionField = getKanjiPracticeOptionField(
        payload.config?.optionField,
        state.kanjiPracticeQuestionField
      );
      state.kanjiPracticeQuizCount = getKanjiPracticeQuizCount(payload.config?.count);
      state.kanjiPracticeQuizDuration = getKanjiPracticeQuizDuration(payload.config?.duration);
      activeKanjiPracticeQuestions = cloneChallengeSessionData(payload.questions);
      kanjiPracticeState.results = [];
      kanjiPracticeState.showResults = false;
      kanjiPracticeState.resultFilter = "all";
      state.kanjiPracticeQuizStarted = true;
      state.kanjiPracticeQuizFinished = false;
      state.basicPracticeIndexes.kanji = 0;
      setQuizSessionDuration("kanjiPractice", state.kanjiPracticeQuizDuration);
      saveState();
      renderKanjiPageLayout();
      document.querySelector('[data-kanji-tab-panel="practice"]')?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return true;
    }
  });

  japanoteChallengeLinks.registerProvider({
    resultViewId: "kana-quiz-result-view",
    kind: "kana-quiz",
    getApplyMessage: () => "친구가 보낸 문자 도전이 열렸어요.",
    createPayload: () => {
      if (!Array.isArray(kanaQuizSheetState.sessionItems) || !kanaQuizSheetState.sessionItems.length) {
        return null;
      }

      return {
        config: {
          mode: kanaQuizSettings.mode,
          count: kanaQuizSettings.count,
          duration: kanaQuizSettings.duration
        },
        sessionItems: cloneChallengeSessionData(kanaQuizSheetState.sessionItems)
      };
    },
    applyPayload: (payload) => {
      if (!Array.isArray(payload?.sessionItems) || !payload.sessionItems.length) {
        return false;
      }

      const nextDuration = Number(payload.config?.duration);
      state.charactersTab = "quiz";
      kanaQuizSettings.mode = ["hiragana", "katakana", "random"].includes(payload.config?.mode)
        ? payload.config.mode
        : "hiragana";
      kanaQuizSettings.count = payload.config?.count ?? kanaQuizSettings.count;
      if (Number.isFinite(nextDuration) && nextDuration >= 0) {
        kanaQuizSettings.duration = nextDuration;
      }
      kanaQuizSheetState.mode = kanaQuizSettings.mode;
      kanaQuizSheetState.sessionItems = cloneChallengeSessionData(payload.sessionItems);
      kanaQuizSheetState.sessionIndex = 0;
      kanaQuizSheetState.answered = false;
      kanaQuizSheetState.finished = false;
      kanaQuizSheetState.open = true;
      kanaQuizSheetState.results = [];
      kanaQuizSheetState.resultFilter = "all";
      setQuizSessionDuration("kana", Number(kanaQuizSettings.duration));
      resetQuizSessionScore("kana");
      stopQuizSessionTimer("kana");
      saveState();
      renderCharactersPageLayout();
      renderKanaQuizSetup();
      renderQuizSessionHud("kana");
      renderKanaQuizSheet();
      resetQuizSessionTimer("kana", handleKanaQuizTimeout);
      document.querySelector('[data-characters-tab-panel="quiz"]')?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return true;
    }
  });
}

attachEventListeners();
window.addEventListener("hashchange", () => {
  if (!isVocabPagePath()) {
    return;
  }

  const hashTab = window.location.hash.replace(/^#/, "").toLowerCase();
  setVocabTab(["quiz", "match"].includes(hashTab) ? hashTab : "study");
});
window.addEventListener("japanote:storage-updated", (event) => {
  if (event.detail?.key !== storageKey || event.detail?.source !== "remote") {
    return;
  }

  applyExternalStudyState(event.detail.value);
});
Promise.all([
  loadSupplementaryContentData(),
  // 카드 기본 문구가 먼저 보였다가 실제 단어로 바뀌는 현상을 막기 위해 첫 렌더 전에 필요한 단어 데이터를 같이 기다린다.
  preloadRelevantVocabData()
])
  .then(() => {
    syncDynamicVocabCollections();
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
    renderAll();
    dispatchSupplementaryContentLoaded();
  })
  .catch((error) => {
    console.error("Failed to load supplementary content data.", error);
    syncDynamicVocabCollections();
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
    renderAll();
    dispatchSupplementaryContentLoaded();
  });
