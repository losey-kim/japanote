/* Japanote — shared quiz HUD / timers (split from app.js, phase 1) */
function buildJapanoteQuizSessionsTable() {
  return {
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
}

var quizSessions = {};
function initJapanoteQuizSessions() {
  const next = buildJapanoteQuizSessionsTable();
  Object.keys(next).forEach((key) => {
    quizSessions[key] = next[key];
  });
}

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
    const nextLabel = session.isPaused
      ? key === "reading"
        ? getJapanoteButtonLabel("rereadPassage")
        : "다시 시작"
      : "일시정지";
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
