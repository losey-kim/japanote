(function registerJapanoteCopy(global) {
  global.japanoteCopy = {
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
      },
      todayReview: {
        ariaLabel: "오늘의 단어 복습",
        prepared: "오늘 다시 볼 단어 {count}개 준비했어요",
        startButton: "오늘의 복습 시작",
        retryHint: "틀린 단어는 한 번 더 나와요",
        emptyQueue: "오늘 복습할 단어가 아직 없어요",
        notEnoughWords: "복습을 시작하려면 단어가 4개 이상 모여야 해요.",
        quizSourceLabel: "오늘의 복습"
      },
      recall: {
        modeLabel: "풀이 방식",
        choiceMode: "객관식",
        recallMode: "떠올리기",
        summaryLabel: "떠올리기",
        revealAnswer: "정답 보기",
        answerLabel: "정답",
        selfCheckPrompt: "먼저 떠올려보고 스스로 체크해봐요.",
        correctButton: "맞았어요",
        unsureButton: "애매해요",
        wrongButton: "틀렸어요",
        timeoutMessage: "시간이 지나서 정답을 먼저 보여줄게요."
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
    },
    buttons: {
      start: "시작해볼까요?",
      restart: "다시 해볼까요?",
      nextQuestion: "다음 문제 볼까요?",
      nextPassage: "다음 글 볼까요?",
      rereadPassage: "다시 읽어볼까요?",
      result: "결과 볼까요?",
      reviewSave: "다시 보기로 표시",
      reviewRemove: "다시 보기 해제",
      masteredSave: "익힘으로 표시",
      masteredRemove: "익힘 해제",
      resultShare: "공유",
      resultShareDetail: "결과를 그림으로 만들어 공유해요",
      resultChallenge: "도전",
      resultChallengeLinkDetail: "친구가 같은 문제를 풀 수 있게 링크를 보내요",
      resultChallengeCopy: "복사",
      resultChallengeCopyDetail: "같은 문제·결과의 도전 링크를 복사해요",
      reviewSaveShort: "다시 보기",
      reviewRemoveShort: "다시 해제",
      masteredSaveShort: "익힘",
      masteredRemoveShort: "익힘 해제"
    }
  };
})(window);

/* Shared study hints + copy accessors (used across study/practice modules) */
const STUDY_READY_TO_START_HINT = "준비됐다면 시작해봐요";
const STUDY_NO_CONTENT_LEVEL_HINT = "아직 보여줄 내용이 없어요. 다른 레벨로 바꿔보세요.";

function getStudyPracticeResultEmptyMessage(activeFilter) {
  if (activeFilter === "correct") {
    return "아직 정답 결과가 없어요. 문제를 더 풀어볼까요?";
  }

  if (activeFilter === "wrong") {
    return "지금은 오답이 없어요. 이 흐름 좋네요.";
  }

  return "아직 결과가 없어요. 문제를 풀고 다시 확인해봐요.";
}

/** Mirrors registerJapanoteCopy when that script is absent or fails. */
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
    },
    todayReview: {
      ariaLabel: "오늘의 단어 복습",
      prepared: "오늘 다시 볼 단어 {count}개 준비했어요",
      startButton: "오늘의 복습 시작",
      retryHint: "틀린 단어는 한 번 더 나와요",
      emptyQueue: "오늘 복습할 단어가 아직 없어요",
      notEnoughWords: "복습을 시작하려면 단어가 4개 이상 모여야 해요.",
      quizSourceLabel: "오늘의 복습"
    },
    recall: {
      modeLabel: "풀이 방식",
      choiceMode: "객관식",
      recallMode: "떠올리기",
      summaryLabel: "떠올리기",
      revealAnswer: "정답 보기",
      answerLabel: "정답",
      selfCheckPrompt: "먼저 떠올려보고 스스로 체크해봐요.",
      correctButton: "맞았어요",
      unsureButton: "애매해요",
      wrongButton: "틀렸어요",
      timeoutMessage: "시간이 지나서 정답을 먼저 보여줄게요."
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
  },
  buttons: {
    start: "시작해볼까요?",
    restart: "다시 해볼까요?",
    nextQuestion: "다음 문제 볼까요?",
    nextPassage: "다음 글 볼까요?",
    rereadPassage: "다시 읽어볼까요?",
    result: "결과 볼까요?",
    reviewSave: "다시 보기로 표시",
    reviewRemove: "다시 보기 해제",
    masteredSave: "익힘으로 표시",
    masteredRemove: "익힘 해제",
    resultShare: "공유",
    resultShareDetail: "결과를 그림으로 만들어 공유해요",
    resultChallenge: "도전",
    resultChallengeLinkDetail: "친구가 같은 문제를 풀 수 있게 링크를 보내요",
    resultChallengeCopy: "복사",
    resultChallengeCopyDetail: "같은 문제·결과의 도전 링크를 복사해요",
    reviewSaveShort: "다시 보기",
    reviewRemoveShort: "다시 해제",
    masteredSaveShort: "익힘",
    masteredRemoveShort: "익힘 해제"
  }
};

function getJapanoteCopy() {
  const fromGlobal = globalThis.japanoteCopy;
  return fromGlobal && typeof fromGlobal === "object" ? fromGlobal : japanoteCopyFallback;
}

function getJapanoteButtonLabel(key) {
  const fallback = japanoteCopyFallback.buttons || {};
  const from = getJapanoteCopy().buttons;
  const value = from?.[key] ?? fallback[key];
  return typeof value === "string" && value.length > 0 ? value : "";
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

function getVocabTodayReviewCopy(key, vars) {
  const root = getJapanoteCopy();
  const fromRoot = root?.vocab?.todayReview;
  const block =
    fromRoot && typeof fromRoot === "object" ? fromRoot : japanoteCopyFallback.vocab.todayReview;
  const fallbackBlock = japanoteCopyFallback.vocab.todayReview;
  let text = typeof block[key] === "string" ? block[key] : "";

  if (!text && typeof fallbackBlock[key] === "string") {
    text = fallbackBlock[key];
  }

  const replacements = vars && typeof vars === "object" ? vars : {};

  if (Object.prototype.hasOwnProperty.call(replacements, "count")) {
    text = text.replace(/\{count\}/g, String(replacements.count));
  }

  return text;
}

function getVocabRecallCopy(key) {
  const root = getJapanoteCopy();
  const fromRoot = root?.vocab?.recall;
  const block =
    fromRoot && typeof fromRoot === "object" ? fromRoot : japanoteCopyFallback.vocab.recall;
  const fallbackBlock = japanoteCopyFallback.vocab.recall;
  const text = typeof block[key] === "string" ? block[key] : fallbackBlock[key];
  return typeof text === "string" ? text : "";
}
