(function registerJapanoteAppContentLoader(global) {
  function getLevelContentSets(source, contentLevels = []) {
    return contentLevels.reduce((sets, level) => {
      sets[level] = Array.isArray(source?.[level]) ? source[level] : [];
      return sets;
    }, {});
  }

  function normalizeGrammarContent(payload, contentLevels = []) {
    const normalized = payload || {};

    return {
      items: Array.isArray(normalized.items) ? normalized.items : [],
      practiceSets: getLevelContentSets(normalized.practiceSets || {}, contentLevels)
    };
  }

  function normalizeReadingContent(payload, contentLevels = []) {
    const normalized = payload || {};

    return {
      sets: getLevelContentSets(normalized.sets || {}, contentLevels)
    };
  }

  function normalizeKanjiRows(payload) {
    return Array.isArray(payload) ? payload.filter((row) => Array.isArray(row)) : [];
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

  function normalizeQuizQuestionList(payload) {
    const candidate = Array.isArray(payload) ? payload : [];
    return candidate.length ? candidate : [];
  }

  function getContentDataUrl(fileName) {
    if (!global.location) {
      return fileName;
    }

    return new URL(`data/${fileName}`, global.location.href).toString();
  }

  function isSuccessfulResponse(response) {
    return response.status >= 200 && response.status < 300;
  }

  function parseJsonPayload(payloadText, fallbackLabel) {
    try {
      const parsed = typeof payloadText === "string" ? JSON.parse(payloadText) : payloadText;

      if (parsed === undefined || parsed === null) {
        throw new Error("Payload is empty.");
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

  function createSupplementaryContentLoader(options) {
    const config = options && typeof options === "object" ? options : {};
    const contentLevels = Array.isArray(config.contentLevels) ? config.contentLevels : [];
    const allLevelValue = typeof config.allLevelValue === "string" ? config.allLevelValue : "all";
    const getAllPracticeSets = typeof config.getAllPracticeSets === "function" ? config.getAllPracticeSets : () => [];
    const refreshKanjiPracticeSet =
      typeof config.refreshKanjiPracticeSet === "function" ? config.refreshKanjiPracticeSet : null;
    const readState = typeof config.readState === "function" ? config.readState : () => ({});
    const writeState = typeof config.writeState === "function" ? config.writeState : () => {};
    const logger = config.logger && typeof config.logger === "object" ? config.logger : console;

    function dispatchSupplementaryContentLoaded() {
      if (typeof global.CustomEvent !== "function" || typeof global.dispatchEvent !== "function") {
        return;
      }

      const currentState = readState();
      const kanjiRows = Array.isArray(currentState.kanjiDataRows) ? [...currentState.kanjiDataRows] : [];

      global.dispatchEvent(
        new global.CustomEvent("japanote:supplementary-content-loaded", {
          detail: {
            kanjiRows
          }
        })
      );
    }

    function refreshGrammarContentState(payload) {
      const normalized = normalizeGrammarContent(payload || {}, contentLevels);
      const practiceSets = getLevelContentSets(normalized.practiceSets, contentLevels);
      practiceSets[allLevelValue] = getAllPracticeSets(practiceSets);

      writeState({
        grammarContent: normalized,
        grammarItems: normalized.items,
        grammarPracticeSets: practiceSets
      });
    }

    function refreshReadingContentState(payload) {
      const normalized = normalizeReadingContent(payload || {}, contentLevels);
      const sets = getLevelContentSets(normalized.sets, contentLevels);
      sets[allLevelValue] = getAllPracticeSets(sets);

      writeState({
        readingContent: normalized,
        readingSets: sets
      });
    }

    function refreshKanjiRows(payload) {
      const normalized = normalizeKanjiRows(payload || []);
      global.JAPANOTE_KANJI_DATA = [...normalized];

      writeState({
        kanjiDataRows: normalized
      });
    }

    function refreshStarterItems(payload) {
      writeState({
        starterItems: Array.isArray(payload?.items) ? payload.items : []
      });
    }

    function refreshBasicPracticeSets(payload) {
      const source = payload && typeof payload === "object" ? payload : {};
      const currentState = readState();
      const currentBasicPracticeSets =
        currentState.basicPracticeSets && typeof currentState.basicPracticeSets === "object"
          ? currentState.basicPracticeSets
          : {};

      writeState({
        basicPracticeSets: {
          ...currentBasicPracticeSets,
          words: normalizeBasicPracticeTrack(source.words),
          particles: normalizeBasicPracticeTrackOrNull(source.particles),
          kanji: normalizeBasicPracticeTrackOrNull(source.kanji),
          sentences: normalizeBasicPracticeTrackOrNull(source.sentences)
        }
      });
    }

    function refreshFallbackFlashcards(payload) {
      const normalized = normalizeQuizQuestionList(payload?.flashcards);

      writeState({
        fallbackFlashcards: normalized,
        flashcards: [...normalized],
        vocabListItems: [...normalized]
      });
    }

    function refreshQuizQuestions(payload) {
      writeState({
        quizQuestions: normalizeQuizQuestionList(payload?.questions)
      });
    }

    function loadGrammarDataFromJson() {
      return fetchJsonData("grammar.json", "grammar.json")
        .then((payload) => {
          refreshGrammarContentState(payload || {});
          return payload;
        })
        .catch((error) => {
          logger.warn("Failed to load grammar.json. Using empty grammar data.", error);
          refreshGrammarContentState(readState().grammarContent);
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
          logger.warn("Failed to load reading.json. Using empty reading data.", error);
          refreshReadingContentState(readState().readingContent);
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
          logger.warn("Failed to load kanji.json. Using empty kanji data.", error);
          refreshKanjiRows(readState().kanjiDataRows);
          return null;
        });
    }

    function loadStarterItemsFromJson() {
      return fetchJsonData("starter-items.json", "starter-items.json")
        .then((payload) => {
          refreshStarterItems(payload || {});
          return payload;
        })
        .catch((error) => {
          logger.warn("Using default starter-items data (script fallback).", error);
          refreshStarterItems({});
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
          logger.warn("Using default basic-practice data (script fallback).", error);
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
          logger.warn("Using default fallback flashcards (script fallback).", error);
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
          logger.warn("Using default quiz questions (script fallback).", error);
          refreshQuizQuestions({});
          return null;
        });
    }

    function loadSupplementaryContentData() {
      return Promise.all([
        loadGrammarDataFromJson(),
        loadReadingDataFromJson(),
        loadKanjiDataFromJson(),
        loadStarterItemsFromJson(),
        loadBasicPracticeSetsFromJson(),
        loadFallbackFlashcardsFromJson(),
        loadQuizQuestionsFromJson()
      ]).then(() => {
        if (refreshKanjiPracticeSet) {
          refreshKanjiPracticeSet();
        }
      });
    }

    return {
      dispatchSupplementaryContentLoaded,
      loadSupplementaryContentData,
      refreshGrammarContentState,
      refreshReadingContentState,
      refreshKanjiRows
    };
  }

  global.japanoteAppContentLoader = {
    getLevelContentSets,
    normalizeGrammarContent,
    normalizeReadingContent,
    normalizeKanjiRows,
    normalizeBasicPracticeTrack,
    createSupplementaryContentLoader
  };
})(typeof window !== "undefined" ? window : globalThis);
