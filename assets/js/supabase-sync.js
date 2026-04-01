(function () {
  const studyStateKey = "jlpt-compass-state";
  const matchStateKey = "japanote-match-state";
  const themeStorageKey = "japanote-theme";
  const authStorageKey = "japanote-supabase-auth";
  const supportedKeys = new Set([studyStateKey, matchStateKey, themeStorageKey]);
  const defaultConfig = {
    enabled: false,
    url: "",
    anonKey: "",
    stateTable: "user_state",
    emailRedirectTo: ""
  };
  const rawConfig =
    globalThis.japanoteSupabaseConfig && typeof globalThis.japanoteSupabaseConfig === "object"
      ? globalThis.japanoteSupabaseConfig
      : {};
  const config = {
    ...defaultConfig,
    ...rawConfig
  };

  config.enabled = Boolean(config.enabled && config.url && config.anonKey && config.stateTable);

  const localValues = {
    [studyStateKey]: readLocalJson(studyStateKey, {}),
    [matchStateKey]: readLocalJson(matchStateKey, {}),
    [themeStorageKey]: readLocalText(themeStorageKey, "light")
  };

  let client = null;
  let currentSession = null;
  let currentUser = null;
  let authPanelOpen = false;
  let authPanelFrame = 0;
  let authPanelIdSequence = 0;
  let pendingAuthPullTimer = null;
  let pendingSaveTimer = null;
  let isLoadingRemoteState = false;
  let authUrlErrorVisible = false;
  let status = {
    code: config.enabled ? "ready" : "local-only",
    summary: config.enabled ? "클라우드 준비" : "이 기기만 저장",
    detail: config.enabled
      ? "이메일 로그인 후 같은 데이터를 여러 기기에서 볼 수 있어요."
      : "Supabase 설정이 비어 있어서 현재는 이 기기 브라우저에만 저장해요.",
    busy: false
  };

  function clone(value) {
    if (value == null || typeof value !== "object") {
      return value;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function readLocalJson(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : clone(fallback);
    } catch (error) {
      return clone(fallback);
    }
  }

  function readLocalText(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return typeof saved === "string" && saved ? saved : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function persistLocalValue(key, value) {
    try {
      if (key === themeStorageKey) {
        localStorage.setItem(key, String(value || "light"));
        return;
      }

      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Keep the in-memory state even if localStorage is unavailable.
    }
  }

  const studyArrayIdKeys = [
    "masteredIds",
    "reviewIds",
    "kanjiMasteredIds",
    "kanjiReviewIds",
    "starterDoneIds",
    "grammarDoneIds",
    "quizSessionMistakeIds"
  ];

  /** 제거(빼기)가 동기화돼야 하는 ID 목록은 합집합이 아니라 최근 편집본을 따른다. */
  const studyArrayIdKeysLastWriteWins = new Set([
    "masteredIds",
    "reviewIds",
    "kanjiMasteredIds",
    "kanjiReviewIds"
  ]);

  const studyIndexObjectKeys = ["basicPracticeIndexes", "readingIndexes", "grammarPracticeIndexes"];

  function unionIdArrays(a, b) {
    const seen = new Set();
    const out = [];

    for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (item == null || item === "") {
        continue;
      }

      const key = String(item);

      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }

    return out;
  }

  function mergeIndexObjects(a, b) {
    const left = a && typeof a === "object" ? a : {};
    const right = b && typeof b === "object" ? b : {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const out = {};

    for (const k of keys) {
      out[k] = Math.max(Number(left[k]) || 0, Number(right[k]) || 0);
    }

    return out;
  }

  function mergeQuizMistakes(a, b) {
    const map = new Map();

    for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (item && item.id) {
        map.set(String(item.id), item);
      }
    }

    return Array.from(map.values()).slice(0, 30);
  }

  function maxDateString(a, b) {
    if (!a && !b) {
      return null;
    }

    if (!a) {
      return b;
    }

    if (!b) {
      return a;
    }

    return String(a) >= String(b) ? a : b;
  }

  function mergeStudyState(local, remote) {
    const la = local?._sync?.clientEditedAt ?? 0;
    const ra = remote?._sync?.clientEditedAt ?? 0;
    const newer = la >= ra ? local : remote;
    const older = la >= ra ? remote : local;
    const merged = {
      ...(older && typeof older === "object" ? older : {}),
      ...(newer && typeof newer === "object" ? newer : {})
    };

    for (const key of studyArrayIdKeys) {
      if (studyArrayIdKeysLastWriteWins.has(key)) {
        if (la > ra) {
          merged[key] = Array.isArray(local?.[key]) ? [...local[key]] : [];
        } else if (ra > la) {
          merged[key] = Array.isArray(remote?.[key]) ? [...remote[key]] : [];
        } else {
          merged[key] = unionIdArrays(local?.[key], remote?.[key]);
        }
      } else {
        merged[key] = unionIdArrays(local?.[key], remote?.[key]);
      }
    }

    merged.quizMistakes = mergeQuizMistakes(local?.quizMistakes, remote?.quizMistakes);

    for (const key of studyIndexObjectKeys) {
      merged[key] = mergeIndexObjects(local?.[key], remote?.[key]);
    }

    merged.streak = Math.max(Number(local?.streak) || 0, Number(remote?.streak) || 0);
    merged.lastStudyDate = maxDateString(local?.lastStudyDate, remote?.lastStudyDate);
    merged.quizCorrectCount = Math.max(Number(local?.quizCorrectCount) || 0, Number(remote?.quizCorrectCount) || 0);
    merged.quizAnsweredCount = Math.max(Number(local?.quizAnsweredCount) || 0, Number(remote?.quizAnsweredCount) || 0);
    merged.stateVersion = Math.max(Number(local?.stateVersion) || 0, Number(remote?.stateVersion) || 0);

    const mastered = new Set(merged.masteredIds.map((id) => String(id)));
    merged.reviewIds = merged.reviewIds.filter((id) => !mastered.has(String(id)));
    const km = new Set(merged.kanjiMasteredIds.map((id) => String(id)));
    merged.kanjiReviewIds = merged.kanjiReviewIds.filter((id) => !km.has(String(id)));

    merged._sync = { clientEditedAt: Math.max(la, ra) || Date.now() };

    return merged;
  }

  function mergeMatchState(local, remote) {
    const la = local?._sync?.clientEditedAt ?? 0;
    const ra = remote?._sync?.clientEditedAt ?? 0;
    const newer = la >= ra ? local : remote;
    const older = la >= ra ? remote : local;
    const merged = {
      ...(older && typeof older === "object" ? older : {}),
      ...(newer && typeof newer === "object" ? newer : {})
    };

    merged._sync = { clientEditedAt: Math.max(la, ra) || Date.now() };

    return merged;
  }

  function hasHttpOrigin() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  function getCurrentPageUrl() {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = "";
      currentUrl.search = "";
      return currentUrl.toString();
    } catch (error) {
      return window.location.href.split("#")[0].split("?")[0];
    }
  }

  /** 매직 링크는 항상 "지금 이 페이지"로 돌아오게 함. Supabase Redirect URLs에 이 URL(포트 포함)이 있어야 함. */
  function getEmailRedirectUrl() {
    const currentPageUrl = getCurrentPageUrl();

    if (hasHttpOrigin()) {
      return currentPageUrl;
    }

    return config.emailRedirectTo || currentPageUrl;
  }

  function setStatus(code, summary, detail, busy = false) {
    status = { code, summary, detail, busy };
    renderAuthUi();
    dispatchStatusEvent();
  }

  function setReadyStatus() {
    authUrlErrorVisible = false;
    setStatus("ready", "클라우드 준비", "이메일 로그인 후 같은 데이터를 여러 기기에서 볼 수 있어요.");
  }

  function syncCurrentSession(session) {
    currentSession = session || null;
    currentUser = session?.user || null;
  }

  function dispatchStorageUpdate(key, value, source) {
    window.dispatchEvent(
      new CustomEvent("japanote:storage-updated", {
        detail: {
          key,
          value: clone(value),
          source
        }
      })
    );
  }

  function dispatchStatusEvent() {
    window.dispatchEvent(
      new CustomEvent("japanote:sync-status", {
        detail: getPublicState()
      })
    );
  }

  function getPublicState() {
    return {
      enabled: config.enabled,
      session: currentSession,
      user: currentUser,
      status: { ...status }
    };
  }

  function readValue(key, fallback = null) {
    if (!supportedKeys.has(key)) {
      return clone(fallback);
    }

    if (!Object.prototype.hasOwnProperty.call(localValues, key)) {
      return clone(fallback);
    }

    return clone(localValues[key]);
  }

  function writeValue(key, value, options = {}) {
    if (!supportedKeys.has(key)) {
      return;
    }

    const nextValue = clone(value);

    if (options.source !== "remote") {
      if (key === studyStateKey && nextValue && typeof nextValue === "object") {
        nextValue._sync = { clientEditedAt: Date.now() };
      }

      if (key === matchStateKey && nextValue && typeof nextValue === "object") {
        nextValue._sync = { clientEditedAt: Date.now() };
      }
    }

    localValues[key] = nextValue;
    persistLocalValue(key, nextValue);
    dispatchStorageUpdate(key, nextValue, options.source || "local");

    if (options.remote !== false) {
      queueRemoteSave();
    }

    renderAuthUi();
  }

  function queueRemoteSave() {
    if (!config.enabled || !currentUser || isLoadingRemoteState) {
      return;
    }

    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = window.setTimeout(() => {
      pushRemoteState("변경 내용을 클라우드에 저장하고 있어요.");
    }, 700);
  }

  async function fetchRemoteState() {
    if (!client || !currentUser) {
      return { data: null, error: null };
    }

    return client
      .from(config.stateTable)
      .select("study_state, match_state, theme_mode, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();
  }

  function applyRemoteState(remoteState) {
    if (!remoteState || typeof remoteState !== "object") {
      return;
    }

    const mergedStudy = mergeStudyState(readValue(studyStateKey, {}), remoteState.study_state || {});
    const mergedMatch = mergeMatchState(readValue(matchStateKey, {}), remoteState.match_state || {});

    writeValue(studyStateKey, mergedStudy, {
      remote: false,
      source: "remote"
    });
    writeValue(matchStateKey, mergedMatch, {
      remote: false,
      source: "remote"
    });
    writeValue(themeStorageKey, remoteState.theme_mode || "light", {
      remote: false,
      source: "remote"
    });
  }

  async function pullRemoteState(detail = "클라우드 데이터를 확인하고 있어요.") {
    if (!config.enabled || !client || !currentUser) {
      return { ok: false };
    }

    isLoadingRemoteState = true;
    setStatus("syncing", "클라우드 동기화", detail, true);

    try {
      const { data, error } = await fetchRemoteState();

      if (error) {
        throw error;
      }

      if (!data) {
        await pushRemoteState("클라우드에 첫 학습 기록을 만들고 있어요.");
        return { ok: true, bootstrapped: true };
      }

      applyRemoteState(data);
      setStatus("synced", "동기화됨", "클라우드에 저장된 최신 학습 상태를 불러왔어요.");
      return { ok: true, data };
    } catch (error) {
      setStatus(
        "error",
        "동기화 오류",
        error?.message || "Supabase에서 데이터를 읽지 못했어요. 설정과 RLS 정책을 확인해 주세요."
      );
      return { ok: false, error };
    } finally {
      isLoadingRemoteState = false;
    }
  }

  async function pushRemoteState(detail = "클라우드에 학습 상태를 저장하고 있어요.") {
    if (!config.enabled || !client || !currentUser) {
      return { ok: false };
    }

    setStatus("syncing", "클라우드 저장", detail, true);

    try {
      const { data: row, error: fetchError } = await fetchRemoteState();

      if (fetchError) {
        throw fetchError;
      }

      const localStudy = readValue(studyStateKey, {});
      const localMatch = readValue(matchStateKey, {});
      const mergedStudy = mergeStudyState(localStudy, row?.study_state || {});
      const mergedMatch = mergeMatchState(localMatch, row?.match_state || {});
      const themeMode =
        typeof localValues[themeStorageKey] === "string" ? localValues[themeStorageKey] : "light";

      const payload = {
        user_id: currentUser.id,
        study_state: mergedStudy,
        match_state: mergedMatch,
        theme_mode: themeMode,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from(config.stateTable).upsert(payload, {
        onConflict: "user_id"
      });

      if (error) {
        throw error;
      }

      writeValue(studyStateKey, mergedStudy, {
        remote: false,
        source: "remote"
      });
      writeValue(matchStateKey, mergedMatch, {
        remote: false,
        source: "remote"
      });

      setStatus("synced", "동기화됨", "다른 기기와 합친 학습 상태를 클라우드에 저장했어요.");
      return { ok: true };
    } catch (error) {
      setStatus(
        "error",
        "저장 실패",
        error?.message || "Supabase에 데이터를 저장하지 못했어요. 테이블 이름과 정책을 확인해 주세요."
      );
      return { ok: false, error };
    }
  }

  function scheduleRemotePull(detail) {
    if (!config.enabled || !currentUser) {
      return;
    }

    window.clearTimeout(pendingAuthPullTimer);
    pendingAuthPullTimer = window.setTimeout(() => {
      pendingAuthPullTimer = null;
      pullRemoteState(detail);
    }, 0);
  }

  function getFriendlyAuthErrorMessage(error) {
    const rawMessage = String(error?.message || "").trim();
    const lowerMessage = rawMessage.toLowerCase();

    if (!rawMessage) {
      return "인증 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
    }

    if (lowerMessage.includes("email rate limit exceeded")) {
      return "이메일을 너무 자주 보내서 잠시 제한됐어요. 조금 기다린 뒤 다시 시도해 주세요.";
    }

    if (lowerMessage.includes("email link is invalid or has expired") || lowerMessage.includes("otp_expired")) {
      return "로그인 링크가 만료됐거나 이미 사용됐어요. 새 링크를 다시 보내 주세요.";
    }

    if (lowerMessage.includes("invalid login credentials")) {
      return "로그인 정보가 맞지 않아요. 다시 확인해 주세요.";
    }

    if (lowerMessage.includes("user already registered")) {
      return "이미 등록된 이메일이에요. 바로 로그인해 보세요.";
    }

    if (lowerMessage.includes("signup is disabled")) {
      return "현재 새 로그인 요청을 받을 수 없어요. 인증 설정을 확인해 주세요.";
    }

    return rawMessage;
  }

  async function signInWithEmail(email, displayName) {
    if (!config.enabled || !client) {
      return { ok: false };
    }

    authUrlErrorVisible = false;
    const normalizedEmail = String(email || "").trim();
    const normalizedName = String(displayName || "").trim();

    if (!normalizedName) {
      setStatus("error", "이름 필요", "표시할 이름을 입력해 주세요.");
      return { ok: false };
    }

    if (!normalizedEmail) {
      setStatus("error", "이메일 필요", "로그인 링크를 받을 이메일 주소를 입력해 주세요.");
      return { ok: false };
    }

    setStatus("sending-link", "로그인 링크 전송", "이메일로 매직 링크를 보내는 중이에요.", true);

    try {
      const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          data: {
            full_name: normalizedName,
            name: normalizedName
          }
        }
      });

      if (error) {
        throw error;
      }

      setStatus(
        "link-sent",
        "링크 전송됨",
        "받은 편지함에서 가장 최근에 온 로그인 링크를 열어 주세요."
      );
      return { ok: true };
    } catch (error) {
      setStatus("error", "링크 전송 실패", getFriendlyAuthErrorMessage(error));
      return { ok: false, error };
    }
  }

  async function signOut() {
    if (!client) {
      return;
    }

    try {
      await client.auth.signOut();
      syncCurrentSession(null);
      setReadyStatus();
    } catch (error) {
      setStatus("error", "로그아웃 실패", error?.message || "로그아웃 처리 중 문제가 발생했어요.");
    }
  }

  function getSummaryLabel() {
    if (!config.enabled) {
      return "이 기기만";
    }

    if (currentUser) {
      return status.busy ? "동기화 중" : "연결됨";
    }

    if (status.code === "link-sent") {
      return "메일 확인";
    }

    if (status.code === "error") {
      return "동기화 오류";
    }

    return "클라우드 연결";
  }

  function getSummaryIcon() {
    if (!config.enabled) {
      return "cloud_off";
    }

    if (status.code === "error") {
      return "cloud_alert";
    }

    if (currentUser) {
      return status.busy ? "cloud_upload" : "cloud_done";
    }

    if (status.code === "link-sent") {
      return "mark_email_read";
    }

    return "cloud_sync";
  }

  function getPanelForRoot(root) {
    const panelId = root?.dataset?.authPanelId;
    return panelId ? document.getElementById(panelId) : null;
  }

  function ensurePanelPortal(root) {
    if (!root) {
      return null;
    }

    const existingPanel = getPanelForRoot(root);
    if (existingPanel) {
      return existingPanel;
    }

    const inlinePanel = root.querySelector("[data-auth-panel]");
    if (!inlinePanel) {
      return null;
    }

    authPanelIdSequence += 1;
    inlinePanel.id = inlinePanel.id || `auth-panel-${authPanelIdSequence}`;
    root.dataset.authPanelId = inlinePanel.id;
    document.body.appendChild(inlinePanel);
    return inlinePanel;
  }

  function resetAuthPanelPosition(panel) {
    if (!panel) {
      return;
    }

    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("right");
    panel.style.removeProperty("visibility");
  }

  function positionAuthPanel(root, panel) {
    const toggle = root?.querySelector("[data-auth-toggle]");

    if (!toggle || !panel || panel.hidden) {
      resetAuthPanelPosition(panel);
      return;
    }

    const viewportPadding = 12;
    const panelOffset = 12;
    const toggleRect = toggle.getBoundingClientRect();

    panel.style.visibility = "hidden";
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.right = "auto";

    const panelRect = panel.getBoundingClientRect();
    const panelWidth = Math.min(panelRect.width || 360, window.innerWidth - viewportPadding * 2);
    const preferredLeft = toggleRect.right - panelWidth;
    const left = Math.min(
      window.innerWidth - viewportPadding - panelWidth,
      Math.max(viewportPadding, preferredLeft)
    );
    const panelHeight = panelRect.height || 0;
    const preferredTop = toggleRect.bottom + panelOffset;
    const maxTop = Math.max(viewportPadding, window.innerHeight - viewportPadding - panelHeight);
    const top = Math.max(viewportPadding, Math.min(preferredTop, maxTop));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = "";
  }

  function updateOpenAuthPanelPosition() {
    if (!authPanelOpen) {
      if (authPanelFrame) {
        window.cancelAnimationFrame(authPanelFrame);
        authPanelFrame = 0;
      }
      return;
    }

    if (authPanelFrame) {
      return;
    }

    authPanelFrame = window.requestAnimationFrame(() => {
      authPanelFrame = 0;
      document.querySelectorAll("[data-auth-root]").forEach((root) => {
        positionAuthPanel(root, getPanelForRoot(root) || ensurePanelPortal(root));
      });
    });
  }

  function buildAuthMarkup() {
    return [
      '<button class="secondary-btn button-with-icon auth-toggle" type="button" data-auth-toggle aria-expanded="false">',
      '<span class="material-symbols-rounded" data-auth-icon aria-hidden="true">cloud_sync</span>',
      '<span data-auth-summary>클라우드 연결</span>',
      "</button>",
      '<div class="auth-panel" data-auth-panel hidden>',
      '<p class="auth-panel-title">로그인</p>',
      '<p class="auth-panel-status" data-auth-status></p>',
      '<p class="auth-panel-copy" data-auth-detail></p>',
      '<form class="auth-form" data-auth-form>',
      '<label class="auth-field" for="auth-name-input">',
      "<span>이름</span>",
      '<input id="auth-name-input" class="auth-input" type="text" autocomplete="name" placeholder="홍길동" data-auth-name>',
      "</label>",
      '<label class="auth-field" for="auth-email-input">',
      "<span>이메일</span>",
      '<input id="auth-email-input" class="auth-input" type="email" autocomplete="email" placeholder="you@example.com" data-auth-email>',
      "</label>",
      '<button class="secondary-btn auth-submit" type="submit" data-auth-submit>로그인 링크 받기</button>',
      "</form>",
      '<div class="auth-user" data-auth-user hidden>',
      '<span class="material-symbols-rounded" aria-hidden="true">person</span>',
      '<strong data-auth-user-email></strong>',
      "</div>",
      '<div class="auth-actions" data-auth-actions>',
      '<button class="secondary-btn auth-action-button" type="button" data-auth-signout>로그아웃</button>',
      "</div>",
      '<p class="auth-panel-help" data-auth-help></p>',
      "</div>"
    ].join("");
  }

  function ensureAuthRoots() {
    document.querySelectorAll(".topbar").forEach((header) => {
      let root = header.querySelector("[data-auth-root]");

      if (!root) {
        root = document.createElement("div");
        root.className = "topbar-auth";
        root.setAttribute("data-auth-root", "");
        root.innerHTML = buildAuthMarkup();
        header.appendChild(root);
      }

      const panel = ensurePanelPortal(root);

      if (root.dataset.authBound === "true") {
        return;
      }

      const toggle = root.querySelector("[data-auth-toggle]");
      const form = panel?.querySelector("[data-auth-form]");
      const emailInput = panel?.querySelector("[data-auth-email]");
      const nameInput = panel?.querySelector("[data-auth-name]");
      const signoutButton = panel?.querySelector("[data-auth-signout]");

      if (toggle && panel) {
        toggle.setAttribute("aria-controls", panel.id);
        toggle.addEventListener("click", () => {
          authPanelOpen = !authPanelOpen;
          renderAuthUi();
        });
      }

      if (form && emailInput && nameInput) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          await signInWithEmail(emailInput.value, nameInput.value);
          renderAuthUi();
        });
      }

      if (signoutButton) {
        signoutButton.addEventListener("click", async () => {
          await signOut();
        });
      }

      root.dataset.authBound = "true";
    });
  }

  function renderAuthUi() {
    ensureAuthRoots();

    document.querySelectorAll("[data-auth-root]").forEach((root) => {
      const panel = ensurePanelPortal(root);
      const icon = root.querySelector("[data-auth-icon]");
      const summary = root.querySelector("[data-auth-summary]");
      const toggle = root.querySelector("[data-auth-toggle]");
      const statusNode = panel?.querySelector("[data-auth-status]");
      const detailNode = panel?.querySelector("[data-auth-detail]");
      const helpNode = panel?.querySelector("[data-auth-help]");
      const form = panel?.querySelector("[data-auth-form]");
      const submitButton = panel?.querySelector("[data-auth-submit]");
      const signoutButton = panel?.querySelector("[data-auth-signout]");
      const userNode = panel?.querySelector("[data-auth-user]");
      const userEmailNode = panel?.querySelector("[data-auth-user-email]");

      if (panel) {
        panel.hidden = !authPanelOpen;
      }
      if (icon) {
        icon.textContent = getSummaryIcon();
      }
      if (summary) {
        summary.textContent = getSummaryLabel();
      }
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(authPanelOpen));
      }
      if (statusNode) {
        statusNode.textContent = status.summary;
      }
      if (detailNode) {
        detailNode.textContent = status.detail;
      }
      if (helpNode) {
        helpNode.hidden = config.enabled;
        helpNode.textContent = config.enabled
          ? ""
          : "assets/js/supabase-config.js에서 SUPABASE_URL과 SUPABASE_ANON_KEY를 채우세요. (대시보드 → Settings → API)";
      }
      if (form) {
        form.hidden = !config.enabled || Boolean(currentUser);
      }
      if (submitButton) {
        submitButton.disabled = status.busy;
      }
      if (signoutButton) {
        signoutButton.hidden = !Boolean(currentUser);
        signoutButton.disabled = status.busy;
      }
      if (userNode) {
        userNode.hidden = !Boolean(currentUser);
      }
      if (userEmailNode) {
        const display =
          currentUser?.user_metadata?.full_name ||
          currentUser?.user_metadata?.name ||
          currentUser?.email ||
          currentUser?.user_metadata?.user_name ||
          "로그인됨";
        userEmailNode.textContent = display;
      }
      if (panel) {
        positionAuthPanel(root, panel);
      }
    });
  }

  function attachDismissHandler() {
    document.addEventListener("click", (event) => {
      if (!authPanelOpen) {
        return;
      }

      const authRoot = event.target.closest("[data-auth-root]");
      const authPanel = event.target.closest("[data-auth-panel]");

      if (authRoot || authPanel) {
        return;
      }

      authPanelOpen = false;
      renderAuthUi();
    });
  }

  function attachViewportHandlers() {
    window.addEventListener("resize", updateOpenAuthPanelPosition);
    window.addEventListener("scroll", updateOpenAuthPanelPosition, true);
  }

  function readAuthResponseParams() {
    const values = [];

    if (window.location.hash.length > 1) {
      values.push(window.location.hash.slice(1));
    }
    if (window.location.search.length > 1) {
      values.push(window.location.search.slice(1));
    }

    for (const rawValue of values) {
      const params = new URLSearchParams(rawValue);
      if (params.has("error") || params.has("error_code")) {
        return params;
      }
    }

    return null;
  }

  function clearAuthResponseParams() {
    if (!hasHttpOrigin()) {
      return;
    }

    const url = new URL(window.location.href);
    let changed = false;
    const authKeys = [
      "error",
      "error_code",
      "error_description",
      "access_token",
      "refresh_token",
      "expires_at",
      "expires_in",
      "provider_token",
      "provider_refresh_token",
      "token_type",
      "code"
    ];

    for (const key of authKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      for (const key of authKeys) {
        if (hashParams.has(key)) {
          hashParams.delete(key);
          changed = true;
        }
      }
      url.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";
    }

    if (changed) {
      window.history.replaceState({}, document.title, url.toString());
    }
  }

  function maybeShowAuthUrlError() {
    const params = readAuthResponseParams();
    if (!params || currentUser) {
      return false;
    }

    authUrlErrorVisible = true;
    setStatus(
      "error",
      "로그인 링크 오류",
      getFriendlyAuthErrorMessage({
        message: params.get("error_description") || params.get("error") || params.get("error_code") || "auth_error"
      })
    );
    clearAuthResponseParams();
    return true;
  }

  async function initializeSupabase() {
    ensureAuthRoots();
    renderAuthUi();
    attachDismissHandler();
    attachViewportHandlers();

    if (!config.enabled) {
      return;
    }

    if (!globalThis.supabase || typeof globalThis.supabase.createClient !== "function") {
      setStatus("error", "SDK 누락", "Supabase JavaScript SDK를 불러오지 못했어요.");
      return;
    }

    client = globalThis.supabase.createClient(config.url, config.anonKey, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: authStorageKey
      }
    });

    client.auth.onAuthStateChange((event, session) => {
      syncCurrentSession(session);

      if (!currentUser) {
        if (!authUrlErrorVisible && !maybeShowAuthUrlError()) {
          setReadyStatus();
        } else {
          renderAuthUi();
        }
        return;
      }

      authUrlErrorVisible = false;
      clearAuthResponseParams();
      renderAuthUi();

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        scheduleRemotePull("클라우드에 저장된 학습 상태를 연결하고 있어요.");
      }
    });

    try {
      await client.auth.getSession();
    } catch (error) {
      console.warn("Supabase getSession failed.", error);
    }

    if (!maybeShowAuthUrlError()) {
      setReadyStatus();
    }
  }

  globalThis.japanoteSync = {
    getState: getPublicState,
    readValue,
    writeValue,
    pullRemoteState,
    pushRemoteState,
    signInWithEmail,
    signOut
  };

  void initializeSupabase();
})();
