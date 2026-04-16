/* Japanote — bootstrap after supplementary content (split from app.js, phase 1) */

/**
 * supplementary JSON + 관련 단어 프리로드 후 첫 렌더.
 * `loadSupplementaryContentData`, `preloadRelevantVocabData`, `renderAll` 등은 app.js 전역에 정의되어 있어야 한다.
 */
function japanoteRunInitialContentBoot() {
  return Promise.all([loadSupplementaryContentData(), preloadRelevantVocabData()])
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
}
