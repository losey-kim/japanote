globalThis.japanoteContent = globalThis.japanoteContent || {};
globalThis.japanoteContent.vocab = globalThis.japanoteContent.vocab || {};

const vocabRegistry = globalThis.japanoteContent.vocab;
const vocabLevels = ["N5", "N4", "N3"];
const vocabLevelUrls = {
  N5: "data/jlpt_n5.json",
  N4: "data/jlpt_n4.json",
  N3: "data/jlpt_n3.json"
};
const vocabLevelStates = vocabLevels.reduce((states, level) => {
  states[level] = "idle";
  return states;
}, {});
const vocabLevelPromises = {};

function getLegacyVocabRegistryKey(level) {
  return `jlpt${level}`;
}

function setLevelItems(level, items) {
  const nextItems = Array.isArray(items) ? items : [];
  vocabRegistry[level] = nextItems;
  vocabRegistry[getLegacyVocabRegistryKey(level)] = nextItems;
  globalThis[`jlpt${level}Vocab`] = nextItems;
}

function dispatchVocabEvent(name, detail) {
  if (typeof window === "undefined" || typeof window.CustomEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function extractLevelItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

function markLevelsLoaded(levels) {
  const loadedLevels = (Array.isArray(levels) ? levels : []).filter((level) => vocabLevels.includes(level));

  loadedLevels.forEach((level) => {
    vocabLevelStates[level] = "loaded";
  });

  if (loadedLevels.length) {
    dispatchVocabEvent("japanote:vocab-loaded", { levels: loadedLevels });
  }
}

function getLevelDataUrl(level) {
  if (typeof window === "undefined" || !window.location) {
    return vocabLevelUrls[level];
  }

  return new URL(vocabLevelUrls[level], window.location.href).toString();
}

function isSuccessfulResponse(response) {
  return response.status >= 200 && response.status < 300;
}

function parseJsonPayload(payloadText, level) {
  try {
    const parsed = typeof payloadText === "string" ? JSON.parse(payloadText) : payloadText;

    if (parsed === undefined || parsed === null) {
      throw new Error("Payload is empty.");
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse vocab data for ${level}: ${error.message}`);
  }
}

function fetchLevelItemsWithXhr(level) {
  const requestUrl = getLevelDataUrl(level);

  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest !== "function") {
      reject(new Error(`XHR is not available for ${level}.`));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("GET", requestUrl, true);
    request.responseType = "text";

    request.onload = () => {
      const isLoaded = request.status === 0 || isSuccessfulResponse(request);

      if (!isLoaded) {
        reject(new Error(`Failed to load vocab data for ${level} (${request.status}).`));
        return;
      }

      try {
        resolve(parseJsonPayload(request.responseText, level));
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to load vocab data for ${level} (XHR).`));
    };

    request.ontimeout = () => {
      reject(new Error(`Timed out while loading vocab data for ${level} (XHR).`));
    };

    request.send();
  });
}

function fetchLevelItems(level) {
  const requestUrl = getLevelDataUrl(level);

  return fetch(requestUrl, {
    cache: "default",
    credentials: "same-origin"
  }).then((response) => {
    if (!isSuccessfulResponse(response)) {
      throw new Error(`Failed to load vocab data for ${level} (${response.status}).`);
    }

    return response.json();
  }).catch(() => {
    return fetchLevelItemsWithXhr(level);
  }).then((payload) => {
    const items = extractLevelItems(payload);
    setLevelItems(level, items);
    markLevelsLoaded([level]);
    return items;
  });
}

function ensureLevel(level) {
  if (!vocabLevels.includes(level)) {
    return Promise.resolve([]);
  }

  if (vocabLevelStates[level] === "loaded") {
    return Promise.resolve(vocabRegistry[level] || []);
  }

  if (vocabLevelPromises[level]) {
    return vocabLevelPromises[level];
  }

  vocabLevelStates[level] = "loading";

  const request = fetchLevelItems(level)
    .then(() => vocabRegistry[level] || [])
    .catch((error) => {
      vocabLevelStates[level] = "error";
      dispatchVocabEvent("japanote:vocab-load-error", {
        level,
        message: error && error.message ? error.message : String(error)
      });
      throw error;
    })
    .finally(() => {
      delete vocabLevelPromises[level];
    });

  vocabLevelPromises[level] = request;
  return request;
}

function ensureLevels(levels) {
  const targetLevels = Array.from(
    new Set((Array.isArray(levels) ? levels : [levels]).filter((level) => vocabLevels.includes(level)))
  );

  return Promise.all(
    targetLevels.map((level) =>
      ensureLevel(level).catch(() => {
        return [];
      })
    )
  );
}

function getLevelItems(level) {
  return Array.isArray(vocabRegistry[level]) ? vocabRegistry[level] : [];
}

function isLevelLoaded(level) {
  return vocabLevelStates[level] === "loaded";
}

function isLevelLoading(level) {
  return vocabLevelStates[level] === "loading";
}

function getLevelState(level) {
  return vocabLevelStates[level] || "idle";
}

globalThis.japanoteVocabStore = {
  levels: [...vocabLevels],
  ensureLevel,
  ensureLevels,
  getLevelItems,
  getLevelState,
  isLevelLoaded,
  isLevelLoading
};

ensureLevel("N5").catch(() => {
  // Keep vocab loading lazy if the first request fails.
});
