/* Japanote — bootstrap after supplementary content (split from app.js, phase 1) */

/**
 * `japanote-boot-early.js`로 막아 둔 main + 화면 중앙 로더를 첫 렌더 후 정리.
 */
function japanoteFinishInitialBoot() {
  document.documentElement.classList.remove("japanote-app-booting");
  const root = document.getElementById("japanote-boot-root");
  if (root) {
    root.classList.add("japanote-boot-fadeout");
    window.setTimeout(() => {
      if (root.parentNode) {
        root.remove();
      }
    }, 400);
  }
}

/**
 * supplementary JSON + 관련 단어 프리로드 후 첫 렌더.
 * `loadSupplementaryContentData`, `preloadRelevantVocabData`, `renderAll` 등은 app.js 전역에 정의되어 있어야 한다.
 */
function japanoteRunInitialContentBoot() {
  return Promise.all([loadSupplementaryContentData(), preloadRelevantVocabData()])
    .then(() => {
      syncDynamicVocabCollections();
      activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
      try {
        renderAll();
        dispatchSupplementaryContentLoaded();
      } finally {
        japanoteFinishInitialBoot();
      }
    })
    .catch((error) => {
      console.error("Failed to load supplementary content data.", error);
      syncDynamicVocabCollections();
      activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
      try {
        renderAll();
        dispatchSupplementaryContentLoaded();
      } finally {
        japanoteFinishInitialBoot();
      }
    });
}
