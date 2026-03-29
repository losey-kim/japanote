globalThis.japanoteContent = globalThis.japanoteContent || {};
globalThis.japanoteContent.vocab = globalThis.japanoteContent.vocab || {};

const vocabRegistry = globalThis.japanoteContent.vocab;
const staticVocab = globalThis.japanoteStaticVocab || {};
const vocabLevels = ["N5", "N4", "N3"];

function getLegacyVocabRegistryKey(level) {
  return `jlpt${level}`;
}

function setLevelItems(level, items) {
  const nextItems = Array.isArray(items) ? items : [];
  vocabRegistry[level] = nextItems;
  vocabRegistry[getLegacyVocabRegistryKey(level)] = nextItems;
  globalThis[`jlpt${level}Vocab`] = nextItems;
}

vocabLevels.forEach((level) => {
  setLevelItems(level, staticVocab[level]);
});
