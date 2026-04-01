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
let staticBundlePromise = null;

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

function seedStaticVocab() {
  const staticVocab = globalThis.japanoteStaticVocab || {};
  const loadedLevels = [];

  vocabLevels.forEach((level) => {
    if (!Array.isArray(staticVocab[level]) || !staticVocab[level].length) {
      return;
    }

    setLevelItems(level, staticVocab[level]);
    loadedLevels.push(level);
  });

  if (loadedLevels.length) {
    markLevelsLoaded(loadedLevels);
  }

  return loadedLevels;
}

function isFileProtocol() {
  return typeof window !== "undefined" && window.location.protocol === "file:";
}

function loadStaticBundle() {
  if (globalThis.japanoteStaticVocab) {
    return Promise.resolve(seedStaticVocab());
  }

  if (staticBundlePromise) {
    return staticBundlePromise;
  }

  staticBundlePromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined" || !document.head) {
      reject(new Error("Static vocab bundle cannot be loaded in this environment."));
      return;
    }

    const script = document.createElement("script");
    script.src = "assets/js/jlpt-vocab-data.js";
    script.async = true;
    script.onload = () => {
      resolve(seedStaticVocab());
    };
    script.onerror = () => {
      reject(new Error("Failed to load the local vocab bundle."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    staticBundlePromise = null;
    throw error;
  });

  return staticBundlePromise;
}

function fetchLevelItems(level) {
  return fetch(vocabLevelUrls[level], {
    cache: "default",
    credentials: "same-origin"
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load vocab data for ${level} (${response.status}).`);
    }

    return response.json();
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

  const request = (isFileProtocol() ? loadStaticBundle() : fetchLevelItems(level))
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

seedStaticVocab();

if (!globalThis.japanoteStaticVocab && !isFileProtocol()) {
  ensureLevel("N5").catch(() => {
    // Keep fallback vocab available in the app if the network fetch fails.
  });
}
