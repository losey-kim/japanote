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


function getLevelContentSets(source) {
  return contentLevels.reduce((sets, level) => {
    sets[level] = Array.isArray(source?.[level]) ? source[level] : [];
    return sets;
  }, {});
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
const vocabQuizSessionSize = 12;
const VOCAB_TODAY_REVIEW_QUEUE_MAX = 10;
const VOCAB_RECENT_WRONG_MAX = 30;
const VOCAB_QUIZ_RETRY_INSERT_OFFSET = 2;
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

function applyKanaTracksToBasicPractice(normalized) {
  if (!normalized?.tracks) {
    return;
  }

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
}

refreshKanaContentState(kanaContent);

const basicPracticeTrackOrder = ["hiragana", "katakana", "words", "particles", "kanji", "sentences"];

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
const quizSessionSizeOptions = [10, 20];
const vocabQuizCountOptions = [5, 10, 15, 20];
const quizDurationOptions = [10, 15, 20, 0];
const vocabPartAllValue = allLevelValue;
const selectableStudyLevels = [...contentLevels, allLevelValue];



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

function getVocabQuizDuration(value = state?.vocabQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}


function getVocabTab(value = state?.vocabTab) {
  return ["study", "quiz", "match"].includes(value) ? value : "study";
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

function buildVocabPracticeQuestionForItem(item, pool, level = "N5", questionIndex = 0, config = {}) {
  const tones = ["tone-coral", "tone-mint", "tone-gold", "tone-sky"];
  const levelLabel = getLevelLabel(level);
  const questionField = getVocabQuizQuestionField(config.questionField, config.mode);
  const optionField = getVocabQuizOptionField(config.optionField, questionField, config.mode);
  const display = getVocabQuizItemValue(item, questionField);
  const displaySub = getVocabQuizDisplaySub(item, questionField, optionField);
  const correctOption = getVocabQuizItemValue(item, optionField);
  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => getVocabQuizItemValue(candidate, optionField))
        .filter((value) => value && value !== correctOption)
    )
  ).slice(0, 3);

  if (!display || !correctOption || distractors.length < 3) {
    return null;
  }

  const options = shuffleQuizArray([correctOption, ...distractors]);
  const answer = options.indexOf(correctOption);
  const questionLabel = getVocabQuizFieldLabel(questionField);
  const optionLabel = getVocabQuizFieldLabel(optionField);
  const title = item.part ? `${item.part} ${optionLabel} 퀴즈` : `${levelLabel} ${optionLabel} 퀴즈`;
  const note = `${questionLabel}를 보고 ${optionLabel}를 골라봐요.`;
  const prompt = `이 ${questionLabel}에 맞는 ${optionLabel}, 어떤 걸까요?`;
  const explanation = getVocabQuizExplanation(item);

  return {
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
  };
}

function buildWordPracticeQuestionSet(items, level = "N5", fallbackItems = [], config = {}) {
  const count = Math.max(1, Number(config.count) || vocabQuizSessionSize);
  const seedItems = shuffleQuizArray(items);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const item = seedItems[index];
    const built = buildVocabPracticeQuestionForItem(item, items, level, questions.length, config);

    if (built) {
      questions.push(built);
    }
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
    clearVocabQuizSessionRuntime();
  }

  renderAll();
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
let activeVocabQuizItemPool = [];
let vocabQuizSessionScheduledRetrySourceIds = new Set();
let vocabQuizRetryNonce = 0;

let pendingExternalStudyState = null;

state = normalizeLoadedState(loadState());
initJapanoteQuizSessions();

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
        "vocabQuizTodayReviewActive",
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

function setActionButtonIcon(button, iconName) {
  const icon = button?.querySelector(".material-symbols-rounded");

  if (icon) {
    icon.textContent = iconName;
  }
}

