const matchRoundSize = 5;

function normalizeMatchText(value) {
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

function getMatchReading(item) {
  return normalizeMatchText(item.showEntry || item.entry).replace(/-/g, "");
}

function getMatchMeaning(item) {
  if (!Array.isArray(item.means)) {
    return "";
  }

  return normalizeMatchText(item.means.find((value) => normalizeMatchText(value)) || "");
}

function shuffleMatchItems(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildMatchPool(source) {
  return source
    .map((item) => ({
      id: item.id || item.entry_id,
      reading: getMatchReading(item),
      meaning: getMatchMeaning(item)
    }))
    .filter((item) => item.id && item.reading && item.meaning)
    .filter(
      (item, index, pool) =>
        pool.findIndex(
          (candidate) => candidate.reading === item.reading && candidate.meaning === item.meaning
        ) === index
    );
}

function getMatchSource() {
  const vocabRegistry = globalThis.japanoteContent?.vocab || {};

  if (Array.isArray(vocabRegistry.N5) && vocabRegistry.N5.length) {
    return vocabRegistry.N5;
  }

  if (Array.isArray(vocabRegistry.jlptN5) && vocabRegistry.jlptN5.length) {
    return vocabRegistry.jlptN5;
  }

  if (Array.isArray(globalThis.jlptN5Vocab) && globalThis.jlptN5Vocab.length) {
    return globalThis.jlptN5Vocab;
  }

  return [];
}

let matchPool = buildMatchPool(getMatchSource());
const fallbackMatchPool = [
  { id: "match-fallback-1", reading: "たべる", meaning: "먹다" },
  { id: "match-fallback-2", reading: "いく", meaning: "가다" },
  { id: "match-fallback-3", reading: "みる", meaning: "보다" },
  { id: "match-fallback-4", reading: "がっこう", meaning: "학교" },
  { id: "match-fallback-5", reading: "ともだち", meaning: "친구" }
];

const matchState = {
  round: [],
  leftCards: [],
  rightCards: [],
  selectedLeft: null,
  selectedRight: null,
  matchedIds: [],
  attempts: 0,
  streak: 0,
  bestStreak: 0
};

function refreshMatchPool() {
  const nextPool = buildMatchPool(getMatchSource());
  matchPool = nextPool.length >= matchRoundSize ? nextPool : [...fallbackMatchPool];
}

function setMatchActionAvailability(enabled) {
  const newRound = document.getElementById("match-new-round");
  const resetRound = document.getElementById("match-reset-round");

  if (newRound) {
    newRound.disabled = !enabled;
  }

  if (resetRound) {
    resetRound.disabled = !enabled;
  }
}

function renderMatchUnavailableState(message) {
  const leftList = document.getElementById("match-left-list");
  const rightList = document.getElementById("match-right-list");

  matchState.round = [];
  matchState.leftCards = [];
  matchState.rightCards = [];
  matchState.selectedLeft = null;
  matchState.selectedRight = null;
  matchState.matchedIds = [];
  matchState.attempts = 0;
  matchState.streak = 0;

  if (leftList) {
    leftList.innerHTML = "";
  }

  if (rightList) {
    rightList.innerHTML = "";
  }

  setMatchActionAvailability(false);
  setMatchFeedback(message);
  renderMatchStats();
}

function createMatchRound() {
  const picked = shuffleMatchItems(matchPool).slice(0, matchRoundSize);

  matchState.round = picked;
  matchState.leftCards = shuffleMatchItems(
    picked.map((item) => ({
      id: item.id,
      value: item.reading,
      side: "left"
    }))
  );
  matchState.rightCards = shuffleMatchItems(
    picked.map((item) => ({
      id: item.id,
      value: item.meaning,
      side: "right"
    }))
  );
  matchState.selectedLeft = null;
  matchState.selectedRight = null;
  matchState.matchedIds = [];
  matchState.attempts = 0;
  matchState.streak = 0;
}

function renderMatchStats() {
  const progress = document.getElementById("match-progress");
  const attempts = document.getElementById("match-attempts");
  const streak = document.getElementById("match-streak");
  const best = document.getElementById("match-best");

  if (progress) {
    progress.textContent = `${matchState.matchedIds.length} / ${matchState.round.length}`;
  }
  if (attempts) {
    attempts.textContent = String(matchState.attempts);
  }
  if (streak) {
    streak.textContent = String(matchState.streak);
  }
  if (best) {
    best.textContent = String(matchState.bestStreak);
  }
}

function setMatchFeedback(message, tone = "") {
  const feedback = document.getElementById("match-feedback");

  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("is-success", "is-fail");

  if (tone) {
    feedback.classList.add(tone);
  }
}

function createMatchCard(card, selectedId) {
  const button = document.createElement("button");
  const matched = matchState.matchedIds.includes(card.id);

  button.type = "button";
  button.className = "match-card";
  button.textContent = card.value;
  button.disabled = matched;

  if (selectedId === card.id) {
    button.classList.add("is-selected");
  }

  if (matched) {
    button.classList.add("is-matched");
  }

  button.addEventListener("click", () => handleMatchSelection(card));
  return button;
}

function renderMatchBoard() {
  const leftList = document.getElementById("match-left-list");
  const rightList = document.getElementById("match-right-list");

  if (!leftList || !rightList) {
    return;
  }

  leftList.innerHTML = "";
  rightList.innerHTML = "";

  matchState.leftCards.forEach((card) => {
    leftList.appendChild(createMatchCard(card, matchState.selectedLeft));
  });
  matchState.rightCards.forEach((card) => {
    rightList.appendChild(createMatchCard(card, matchState.selectedRight));
  });

  renderMatchStats();
}

function resetSelectedCards() {
  matchState.selectedLeft = null;
  matchState.selectedRight = null;
}

function handleSuccessfulMatch(id) {
  matchState.matchedIds.push(id);
  matchState.streak += 1;
  matchState.bestStreak = Math.max(matchState.bestStreak, matchState.streak);

  if (matchState.matchedIds.length === matchState.round.length) {
    setMatchFeedback("와, 전부 맞혔어요! 새 라운드도 해볼까요?", "is-success");
  } else {
    setMatchFeedback("잘했어요! 다음 짝도 이어서 찾아봐요.", "is-success");
  }
}

function handleFailedMatch() {
  matchState.streak = 0;
  setMatchFeedback("조금 아쉬워요. 다른 카드를 골라볼까요?", "is-fail");
}

function handleMatchSelection(card) {
  if (matchState.matchedIds.includes(card.id)) {
    return;
  }

  if (card.side === "left") {
    matchState.selectedLeft = matchState.selectedLeft === card.id ? null : card.id;
  } else {
    matchState.selectedRight = matchState.selectedRight === card.id ? null : card.id;
  }

  renderMatchBoard();

  if (!matchState.selectedLeft || !matchState.selectedRight) {
    return;
  }

  matchState.attempts += 1;

  if (matchState.selectedLeft === matchState.selectedRight) {
    handleSuccessfulMatch(matchState.selectedLeft);
  } else {
    handleFailedMatch();
  }

  resetSelectedCards();
  renderMatchBoard();
}

function startNewMatchRound() {
  if (matchPool.length < matchRoundSize) {
    renderMatchUnavailableState("단어 데이터를 불러오는 중이에요. 잠시 후 다시 해볼까요?");
    return;
  }

  setMatchActionAvailability(true);
  createMatchRound();
  setMatchFeedback("왼쪽이랑 오른쪽에서 하나씩 골라 짝을 맞춰봐요.");
  renderMatchBoard();
}

function attachMatchEventListeners() {
  const newRound = document.getElementById("match-new-round");
  const resetRound = document.getElementById("match-reset-round");

  if (newRound) {
    newRound.addEventListener("click", startNewMatchRound);
  }
  if (resetRound) {
    resetRound.addEventListener("click", startNewMatchRound);
  }
}

refreshMatchPool();
attachMatchEventListeners();
startNewMatchRound();
