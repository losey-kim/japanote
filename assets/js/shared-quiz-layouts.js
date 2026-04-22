(function initSharedQuizLayouts(global) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAttributes(attributes = {}) {
    return Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null && value !== false)
      .map(([key, value]) => {
        if (value === true) {
          return key;
        }

        return `${key}="${escapeHtml(value)}"`;
      })
      .join(" ");
  }

  function createSelectField({
    id,
    label,
    ariaLabel,
    options,
    wrapperClass = "vocab-select-wrap",
    includeLabel = true
  }) {
    const optionMarkup = (options || [])
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    const containerTag = includeLabel ? "label" : "div";
    const containerAttributes = includeLabel ? ` for="${escapeHtml(id)}"` : "";
    const labelMarkup = includeLabel ? `<span>${escapeHtml(label)}</span>` : "";

    return `
      <${containerTag} class="vocab-select-field"${containerAttributes}>
        ${labelMarkup}
        <div class="${escapeHtml(wrapperClass)}">
          <select class="vocab-select" id="${escapeHtml(id)}" aria-label="${escapeHtml(ariaLabel)}">
            ${optionMarkup}
          </select>
          <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
        </div>
      </${containerTag}>
    `;
  }

  function createValueSpinner({ spinnerId, ariaLabel, valueLabel, decrementAriaLabel, incrementAriaLabel }) {
    return `
      <div class="study-spinner" data-spinner-id="${escapeHtml(spinnerId)}" role="group" aria-label="${escapeHtml(ariaLabel)}">
        <button class="study-spinner-button" type="button" data-spinner-direction="-1" aria-label="${escapeHtml(decrementAriaLabel)}">
          <span class="material-symbols-rounded" aria-hidden="true">remove</span>
        </button>
        <output class="study-spinner-value" data-spinner-value aria-live="polite">${escapeHtml(valueLabel)}</output>
        <button class="study-spinner-button" type="button" data-spinner-direction="1" aria-label="${escapeHtml(incrementAriaLabel)}">
          <span class="material-symbols-rounded" aria-hidden="true">add</span>
        </button>
      </div>
    `;
  }

  function createQuestionCountSpinner({ spinnerId, ariaLabel, activeValue }) {
    return createValueSpinner({
      spinnerId,
      ariaLabel,
      valueLabel: `${activeValue}문제`,
      decrementAriaLabel: `${ariaLabel} 줄이기`,
      incrementAriaLabel: `${ariaLabel} 늘리기`
    });
  }

  function createDurationSpinner({ spinnerId, ariaLabel, activeValue }) {
    return createValueSpinner({
      spinnerId,
      ariaLabel,
      valueLabel: activeValue === 0 ? "천천히" : `${activeValue}초`,
      decrementAriaLabel: `${ariaLabel} 줄이기`,
      incrementAriaLabel: `${ariaLabel} 늘리기`
    });
  }

  function createStudySelectGroup({ groupLabel, id, label = groupLabel, ariaLabel, options = [] }) {
    return {
      label: groupLabel,
      content: createSelectField({
        id,
        label,
        ariaLabel,
        includeLabel: false,
        options
      })
    };
  }

  function createQuizFieldGroups({ questionField, optionField }) {
    return [createStudySelectGroup(questionField), createStudySelectGroup(optionField)];
  }

  const JLPT_LEVEL_OPTIONS = [
    { value: "all", label: "전체" },
    { value: "N5", label: "N5" },
    { value: "N4", label: "N4" },
    { value: "N3", label: "N3" }
  ];

  const VOCAB_LEVEL_OPTIONS_CATALOG = [
    { value: "N5", label: "N5" },
    { value: "N4", label: "N4" },
    { value: "N3", label: "N3" },
    { value: "all", label: "전체" }
  ];

  const KANJI_GRADE_FILTER_OPTIONS = [
    { value: "all", label: "전체" },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n}학년` }))
  ];

  const KANJI_COLLECTION_OPTIONS_CATALOG = [
    { value: "all", label: "전체" },
    { value: "review", label: "다시 볼래요" },
    { value: "mastered", label: "익혔어요" },
    { value: "unmarked", label: "아직 안 봤어요" }
  ];
  const GRAMMAR_COLLECTION_OPTIONS_CATALOG = [
    { value: "all", label: "전체" },
    { value: "review", label: "다시 볼래요" },
    { value: "mastered", label: "익혔어요" },
    { value: "unmarked", label: "미분류" }
  ];

  const KANJI_COLLECTION_OPTIONS_BASIC = [
    { value: "all", label: "전체" },
    { value: "review", label: "다시 볼래요" },
    { value: "mastered", label: "익혔어요" }
  ];

  const DEFAULT_PART_OPTIONS = [{ value: "all", label: "전체 품사" }];

  function buildKanjiGradeCollectionSelectFields({
    gradeSelectId,
    collectionSelectId,
    ariaPrefix,
    collectionOptions = KANJI_COLLECTION_OPTIONS_CATALOG,
    fieldOrder = "grade-first"
  }) {
    const gradeField = createSelectField({
      id: gradeSelectId,
      label: "학년",
      ariaLabel: `${ariaPrefix} 학년 고르기`,
      options: KANJI_GRADE_FILTER_OPTIONS
    });
    const collectionField = createSelectField({
      id: collectionSelectId,
      label: "모아보기",
      ariaLabel: `${ariaPrefix} 모아보기 고르기`,
      options: collectionOptions
    });
    return fieldOrder === "collection-first" ? [collectionField, gradeField] : [gradeField, collectionField];
  }

  function createKanjiGradeCollectionToolbarHtml({
    toolbarAriaLabel,
    toolbarClassName,
    gradeSelectId,
    collectionSelectId,
    ariaPrefix,
    collectionOptions,
    fieldOrder
  }) {
    const fields = buildKanjiGradeCollectionSelectFields({
      gradeSelectId,
      collectionSelectId,
      ariaPrefix,
      collectionOptions,
      fieldOrder
    });
    return `
      <div class="${escapeHtml(toolbarClassName)}" aria-label="${escapeHtml(toolbarAriaLabel)}">
        ${fields.join("")}
      </div>
    `;
  }

  function buildVocabLevelFilterPartSelectFields({
    levelId,
    filterId,
    partId,
    ariaPrefix,
    levelOptions,
    collectionOptions,
    partOptions = DEFAULT_PART_OPTIONS,
    partAriaLabel
  }) {
    return [
      createSelectField({
        id: levelId,
        label: "레벨",
        ariaLabel: `${ariaPrefix} 레벨 고르기`,
        options: levelOptions
      }),
      createSelectField({
        id: filterId,
        label: "모아보기",
        ariaLabel: `${ariaPrefix} 모아보기 고르기`,
        options: collectionOptions
      }),
      createSelectField({
        id: partId,
        label: "품사",
        ariaLabel: partAriaLabel || `${ariaPrefix} 품사 고르기`,
        options: partOptions
      })
    ];
  }

  function buildLevelCollectionSelectFields({
    levelId,
    collectionId,
    ariaPrefix,
    levelOptions = JLPT_LEVEL_OPTIONS,
    collectionOptions = KANJI_COLLECTION_OPTIONS_CATALOG,
    levelLabel = "레벨"
  }) {
    return [
      createSelectField({
        id: levelId,
        label: levelLabel,
        ariaLabel: `${ariaPrefix} ${levelLabel} 고르기`,
        options: levelOptions
      }),
      createSelectField({
        id: collectionId,
        label: "모아보기",
        ariaLabel: `${ariaPrefix} 모아보기 고르기`,
        options: collectionOptions
      })
    ];
  }

  function createVocabQuizSidebarToolbarHtml() {
    const fields = buildVocabLevelFilterPartSelectFields({
      levelId: "vocab-quiz-level-select",
      filterId: "vocab-quiz-filter-select",
      partId: "vocab-quiz-part-select",
      ariaPrefix: "단어 퀴즈",
      levelOptions: JLPT_LEVEL_OPTIONS,
      collectionOptions: KANJI_COLLECTION_OPTIONS_BASIC
    });
    return `
      <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="단어 퀴즈 필터">
        ${fields.join("")}
      </div>
    `;
  }

  function createMatchSidebarVocabToolbarHtml() {
    const fields = buildVocabLevelFilterPartSelectFields({
      levelId: "match-level-select",
      filterId: "match-filter-select",
      partId: "match-part-select",
      ariaPrefix: "짝 맞추기",
      levelOptions: JLPT_LEVEL_OPTIONS,
      collectionOptions: KANJI_COLLECTION_OPTIONS_BASIC
    });
    return `
      <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="짝 맞추기 필터">
        ${fields.join("")}
      </div>
    `;
  }

  function createGrammarMatchSidebarToolbarHtml() {
    const fields = buildLevelCollectionSelectFields({
      levelId: "grammar-match-level-select",
      collectionId: "grammar-match-filter-select",
      ariaPrefix: "문법 짝 맞추기",
      levelOptions: JLPT_LEVEL_OPTIONS,
      collectionOptions: GRAMMAR_COLLECTION_OPTIONS_CATALOG
    });

    return `
      <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="문법 짝 맞추기 필터">
        ${fields.join("")}
      </div>
    `;
  }

  function createStudyOptionsShell({
    shellId,
    shellClassName = "",
    toggleId,
    toggleTitle,
    summaryId,
    summaryText,
    panelId,
    panelClassName = "",
    isOpen = false,
    groups = []
  }) {
    const shellClass = ["study-options-shell", shellClassName].filter(Boolean).join(" ").trim();
    const panelClass = ["study-options-panel", panelClassName].filter(Boolean).join(" ").trim();
    const groupMarkup = groups
      .map(
        (group) => `
          <div class="study-options-group">
            <span>${escapeHtml(group.label)}</span>
            ${group.content}
          </div>
        `
      )
      .join("");

    return `
      <div class="${escapeHtml(shellClass)}" id="${escapeHtml(shellId)}">
        <button class="study-options-toggle" id="${escapeHtml(toggleId)}" type="button" aria-expanded="${isOpen ? "true" : "false"}" aria-controls="${escapeHtml(panelId)}" aria-label="${escapeHtml(toggleTitle)}" title="${escapeHtml(toggleTitle)}">
          <div class="study-options-toggle-copy">
            <strong>${escapeHtml(toggleTitle)}</strong>
            <p class="study-options-toggle-summary" id="${escapeHtml(summaryId)}">${escapeHtml(summaryText)}</p>
          </div>
          <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
        </button>
        <div class="${escapeHtml(panelClass)}" id="${escapeHtml(panelId)}" aria-hidden="${isOpen ? "false" : "true"}"${isOpen ? "" : " hidden"}>
          ${groupMarkup}
        </div>
      </div>
    `;
  }

  function createStatsGrid({ id, className = "match-stats-grid", items = [], hidden = false }) {
    const cards = items
      .map(
        (item) => `
          <div class="match-stat-card">
            <span>${escapeHtml(item.label)}</span>
            <strong id="${escapeHtml(item.valueId)}">${escapeHtml(item.value)}</strong>
          </div>
        `
      )
      .join("");
    const idAttribute = id ? ` id="${escapeHtml(id)}"` : "";
    const hiddenAttribute = hidden ? " hidden" : "";

    return `<div class="${escapeHtml(className)}"${idAttribute}${hiddenAttribute}>${cards}</div>`;
  }

  function createActionButton({ id, labelId, label, icon = "play_arrow", buttonClass = "primary-btn button-with-icon" }) {
    return `
      <div class="match-actions">
        <button class="${escapeHtml(buttonClass)}" id="${escapeHtml(id)}" type="button">
          <span class="material-symbols-rounded" aria-hidden="true">${escapeHtml(icon)}</span>
          <span id="${escapeHtml(labelId)}">${escapeHtml(label)}</span>
        </button>
      </div>
    `;
  }

  const QUIZ_EMPTY_MESSAGE = "시작해볼까요?";
  const QUIZ_READY_TO_START_HINT = "준비됐다면 시작해봐요";
  const QUIZ_BOARD_READY_MESSAGE = "퀴즈를 준비하고 있어요.";
  const QUIZ_RESULT_EMPTY_MESSAGE = "아직 결과가 없어요. 문제를 풀고 다시 확인해봐요.";
  const QUIZ_RESULT_ALL_ACTION_LABEL = "전체 담기";
  const QUIZ_RESULT_RETRY_ALL_ACTION_LABEL = "전체 다시 볼래요";

  const QUIZ_RESULT_MASTERED_ACTION_LABEL = "익힘으로 표시";

  const QUIZ_RESULT_REVIEW_ACTION_LABEL = "다시 보기로 표시";
  const QUIZ_RESULT_LEARN_ACTION_LABEL = "익힘으로 표시";

  function getJapanoteBtn(key, fallback) {
    const fn = global.getJapanoteButtonLabel;
    if (typeof fn === "function") {
      const t = fn(key);
      if (t) {
        return t;
      }
    }
    return fallback;
  }

  function reviewResultBulkAction(id, labelId) {
    return {
      id,
      labelId,
      label: getJapanoteBtn("reviewSaveShort", "다시 보기"),
      title: getJapanoteBtn("reviewSave", QUIZ_RESULT_REVIEW_ACTION_LABEL)
    };
  }

  function masteredResultBulkAction(id, labelId, icon) {
    return {
      id,
      labelId,
      label: getJapanoteBtn("masteredSaveShort", "익힘"),
      title: getJapanoteBtn("masteredSave", QUIZ_RESULT_LEARN_ACTION_LABEL),
      icon: icon || "check_circle"
    };
  }

  function createPracticeEmptyMessage({ id, text = QUIZ_EMPTY_MESSAGE }) {
    return `<p class="vocab-list-empty" id="${escapeHtml(id)}" hidden>${escapeHtml(text)}</p>`;
  }

  function createQuestionDurationGroups({
    countSpinnerId,
    countAriaLabel,
    countValue,
    durationSpinnerId,
    durationAriaLabel,
    durationValue,
    countLabel = "문항 수",
    durationLabel = "문항당 제한시간"
  }) {
    return [
      {
        label: countLabel,
        content: createQuestionCountSpinner({
          spinnerId: countSpinnerId,
          ariaLabel: countAriaLabel,
          activeValue: countValue
        })
      },
      {
        label: durationLabel,
        content: createDurationSpinner({
          spinnerId: durationSpinnerId,
          ariaLabel: durationAriaLabel,
          activeValue: durationValue
        })
      }
    ];
  }

  function createStartQuizButton({ id, labelId }) {
    return createActionButton({
      id,
      labelId,
      label: "시작해볼까요?"
    });
  }

  function createStudyViewSwitch({ ariaLabel, buttons = [] }) {
    const buttonMarkup = buttons
      .map((button) => {
        const attributes = renderAttributes(button.attributes || {});
        const spacing = attributes ? ` ${attributes}` : "";
        const className = ["study-view-button", button.className].filter(Boolean).join(" ");

        return `
          <button class="${escapeHtml(className)}" type="button"${spacing}>
            <span class="material-symbols-rounded" aria-hidden="true">${escapeHtml(button.icon)}</span>
          </button>
        `;
      })
      .join("");

    return `<div class="study-view-switch" role="tablist" aria-label="${escapeHtml(ariaLabel)}">${buttonMarkup}</div>`;
  }

  function createStudyFlashcardBlock({
    viewId,
    viewClassName = "vocab-card-view",
    articleClassName = "flashcard",
    articleId,
    toggleId,
    meaningId,
    levelId,
    levelText,
    wordId,
    wordText,
    readingId,
    readingText,
    readingHidden = false,
    meaningText,
    hintId,
    hintText,
    navAriaLabel,
    prevButton,
    nextButton,
    actionButtons = []
  }) {
    const actionMarkup = actionButtons
      .map((button) => {
        const attributes = renderAttributes(button.attributes || {});
        const buttonAttributes = attributes ? ` ${attributes}` : "";
        const iconAttributes = renderAttributes(button.iconAttributes || {});
        const iconMarkup = button.icon
          ? `<span class="material-symbols-rounded" aria-hidden="true"${iconAttributes ? ` ${iconAttributes}` : ""}>${escapeHtml(button.icon)}</span>`
          : "";
        const labelAttributes = renderAttributes(button.labelAttributes || {});

        return `
          <button class="${escapeHtml(button.className)}" id="${escapeHtml(button.id)}" type="button"${buttonAttributes}>
            ${iconMarkup}
            <span${labelAttributes ? ` ${labelAttributes}` : ""}>${escapeHtml(button.label)}</span>
          </button>
        `;
      })
      .join("");

    return `
      <div class="${escapeHtml(viewClassName)}" id="${escapeHtml(viewId)}" hidden>
        <article class="${escapeHtml(articleClassName)}" id="${escapeHtml(articleId)}" aria-live="polite">
          <button class="flashcard-toggle" id="${escapeHtml(toggleId)}" type="button" aria-controls="${escapeHtml(meaningId)}" aria-expanded="false">
            <span class="flashcard-level" id="${escapeHtml(levelId)}">${escapeHtml(levelText)}</span>
            <div class="flashcard-copy">
              <strong class="flashcard-word${articleClassName.includes("kanji-flashcard") ? " kanji-flashcard-word" : ""}" id="${escapeHtml(wordId)}">${escapeHtml(wordText)}</strong>
              <p class="flashcard-reading${articleClassName.includes("kanji-flashcard") ? " kanji-flashcard-reading" : ""}" id="${escapeHtml(readingId)}"${readingHidden ? " hidden" : ""}>${escapeHtml(readingText)}</p>
              <p class="flashcard-meaning${articleClassName.includes("kanji-flashcard") ? " kanji-flashcard-meaning" : ""}" id="${escapeHtml(meaningId)}">${escapeHtml(meaningText)}</p>
            </div>
            <span class="flashcard-hint" id="${escapeHtml(hintId)}">${escapeHtml(hintText)}</span>
          </button>
          <div class="flashcard-inline-nav" aria-label="${escapeHtml(navAriaLabel)}">
            <button class="secondary-btn flashcard-nav-btn icon-only-btn" id="${escapeHtml(prevButton.id)}" type="button" aria-label="${escapeHtml(prevButton.ariaLabel)}" title="${escapeHtml(prevButton.title)}"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button>
            <button class="secondary-btn flashcard-nav-btn icon-only-btn" id="${escapeHtml(nextButton.id)}" type="button" aria-label="${escapeHtml(nextButton.ariaLabel)}" title="${escapeHtml(nextButton.title)}"><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
          </div>
        </article>
        <div class="flashcard-actions">
          ${actionMarkup}
        </div>
      </div>
    `;
  }

  function createStudyListBlock({
    viewId,
    viewClassName = "vocab-list-view",
    listClassName = "vocab-list",
    listId,
    prevId,
    pageInfoId,
    nextId
  }) {
    return `
      <div class="${escapeHtml(viewClassName)}" id="${escapeHtml(viewId)}" hidden>
        <div class="${escapeHtml(listClassName)}" id="${escapeHtml(listId)}"></div>
        <div class="vocab-pagination">
          <button class="secondary-btn button-with-icon" id="${escapeHtml(prevId)}" type="button"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span><span>이전</span></button>
          <span class="vocab-page-info" id="${escapeHtml(pageInfoId)}">1 / 1</span>
          <button class="secondary-btn button-with-icon" id="${escapeHtml(nextId)}" type="button"><span>다음</span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
        </div>
      </div>
    `;
  }

  function createStudyCatalogLayout({
    toolbarClassName = "vocab-select-toolbar",
    toolbarAriaLabel,
    selectFields = [],
    summaryId,
    summaryText,
    viewSwitchAriaLabel,
    viewButtons,
    flashcard,
    listView,
    panelHeadLayout = "spread"
  }) {
    const viewSwitchMarkup = createStudyViewSwitch({ ariaLabel: viewSwitchAriaLabel, buttons: viewButtons });
    const headBlock =
      panelHeadLayout === "inline"
        ? `
        <div class="study-panel-head study-panel-head--inline">
          <div class="study-panel-summary-row">
            <p class="vocab-summary" id="${escapeHtml(summaryId)}">${escapeHtml(summaryText)}</p>
            ${viewSwitchMarkup}
          </div>
        </div>
      `
        : `
        <div class="study-panel-head">
          <p class="vocab-summary" id="${escapeHtml(summaryId)}">${escapeHtml(summaryText)}</p>
          ${viewSwitchMarkup}
        </div>
      `;
    return `
      <div class="flashcard-panel">
        <div class="${escapeHtml(toolbarClassName)}" aria-label="${escapeHtml(toolbarAriaLabel)}">
          ${selectFields.join("")}
        </div>
        ${headBlock}
        ${createStudyFlashcardBlock(flashcard)}
        ${createStudyListBlock(listView)}
      </div>
    `;
  }

  function createCatalogViewButtons({ scope }) {
    const dataAttribute = `data-${scope}-view`;
    const cardLabel = "카드 보기";
    const listLabel = "목록 보기";

    return [
      {
        icon: "style",
        className: "is-active",
        attributes: {
          [dataAttribute]: "card",
          "aria-pressed": "true",
          "aria-label": cardLabel,
          title: cardLabel
        }
      },
      {
        icon: "view_list",
        attributes: {
          [dataAttribute]: "list",
          "aria-pressed": "false",
          "aria-label": listLabel,
          title: listLabel
        }
      }
    ];
  }

  function createCatalogActionButtons({ againId, masteredId, leadingButtons = [] }) {
    return [
      ...leadingButtons,
      { id: againId, className: "secondary-btn", label: "다시 볼래요" },
      { id: masteredId, className: "primary-btn", label: "마스터했어요!" }
    ];
  }

  function createCatalogNavigationLabels({ scopeLabel, prevId, nextId }) {
    return {
      prevButton: {
        id: prevId,
        ariaLabel: `이전 ${scopeLabel}`,
        title: `이전 ${scopeLabel}`
      },
      nextButton: {
        id: nextId,
        ariaLabel: `다음 ${scopeLabel}`,
        title: `다음 ${scopeLabel}`
      }
    };
  }

  function createCatalogListViewConfig({ scope, viewClassName = "vocab-list-view", listClassName = "vocab-list" }) {
    return {
      viewId: `${scope}-list-view`,
      viewClassName,
      listClassName,
      listId: `${scope}-list`,
      prevId: `${scope}-page-prev`,
      pageInfoId: `${scope}-page-info`,
      nextId: `${scope}-page-next`
    };
  }

  function createCatalogFlashcardConfig({
    viewId,
    viewClassName = "vocab-card-view",
    articleClassName = "flashcard",
    articleId,
    toggleId,
    meaningId,
    levelId,
    levelText,
    wordId,
    wordText,
    readingId,
    readingText,
    readingHidden = false,
    meaningText,
    hintId,
    hintText,
    navAriaLabel,
    scopeLabel,
    prevId,
    nextId,
    againId,
    masteredId,
    leadingActionButtons = []
  }) {
    return {
      viewId,
      viewClassName,
      articleClassName,
      articleId,
      toggleId,
      meaningId,
      levelId,
      levelText,
      wordId,
      wordText,
      readingId,
      readingText,
      readingHidden,
      meaningText,
      hintId,
      hintText,
      navAriaLabel,
      ...createCatalogNavigationLabels({
        scopeLabel,
        prevId,
        nextId
      }),
      actionButtons: createCatalogActionButtons({
        againId,
        masteredId,
        leadingButtons: leadingActionButtons
      })
    };
  }

  function createCatalogLayout({
    toolbarClassName = "vocab-select-toolbar",
    panelHeadLayout = "spread",
    toolbarAriaLabel,
    selectFields,
    summaryId,
    summaryText,
    viewSwitchAriaLabel,
    viewButtonsScope,
    flashcard,
    listView
  }) {
    return createStudyCatalogLayout({
      toolbarClassName,
      panelHeadLayout,
      toolbarAriaLabel,
      selectFields,
      summaryId,
      summaryText,
      viewSwitchAriaLabel,
      viewButtons: createCatalogViewButtons({ scope: viewButtonsScope }),
      flashcard,
      listView
    });
  }

  const CATALOG_LAYOUT_SCOPE_MAP = {
    vocab: {
      viewButtonsScope: "vocab",
      toolbarAriaLabel: "단어 필터",
      toolbarClassName: "vocab-select-toolbar",
      panelHeadLayout: "spread",
      selectFields: buildVocabLevelFilterPartSelectFields({
        levelId: "vocab-level-select",
        filterId: "vocab-filter-select",
        partId: "vocab-part-select",
        ariaPrefix: "단어",
        levelOptions: VOCAB_LEVEL_OPTIONS_CATALOG,
        collectionOptions: KANJI_COLLECTION_OPTIONS_CATALOG,
        partAriaLabel: "품사별로 보기"
      }),
      summaryId: "vocab-summary",
      summaryText: "0개 모였어요",
      viewSwitchAriaLabel: "단어 보기 방식 고르기",
      flashcard: createCatalogFlashcardConfig({
        viewId: "vocab-card-view",
        articleId: "flashcard",
        toggleId: "flashcard-toggle",
        meaningId: "flashcard-meaning",
        levelId: "flashcard-level",
        levelText: "N5",
        wordId: "flashcard-word",
        wordText: "불러오는 중이에요",
        readingId: "flashcard-reading",
        readingText: "단어를 불러오고 있어요.",
        meaningText: "뜻도 곧 보여줄게요.",
        hintId: "flashcard-hint",
        hintText: "눌러서 뜻을 확인해봐요.",
        navAriaLabel: "단어 넘기기",
        scopeLabel: "카드",
        prevId: "flashcard-prev",
        nextId: "flashcard-next",
        againId: "flashcard-again",
        masteredId: "flashcard-mastered"
      }),
      listView: createCatalogListViewConfig({ scope: "vocab" })
    },
    kanji: {
      viewButtonsScope: "kanji",
      toolbarAriaLabel: "한자 필터",
      toolbarClassName: "vocab-select-toolbar kanji-filter-toolbar",
      panelHeadLayout: "inline",
      selectFields: buildKanjiGradeCollectionSelectFields({
        gradeSelectId: "kanji-grade-select",
        collectionSelectId: "kanji-collection-select",
        ariaPrefix: "한자",
        collectionOptions: KANJI_COLLECTION_OPTIONS_CATALOG,
        fieldOrder: "grade-first"
      }),
      summaryId: "kanji-summary",
      summaryText: "0개 한자를 준비하고 있어요",
      viewSwitchAriaLabel: "한자 보기 방식 고르기",
      flashcard: createCatalogFlashcardConfig({
        viewId: "kanji-card-view",
        viewClassName: "vocab-card-view kanji-card-view",
        articleClassName: "flashcard kanji-flashcard",
        articleId: "kanji-flashcard",
        toggleId: "kanji-flashcard-toggle",
        meaningId: "kanji-flashcard-meaning",
        levelId: "kanji-flashcard-level",
        levelText: "한자",
        wordId: "kanji-flashcard-word",
        wordText: "漢字",
        readingId: "kanji-flashcard-reading",
        readingText: "",
        readingHidden: true,
        meaningText: "かんじ",
        hintId: "kanji-flashcard-hint",
        hintText: "눌러서 읽기를 확인해볼까요?",
        navAriaLabel: "한자 익히기",
        scopeLabel: "한자",
        prevId: "kanji-flashcard-prev",
        nextId: "kanji-flashcard-next",
        againId: "kanji-flashcard-review",
        masteredId: "kanji-flashcard-mastered"
      }),
      listView: createCatalogListViewConfig({
        scope: "kanji",
        viewClassName: "vocab-list-view kanji-list-view",
        listClassName: "vocab-list kanji-list"
      })
    },
    grammar: {
      viewButtonsScope: "grammar",
      toolbarAriaLabel: "문법 필터",
      toolbarClassName: "vocab-select-toolbar grammar-filter-toolbar",
      panelHeadLayout: "inline",
      selectFields: buildLevelCollectionSelectFields({
        levelId: "grammar-level-select",
        collectionId: "grammar-filter-select",
        ariaPrefix: "문법",
        collectionOptions: GRAMMAR_COLLECTION_OPTIONS_CATALOG
      }),
      summaryId: "grammar-summary",
      summaryText: "문법을 준비하고 있어요",
      viewSwitchAriaLabel: "문법 보기 방식 고르기",
      flashcard: createCatalogFlashcardConfig({
        viewId: "grammar-card-view",
        viewClassName: "vocab-card-view grammar-card-view",
        articleClassName: "flashcard grammar-flashcard",
        articleId: "grammar-flashcard",
        toggleId: "grammar-flashcard-toggle",
        meaningId: "grammar-flashcard-meaning",
        levelId: "grammar-flashcard-level",
        levelText: "N5",
        wordId: "grammar-flashcard-word",
        wordText: "문법을 불러오고 있어요",
        readingId: "grammar-flashcard-reading",
        readingText: "",
        readingHidden: true,
        meaningText: "설명은 뒤집으면 볼 수 있어요",
        hintId: "grammar-flashcard-hint",
        hintText: "눌러서 설명을 확인해봐요",
        navAriaLabel: "문법 카드 넘기기",
        scopeLabel: "문법",
        prevId: "grammar-flashcard-prev",
        nextId: "grammar-flashcard-next",
        againId: "grammar-flashcard-review",
        masteredId: "grammar-flashcard-mastered"
      }),
      listView: createCatalogListViewConfig({
        scope: "grammar",
        viewClassName: "vocab-list-view grammar-list-view",
        listClassName: "vocab-list grammar-list"
      })
    }
  };

  function createCatalogLayoutByScope(scope) {
    const config = CATALOG_LAYOUT_SCOPE_MAP[scope];
    if (!config) {
      return createCatalogLayout({});
    }
    return createCatalogLayout({ ...config });
  }

  function createQuizHudPauseButton(buttonId) {
    if (!buttonId) {
      return "";
    }

    return `
      <button class="quiz-hud-pause" id="${escapeHtml(buttonId)}" type="button" aria-label="일시정지" title="일시정지">
        <span class="quiz-hud-pause-glyph" aria-hidden="true"></span>
      </button>
    `;
  }

  function createQuizHudItem(item, className = "quiz-hud-item") {
    const itemKind = item.kind || "";
    const classNames = ["quiz-hud-item"];

    if (className && className !== "quiz-hud-item") {
      classNames.push(className);
    }

    if (itemKind) {
      classNames.push(`is-${itemKind}`);
    }

    return `
      <div class="${classNames.join(" ")}"${itemKind ? ` data-hud-kind="${escapeHtml(itemKind)}"` : ""}>
        <div class="quiz-hud-item-copy">
          <span>${escapeHtml(item.label)}</span>
          <strong id="${escapeHtml(item.valueId)}">${escapeHtml(item.value)}</strong>
        </div>
      </div>
    `;
  }

  function createQuizHudMarkup(hudItems = [], extraClassName = "", options = {}) {
    if (!hudItems.length) {
      return "";
    }

    const progressItem = hudItems.find((item) => item.kind === "progress") || null;
    const timerItem = hudItems.find((item) => item.kind === "timer") || null;
    const summaryItems = hudItems.filter((item) => item !== progressItem && item !== timerItem);
    const pauseButtonMarkup = createQuizHudPauseButton(options.pauseButtonId);
    const classNames = ["quiz-hud"];

    if (extraClassName) {
      classNames.push(extraClassName);
    }

    if (timerItem) {
      classNames.push("has-timer");
    }

    return `
      <div class="${classNames.join(" ")}">
        <div class="quiz-hud-top">
          <div class="quiz-hud-stats">
            ${progressItem ? `<div class="quiz-hud-progress">${createQuizHudItem(progressItem, "quiz-hud-progress-item")}</div>` : ""}
            ${
              summaryItems.length
                ? `
                  <div class="quiz-hud-summary">
                    ${summaryItems
                      .map(
                        (item, index) =>
                          `${index > 0 || progressItem ? '<span class="quiz-hud-summary-divider" aria-hidden="true"></span>' : ""}${createQuizHudItem(item)}`
                      )
                      .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
        <div class="quiz-hud-bottom">
          ${timerItem ? '<div class="quiz-hud-track-slot"><div class="quiz-hud-track" aria-hidden="true"><span class="quiz-hud-track-fill"></span></div></div>' : ""}
          ${timerItem ? `<div class="quiz-hud-timer">${createQuizHudItem(timerItem)}</div>` : ""}
          ${pauseButtonMarkup}
        </div>
      </div>
    `;
  }

  function createChoiceQuizCard({
    articleId,
    className,
    metaItems = [],
    hudItems = [],
    header,
    promptBox,
    displayBox,
    optionsId,
    feedbackId,
    explanationId,
    pauseButtonId,
    nextButtonId,
    nextButtonLabel
  }) {
    const metaMarkup = metaItems.length
      ? `
        <div class="basic-practice-meta">
          ${metaItems
            .map((item) => `<span${item.id ? ` id="${escapeHtml(item.id)}"` : ""}>${escapeHtml(item.text)}</span>`)
            .join("")}
        </div>
      `
      : "";
    const hudMarkup = createQuizHudMarkup(hudItems, "", { pauseButtonId });
    const headerMarkup = header
      ? `
        <div class="${escapeHtml(header.className)}">
          <div>
            <span class="eyebrow">${escapeHtml(header.eyebrow)}</span>
            <h3 id="${escapeHtml(header.titleId)}">${escapeHtml(header.title)}</h3>
          </div>
          <p class="${escapeHtml(header.noteClassName)}" id="${escapeHtml(header.noteId)}">${escapeHtml(header.note)}</p>
        </div>
      `
      : "";
    const promptMarkup = promptBox
      ? `
        <div class="${escapeHtml(promptBox.className)}">
          <span class="eyebrow">${escapeHtml(promptBox.eyebrow)}</span>
          <p id="${escapeHtml(promptBox.textId)}">${escapeHtml(promptBox.text)}</p>
        </div>
      `
      : "";
    const displayMarkup = displayBox
      ? `
        <div class="${escapeHtml(displayBox.className)}">
          <strong id="${escapeHtml(displayBox.titleId)}">${escapeHtml(displayBox.title)}</strong>
          <p id="${escapeHtml(displayBox.subtitleId)}">${escapeHtml(displayBox.subtitle)}</p>
        </div>
      `
      : "";
    const feedbackMarkup = feedbackId ? `<p class="basic-practice-feedback" id="${escapeHtml(feedbackId)}"></p>` : "";
    const explanationMarkup = explanationId ? `<p class="basic-practice-explanation" id="${escapeHtml(explanationId)}"></p>` : "";

    return `
      <article class="${escapeHtml(className)}" id="${escapeHtml(articleId)}">
        ${metaMarkup}
        ${hudMarkup}
        ${headerMarkup}
        ${promptMarkup}
        ${displayMarkup}
        <div class="basic-practice-options" id="${escapeHtml(optionsId)}"></div>
        ${feedbackMarkup}
        ${explanationMarkup}
        <div class="quiz-actions">
          <button class="primary-btn" id="${escapeHtml(nextButtonId)}" type="button">${escapeHtml(nextButtonLabel)}</button>
        </div>
      </article>
    `;
  }


  function createChoiceQuizLayout({
    sidebarHead,
    shellClassName = "match-shell",
    sidebarClassName = "match-sidebar",
    optionsShellConfig,
    sidebarExtra = "",
    startButton = "",
    boardClassName,
    emptyId,
    emptyText = QUIZ_EMPTY_MESSAGE,
    viewId,
    viewClassName = "",
    choiceQuizCardConfig = {},
    resultPrefix,
    resultClassName = "match-result-view",
    resultFilterAriaLabel,
    resultBulkActionLabel = QUIZ_RESULT_REVIEW_ACTION_LABEL,
    resultBulkActions = [],
    resultFooterHtml = ""
  }) {
    return createPracticeModeLayout({
      shellClassName,
      sidebarClassName,
      sidebarHead,
      optionsShellConfig,
      sidebarExtra,
      startButton,
      boardClassName,
      emptyId,
      emptyText,
      viewId,
      viewClassName,
      viewMarkup: createChoiceQuizCard(choiceQuizCardConfig),
      resultViewConfig: {
        idPrefix: resultPrefix,
        className: resultClassName,
        filterAriaLabel: resultFilterAriaLabel,
        bulkActionLabel: resultBulkActionLabel,
        bulkActions: resultBulkActions,
        footerHtml: resultFooterHtml
      }
    });
  }
  function createResultView({
    viewId,
    className = "match-result-view",
    totalId,
    correctId,
    wrongId,
    filterId,
    filterAriaLabel,
    emptyId,
    emptyText,
    listId,
    bulkAction,
    bulkActions = [],
    footerHtml = ""
  }) {
    const resolvedBulkActions = Array.isArray(bulkActions) && bulkActions.length
      ? bulkActions
      : bulkAction
        ? [bulkAction]
        : [];
    const bulkActionMarkup = resolvedBulkActions.length
      ? `
        <div class="match-result-bulk-actions match-result-bulk-actions--study">
          ${resolvedBulkActions.map((action) => {
            const titleText = action.title || action.label;
            const ariaText = action.ariaLabel || titleText;
            return `
            <button class="secondary-btn button-with-icon match-result-action-btn match-result-action-btn--with-caption" id="${escapeHtml(action.id)}" type="button" title="${escapeHtml(titleText)}" aria-label="${escapeHtml(ariaText)}">
              <span class="material-symbols-rounded" aria-hidden="true">${escapeHtml(action.icon || "bookmark_add")}</span>
              <span class="match-result-action-btn__text" id="${escapeHtml(action.labelId)}" aria-hidden="true">${escapeHtml(action.label)}</span>
            </button>`;
          }).join("")}
        </div>
      `
      : "";
    const actionRowMarkup = bulkActionMarkup
      ? `
        <div class="match-result-filters">
          ${bulkActionMarkup}
        </div>
      `
      : "";

    return `
      <div class="${escapeHtml(className)}" id="${escapeHtml(viewId)}" hidden>
        <p class="match-result-title">결과 볼까요?</p>
        <div class="match-result-grid" role="group" aria-label="${escapeHtml(filterAriaLabel)}">
          <button class="match-result-stat match-result-stat-button is-active" id="${escapeHtml(filterId)}-all" type="button" data-result-filter="all" aria-pressed="true">
            <span>전체</span>
            <strong id="${escapeHtml(totalId)}">0</strong>
          </button>
          <button class="match-result-stat match-result-stat-button" id="${escapeHtml(filterId)}-correct" type="button" data-result-filter="correct" aria-pressed="false">
            <span>정답</span>
            <strong id="${escapeHtml(correctId)}">0</strong>
          </button>
          <button class="match-result-stat match-result-stat-button" id="${escapeHtml(filterId)}-wrong" type="button" data-result-filter="wrong" aria-pressed="false">
            <span>오답</span>
            <strong id="${escapeHtml(wrongId)}">0</strong>
          </button>
        </div>
        ${actionRowMarkup}
        <p class="match-result-empty" id="${escapeHtml(emptyId)}" hidden>${escapeHtml(emptyText)}</p>
        <div class="match-result-list" id="${escapeHtml(listId)}"></div>
        ${footerHtml}
      </div>
    `;
  }

  function createPrefixedResultView({
    idPrefix,
    className = "match-result-view",
    filterAriaLabel,
    emptyText = QUIZ_RESULT_EMPTY_MESSAGE,
    bulkActionLabel = QUIZ_RESULT_REVIEW_ACTION_LABEL,
    bulkActions = [],
    disableDefaultBulkAction = false,
    footerHtml = ""
  }) {
    const resolvedBulkActions = Array.isArray(bulkActions) && bulkActions.length
      ? bulkActions
      : disableDefaultBulkAction
        ? []
        : [
          {
            id: `${idPrefix}-result-bulk-action`,
            labelId: `${idPrefix}-result-bulk-label`,
            label: getJapanoteBtn("reviewSaveShort", "다시 보기"),
            title: getJapanoteBtn("reviewSave", bulkActionLabel)
          }
        ];

    return createResultView({
      viewId: `${idPrefix}-result-view`,
      className,
      totalId: `${idPrefix}-result-total`,
      correctId: `${idPrefix}-result-correct`,
      wrongId: `${idPrefix}-result-wrong`,
      filterId: `${idPrefix}-result-filter`,
      filterAriaLabel,
      emptyId: `${idPrefix}-result-empty`,
      emptyText,
      listId: `${idPrefix}-result-list`,
      bulkActions: resolvedBulkActions,
      footerHtml
    });
  }

  function createMatchPlayView({
    boardId,
    progressId,
    timerId,
    feedbackId,
    leftColumnTitle,
    rightColumnTitle,
    leftListId,
    rightListId,
    initialProgress = "0 / 5",
    initialTimer = "00:15"
  }) {
    return `
          <div class="match-play-view" id="${escapeHtml(boardId)}">
            ${createQuizHudMarkup(
              [
                { kind: "progress", label: "진행", valueId: progressId, value: initialProgress },
                { kind: "timer", label: "남은 시간", valueId: timerId, value: initialTimer }
              ],
              "match-play-hud"
            )}
            <div class="match-feedback" id="${escapeHtml(feedbackId)}" hidden></div>
            <div class="match-columns">
              <section class="match-column"><div class="match-column-head"><h3>${escapeHtml(leftColumnTitle)}</h3></div><div class="match-card-list" id="${escapeHtml(leftListId)}"></div></section>
              <section class="match-column"><div class="match-column-head"><h3>${escapeHtml(rightColumnTitle)}</h3></div><div class="match-card-list" id="${escapeHtml(rightListId)}"></div></section>
            </div>
          </div>
    `;
  }

  function createVocabQuizLayout() {
    const vocabQuizFieldSelectOptions = [
      { value: "reading", label: "히라가나·가타카나" },
      { value: "word", label: "한자" },
      { value: "meaning", label: "뜻" }
    ];

    return createChoiceQuizLayout({
      sidebarHead: "",
      shellClassName: "match-shell vocab-quiz-shell",
      sidebarClassName: "match-sidebar vocab-quiz-sidebar",
      optionsShellConfig: {
        shellId: "vocab-quiz-options-shell",
        shellClassName: "match-options-shell",
        toggleId: "vocab-quiz-options-toggle",
        toggleTitle: "퀴즈 설정, 어떻게 할까요?",
        summaryId: "vocab-quiz-options-summary",
        summaryText: "히라가나·가타카나 → 뜻 · 10문제 · 15초",
        panelId: "vocab-quiz-options-panel",
        panelClassName: "study-options-panel-wide",
        isOpen: false,
        groups: [
          ...createQuizFieldGroups({
            questionField: {
              groupLabel: "문제 영역",
              id: "vocab-quiz-question-field",
              ariaLabel: "단어 퀴즈 문제 영역 고르기",
              options: vocabQuizFieldSelectOptions
            },
            optionField: {
              groupLabel: "보기 영역",
              id: "vocab-quiz-option-field",
              ariaLabel: "단어 퀴즈 보기 영역 고르기",
              options: vocabQuizFieldSelectOptions
            }
          }),
          {
            label: "몇 문제 풀까요?",
            content: createQuestionCountSpinner({
              spinnerId: "vocab-quiz-count",
              ariaLabel: "단어 퀴즈 문제 수",
              activeValue: 10
            })
          },
          {
            label: "시간은 어떻게 할까요?",
            content: createDurationSpinner({
              spinnerId: "vocab-quiz-time",
              ariaLabel: "단어 퀴즈 시간",
              activeValue: 15
            })
          }
        ]
      },
      sidebarExtra: createVocabQuizSidebarToolbarHtml(),
      startButton: createActionButton({
        id: "vocab-quiz-restart",
        labelId: "vocab-quiz-restart-label",
        label: "시작해볼까요?"
      }),
      boardClassName: "match-board vocab-quiz-board",
      emptyId: "vocab-quiz-empty",
      emptyText: QUIZ_BOARD_READY_MESSAGE,
      viewId: "vocab-quiz",
      viewClassName: "vocab-quiz-view",
      choiceQuizCardConfig: {
        articleId: "vocab-quiz-card",
        className: "basic-practice-card vocab-quiz-card",
        metaItems: [
          { id: "vocab-quiz-track", text: "단어" },
          { id: "vocab-quiz-source", text: "N5 단어" }
        ],
        hudItems: [
          { kind: "progress", label: "진행", valueId: "vocab-quiz-progress", value: "0 / 0" },
          { kind: "timer", label: "남은 시간", valueId: "vocab-quiz-timer", value: "00:15" },
          { kind: "correct", label: "정답", valueId: "vocab-quiz-correct", value: "0" },
          { kind: "wrong", label: "오답", valueId: "vocab-quiz-wrong", value: "0" }
        ],
        header: {
          className: "basic-practice-header",
          eyebrow: "VOCAB QUIZ",
          titleId: "vocab-quiz-title",
          title: "단어 퀴즈",
          noteClassName: "basic-practice-note",
          noteId: "vocab-quiz-note",
          note: "고른 단어로 바로 풀어봐요."
        },
        promptBox: {
          className: "basic-practice-prompt-box",
          eyebrow: "QUESTION",
          textId: "vocab-quiz-prompt",
          text: "문제를 준비하고 있어요."
        },
        displayBox: {
          className: "basic-practice-display-box",
          titleId: "vocab-quiz-display",
          title: "-",
          subtitleId: "vocab-quiz-display-sub",
          subtitle: ""
        },
        optionsId: "vocab-quiz-options",
        feedbackId: "vocab-quiz-feedback",
        explanationId: "vocab-quiz-explanation",
        pauseButtonId: "vocab-quiz-pause",
        nextButtonId: "vocab-quiz-next",
        nextButtonLabel: "다음 문제 볼까요?"
      },
      resultPrefix: "vocab-quiz",
      resultFilterAriaLabel: "단어 퀴즈 결과 필터",
      resultBulkActions: [
        reviewResultBulkAction("vocab-quiz-result-bulk-action", "vocab-quiz-result-bulk-label"),
        masteredResultBulkAction("vocab-quiz-result-mastered-action", "vocab-quiz-result-mastered-label", "check_circle")
      ]
    });
  }
  function createKanjiPracticeLayout() {
    const kanjiPracticeQuestionFieldOptions = [
      { value: "display", label: "한자" },
      { value: "reading", label: "발음" }
    ];
    const kanjiPracticeOptionFieldOptions = [
      { value: "reading", label: "발음" },
      { value: "display", label: "한자" }
    ];

    return createChoiceQuizLayout({
      sidebarHead: "",
      optionsShellConfig: {
        shellId: "kanji-practice-options-shell",
        shellClassName: "match-options-shell kanji-options-shell",
        toggleId: "kanji-practice-options-toggle",
        toggleTitle: "퀴즈 설정, 어떻게 할까요?",
        summaryId: "kanji-practice-options-summary",
        summaryText: "전체 · 전체 · 10문제 · 15초",
        panelId: "kanji-practice-options-panel",
        panelClassName: "study-options-panel-wide",
        isOpen: false,
        groups: [
          ...createQuizFieldGroups({
            questionField: {
              groupLabel: "문제 영역",
              id: "kanji-practice-question-field",
              ariaLabel: "한자 퀴즈 문제 영역 고르기",
              options: kanjiPracticeQuestionFieldOptions
            },
            optionField: {
              groupLabel: "보기 영역",
              id: "kanji-practice-option-field",
              ariaLabel: "한자 퀴즈 보기 영역 고르기",
              options: kanjiPracticeOptionFieldOptions
            }
          }),
          ...createQuestionDurationGroups({
            countSpinnerId: "kanji-practice-count",
            countAriaLabel: "한자 퀴즈 문제 수",
            countValue: 10,
            durationSpinnerId: "kanji-practice-time",
            durationAriaLabel: "한자 퀴즈 제한시간",
            durationValue: 15
          })
        ]
      },
      sidebarExtra: createKanjiGradeCollectionToolbarHtml({
        toolbarAriaLabel: "한자 퀴즈 학년 필터",
        toolbarClassName: "vocab-select-toolbar vocab-select-toolbar-sidebar kanji-filter-toolbar",
        gradeSelectId: "kanji-practice-grade-select",
        collectionSelectId: "kanji-practice-collection-select",
        ariaPrefix: "한자 퀴즈",
        collectionOptions: KANJI_COLLECTION_OPTIONS_BASIC,
        fieldOrder: "grade-first"
      }),
      startButton: createStartQuizButton({ id: "kanji-practice-start", labelId: "kanji-practice-start-label" }),
      boardClassName: "match-board",
      emptyId: "kanji-practice-empty",
      emptyText: QUIZ_EMPTY_MESSAGE,
      viewId: "kanji-practice-view",
      choiceQuizCardConfig: {
        articleId: "kanji-practice-card",
        className: "basic-practice-card tone-gold kanji-practice-card",
        hudItems: [
          { kind: "progress", label: "진행", valueId: "kanji-practice-progress", value: "1 / 5" },
          { kind: "timer", label: "남은 시간", valueId: "kanji-practice-timer", value: "00:15" },
          { kind: "correct", label: "정답", valueId: "kanji-practice-correct", value: "0" },
          { kind: "wrong", label: "오답", valueId: "kanji-practice-wrong", value: "0" }
        ],
        displayBox: {
          className: "basic-practice-display-box",
          titleId: "kanji-practice-display",
          title: "-",
          subtitleId: "kanji-practice-display-sub",
          subtitle: ""
        },
        optionsId: "kanji-practice-options",
        pauseButtonId: "kanji-practice-pause",
        nextButtonId: "kanji-practice-next",
        nextButtonLabel: "다음 문제 볼까요?"
      },
      resultPrefix: "kanji-practice",
      resultClassName: "match-result-view kanji-result-view",
      resultFilterAriaLabel: "한자 퀴즈 결과 필터",
      resultBulkActions: [
        reviewResultBulkAction("kanji-practice-result-bulk-action", "kanji-practice-result-bulk-label"),
        masteredResultBulkAction("kanji-practice-result-mastered-action", "kanji-practice-result-mastered-label", "check_circle")
      ],
      resultFooterHtml:
        '<div class="quiz-actions"><button class="primary-btn button-with-icon" id="kanji-practice-restart" type="button"><span class="material-symbols-rounded" aria-hidden="true">autorenew</span><span>다시 해볼까요?</span></button></div>'
    });
  }
  function createMatchRoundLayout({
    sidebarHead,
    shellId,
    shellClassName,
    toggleId,
    toggleTitle,
    summaryId,
    summaryText,
    panelId,
    panelClassName,
    isOpen = false,
    countSpinnerId,
    countAriaLabel,
    countValue,
    durationSpinnerId,
    durationAriaLabel,
    durationValue,
    sidebarExtra = "",
    startButton,
    boardId,
    emptyId,
    emptyText = QUIZ_EMPTY_MESSAGE,
    playBoardConfig,
    resultPrefix,
    resultFilterAriaLabel,
    resultClassName = "match-result-view",
    bulkActionLabel,
    resultBulkActions = []
  }) {
    return createLayoutShell({
      sidebarHead,
      optionsShellConfig: {
        shellId,
        shellClassName,
        toggleId,
        toggleTitle,
        summaryId,
        summaryText,
        panelId,
        panelClassName,
        isOpen,
        groups: [
          ...createQuestionDurationGroups({
            countSpinnerId,
            countAriaLabel,
            countValue,
            durationSpinnerId,
            durationAriaLabel,
            durationValue
          })
        ]
      },
      sidebarExtra,
      startButton,
      boardMarkup: createMatchBoardLayout({
        boardId,
        emptyId,
        emptyText,
        playBoardConfig,
        resultPrefix,
        resultFilterAriaLabel,
        resultClassName,
        bulkActionLabel,
        bulkActions: resultBulkActions
      })
    });
  }

  function createMatchLayout() {
    return createMatchRoundLayout({
      sidebarHead: "",
      shellId: "match-options-shell",
      shellClassName: "match-options-shell",
      toggleId: "match-options-toggle",
      toggleTitle: "짝 맞추기 설정",
      summaryId: "match-options-summary",
      summaryText: "5문제 · 15초",
      panelId: "match-options-panel",
      panelClassName: "study-options-panel-wide",
      countSpinnerId: "match-count",
      countAriaLabel: "짝 맞추기 문제 수",
      countValue: 5,
      durationSpinnerId: "match-time",
      durationAriaLabel: "짝 맞추기 제한시간",
      durationValue: 15,
      sidebarExtra: createMatchSidebarVocabToolbarHtml(),
      startButton: createStartQuizButton({ id: "match-new-round", labelId: "match-new-round-label" }),
      boardId: "match-board",
      emptyId: "match-empty",
      playBoardConfig: {
        boardId: "match-play-view",
        progressId: "match-progress",
        timerId: "match-timer",
        feedbackId: "match-feedback",
        leftColumnTitle: "문장 보기",
        rightColumnTitle: "뜻 보기",
        leftListId: "match-left-list",
        rightListId: "match-right-list"
      },
      resultPrefix: "match",
      resultFilterAriaLabel: "짝 맞추기 결과 필터",
      resultBulkActions: [
        reviewResultBulkAction("match-result-bulk-action", "match-result-bulk-label"),
        masteredResultBulkAction("match-result-mastered-action", "match-result-mastered-label", "check_circle")
      ]
    });
  }

  function createKanjiMatchLayout() {
    return createMatchRoundLayout({
      sidebarHead: "",
      shellId: "kanji-match-options-shell",
      shellClassName: "match-options-shell",
      toggleId: "kanji-match-options-toggle",
      toggleTitle: "짝 맞추기 설정",
      summaryId: "kanji-match-options-summary",
      summaryText: "전체 · 전체 · 5문제 · 15초",
      panelId: "kanji-match-options-panel",
      panelClassName: "study-options-panel-wide",
      countSpinnerId: "kanji-match-count",
      countAriaLabel: "한자 짝 맞추기 문제 수",
      countValue: 5,
      durationSpinnerId: "kanji-match-time",
      durationAriaLabel: "한자 짝 맞추기 제한시간",
      durationValue: 15,
      sidebarExtra: createKanjiGradeCollectionToolbarHtml({
        toolbarAriaLabel: "한자 짝 맞추기 필터",
        toolbarClassName: "vocab-select-toolbar vocab-select-toolbar-sidebar kanji-filter-toolbar",
        gradeSelectId: "kanji-match-grade-select",
        collectionSelectId: "kanji-match-filter-select",
        ariaPrefix: "한자 짝 맞추기",
        collectionOptions: KANJI_COLLECTION_OPTIONS_BASIC,
        fieldOrder: "grade-first"
      }),
      startButton: createStartQuizButton({ id: "kanji-match-new-round", labelId: "kanji-match-new-round-label" }),
      boardId: "kanji-match-board",
      emptyId: "kanji-match-empty",
      playBoardConfig: {
        boardId: "kanji-match-play-view",
        progressId: "kanji-match-progress",
        timerId: "kanji-match-timer",
        feedbackId: "kanji-match-feedback",
        leftColumnTitle: "한자",
        rightColumnTitle: "의미",
        leftListId: "kanji-match-left-list",
        rightListId: "kanji-match-right-list"
      },
      resultPrefix: "kanji-match",
      resultFilterAriaLabel: "한자 짝 맞추기 결과 필터",
      resultClassName: "match-result-view kanji-result-view",
      resultBulkActions: [
        reviewResultBulkAction("kanji-match-result-bulk-action", "kanji-match-result-bulk-label"),
        masteredResultBulkAction("kanji-match-result-mastered-action", "kanji-match-result-mastered-label", "check_circle")
      ]
    });
  }

  function createGrammarMatchLayout() {
    return createMatchRoundLayout({
      sidebarHead: "",
      shellId: "grammar-match-options-shell",
      shellClassName: "match-options-shell",
      toggleId: "grammar-match-options-toggle",
      toggleTitle: "문법 짝 맞추기 설정을 골라볼까요?",
      summaryId: "grammar-match-options-summary",
      summaryText: "N5 · 전체 · 5문제 · 15초",
      panelId: "grammar-match-options-panel",
      panelClassName: "study-options-panel-wide",
      countSpinnerId: "grammar-match-count",
      countAriaLabel: "문법 짝 맞추기 문제 수",
      countValue: 5,
      durationSpinnerId: "grammar-match-time",
      durationAriaLabel: "문법 짝 맞추기 제한 시간",
      durationValue: 15,
      sidebarExtra: createGrammarMatchSidebarToolbarHtml(),
      startButton: createStartQuizButton({ id: "grammar-match-new-round", labelId: "grammar-match-new-round-label" }),
      boardId: "grammar-match-board",
      emptyId: "grammar-match-empty",
      emptyText: QUIZ_READY_TO_START_HINT,
      playBoardConfig: {
        boardId: "grammar-match-play-view",
        progressId: "grammar-match-progress",
        timerId: "grammar-match-timer",
        feedbackId: "grammar-match-feedback",
        leftColumnTitle: "문법 보기",
        rightColumnTitle: "뜻 보기",
        leftListId: "grammar-match-left-list",
        rightListId: "grammar-match-right-list"
      },
      resultPrefix: "grammar-match",
      resultFilterAriaLabel: "문법 짝 맞추기 결과 필터",
      resultBulkActions: [
        reviewResultBulkAction("grammar-match-result-bulk-action", "grammar-match-result-bulk-label"),
        masteredResultBulkAction("grammar-match-result-mastered-action", "grammar-match-result-mastered-label", "check_circle")
      ]
    });
  }

  function createLayoutShell({
    shellClassName = "match-shell",
    sidebarClassName = "match-sidebar",
    sidebarHead,
    optionsShellConfig,
    sidebarExtra = "",
    startButton = "",
    boardMarkup
  }) {
    return `
      <div class="${escapeHtml(shellClassName)}">
        <aside class="${escapeHtml(sidebarClassName)}">
          ${sidebarHead}
          ${createStudyOptionsShell(optionsShellConfig)}
          ${sidebarExtra}
          ${startButton}
        </aside>
        ${boardMarkup}
      </div>
    `;
  }

  function createPracticeBoardLayout({
    boardClassName,
    emptyId,
    emptyText = QUIZ_EMPTY_MESSAGE,
    viewId,
    viewClassName = "",
    viewMarkup,
    resultViewConfig = null
  }) {
    const viewClassAttribute = viewClassName ? ` class="${escapeHtml(viewClassName)}"` : "";

    return `
      <div class="${escapeHtml(boardClassName)}">
        ${createPracticeEmptyMessage({ id: emptyId, text: emptyText })}
        <div${viewClassAttribute} id="${escapeHtml(viewId)}">
          ${viewMarkup}
        </div>
        ${resultViewConfig ? createPrefixedResultView(resultViewConfig) : ""}
      </div>
    `;
  }

  function createPracticeModeLayout({
    shellClassName = "match-shell",
    sidebarClassName = "match-sidebar",
    sidebarHead,
    optionsShellConfig,
    sidebarExtra = "",
    startButton = "",
    boardClassName,
    emptyId,
    emptyText = QUIZ_EMPTY_MESSAGE,
    viewId,
    viewClassName = "",
    viewMarkup,
    resultViewConfig = null
  }) {
    return createLayoutShell({
      shellClassName,
      sidebarClassName,
      sidebarHead,
      optionsShellConfig,
      sidebarExtra,
      startButton,
      boardMarkup: createPracticeBoardLayout({
        boardClassName,
        emptyId,
        emptyText,
        viewId,
        viewClassName,
        viewMarkup,
        resultViewConfig
      })
    });
  }

  function createPracticeModeCardLayout({
    articleClassName,
    metaClassName,
    metaItems = [],
    hudItems = [],
    header,
    contentMarkup = "",
    optionsId,
    feedbackId,
    explanationId,
    pauseButtonId,
    nextButtonId,
    nextButtonLabel
  }) {
    const metaMarkup = metaItems.map((item) => `<span${item.id ? ` id="${escapeHtml(item.id)}"` : ""}>${escapeHtml(item.text)}</span>`).join("");
    const metaSectionMarkup = metaMarkup
      ? `<div class="${escapeHtml(metaClassName)}">${metaMarkup}</div>`
      : "";
    const hudMarkup = createQuizHudMarkup(hudItems, "", { pauseButtonId });

    const headerMarkup = header
      ? `
        <div class="${escapeHtml(header.className)}">
          <div>
            <span class="eyebrow">${escapeHtml(header.eyebrow)}</span>
            <h3 id="${escapeHtml(header.titleId)}">${escapeHtml(header.title)}</h3>
          </div>
          ${header.noteId ? `<p class="${escapeHtml(header.noteClassName || `${header.className}-note`)}" id="${escapeHtml(header.noteId)}">${escapeHtml(header.note || "")}</p>` : ""}
        </div>
      `
      : "";

    return `
      <article class="${escapeHtml(articleClassName)}">
        ${metaSectionMarkup}
        ${hudMarkup}
        ${headerMarkup}
        ${contentMarkup}
        <div class="${escapeHtml(optionsId)}" id="${escapeHtml(optionsId)}"></div>
        <p class="${escapeHtml(feedbackId)}" id="${escapeHtml(feedbackId)}"></p>
        <p class="${escapeHtml(explanationId)}" id="${escapeHtml(explanationId)}"></p>
        <div class="quiz-actions"><button class="primary-btn" id="${escapeHtml(nextButtonId)}" type="button">${escapeHtml(nextButtonLabel)}</button></div>
      </article>
    `;
  }

  function createGrammarPracticeLayout() {
    return createPracticeModeLayout({
      sidebarHead: "",
      optionsShellConfig: {
        shellId: "grammar-practice-options-shell",
        shellClassName: "match-options-shell",
        toggleId: "grammar-practice-options-toggle",
        toggleTitle: "문법 퀴즈 설정을 골라볼까요?",
        summaryId: "grammar-practice-options-summary",
        summaryText: "N5 · 10문제 · 25초",
        panelId: "grammar-practice-options-panel",
        panelClassName: "study-options-panel-compact",
        groups: [
          createStudySelectGroup({
            groupLabel: "어느 레벨로 풀까요?",
            id: "grammar-practice-level-select",
            ariaLabel: "문법 레벨 고르기",
            options: JLPT_LEVEL_OPTIONS
          }),
          createStudySelectGroup({
            groupLabel: "모아보기",
            id: "grammar-practice-filter-select",
            ariaLabel: "문법 퀴즈 모아보기 고르기",
            options: GRAMMAR_COLLECTION_OPTIONS_CATALOG
          }),
          ...createQuestionDurationGroups({
            countSpinnerId: "grammar-practice-count",
            countAriaLabel: "문법 퀴즈 문제 수",
            countValue: 10,
            durationSpinnerId: "grammar-practice-time",
            durationAriaLabel: "문법 퀴즈 제한시간",
            durationValue: 25
          })
        ]
      },
      startButton: createStartQuizButton({ id: "grammar-practice-start", labelId: "grammar-practice-start-label" }),
      boardClassName: "match-board grammar-practice-board",
      emptyId: "grammar-practice-empty",
      emptyText: QUIZ_READY_TO_START_HINT,
      viewId: "grammar-practice-view",
      resultViewConfig: {
        idPrefix: "grammar-practice",
        filterAriaLabel: "문법 퀴즈 결과 필터",
        bulkActions: [
          reviewResultBulkAction("grammar-practice-result-bulk-action", "grammar-practice-result-bulk-label"),
          masteredResultBulkAction("grammar-practice-result-mastered-action", "grammar-practice-result-mastered-label", "check_circle")
        ]
      },
      viewMarkup: createPracticeModeCardLayout({
        articleClassName: "grammar-practice-card",
        metaClassName: "grammar-practice-meta",
        metaItems: [],
        hudItems: [
          { kind: "progress", label: "진행", valueId: "grammar-practice-progress", value: "1 / 10" },
          { kind: "timer", label: "남은 시간", valueId: "grammar-timer", value: "00:25" },
          { kind: "correct", label: "정답", valueId: "grammar-correct", value: "0" },
          { kind: "wrong", label: "오답", valueId: "grammar-wrong", value: "0" }
        ],
        header: null,
        contentMarkup: `
          <div class="basic-practice-display-box">
            <strong id="grammar-practice-sentence">문법을 불러오고 있어요.</strong>
          </div>
        `,
        optionsId: "grammar-practice-options",
        feedbackId: "grammar-practice-feedback",
        explanationId: "grammar-practice-explanation",
        pauseButtonId: "grammar-pause",
        nextButtonId: "grammar-practice-next",
        nextButtonLabel: "다음 문제 볼까요?"
      })
    });
  }

  function createReadingPracticeLayout() {
    return createPracticeModeLayout({
      sidebarHead: "",
      optionsShellConfig: {
        shellId: "reading-options-shell",
        shellClassName: "match-options-shell",
        toggleId: "reading-options-toggle",
        toggleTitle: "독해 설정을 골라볼까요?",
        summaryId: "reading-options-summary",
        summaryText: "N5 · 10문제 · 45초",
        panelId: "reading-options-panel",
        panelClassName: "study-options-panel-compact",
        groups: [
          createStudySelectGroup({
            groupLabel: "어느 레벨로 읽을까요?",
            id: "reading-level-select",
            ariaLabel: "독해 레벨 고르기",
            options: JLPT_LEVEL_OPTIONS
          }),
          ...createQuestionDurationGroups({
            countSpinnerId: "reading-count",
            countAriaLabel: "독해 퀴즈 문제 수",
            countValue: 10,
            durationSpinnerId: "reading-time",
            durationAriaLabel: "독해 퀴즈 제한시간",
            durationValue: 45
          })
        ]
      },
      startButton: createStartQuizButton({ id: "reading-start", labelId: "reading-start-label" }),
      boardClassName: "match-board reading-practice-board",
      emptyId: "reading-empty",
      emptyText: QUIZ_READY_TO_START_HINT,
      viewId: "reading-practice-view",
      resultViewConfig: {
        idPrefix: "reading-practice",
        filterAriaLabel: "독해 결과 필터",
        disableDefaultBulkAction: true
      },
      viewMarkup: createPracticeModeCardLayout({
        articleClassName: "reading-card",
        metaClassName: "reading-meta",
        metaItems: [],
        hudItems: [
          { kind: "progress", label: "진행", valueId: "reading-progress", value: "1 / 3" },
          { kind: "timer", label: "남은 시간", valueId: "reading-timer", value: "00:45" },
          { kind: "correct", label: "정답", valueId: "reading-correct", value: "0" },
          { kind: "wrong", label: "오답", valueId: "reading-wrong", value: "0" }
        ],
        header: null,
        contentMarkup: `
          <div class="reading-passage" id="reading-passage"></div>
          <div class="reading-question-box"><span class="eyebrow">QUESTION</span><h4 id="reading-question">질문을 불러오고 있어요.</h4></div>
        `,
        optionsId: "reading-options",
        feedbackId: "reading-feedback",
        explanationId: "reading-explanation",
        pauseButtonId: "reading-pause",
        nextButtonId: "reading-next",
        nextButtonLabel: "다음 글 볼까요?"
      })
    });
  }

  function createLayout(kind) {
    const layoutMap = {
      "vocab-quiz": createVocabQuizLayout,
      "kanji-practice": createKanjiPracticeLayout,
      "kanji-match-round": createKanjiMatchLayout,
      "match-round": createMatchLayout,
      "grammar-match-round": createGrammarMatchLayout,
      "grammar-practice": createGrammarPracticeLayout,
      "reading-practice": createReadingPracticeLayout
    };

    const layoutFactory = layoutMap[kind];
    return layoutFactory ? layoutFactory() : "";
  }

  function createMatchBoardLayout({
    boardId,
    emptyId,
    emptyText = QUIZ_EMPTY_MESSAGE,
    playBoardConfig,
    resultPrefix,
    resultFilterAriaLabel,
    resultClassName = "match-result-view",
    bulkActionLabel = QUIZ_RESULT_REVIEW_ACTION_LABEL,
    bulkActions = []
  }) {
    return `
        <div class="match-board" id="${escapeHtml(boardId)}" hidden>
          ${createPracticeEmptyMessage({ id: emptyId, text: emptyText })}
          ${createMatchPlayView(playBoardConfig)}
          ${createPrefixedResultView({
            idPrefix: resultPrefix,
            className: resultClassName,
            filterAriaLabel: resultFilterAriaLabel,
            bulkActionLabel,
            bulkActions
          })}
        </div>
    `;
  }

  function createStudyLayout(kind) {
    const studyLayoutMap = {
      "vocab-catalog": () => createCatalogLayoutByScope("vocab"),
      "kanji-catalog": () => createCatalogLayoutByScope("kanji"),
      "grammar-catalog": () => createCatalogLayoutByScope("grammar")
    };
    const layoutFactory = studyLayoutMap[kind];

    return layoutFactory ? layoutFactory() : "";
  }

  function mountSharedQuizLayouts() {
    document.querySelectorAll("[data-shared-quiz-layout]").forEach((container) => {
      if (container.dataset.sharedQuizMounted === "true") {
        return;
      }

      const markup = createLayout(container.dataset.sharedQuizLayout);

      if (!markup) {
        return;
      }

      container.innerHTML = markup;
      container.dataset.sharedQuizMounted = "true";
    });
  }

  function mountSharedStudyLayouts() {
    document.querySelectorAll("[data-shared-study-layout]").forEach((container) => {
      if (container.dataset.sharedStudyMounted === "true") {
        return;
      }

      const markup = createStudyLayout(container.dataset.sharedStudyLayout);

      if (!markup) {
        return;
      }

      container.innerHTML = markup;
      container.dataset.sharedStudyMounted = "true";
    });
  }

  global.japanoteSharedQuizLayouts = {
    mount: mountSharedQuizLayouts,
    mountStudy: mountSharedStudyLayouts
  };

  mountSharedQuizLayouts();
  mountSharedStudyLayouts();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountSharedQuizLayouts();
      mountSharedStudyLayouts();
    }, { once: true });
  }
})(globalThis);