function renderRestartableActionButton(button, label, isStarted, canStart) {
  if (button) {
    button.classList.toggle("primary-btn", !isStarted);
    button.classList.toggle("secondary-btn", isStarted);
    button.disabled = !canStart;
  }

  if (label) {
    label.textContent = isStarted ? getJapanoteButtonLabel("restart") : getJapanoteButtonLabel("start");
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
  saveLabelShort,
  removeLabelShort,
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
  const displaySave = saveLabelShort && String(saveLabelShort).length > 0 ? saveLabelShort : saveLabel;
  const displayRemove =
    removeLabelShort && String(removeLabelShort).length > 0 ? removeLabelShort : removeLabel;
  const describeEmpty = emptyTitle != null && String(emptyTitle).length > 0 ? String(emptyTitle) : "";
  const describeSave = saveTitle != null && String(saveTitle).length > 0 ? String(saveTitle) : String(saveLabel);
  const describeRemove =
    removeTitle != null && String(removeTitle).length > 0 ? String(removeTitle) : String(removeLabel);
  const ariaAndTitle = (() => {
    if (uniqueIds.length === 0) {
      return describeEmpty;
    }
    if (allSaved) {
      return describeRemove;
    }
    return describeSave;
  })();

  button.disabled = uniqueIds.length === 0;
  button.dataset[datasetKey] = allSaved ? removeActionValue : saveActionValue;
  button.setAttribute("aria-label", ariaAndTitle);
  button.title = ariaAndTitle;
  label.textContent = allSaved ? displayRemove : displaySave;
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

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getVocabTodayReviewSignature() {
  return [getVocabLevel(), getVocabFilter(), getVocabPartFilter()].join("::");
}

function buildTodayVocabReviewQueueIds() {
  const visible = getVisibleVocabList();
  const byId = new Map(visible.map((entry) => [entry.id, entry]));
  const orderedIds = [];
  const used = new Set();

  visible.forEach((item) => {
    if (used.has(item.id)) {
      return;
    }

    if (state.reviewIds.includes(item.id)) {
      orderedIds.push(item.id);
      used.add(item.id);
    }
  });

  const recent = Array.isArray(state.recentVocabWrongIds) ? state.recentVocabWrongIds : [];
  recent.forEach((id) => {
    if (!byId.has(id) || used.has(id)) {
      return;
    }

    orderedIds.push(id);
    used.add(id);
  });

  visible.forEach((item) => {
    if (used.has(item.id)) {
      return;
    }

    const unmarked = !state.reviewIds.includes(item.id) && !state.masteredIds.includes(item.id);

    if (unmarked) {
      orderedIds.push(item.id);
      used.add(item.id);
    }
  });

  return orderedIds.slice(0, VOCAB_TODAY_REVIEW_QUEUE_MAX);
}

function ensureVocabTodayReviewQueueInState() {
  const today = getLocalDateKey();
  const signature = getVocabTodayReviewSignature();
  const cached = state.vocabTodayReview;
  const nextIds = buildTodayVocabReviewQueueIds();

  if (
    cached &&
    cached.date === today &&
    cached.signature === signature &&
    Array.isArray(cached.ids) &&
    cached.ids.join("\u0001") === nextIds.join("\u0001")
  ) {
    return;
  }

  state.vocabTodayReview = {
    date: today,
    signature,
    ids: nextIds
  };
  saveState();
}

function pushRecentVocabWrongId(id) {
  if (!id) {
    return;
  }

  const next = [id, ...(state.recentVocabWrongIds || []).filter((entry) => entry !== id)];
  state.recentVocabWrongIds = next.slice(0, VOCAB_RECENT_WRONG_MAX);
}

function getTodayVocabReviewQuizItems() {
  ensureVocabTodayReviewQueueInState();
  const ids = state.vocabTodayReview?.ids || [];
  const visible = getVisibleVocabList();
  const map = new Map(visible.map((entry) => [entry.id, entry]));

  return ids.map((id) => map.get(id)).filter(Boolean);
}

function scheduleVocabQuizRetryQuestion(question) {
  if (!state.vocabQuizRetryOnWrong) {
    return;
  }

  if (activeVocabQuizChallengePayload) {
    return;
  }

  const sourceId = question.sourceId;

  if (!sourceId || vocabQuizSessionScheduledRetrySourceIds.has(sourceId)) {
    return;
  }

  const item = activeVocabQuizItemPool.find((entry) => entry.id === sourceId);

  if (!item || !activeVocabQuizItemPool.length) {
    return;
  }

  const built = buildVocabPracticeQuestionForItem(item, activeVocabQuizItemPool, getVocabLevel(), activeVocabQuizQuestions.length, {
    questionField: getVocabQuizQuestionField(),
    optionField: getVocabQuizOptionField()
  });

  if (!built) {
    return;
  }

  vocabQuizRetryNonce += 1;
  const retryQuestion = { ...built, id: `${built.id}-retry-${vocabQuizRetryNonce}` };
  const insertAt = Math.min(state.vocabQuizIndex + VOCAB_QUIZ_RETRY_INSERT_OFFSET, activeVocabQuizQuestions.length);
  activeVocabQuizQuestions.splice(insertAt, 0, retryQuestion);
  vocabQuizSessionScheduledRetrySourceIds.add(sourceId);
}

function clearVocabQuizSessionRuntime() {
  activeVocabQuizItemPool = [];
  vocabQuizSessionScheduledRetrySourceIds = new Set();
}

function invalidateVocabQuizSession() {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("vocab-quiz-result-view");
  activeVocabQuizQuestions = [];
  activeVocabQuizSignature = "";
  activeVocabQuizResults = [];
  activeVocabQuizChallengePayload = null;
  state.vocabQuizStarted = false;
  state.vocabQuizTodayReviewActive = false;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  clearVocabQuizSessionRuntime();
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
  const retryLabel = state.vocabQuizRetryOnWrong ? "오답 한 번 더" : "";

  return [getVocabQuizConfigLabel(), `${getVocabQuizCount()}문제`, getDurationLabel(getVocabQuizDuration()), retryLabel]
    .filter(Boolean)
    .join(" · ");
}

function ensureVocabQuizRetryToggle() {
  const panel = document.getElementById("vocab-quiz-options-panel");

  if (!panel) {
    return;
  }

  let input = document.getElementById("vocab-quiz-retry-on-wrong");

  if (!input) {
    const group = document.createElement("div");
    group.className = "study-options-group";

    const label = document.createElement("label");
    label.className = "vocab-quiz-retry-label";
    label.setAttribute("for", "vocab-quiz-retry-on-wrong");

    input = document.createElement("input");
    input.type = "checkbox";
    input.id = "vocab-quiz-retry-on-wrong";
    input.setAttribute(
      "aria-label",
      "틀렸을 때 같은 단어를 한 번 더 풀면 진행 칸이 하나 늘어날 수 있어요"
    );

    const span = document.createElement("span");
    span.textContent = "오답이면 같은 단어를 한 번 더 풀기 (진행 칸이 늘어날 수 있어요)";

    label.append(input, span);
    group.appendChild(label);
    panel.appendChild(group);

    input.addEventListener("change", () => {
      if (state.vocabQuizStarted && !state.vocabQuizFinished) {
        input.checked = Boolean(state.vocabQuizRetryOnWrong);
        return;
      }

      state.vocabQuizRetryOnWrong = Boolean(input.checked);
      saveState();
      renderVocabPage();
    });
  }

  input.disabled = Boolean(state.vocabQuizStarted && !state.vocabQuizFinished);
  input.checked = Boolean(state.vocabQuizRetryOnWrong);
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
  const retryKey = state.vocabQuizRetryOnWrong === true ? "retry-on" : "retry-off";

  if (state.vocabQuizTodayReviewActive) {
    const queueIds = state.vocabTodayReview?.ids || [];
    return [
      "today-review",
      getLocalDateKey(),
      queueIds.join("|"),
      getVocabQuizQuestionField(),
      getVocabQuizOptionField(),
      getVocabQuizCount(),
      retryKey
    ].join("::");
  }

  return [
    getVocabLevel(),
    getVocabFilter(),
    getVocabPartFilter(),
    getVocabQuizQuestionField(),
    getVocabQuizOptionField(),
    getVocabQuizCount(),
    retryKey,
    items.map((item) => item.id).join("|")
  ].join("::");
}

function getVocabQuizSourceLabel() {
  if (state.vocabQuizTodayReviewActive) {
    return getVocabTodayReviewCopy("quizSourceLabel");
  }

  return [getVocabLevelLabel(), vocabFilterLabels[getVocabFilter()], getVocabPartSummaryLabel()].join(" · ");
}

function getCurrentVocabQuizQuestion() {
  return activeVocabQuizQuestions[state.vocabQuizIndex] || activeVocabQuizQuestions[0] || null;
}

function syncVocabQuizProgressDisplay() {
  const progress = document.getElementById("vocab-quiz-progress");

  if (!progress || !state.vocabQuizStarted || state.vocabQuizFinished) {
    return;
  }

  const total = Array.isArray(activeVocabQuizQuestions) ? activeVocabQuizQuestions.length : 0;

  if (!total) {
    return;
  }

  const index = Number.isFinite(Number(state.vocabQuizIndex)) ? Number(state.vocabQuizIndex) : 0;
  progress.textContent = `${Math.min(index + 1, total)} / ${total}`;
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

  state.vocabQuizTodayReviewActive = false;
  clearVocabQuizSessionRuntime();
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

function startNewVocabQuizSession(force = false, options) {
  const opts = options && typeof options === "object" ? options : {};
  const todayReview = opts.todayReview === true;
  const hasTodayReviewOption = Object.prototype.hasOwnProperty.call(opts, "todayReview");

  if (hasTodayReviewOption) {
    state.vocabQuizTodayReviewActive = todayReview;
  }

  window.japanoteChallengeLinks?.clearActiveChallenge?.("vocab-quiz-result-view");
  const items = todayReview ? getTodayVocabReviewQuizItems() : getVocabQuizItems();
  const nextSignature = getVocabQuizSignature(items);

  if (!force && nextSignature === activeVocabQuizSignature && activeVocabQuizQuestions.length) {
    state.vocabQuizStarted = true;
    return true;
  }

  activeVocabQuizItemPool = items.slice();
  vocabQuizSessionScheduledRetrySourceIds = new Set();
  const questionCount = todayReview ? Math.min(getVocabQuizCount(), items.length) : getVocabQuizCount();
  const nextQuestions = buildWordPracticeQuestionSet(items, getVocabLevel(), [], {
    questionField: getVocabQuizQuestionField(),
    optionField: getVocabQuizOptionField(),
    count: questionCount
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

function startTodayVocabReviewSession() {
  window.japanoteChallengeLinks?.clearActiveChallenge?.("vocab-quiz-result-view");
  invalidateVocabQuizSession();
  return startNewVocabQuizSession(true, { todayReview: true });
}

function handleVocabTodayReviewStartClick() {
  ensureVocabTodayReviewQueueInState();
  const items = getTodayVocabReviewQuizItems();

  if (items.length < 4) {
    showJapanoteToast(getVocabTodayReviewCopy("notEnoughWords"));
    return;
  }

  if (getVocabTab() !== "quiz") {
    state.vocabTab = "quiz";
    syncVocabLocationHash("quiz");
  }

  const started = startTodayVocabReviewSession();
  renderVocabPage();

  if (started) {
    scrollToElementById("vocab-quiz-card");
  }
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
    return startNewVocabQuizSession(true, { todayReview: state.vocabQuizTodayReviewActive });
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
    saveLabel: getJapanoteButtonLabel("reviewSave"),
    removeLabel: getJapanoteButtonLabel("reviewRemove"),
    saveLabelShort: getJapanoteButtonLabel("reviewSaveShort"),
    removeLabelShort: getJapanoteButtonLabel("reviewRemoveShort"),
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
    saveLabel: getJapanoteButtonLabel("masteredSave"),
    removeLabel: getJapanoteButtonLabel("masteredRemove"),
    saveLabelShort: getJapanoteButtonLabel("masteredSaveShort"),
    removeLabelShort: getJapanoteButtonLabel("masteredRemoveShort"),
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
              actionLabel: reviewSelected ? getJapanoteButtonLabel("reviewRemove") : getJapanoteButtonLabel("reviewSave"),
              datasetName: "vocabQuizReview",
              defaultIcon: "bookmark_add",
              selectedIcon: "delete",
              selectedClassName: "is-saved"
            },
            {
              itemId: item.id,
              selected: masteredSelected,
              actionLabel: masteredSelected ? getJapanoteButtonLabel("masteredRemove") : getJapanoteButtonLabel("masteredSave"),
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

  finalizeQuizSession("vocab", correct);
  state.quizAnsweredCount += 1;

  if (correct) {
    state.quizCorrectCount += 1;
  }

  recordVocabQuizResult(question, selectedIndex, correct, timedOut);

  if (!correct) {
    pushRecentVocabWrongId(question.sourceId);
    scheduleVocabQuizRetryQuestion(question);
  }

  const isLastQuestion = state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1;
  revealVocabQuizAnswer(question, selectedIndex, correct);
  feedback.textContent = correct
    ? ""
    : "";
  explanation.textContent = softenExplanationCopy(question.explanation || "");
  nextButton.disabled = false;
  nextButton.hidden = false;
  nextButton.textContent = isLastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");

  syncVocabQuizProgressDisplay();
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
    clearVocabQuizSessionRuntime();
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

  const started = startNewVocabQuizSession(true, { todayReview: false });
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

  ensureVocabQuizRetryToggle();
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
      ? getJapanoteButtonLabel("start")
      : getVocabQuizEmptyText(items);
    card.hidden = true;
    progress.textContent = `0 / ${getVocabQuizCount()}`;
    restart.classList.add("primary-btn");
    restart.classList.remove("secondary-btn");
    restart.disabled = !canStart;
    restartLabel.textContent = getJapanoteButtonLabel("start");
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
    restartLabel.textContent = getJapanoteButtonLabel("restart");
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
    restartLabel.textContent = getJapanoteButtonLabel("start");
    setActionButtonIcon(restart, "play_arrow");
    state.vocabQuizStarted = false;
    state.vocabQuizTodayReviewActive = false;
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
  restartLabel.textContent = getJapanoteButtonLabel("restart");
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
    restartLabel.textContent = getJapanoteButtonLabel("restart");
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
    state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1 ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion");

  renderChoiceOptionButtons({
    container: options,
    options: question.options,
    buttonClassName: "basic-practice-option",
    formatText: (option) => formatQuizLineBreaks(softenVisibleKoreanCopy(option)),
    onSelect: handleVocabQuizAnswer
  });

  resetQuizSessionTimer("vocab", handleVocabQuizTimeout);
}

function buildVocabTodayReviewBannerHtml() {
  ensureVocabTodayReviewQueueInState();
  const count = (state.vocabTodayReview?.ids || []).length;
  const canStart = count >= 4;
  const prepared = getVocabTodayReviewCopy("prepared", { count });
  const retryHint = getVocabTodayReviewCopy("retryHint");
  const emptyMessage = getVocabTodayReviewCopy("emptyQueue");
  const startLabel = getVocabTodayReviewCopy("startButton");

  if (!count) {
    return `
      <div class="vocab-today-review-card" role="region" aria-label="${getVocabTodayReviewCopy("ariaLabel")}">
        <p class="vocab-today-review-title">${emptyMessage}</p>
      </div>
    `;
  }

  return `
    <div class="vocab-today-review-card" role="region" aria-label="${getVocabTodayReviewCopy("ariaLabel")}">
      <div class="vocab-today-review-head">
        <p class="vocab-today-review-title">${prepared}</p>
        <button type="button" class="primary-btn button-with-icon vocab-today-review-start" data-vocab-today-review-start ${canStart ? "" : "disabled"}>
          <span class="material-symbols-rounded" aria-hidden="true">playlist_add_check</span>
          <span>${startLabel}</span>
        </button>
      </div>
      <p class="vocab-today-review-hint">${retryHint}</p>
    </div>
  `;
}

function renderVocabTodayReviewBanners() {
  if (!isVocabPagePath()) {
    return;
  }

  const studySlot = document.getElementById("vocab-today-review-slot-study");
  const quizSlot = document.getElementById("vocab-today-review-slot-quiz");
  const html = buildVocabTodayReviewBannerHtml();

  if (studySlot) {
    studySlot.innerHTML = html;
  }

  if (quizSlot) {
    quizSlot.innerHTML = html;
  }
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

  renderVocabTodayReviewBanners();

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
      ? `${getQuizFeedbackText(question, correct, selectedOption || "시간 초과")} 마지막 문제예요. ${getJapanoteButtonLabel("result")}`
      : getQuizFeedbackText(question, correct, selectedOption || "시간 초과");
  }

  legacyRevealQuizAnswer(question, selectedOption, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion"),
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
      nextLabel: getJapanoteButtonLabel("nextQuestion"),
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
        ? getJapanoteButtonLabel("result")
        : getJapanoteButtonLabel("nextQuestion"),
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
    nextLabel: lastQuestion ? getJapanoteButtonLabel("result") : getJapanoteButtonLabel("nextQuestion"),
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
japanoteRunInitialContentBoot();
