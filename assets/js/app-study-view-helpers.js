(function registerJapanoteStudyViewHelpers(global) {
  function applyStudyActionButtonState(button, selected, selectedClass, idleClass, disabled) {
    if (!button) {
      return;
    }

    button.disabled = disabled;
    button.classList.toggle(selectedClass, selected);
    button.classList.toggle(idleClass, !selected);
  }

  function renderStudyFlashcardComponent({
    flashcard,
    toggle,
    prev,
    next,
    level,
    word,
    reading,
    meaning,
    hint,
    hasCards,
    isRevealed,
    revealWhenEmpty = false,
    levelText,
    wordText,
    readingText = "",
    meaningText = "",
    hintText = "",
    hideReading = false,
    toggleOpenLabel,
    toggleClosedLabel,
    toggleEmptyLabel,
    prevDisabled = false,
    nextDisabled = false,
    actionButtons = [],
    formatLineBreaks = (value) => String(value ?? ""),
    normalizeText = (value) => String(value ?? "").trim()
  }) {
    if (!flashcard || !toggle || !level || !word || !reading || !meaning || !hint) {
      return;
    }

    level.textContent = formatLineBreaks(levelText || "");
    word.textContent = formatLineBreaks(wordText || "");
    reading.textContent = formatLineBreaks(readingText || "");
    reading.hidden = hideReading || !normalizeText(readingText || "");
    meaning.textContent = formatLineBreaks(meaningText || "");
    hint.textContent = hintText;

    flashcard.classList.toggle("is-revealed", isRevealed || (revealWhenEmpty && !hasCards));
    flashcard.classList.toggle("is-empty", !hasCards);
    toggle.disabled = !hasCards;
    toggle.setAttribute("aria-expanded", String(isRevealed));
    toggle.setAttribute(
      "aria-label",
      hasCards ? (isRevealed ? toggleOpenLabel : toggleClosedLabel) : toggleEmptyLabel
    );

    if (prev) {
      prev.disabled = !hasCards || prevDisabled;
    }

    if (next) {
      next.disabled = !hasCards || nextDisabled;
    }

    actionButtons.forEach((action) => {
      applyStudyActionButtonState(
        action.button,
        action.selected,
        action.selectedClass,
        action.idleClass,
        !hasCards || action.disabled === true
      );
    });
  }

  function createStudyListCardMarkup({
    index,
    headMetaMarkup = "",
    badgesMarkup = "",
    headRightMarkup,
    mainClassName = "vocab-list-main",
    titleClassName = "vocab-list-word",
    titleText = "",
    subtitleClassName = "vocab-list-reading",
    subtitleText = "",
    descriptionMarkup = "",
    actionsMarkup = ""
  }) {
    const headRight =
      headRightMarkup !== undefined
        ? headRightMarkup
        : `<div class="vocab-status-badges">${badgesMarkup}</div>`;

    return `
      <article class="vocab-list-card">
        <div class="vocab-list-card-head">
          <div class="kanji-list-head-meta">
            <span class="vocab-list-index">${index}</span>
            ${headMetaMarkup}
          </div>
          ${headRight}
        </div>
        <div class="${mainClassName}">
          <strong class="${titleClassName}">${titleText}</strong>
          <p class="${subtitleClassName}">${subtitleText}</p>
        </div>
        ${descriptionMarkup}
        ${actionsMarkup}
      </article>
    `;
  }

  function syncStudyViewButtons(selector, attributeName, activeValue) {
    document.querySelectorAll(selector).forEach((button) => {
      const active = button.getAttribute(attributeName) === activeValue;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderPagedStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    page,
    pageSize,
    emptyMessage,
    onPageChange,
    renderItem
  }) {
    if (!list || !pageInfo || !prev || !next) {
      return;
    }

    const safeItems = Array.isArray(items) ? items : [];
    const pageCount = Math.max(1, Math.ceil(safeItems.length / pageSize));
    const activePage = Math.min(Math.max(page, 1), pageCount);
    const startIndex = (activePage - 1) * pageSize;
    const pageItems = safeItems.slice(startIndex, startIndex + pageSize);

    if (activePage !== page && typeof onPageChange === "function") {
      onPageChange(activePage);
    }

    pageInfo.textContent = `${activePage} / ${pageCount}`;
    prev.disabled = activePage <= 1;
    next.disabled = activePage >= pageCount;

    if (!pageItems.length) {
      list.innerHTML = `<p class="vocab-list-empty">${emptyMessage}</p>`;
      return;
    }

    list.innerHTML = pageItems
      .map((item, index) => renderItem(item, startIndex + index + 1))
      .join("");
  }

  function getStudyPageCount(items, pageSize) {
    const safeItems = Array.isArray(items) ? items : [];
    return Math.max(1, Math.ceil(safeItems.length / pageSize));
  }

  function setElementHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function scrollElementIntoView(element) {
    if (!element?.scrollIntoView) {
      return;
    }

    global.requestAnimationFrame(() => {
      global.requestAnimationFrame(() => {
        element.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    });
  }

  function scrollToElementById(id) {
    scrollElementIntoView(document.getElementById(id));
  }

  function applyPageHeading(titleElement, copyElement, heading) {
    if (titleElement) {
      titleElement.textContent = heading?.title || "";
    }

    if (copyElement) {
      copyElement.textContent = heading?.description || "";
      copyElement.hidden = !heading?.description;
    }
  }

  function syncTabButtonsAndPanels({
    buttonSelector,
    panelSelector,
    buttonAttribute,
    panelAttribute,
    activeValue
  }) {
    document.querySelectorAll(buttonSelector).forEach((button) => {
      const isActive = button.dataset[buttonAttribute] === activeValue;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    document.querySelectorAll(panelSelector).forEach((panel) => {
      const isActive = panel.dataset[panelAttribute] === activeValue;
      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", String(!isActive));
    });
  }

  function syncStudyViewPanels(cardView, listView, activeView) {
    setElementHidden(cardView, activeView !== "card");
    setElementHidden(listView, activeView !== "list");
  }

  function renderStudyCatalogSection({ cardView, listView, activeView, renderFlashcard, renderList }) {
    syncStudyViewPanels(cardView, listView, activeView);

    if (typeof renderFlashcard === "function") {
      renderFlashcard();
    }

    if (typeof renderList === "function") {
      renderList();
    }
  }

  global.japanoteStudyViewHelpers = {
    applyStudyActionButtonState,
    renderStudyFlashcardComponent,
    createStudyListCardMarkup,
    syncStudyViewButtons,
    renderPagedStudyList,
    getStudyPageCount,
    setElementHidden,
    scrollElementIntoView,
    scrollToElementById,
    applyPageHeading,
    syncTabButtonsAndPanels,
    syncStudyViewPanels,
    renderStudyCatalogSection
  };
})(window);