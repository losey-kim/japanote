globalThis.japanoteMatchCopy = {
  resultFilterLabels: {
    all: "전체",
    correct: "정답",
    wrong: "오답"
  },
  studyFilterLabels: {
    all: "전체",
    review: "다시 볼래요",
    mastered: "익혔어요",
    unmarked: "아직 안 골랐어요"
  },
  formatDurationLabel(duration) {
    const activeDuration = Number(duration);
    return activeDuration <= 0 ? "천천히" : `${activeDuration}초`;
  },
  joinSummaryItems(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).join(" · ");
  },
  getBulkActionLabel(allSaved) {
    return allSaved ? "다시 보기 해제" : "다시 보기로 표시";
  },
  getBulkActionTitle({ count, itemLabel, allSaved }) {
    const label = itemLabel || "항목";

    if (!count) {
      return `지금 담을 ${label}가 없어요.`;
    }

    return allSaved ? "다시 보기 해제" : "다시 보기로 표시";
  },
  getSavedActionLabel(saved) {
    return saved ? "다시 보기 해제" : "다시 보기로 표시";
  },
  getActionButtonText(isResetState) {
    return {
      label: isResetState ? "다시 해볼까요?" : "시작해볼까요?",
      icon: isResetState ? "autorenew" : "play_arrow"
    };
  },
  getReadyStateText() {
    return {
      ready: "시작해볼까요?",
      unavailable: "지금은 준비 중이에요."
    };
  },
  getEmptyResultsText(filterLabel) {
    const label = filterLabel || "선택한";
    return `${label} 결과가 아직 없어요.`;
  }
};
