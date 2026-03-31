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

  function createToggleButtonGroup({ ariaLabel, className = "match-toggle-group", buttons = [] }) {
    const buttonMarkup = buttons
      .map((button) => {
        const attributes = renderAttributes(button.attributes || {});
        const spacing = attributes ? ` ${attributes}` : "";
        return `<button class="${escapeHtml(button.className || "level-button")}" type="button"${spacing}>${escapeHtml(button.label)}</button>`;
      })
      .join("");

    return `<div class="${escapeHtml(className)}" role="group" aria-label="${escapeHtml(ariaLabel)}">${buttonMarkup}</div>`;
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
        <button class="study-options-toggle" id="${escapeHtml(toggleId)}" type="button" aria-expanded="true" aria-controls="${escapeHtml(panelId)}">
          <div class="study-options-toggle-copy">
            <strong>${escapeHtml(toggleTitle)}</strong>
            <p class="study-options-toggle-summary" id="${escapeHtml(summaryId)}">${escapeHtml(summaryText)}</p>
          </div>
          <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
        </button>
        <div class="${escapeHtml(panelClass)}" id="${escapeHtml(panelId)}">
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
    nextButtonId,
    nextButtonLabel
  }) {
    const metaMarkup = metaItems
      .map((item) => `<span${item.id ? ` id="${escapeHtml(item.id)}"` : ""}>${escapeHtml(item.text)}</span>`)
      .join("");
    const hudMarkup = hudItems.length
      ? `
        <div class="quiz-hud">
          ${hudItems
            .map(
              (item) => `
                <div class="quiz-hud-item">
                  <span>${escapeHtml(item.label)}</span>
                  <strong id="${escapeHtml(item.valueId)}">${escapeHtml(item.value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      `
      : "";
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
        <div class="basic-practice-meta">${metaMarkup}</div>
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
    footerHtml = ""
  }) {
    const bulkActionMarkup = bulkAction
      ? `
        <button class="secondary-btn button-with-icon match-result-bulk-btn" id="${escapeHtml(bulkAction.id)}" type="button">
          <span class="material-symbols-rounded" aria-hidden="true">${escapeHtml(bulkAction.icon || "bookmark_add")}</span>
          <span id="${escapeHtml(bulkAction.labelId)}">${escapeHtml(bulkAction.label)}</span>
        </button>
      `
      : "";

    return `
      <div class="${escapeHtml(className)}" id="${escapeHtml(viewId)}" hidden>
        <p class="match-result-title">결과를 볼까요?</p>
        <div class="match-result-grid">
          <article class="match-result-stat"><span>전체</span><strong id="${escapeHtml(totalId)}">0</strong></article>
          <article class="match-result-stat"><span>정답</span><strong id="${escapeHtml(correctId)}">0</strong></article>
          <article class="match-result-stat"><span>오답</span><strong id="${escapeHtml(wrongId)}">0</strong></article>
        </div>
        <div class="match-result-filters">
          <label class="match-result-filter-field" for="${escapeHtml(filterId)}">
            <div class="match-result-filter-select-wrap">
              <select class="match-result-filter-select" id="${escapeHtml(filterId)}" aria-label="${escapeHtml(filterAriaLabel)}">
                <option value="all">전체</option>
                <option value="correct">정답</option>
                <option value="wrong">오답</option>
              </select>
              <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
            </div>
          </label>
          ${bulkActionMarkup}
        </div>
        <p class="match-result-empty" id="${escapeHtml(emptyId)}" hidden>${escapeHtml(emptyText)}</p>
        <div class="match-result-list" id="${escapeHtml(listId)}"></div>
        ${footerHtml}
      </div>
    `;
  }

  function createVocabQuizLayout() {
    return `
      <div class="match-shell vocab-quiz-shell">
        <aside class="match-sidebar vocab-quiz-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">QUIZ HUD</span><h3>단어 퀴즈</h3></div>
          ${createStudyOptionsShell({
            shellId: "vocab-quiz-options-shell",
            shellClassName: "match-options-shell",
            toggleId: "vocab-quiz-options-toggle",
            toggleTitle: "퀴즈 설정, 어떻게 할까요?",
            summaryId: "vocab-quiz-options-summary",
            summaryText: "히라가나·가타카나 → 뜻 · 10문제 · 15초",
            panelId: "vocab-quiz-options-panel",
            panelClassName: "study-options-panel-wide",
            groups: [
              {
                label: "문제 영역",
                content: createSelectField({
                  id: "vocab-quiz-question-field",
                  label: "문제 영역",
                  ariaLabel: "단어 퀴즈 문제 영역 고르기",
                  includeLabel: false,
                  options: [
                    { value: "reading", label: "히라가나·가타카나" },
                    { value: "word", label: "한자" },
                    { value: "meaning", label: "뜻" }
                  ]
                })
              },
              {
                label: "보기 영역",
                content: createSelectField({
                  id: "vocab-quiz-option-field",
                  label: "보기 영역",
                  ariaLabel: "단어 퀴즈 보기 영역 고르기",
                  includeLabel: false,
                  options: [
                    { value: "reading", label: "히라가나·가타카나" },
                    { value: "word", label: "한자" },
                    { value: "meaning", label: "뜻" }
                  ]
                })
              },
              {
                label: "몇 문제 풀까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "단어 퀴즈 문제 수 고르기",
                  buttons: [
                    { label: "5문제", attributes: { "data-vocab-quiz-count": "5", "aria-pressed": "false" } },
                    { label: "10문제", className: "level-button is-active", attributes: { "data-vocab-quiz-count": "10", "aria-pressed": "true" } },
                    { label: "15문제", attributes: { "data-vocab-quiz-count": "15", "aria-pressed": "false" } },
                    { label: "20문제", attributes: { "data-vocab-quiz-count": "20", "aria-pressed": "false" } }
                  ]
                })
              },
              {
                label: "시간은 어떻게 할까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "단어 퀴즈 시간 고르기",
                  buttons: [
                    { label: "천천히", attributes: { "data-vocab-quiz-time": "0", "aria-pressed": "false" } },
                    { label: "10초", attributes: { "data-vocab-quiz-time": "10", "aria-pressed": "false" } },
                    { label: "15초", className: "level-button is-active", attributes: { "data-vocab-quiz-time": "15", "aria-pressed": "true" } },
                    { label: "20초", attributes: { "data-vocab-quiz-time": "20", "aria-pressed": "false" } }
                  ]
                })
              }
            ]
          })}
          <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="단어 퀴즈 필터">
            ${createSelectField({
              id: "vocab-quiz-level-select",
              label: "레벨",
              ariaLabel: "단어 퀴즈 레벨 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "N5", label: "N5" },
                { value: "N4", label: "N4" },
                { value: "N3", label: "N3" }
              ]
            })}
            ${createSelectField({
              id: "vocab-quiz-filter-select",
              label: "모아보기",
              ariaLabel: "단어 퀴즈 모아보기 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "review", label: "다시 볼래요" },
                { value: "mastered", label: "익혔어요" }
              ]
            })}
            ${createSelectField({
              id: "vocab-quiz-part-select",
              label: "품사",
              ariaLabel: "단어 퀴즈 품사 고르기",
              options: [{ value: "all", label: "전체 품사" }]
            })}
          </div>
          ${createActionButton({
            id: "vocab-quiz-restart",
            labelId: "vocab-quiz-restart-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board vocab-quiz-board">
          <div class="vocab-quiz-view" id="vocab-quiz">
            <p class="vocab-list-empty" id="vocab-quiz-empty" hidden>퀴즈를 준비하고 있어요.</p>
            ${createChoiceQuizCard({
              articleId: "vocab-quiz-card",
              className: "basic-practice-card vocab-quiz-card",
              metaItems: [
                { id: "vocab-quiz-track", text: "?⑥뼱" },
                { id: "vocab-quiz-source", text: "N5 ?⑥뼱" }
              ],
              hudItems: [
                { label: "진행", valueId: "vocab-quiz-progress", value: "0 / 0" },
                { label: "남은 시간", valueId: "vocab-quiz-timer", value: "15초" }
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
              nextButtonId: "vocab-quiz-next",
              nextButtonLabel: "다음 문제 볼까요?"
            })}
          </div>
          ${createResultView({
            viewId: "vocab-quiz-result-view",
            totalId: "vocab-quiz-result-total",
            correctId: "vocab-quiz-result-correct",
            wrongId: "vocab-quiz-result-wrong",
            filterId: "vocab-quiz-result-filter",
            filterAriaLabel: "단어 퀴즈 결과 필터",
            emptyId: "vocab-quiz-result-empty",
            emptyText: "아직 보여줄 결과가 없어요.",
            listId: "vocab-quiz-result-list",
            bulkAction: {
              id: "vocab-quiz-result-bulk-action",
              labelId: "vocab-quiz-result-bulk-label",
              label: "전체 담기"
            }
          })}
        </div>
      </div>
    `;
  }

  function createStarterKanjiLayout() {
    return `
      <div class="match-shell">
        <aside class="match-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">QUIZ HUD</span><h3>한자 퀴즈</h3></div>
          <div class="study-options-shell match-options-shell kanji-options-shell" id="starter-kanji-options-shell">
            <button class="study-options-toggle" id="starter-kanji-options-toggle" type="button" aria-expanded="true" aria-controls="starter-kanji-options-panel">
              <div class="study-options-toggle-copy"><strong>퀴즈 설정, 어떻게 할까요?</strong><p class="study-options-toggle-summary" id="starter-kanji-options-summary">전체 · 전체 · 10문제 · 15초</p></div>
              <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
            </button>
            <div class="study-options-panel study-options-panel-wide" id="starter-kanji-options-panel">
              <div class="study-options-group">
                <span>문제 영역</span>
                ${createSelectField({
                  id: "starter-kanji-question-field",
                  label: "문제 영역",
                  ariaLabel: "한자 퀴즈 문제 영역 고르기",
                  includeLabel: false,
                  options: [
                    { value: "display", label: "한자" },
                    { value: "reading", label: "발음" }
                  ]
                })}
              </div>
              <div class="study-options-group">
                <span>보기 영역</span>
                ${createSelectField({
                  id: "starter-kanji-option-field",
                  label: "보기 영역",
                  ariaLabel: "한자 퀴즈 보기 영역 고르기",
                  includeLabel: false,
                  options: [
                    { value: "reading", label: "발음" },
                    { value: "display", label: "한자" }
                  ]
                })}
              </div>
              <div class="study-options-group">
                <span>몇 문제 풀까요?</span>
                ${createToggleButtonGroup({
                  ariaLabel: "한자 퀴즈 문제 수 고르기",
                  buttons: [
                    { label: "5문제", attributes: { "data-starter-kanji-count": "5", "aria-pressed": "false" } },
                    { label: "10문제", className: "level-button is-active", attributes: { "data-starter-kanji-count": "10", "aria-pressed": "true" } },
                    { label: "15문제", attributes: { "data-starter-kanji-count": "15", "aria-pressed": "false" } },
                    { label: "20문제", attributes: { "data-starter-kanji-count": "20", "aria-pressed": "false" } }
                  ]
                })}
              </div>
              <div class="study-options-group">
                <span>시간은 어떻게 할까요?</span>
                ${createToggleButtonGroup({
                  ariaLabel: "한자 퀴즈 시간 고르기",
                  buttons: [
                    { label: "천천히", attributes: { "data-starter-kanji-time": "0", "aria-pressed": "false" } },
                    { label: "10초", attributes: { "data-starter-kanji-time": "10", "aria-pressed": "false" } },
                    { label: "15초", className: "level-button is-active", attributes: { "data-starter-kanji-time": "15", "aria-pressed": "true" } },
                    { label: "20초", attributes: { "data-starter-kanji-time": "20", "aria-pressed": "false" } }
                  ]
                })}
              </div>
            </div>
          </div>
          <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="한자 퀴즈 학년 필터">
            ${createSelectField({
              id: "starter-kanji-collection-select",
              label: "모아보기",
              ariaLabel: "한자 퀴즈 모아보기 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "review", label: "다시 볼래요" },
                { value: "mastered", label: "익혔어요" }
              ]
            })}
            ${createSelectField({
              id: "starter-kanji-grade-select",
              label: "학년",
              ariaLabel: "한자 퀴즈 학년 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "1", label: "1학년" },
                { value: "2", label: "2학년" },
                { value: "3", label: "3학년" },
                { value: "4", label: "4학년" },
                { value: "5", label: "5학년" },
                { value: "6", label: "6학년" }
              ]
            })}
          </div>
          ${createActionButton({
            id: "starter-kanji-start",
            labelId: "starter-kanji-start-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board">
          <p class="vocab-list-empty" id="starter-kanji-empty" hidden>준비됐다면 시작해볼까요?</p>
          <div id="starter-kanji-practice-view">
            ${createChoiceQuizCard({
              articleId: "starter-kanji-card",
              className: "basic-practice-card tone-gold kanji-practice-card",
              metaItems: [
                { text: "한자" },
                { id: "starter-kanji-source", text: "한자 1" },
                { id: "starter-kanji-progress", text: "1 / 5" }
              ],
              hudItems: [
                { label: "남은 시간", valueId: "starter-kanji-timer", value: "15초" },
                { label: "맞힌 수", valueId: "starter-kanji-correct", value: "0" }
              ],
              displayBox: {
                className: "basic-practice-display-box",
                titleId: "starter-kanji-display",
                title: "-",
                subtitleId: "starter-kanji-display-sub",
                subtitle: ""
              },
              optionsId: "starter-kanji-options",
              nextButtonId: "starter-kanji-next",
              nextButtonLabel: "다음 한자 볼까요?"
            })}
          </div>
          ${createResultView({
            viewId: "starter-kanji-result-view",
            className: "match-result-view kanji-result-view",
            totalId: "starter-kanji-result-total",
            correctId: "starter-kanji-result-correct",
            wrongId: "starter-kanji-result-wrong",
            filterId: "starter-kanji-result-filter",
            filterAriaLabel: "한자 결과 필터",
            emptyId: "starter-kanji-result-empty",
            emptyText: "아직 보여줄 결과가 없어요.",
            listId: "starter-kanji-result-list",
            bulkAction: {
              id: "starter-kanji-result-bulk-action",
              labelId: "starter-kanji-result-bulk-label",
              label: "전체 다시 볼래요"
            },
            footerHtml:
              '<div class="quiz-actions"><button class="primary-btn button-with-icon" id="starter-kanji-restart" type="button"><span class="material-symbols-rounded" aria-hidden="true">autorenew</span><span>다시 해볼까요?</span></button></div>'
          })}
        </div>
      </div>
    `;
  }

  function createMatchLayout() {
    return `
      <div class="match-shell">
        <aside class="match-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">ROUND HUD</span></div>
          ${createStudyOptionsShell({
            shellId: "match-options-shell",
            shellClassName: "match-options-shell",
            toggleId: "match-options-toggle",
            toggleTitle: "짝 맞추기 설정",
            summaryId: "match-options-summary",
            summaryText: "5문제 · 15초",
            panelId: "match-options-panel",
            panelClassName: "study-options-panel-wide",
            groups: [
              {
                label: "몇 문제 풀까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "짝 맞추기 문제 수 고르기",
                  buttons: [
                    { label: "5문제", className: "level-button is-active", attributes: { "data-match-count": "5", "aria-pressed": "true" } },
                    { label: "10문제", attributes: { "data-match-count": "10", "aria-pressed": "false" } },
                    { label: "15문제", attributes: { "data-match-count": "15", "aria-pressed": "false" } },
                    { label: "20문제", attributes: { "data-match-count": "20", "aria-pressed": "false" } }
                  ]
                })
              },
              {
                label: "시간은 어떻게 할까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "짝 맞추기 시간 고르기",
                  buttons: [
                    { label: "천천히", attributes: { "data-match-time": "0", "aria-pressed": "false" } },
                    { label: "10초", attributes: { "data-match-time": "10", "aria-pressed": "false" } },
                    { label: "15초", className: "level-button is-active", attributes: { "data-match-time": "15", "aria-pressed": "true" } },
                    { label: "20초", attributes: { "data-match-time": "20", "aria-pressed": "false" } }
                  ]
                })
              }
            ]
          })}
          <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="짝 맞추기 필터">
            ${createSelectField({
              id: "match-level-select",
              label: "레벨",
              ariaLabel: "짝 맞추기 레벨 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "N5", label: "N5" },
                { value: "N4", label: "N4" },
                { value: "N3", label: "N3" }
              ]
            })}
            ${createSelectField({
              id: "match-filter-select",
              label: "모아보기",
              ariaLabel: "짝 맞추기 모아보기 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "review", label: "다시 볼래요" },
                { value: "mastered", label: "익혔어요" }
              ]
            })}
            ${createSelectField({
              id: "match-part-select",
              label: "품사",
              ariaLabel: "짝 맞추기 품사 고르기",
              options: [{ value: "all", label: "전체 품사" }]
            })}
          </div>
          ${createActionButton({
            id: "match-new-round",
            labelId: "match-new-round-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board" id="match-board" hidden>
          <p class="vocab-list-empty" id="match-empty" hidden>준비됐다면 시작해볼까요?</p>
          <div class="match-play-view" id="match-play-view">
            <div class="quiz-hud match-play-hud">
              <div class="quiz-hud-item"><span>진행</span><strong id="match-progress">0 / 5</strong></div>
              <div class="quiz-hud-item"><span>남은 시간</span><strong id="match-timer">15초</strong></div>
            </div>
            <div class="match-feedback" id="match-feedback" hidden></div>
            <div class="match-columns">
              <section class="match-column"><div class="match-column-head"><h3>읽기 카드</h3></div><div class="match-card-list" id="match-left-list"></div></section>
              <section class="match-column"><div class="match-column-head"><h3>뜻 카드</h3></div><div class="match-card-list" id="match-right-list"></div></section>
            </div>
          </div>
          ${createResultView({
            viewId: "match-result-view",
            totalId: "match-result-total",
            correctId: "match-result-correct",
            wrongId: "match-result-wrong",
            filterId: "match-result-filter",
            filterAriaLabel: "짝 맞추기 결과 필터",
            emptyId: "match-result-empty",
            emptyText: "아직 보여줄 결과가 없어요.",
            listId: "match-result-list",
            bulkAction: {
              id: "match-result-bulk-action",
              labelId: "match-result-bulk-label",
              label: "전체 담기"
            }
          })}
        </div>
      </div>
    `;
  }

  function createKanjiMatchLayout() {
    return `
      <div class="match-shell">
        <aside class="match-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">ROUND HUD</span><h3>한자 짝맞추기</h3></div>
          ${createStudyOptionsShell({
            shellId: "kanji-match-options-shell",
            shellClassName: "match-options-shell",
            toggleId: "kanji-match-options-toggle",
            toggleTitle: "짝 맞추기 설정",
            summaryId: "kanji-match-options-summary",
            summaryText: "전체 · 전체 · 5문제 · 15초",
            panelId: "kanji-match-options-panel",
            panelClassName: "study-options-panel-wide",
            groups: [
              {
                label: "몇 문제 풀까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "한자 짝 맞추기 문제 수 고르기",
                  buttons: [
                    { label: "5문제", className: "level-button is-active", attributes: { "data-kanji-match-count": "5", "aria-pressed": "true" } },
                    { label: "10문제", attributes: { "data-kanji-match-count": "10", "aria-pressed": "false" } },
                    { label: "15문제", attributes: { "data-kanji-match-count": "15", "aria-pressed": "false" } },
                    { label: "20문제", attributes: { "data-kanji-match-count": "20", "aria-pressed": "false" } }
                  ]
                })
              },
              {
                label: "시간은 어떻게 할까요?",
                content: createToggleButtonGroup({
                  ariaLabel: "한자 짝 맞추기 시간 고르기",
                  buttons: [
                    { label: "천천히", attributes: { "data-kanji-match-time": "0", "aria-pressed": "false" } },
                    { label: "10초", attributes: { "data-kanji-match-time": "10", "aria-pressed": "false" } },
                    { label: "15초", className: "level-button is-active", attributes: { "data-kanji-match-time": "15", "aria-pressed": "true" } },
                    { label: "20초", attributes: { "data-kanji-match-time": "20", "aria-pressed": "false" } }
                  ]
                })
              }
            ]
          })}
          <div class="vocab-select-toolbar vocab-select-toolbar-sidebar" aria-label="한자 짝 맞추기 필터">
            ${createSelectField({
              id: "kanji-match-grade-select",
              label: "학년",
              ariaLabel: "한자 짝 맞추기 학년 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "1", label: "1학년" },
                { value: "2", label: "2학년" },
                { value: "3", label: "3학년" },
                { value: "4", label: "4학년" },
                { value: "5", label: "5학년" },
                { value: "6", label: "6학년" }
              ]
            })}
            ${createSelectField({
              id: "kanji-match-filter-select",
              label: "모아보기",
              ariaLabel: "한자 짝 맞추기 모아보기 고르기",
              options: [
                { value: "all", label: "전체" },
                { value: "review", label: "다시 볼래요" },
                { value: "mastered", label: "익혔어요" }
              ]
            })}
          </div>
          ${createActionButton({
            id: "kanji-match-new-round",
            labelId: "kanji-match-new-round-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board" id="kanji-match-board" hidden>
          <p class="vocab-list-empty" id="kanji-match-empty" hidden>준비됐다면 시작해볼까요?</p>
          <div class="match-play-view" id="kanji-match-play-view">
            <div class="quiz-hud match-play-hud">
              <div class="quiz-hud-item"><span>진행</span><strong id="kanji-match-progress">0 / 5</strong></div>
              <div class="quiz-hud-item"><span>남은 시간</span><strong id="kanji-match-timer">15초</strong></div>
            </div>
            <div class="match-feedback" id="kanji-match-feedback" hidden></div>
            <div class="match-columns">
              <section class="match-column"><div class="match-column-head"><h3>한자 카드</h3></div><div class="match-card-list" id="kanji-match-left-list"></div></section>
              <section class="match-column"><div class="match-column-head"><h3>발음 카드</h3></div><div class="match-card-list" id="kanji-match-right-list"></div></section>
            </div>
          </div>
          ${createResultView({
            viewId: "kanji-match-result-view",
            totalId: "kanji-match-result-total",
            correctId: "kanji-match-result-correct",
            wrongId: "kanji-match-result-wrong",
            filterId: "kanji-match-result-filter",
            filterAriaLabel: "한자 짝 맞추기 결과 필터",
            emptyId: "kanji-match-result-empty",
            emptyText: "아직 보여줄 결과가 없어요.",
            listId: "kanji-match-result-list",
            bulkAction: {
              id: "kanji-match-result-bulk-action",
              labelId: "kanji-match-result-bulk-label",
              label: "전체 다시 볼래요"
            }
          })}
        </div>
      </div>
    `;
  }

  function createGrammarPracticeLayout() {
    return `
      <div class="match-shell">
        <aside class="match-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">GRAMMAR HUD</span><h3>문법 퀴즈</h3></div>
          ${createStudyOptionsShell({
            shellId: "grammar-practice-options-shell",
            shellClassName: "match-options-shell",
            toggleId: "grammar-practice-options-toggle",
            toggleTitle: "문법 설정",
            summaryId: "grammar-practice-options-summary",
            summaryText: "N5",
            panelId: "grammar-practice-options-panel",
            panelClassName: "study-options-panel-compact",
            groups: [
              {
                label: "어느 레벨로 풀까요?",
                content:
                  '<div class="grammar-practice-level-switcher" id="grammar-practice-level-switcher" role="tablist" aria-label="문법 레벨 고르기"></div>'
              }
            ]
          })}
          ${createActionButton({
            id: "grammar-practice-start",
            labelId: "grammar-practice-start-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board grammar-practice-board">
          <p class="vocab-list-empty" id="grammar-practice-empty" hidden>준비됐다면 시작해볼까요?</p>
          <div id="grammar-practice-view">
            <article class="grammar-practice-card">
              <div class="grammar-practice-meta"><span id="grammar-practice-level">N5</span><span id="grammar-practice-source">N5G 1</span><span id="grammar-practice-progress">1 / 4</span></div>
              <div class="quiz-hud"><div class="quiz-hud-item"><span>남은 시간</span><strong id="grammar-timer">25초</strong></div></div>
              <div class="grammar-practice-header"><div><span class="eyebrow">GRAMMAR SET</span><h3 id="grammar-practice-title">문법 퀴즈</h3></div><p class="grammar-practice-note" id="grammar-practice-note"></p></div>
              <div class="grammar-practice-question"><span class="eyebrow">SENTENCE</span><p id="grammar-practice-sentence">문장을 불러오고 있어요.</p></div>
              <div class="grammar-practice-options" id="grammar-practice-options"></div>
              <p class="grammar-practice-feedback" id="grammar-practice-feedback"></p>
              <p class="grammar-practice-explanation" id="grammar-practice-explanation"></p>
              <div class="quiz-actions"><button class="primary-btn" id="grammar-practice-next" type="button">다음 문제 볼까요?</button></div>
            </article>
          </div>
        </div>
      </div>
    `;
  }

  function createReadingPracticeLayout() {
    return `
      <div class="match-shell">
        <aside class="match-sidebar">
          <div class="match-sidebar-head"><span class="eyebrow">READING HUD</span><h3>독해 퀴즈</h3></div>
          ${createStudyOptionsShell({
            shellId: "reading-options-shell",
            shellClassName: "match-options-shell",
            toggleId: "reading-options-toggle",
            toggleTitle: "독해 설정",
            summaryId: "reading-options-summary",
            summaryText: "N5 · 45초",
            panelId: "reading-options-panel",
            panelClassName: "study-options-panel-compact",
            groups: [
              {
                label: "어느 레벨로 읽을까요?",
                content:
                  '<div class="reading-level-switcher" id="reading-level-switcher" role="tablist" aria-label="독해 레벨 고르기"></div>'
              },
              {
                label: "시간은 어떻게 할까요?",
                content:
                  '<div class="reading-time-switcher" id="reading-time-switcher" role="group" aria-label="독해 시간 고르기"></div>'
              }
            ]
          })}
          ${createActionButton({
            id: "reading-start",
            labelId: "reading-start-label",
            label: "시작해볼까요?"
          })}
        </aside>
        <div class="match-board reading-practice-board">
          <p class="vocab-list-empty" id="reading-empty" hidden>준비됐다면 시작해볼까요?</p>
          <div id="reading-practice-view">
            <article class="reading-card">
              <div class="reading-meta"><span id="reading-level">N5</span><span id="reading-source">N5R p1</span></div>
              <div class="quiz-hud"><div class="quiz-hud-item"><span>진행</span><strong id="reading-progress">1 / 3</strong></div><div class="quiz-hud-item"><span>남은 시간</span><strong id="reading-timer">45초</strong></div></div>
              <div class="reading-header"><div><span class="eyebrow">READING SET</span><h3 id="reading-title">한 문제씩 읽어봐요</h3></div><p class="reading-korean" id="reading-korean"></p></div>
              <div class="reading-passage" id="reading-passage"></div>
              <div class="reading-question-box"><span class="eyebrow">QUESTION</span><h4 id="reading-question">질문을 불러오고 있어요.</h4></div>
              <div class="reading-options" id="reading-options"></div>
              <p class="reading-feedback" id="reading-feedback"></p>
              <p class="reading-explanation" id="reading-explanation"></p>
              <div class="quiz-actions"><button class="primary-btn" id="reading-next" type="button">다음 글도 볼까요?</button></div>
            </article>
          </div>
        </div>
      </div>
    `;
  }

  function createLayout(kind) {
    switch (kind) {
      case "vocab-quiz":
        return createVocabQuizLayout();
      case "starter-kanji-practice":
        return createStarterKanjiLayout();
      case "kanji-match-round":
        return createKanjiMatchLayout();
      case "match-round":
        return createMatchLayout();
      case "grammar-practice":
        return createGrammarPracticeLayout();
      case "reading-practice":
        return createReadingPracticeLayout();
      default:
        return "";
    }
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

  global.japanoteSharedQuizLayouts = {
    mount: mountSharedQuizLayouts
  };

  mountSharedQuizLayouts();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSharedQuizLayouts, { once: true });
  }
})(globalThis);
