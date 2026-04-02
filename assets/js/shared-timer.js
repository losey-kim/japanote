(function (global) {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getDurationSeconds(timerState) {
    return Math.max(0, Number(timerState?.duration) || 0);
  }

  function getRemainingMs(timerState, { now = Date.now } = {}) {
    if (!timerState) {
      return 0;
    }

    if (Number.isFinite(timerState.deadlineAt)) {
      return Math.max(0, Number(timerState.deadlineAt) - now());
    }

    if (Number.isFinite(timerState.timeLeftMs)) {
      return Math.max(0, Number(timerState.timeLeftMs));
    }

    return Math.max(0, (Number(timerState.timeLeft) || 0) * 1000);
  }

  function getDisplaySeconds(timerState, remainingMs = getRemainingMs(timerState)) {
    if (!timerState || getDurationSeconds(timerState) <= 0 || remainingMs <= 0) {
      return 0;
    }

    return Math.ceil(remainingMs / 1000);
  }

  function formatClock(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function syncTimer(timerState, { now = Date.now } = {}) {
    if (!timerState || getDurationSeconds(timerState) <= 0 || !Number.isFinite(timerState.deadlineAt)) {
      return timerState;
    }

    const remainingMs = Math.max(0, Number(timerState.deadlineAt) - now());
    timerState.timeLeftMs = remainingMs;
    timerState.timeLeft = getDisplaySeconds(timerState, remainingMs);
    return timerState;
  }

  function resolveWarningThresholdSeconds(timerState, warningThresholdSeconds) {
    const duration = getDurationSeconds(timerState);

    if (typeof warningThresholdSeconds === "function") {
      return Math.max(0, Number(warningThresholdSeconds(duration, timerState)) || 0);
    }

    if (Number.isFinite(warningThresholdSeconds)) {
      return Math.max(0, Number(warningThresholdSeconds));
    }

    return Math.max(5, Math.floor(duration / 3));
  }

  function createSnapshot(timerState, options = {}) {
    const duration = getDurationSeconds(timerState);
    const remainingMs = getRemainingMs(timerState, options);
    const displaySeconds = getDisplaySeconds(timerState, remainingMs);
    const progress = duration > 0 ? clamp(remainingMs / (duration * 1000), 0, 1) : 0;
    const warningThresholdSeconds = resolveWarningThresholdSeconds(timerState, options.warningThresholdSeconds);
    const warningMs = warningThresholdSeconds * 1000;

    return {
      duration,
      remainingMs,
      displaySeconds,
      progress,
      isWarning: duration > 0 && remainingMs <= warningMs,
      isStatic: duration <= 0,
      shouldFreezeProgress: !timerState?.timerId || progress <= 0,
      text: duration <= 0 ? options.staticLabel || "천천히" : formatClock(displaySeconds)
    };
  }

  function updateTimerItem(timerItem, snapshot, instant = false) {
    if (!timerItem || !snapshot) {
      return;
    }

    const nextProgress = snapshot.progress.toFixed(3);
    const hud = timerItem.closest(".quiz-hud");
    const progressHost = hud || timerItem;
    const previousProgress = Number(progressHost.dataset.timerProgress || "1");
    const shouldReset = instant || snapshot.progress > previousProgress + 0.01;

    timerItem.classList.add("is-timer");
    if (hud) {
      hud.classList.add("has-timer");
    }

    [timerItem, hud].forEach((target) => {
      if (!target) {
        return;
      }

      target.classList.toggle("is-warning", snapshot.isWarning);
      target.classList.toggle("is-static", snapshot.isStatic);

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

  function renderTimer({
    timerId,
    timerState,
    warningThresholdSeconds,
    staticLabel = "천천히",
    instant = false
  }) {
    const timer = document.getElementById(timerId);

    if (!timer) {
      return null;
    }

    const snapshot = createSnapshot(timerState, { warningThresholdSeconds, staticLabel });
    const timerItem = timer.closest(".quiz-hud-item");

    timer.textContent = snapshot.text;
    timer.classList.toggle("is-warning", snapshot.isWarning);

    if (timerItem) {
      updateTimerItem(timerItem, snapshot, instant || snapshot.shouldFreezeProgress);
    }

    return snapshot;
  }

  function stopTimer(timerState, { sync = true, now = Date.now } = {}) {
    if (!timerState) {
      return false;
    }

    if (sync && Number.isFinite(timerState.deadlineAt)) {
      syncTimer(timerState, { now });
    }

    if (timerState.timerId) {
      window.clearInterval(timerState.timerId);
    }

    timerState.timerId = null;
    timerState.deadlineAt = null;
    return true;
  }

  function setDuration(timerState, durationSeconds, { resetRemaining = true } = {}) {
    if (!timerState) {
      return 0;
    }

    const nextDuration = Math.max(0, Number(durationSeconds) || 0);
    timerState.duration = nextDuration;

    if (resetRemaining) {
      timerState.timeLeft = nextDuration;
      timerState.timeLeftMs = nextDuration * 1000;
      timerState.deadlineAt = null;
    }

    return nextDuration;
  }

  function startTimer(timerState, { intervalMs = 100, onTick, onExpire, now = Date.now } = {}) {
    if (!timerState) {
      return false;
    }

    stopTimer(timerState, { now });

    const remainingMs = getRemainingMs(timerState, { now });
    const duration = getDurationSeconds(timerState);

    if (duration <= 0 || timerState.isPaused || remainingMs <= 0) {
      timerState.timeLeftMs = Math.max(0, remainingMs);
      timerState.timeLeft = getDisplaySeconds(timerState, remainingMs);
      timerState.deadlineAt = null;

      if (typeof onTick === "function") {
        onTick(createSnapshot(timerState, { now }));
      }

      if (remainingMs <= 0 && duration > 0 && !timerState.isPaused && typeof onExpire === "function") {
        onExpire(createSnapshot(timerState, { now }));
      }

      return false;
    }

    timerState.deadlineAt = now() + remainingMs;
    timerState.timeLeftMs = remainingMs;
    timerState.timeLeft = getDisplaySeconds(timerState, remainingMs);
    timerState.timerId = window.setInterval(() => {
      syncTimer(timerState, { now });
      const snapshot = createSnapshot(timerState, { now });

      if (typeof onTick === "function") {
        onTick(snapshot);
      }

      if (snapshot.remainingMs === 0) {
        stopTimer(timerState, { sync: false, now });

        if (typeof onExpire === "function") {
          onExpire(snapshot);
        }
      }
    }, intervalMs);

    if (typeof onTick === "function") {
      onTick(createSnapshot(timerState, { now }));
    }

    return true;
  }

  function resetTimer(timerState, { intervalMs = 100, onTick, onExpire, autoStart = true, now = Date.now } = {}) {
    if (!timerState) {
      return false;
    }

    stopTimer(timerState, { sync: false, now });
    timerState.isPaused = false;

    const duration = getDurationSeconds(timerState);
    timerState.timeLeft = duration;
    timerState.timeLeftMs = duration * 1000;
    timerState.deadlineAt = null;

    if (!autoStart || duration <= 0) {
      if (typeof onTick === "function") {
        onTick(createSnapshot(timerState, { now }));
      }
      return false;
    }

    return startTimer(timerState, { intervalMs, onTick, onExpire, now });
  }

  function pauseTimer(timerState, { onTick, now = Date.now } = {}) {
    if (!timerState || getDurationSeconds(timerState) <= 0 || timerState.isPaused || !timerState.timerId) {
      return false;
    }

    stopTimer(timerState, { now });
    timerState.isPaused = true;

    if (typeof onTick === "function") {
      onTick(createSnapshot(timerState, { now }));
    }

    return true;
  }

  function resumeTimer(timerState, options = {}) {
    if (!timerState || getDurationSeconds(timerState) <= 0 || !timerState.isPaused) {
      return false;
    }

    timerState.isPaused = false;
    return startTimer(timerState, options);
  }

  global.japanoteSharedTimer = {
    createSnapshot,
    formatClock,
    getDisplaySeconds,
    getRemainingMs,
    pauseTimer,
    renderTimer,
    resetTimer,
    resumeTimer,
    setDuration,
    startTimer,
    stopTimer,
    syncTimer,
    updateTimerItem
  };
})(globalThis);
