(function challengeLinksBootstrap(global) {
  const challengeParamKey = "challenge";
  const challengeRefParamKey = "c";
  const maxEncodedChallengeLength = 20000;
  const comparisonCardClassName = "challenge-result-comparison";
  const maxVisibleComparisonItems = 6;
  const compressedPayloadPrefix = "lz:";
  const lzUrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const shortCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const shortCodeLength = 10;
  const shortLinkMaxSaveAttempts = 4;
  const challengeTableName = "shared_challenges";
  const challengePreviewFunctionName = "challenge-preview";
  const lzReverseDictionaries = Object.create(null);
  const providersByResultViewId = new Map();
  const providersByKind = new Map();
  let pendingChallengePayload = null;
  let pendingChallengeToken = "";
  let pendingChallengeLoadPromise = null;
  let pendingChallengeLoadError = "";
  let pendingChallengeErrorNotifiedToken = "";
  let appliedChallengeKey = "";
  let applyAttemptQueued = false;
  let activeChallengeState = null;
  let challengeSupabaseClient = null;

  function notify(message) {
    if (!message) {
      return;
    }

    if (typeof global.showJapanoteToast === "function") {
      global.showJapanoteToast(message);
      return;
    }

    console.info(message);
  }

  function toBase64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
  }

  function fromBase64Url(value) {
    const normalized = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function getLzBaseValue(alphabet, character) {
    if (!lzReverseDictionaries[alphabet]) {
      const dictionary = Object.create(null);

      for (let index = 0; index < alphabet.length; index += 1) {
        dictionary[alphabet.charAt(index)] = index;
      }

      lzReverseDictionaries[alphabet] = dictionary;
    }

    return lzReverseDictionaries[alphabet][character];
  }

  function lzCompressToUrlSafe(value) {
    if (value == null) {
      return "";
    }

    let index;
    let currentValue;
    let contextW = "";
    let contextC = "";
    let contextWc = "";
    let enlargeIn = 2;
    let dictionarySize = 3;
    let numBits = 2;
    const dictionary = Object.create(null);
    const dictionaryToCreate = Object.create(null);
    const data = [];
    let dataValue = 0;
    let dataPosition = 0;

    const writeBit = (bit) => {
      dataValue = (dataValue << 1) | bit;

      if (dataPosition === 5) {
        dataPosition = 0;
        data.push(lzUrlAlphabet.charAt(dataValue));
        dataValue = 0;
        return;
      }

      dataPosition += 1;
    };

    const writeValue = (bitCount, rawValue) => {
      let nextValue = rawValue;

      for (let bitIndex = 0; bitIndex < bitCount; bitIndex += 1) {
        writeBit(nextValue & 1);
        nextValue >>= 1;
      }
    };

    for (index = 0; index < value.length; index += 1) {
      contextC = value.charAt(index);

      if (!Object.prototype.hasOwnProperty.call(dictionary, contextC)) {
        dictionary[contextC] = dictionarySize;
        dictionarySize += 1;
        dictionaryToCreate[contextC] = true;
      }

      contextWc = contextW + contextC;

      if (Object.prototype.hasOwnProperty.call(dictionary, contextWc)) {
        contextW = contextWc;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, contextW)) {
        if (contextW.charCodeAt(0) < 256) {
          writeValue(numBits, 0);
          writeValue(8, contextW.charCodeAt(0));
        } else {
          writeValue(numBits, 1);
          writeValue(16, contextW.charCodeAt(0));
        }

        enlargeIn -= 1;
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits;
          numBits += 1;
        }

        delete dictionaryToCreate[contextW];
      } else {
        writeValue(numBits, dictionary[contextW]);
      }

      enlargeIn -= 1;
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }

      dictionary[contextWc] = dictionarySize;
      dictionarySize += 1;
      contextW = String(contextC);
    }

    if (contextW !== "") {
      if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, contextW)) {
        if (contextW.charCodeAt(0) < 256) {
          writeValue(numBits, 0);
          writeValue(8, contextW.charCodeAt(0));
        } else {
          writeValue(numBits, 1);
          writeValue(16, contextW.charCodeAt(0));
        }

        enlargeIn -= 1;
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits;
          numBits += 1;
        }

        delete dictionaryToCreate[contextW];
      } else {
        writeValue(numBits, dictionary[contextW]);
      }

      enlargeIn -= 1;
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
    }

    writeValue(numBits, 2);

    while (true) {
      dataValue <<= 1;

      if (dataPosition === 5) {
        data.push(lzUrlAlphabet.charAt(dataValue));
        break;
      }

      dataPosition += 1;
    }

    return data.join("");
  }

  function lzDecompressFromUrlSafe(value) {
    if (value == null) {
      return "";
    }

    if (value === "") {
      return null;
    }

    const dictionary = [];
    let enlargeIn = 4;
    let dictionarySize = 4;
    let numBits = 3;
    let entry = "";
    const result = [];
    let bits;
    let maxpower;
    let power;
    let next;
    let charCode;
    let currentValue;
    let w;
    const data = {
      value: getLzBaseValue(lzUrlAlphabet, value.charAt(0)),
      position: 32,
      index: 1
    };

    const readBits = (bitCount) => {
      let output = 0;
      let currentPower = 1;
      let currentMaxPower = 2 ** bitCount;

      while (currentPower !== currentMaxPower) {
        const resb = data.value & data.position;
        data.position >>= 1;

        if (data.position === 0) {
          data.position = 32;
          data.value = getLzBaseValue(lzUrlAlphabet, value.charAt(data.index));
          data.index += 1;
        }

        output |= (resb > 0 ? 1 : 0) * currentPower;
        currentPower <<= 1;
      }

      return output;
    };

    for (let index = 0; index < 3; index += 1) {
      dictionary[index] = index;
    }

    next = readBits(2);

    if (next === 0) {
      charCode = readBits(8);
      currentValue = String.fromCharCode(charCode);
    } else if (next === 1) {
      charCode = readBits(16);
      currentValue = String.fromCharCode(charCode);
    } else {
      return "";
    }

    dictionary[3] = currentValue;
    w = currentValue;
    result.push(currentValue);

    while (true) {
      if (data.index > value.length) {
        return "";
      }

      bits = readBits(numBits);

      if (bits === 0) {
        dictionary[dictionarySize] = String.fromCharCode(readBits(8));
        bits = dictionarySize;
        dictionarySize += 1;
        enlargeIn -= 1;
      } else if (bits === 1) {
        dictionary[dictionarySize] = String.fromCharCode(readBits(16));
        bits = dictionarySize;
        dictionarySize += 1;
        enlargeIn -= 1;
      } else if (bits === 2) {
        return result.join("");
      }

      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }

      if (dictionary[bits]) {
        entry = dictionary[bits];
      } else if (bits === dictionarySize) {
        entry = w + w.charAt(0);
      } else {
        return null;
      }

      result.push(entry);
      dictionary[dictionarySize] = w + entry.charAt(0);
      dictionarySize += 1;
      enlargeIn -= 1;
      w = entry;

      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
    }
  }

  function encodeChallengePayload(payload) {
    const packedPayload = packChallengePayload(payload);
    const json = JSON.stringify(packedPayload);
    const compressed = `${compressedPayloadPrefix}${lzCompressToUrlSafe(json)}`;
    const legacy = toBase64Url(json);
    return compressed.length < legacy.length ? compressed : legacy;
  }

  function decodeChallengePayload(value) {
    try {
      if (String(value || "").startsWith(compressedPayloadPrefix)) {
        const compressed = String(value || "").slice(compressedPayloadPrefix.length);
        const decoded = lzDecompressFromUrlSafe(compressed);
        return decoded ? unpackChallengePayload(JSON.parse(decoded)) : null;
      }

      return unpackChallengePayload(JSON.parse(fromBase64Url(value)));
    } catch (error) {
      console.warn("Failed to decode challenge payload.", error);
      return null;
    }
  }

  function readPendingChallengeLocation() {
    try {
      const currentUrl = new URL(global.location.href);
      const refCode = normalizeText(currentUrl.searchParams.get(challengeRefParamKey));
      const encoded = currentUrl.searchParams.get(challengeParamKey);
      return {
        refCode,
        encoded
      };
    } catch (error) {
      console.warn("Failed to parse challenge query.", error);
      return {
        refCode: "",
        encoded: ""
      };
    }
  }

  function getPayloadKey(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    return String(payload.challengeId || `${payload.kind || "challenge"}:${payload.createdAt || ""}`);
  }

  function copyText(text) {
    if (!text) {
      return Promise.resolve(false);
    }

    if (global.navigator?.clipboard?.writeText) {
      return global.navigator.clipboard.writeText(text).then(
        () => true,
        () => false
      );
    }

    return new Promise((resolve) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }

      textarea.remove();
      resolve(copied);
    });
  }

  function normalizeShareMessageLines(lines) {
    return (Array.isArray(lines) ? lines : [])
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function buildChallengeShareText(resultViewId, url) {
    const summary = readResultSummaryFromView(resultViewId);
    const intro = summary?.total
      ? `${summary.correct}/${summary.total} 맞혔어요.`
      : "친구 도전 링크예요.";
    const lines = [`${intro} 저보다 많이 맞출 수 있어요?`];

    lines.push(url);
    return normalizeShareMessageLines(lines);
  }

  async function shareChallengeLink(resultViewId, url) {
    if (!url || typeof global.navigator?.share !== "function") {
      return "failed";
    }

    const shareTitle = "Japanote 친구 도전";
    // 일부 공유 대상은 url 필드를 무시해서 링크를 본문 텍스트에 함께 넣는다.
    const candidates = [
      { title: shareTitle, text: buildChallengeShareText(resultViewId, url) },
      { text: buildChallengeShareText(resultViewId, url) }
    ];

    for (const data of candidates) {
      try {
        await global.navigator.share(data);
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") {
          return "cancelled";
        }
      }
    }

    return "failed";
  }

  function parseStatNumber(text) {
    const matched = String(text || "").match(/\d+/u);
    return matched ? Number(matched[0]) : NaN;
  }

  function getAccuracy(total, correct) {
    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }

    return Math.round((correct / total) * 100);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/gu, " ").trim();
  }

  function buildResultItemKey(item) {
    return [normalizeText(item?.title), normalizeText(item?.description)].join("::");
  }

  function buildResultItemLabel(item) {
    const title = normalizeText(item?.title);
    const description = normalizeText(item?.description);

    if (!description || description === title) {
      return title;
    }

    return `${title} · ${description}`;
  }

  function mergeUniqueResultItems(items) {
    const map = new Map();

    (Array.isArray(items) ? items : []).forEach((item) => {
      const key = buildResultItemKey(item);

      if (!key || map.has(key)) {
        return;
      }

      map.set(key, {
        key,
        title: normalizeText(item.title),
        description: normalizeText(item.description),
        status: item.status === "correct" ? "correct" : "wrong",
        label: buildResultItemLabel(item)
      });
    });

    return Array.from(map.values());
  }

  function packResultSummary(result) {
    if (!result || typeof result !== "object") {
      return null;
    }

    const total = Number(result.total);
    const correct = Number(result.correct);
    const wrong = Number(result.wrong);

    if (!Number.isFinite(total) || !Number.isFinite(correct) || !Number.isFinite(wrong)) {
      return null;
    }

    return [total, correct, wrong];
  }

  function unpackResultSummary(value) {
    if (!Array.isArray(value) || value.length < 3) {
      return null;
    }

    const total = Number(value[0]);
    const correct = Number(value[1]);
    const wrong = Number(value[2]);

    if (!Number.isFinite(total) || !Number.isFinite(correct) || !Number.isFinite(wrong)) {
      return null;
    }

    return {
      total,
      correct,
      wrong,
      accuracy: getAccuracy(total, correct)
    };
  }

  function packResultItems(items) {
    return mergeUniqueResultItems(items).map((item) => [
      normalizeText(item.title),
      normalizeText(item.description),
      item.status === "correct" ? 1 : 0
    ]);
  }

  function unpackResultItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return mergeUniqueResultItems(
      items
        .map((item) => {
          if (!Array.isArray(item) || !item.length) {
            return null;
          }

          return {
            title: normalizeText(item[0]),
            description: normalizeText(item[1]),
            status: Number(item[2]) === 1 ? "correct" : "wrong"
          };
        })
        .filter(Boolean)
    );
  }

  function packChallengePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return payload;
    }

    const packed = {
      v: Number.isFinite(Number(payload.v)) ? Number(payload.v) : 1,
      k: payload.kind || "",
      t: payload.createdAt || Date.now(),
      i: payload.challengeId || ""
    };

    if (payload.config && typeof payload.config === "object") {
      packed.c = payload.config;
    }

    if (Array.isArray(payload.questions) && payload.questions.length) {
      packed.q = payload.questions;
    }

    if (Array.isArray(payload.sessionItems) && payload.sessionItems.length) {
      packed.s = payload.sessionItems;
    }

    if (payload.targetOrigin) {
      packed.o = normalizeText(payload.targetOrigin);
    }

    if (payload.targetPath) {
      packed.p = normalizeText(payload.targetPath);
    }

    if (payload.targetHash) {
      packed.h = normalizeText(payload.targetHash);
    }

    const sourceResult = packResultSummary(payload.sourceResult);
    if (sourceResult) {
      packed.sr = sourceResult;
    }

    const sourceItems = packResultItems(payload.sourceItems);
    if (sourceItems.length) {
      packed.si = sourceItems;
    }

    return packed;
  }

  function unpackChallengePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.kind || payload.challengeId || payload.createdAt || payload.sourceResult || payload.sourceItems) {
      return payload;
    }

    const unpacked = {
      v: Number.isFinite(Number(payload.v)) ? Number(payload.v) : 1,
      kind: payload.k || "",
      createdAt: payload.t || Date.now(),
      challengeId: payload.i || ""
    };

    if (payload.c && typeof payload.c === "object") {
      unpacked.config = payload.c;
    }

    if (Array.isArray(payload.q) && payload.q.length) {
      unpacked.questions = payload.q;
    }

    if (Array.isArray(payload.s) && payload.s.length) {
      unpacked.sessionItems = payload.s;
    }

    if (payload.o) {
      unpacked.targetOrigin = normalizeText(payload.o);
    }

    if (payload.p) {
      unpacked.targetPath = normalizeText(payload.p);
    }

    if (payload.h) {
      unpacked.targetHash = normalizeText(payload.h);
    }

    const sourceResult = unpackResultSummary(payload.sr);
    if (sourceResult) {
      unpacked.sourceResult = sourceResult;
    }

    const sourceItems = unpackResultItems(payload.si);
    if (sourceItems.length) {
      unpacked.sourceItems = sourceItems;
    }

    return unpacked;
  }

  function getChallengeSupabaseConfig() {
    const rawConfig =
      global.japanoteSupabaseConfig && typeof global.japanoteSupabaseConfig === "object"
        ? global.japanoteSupabaseConfig
        : {};

    return {
      enabled: Boolean(rawConfig.enabled && rawConfig.url && rawConfig.anonKey),
      url: rawConfig.url || "",
      anonKey: rawConfig.anonKey || "",
      table: rawConfig.challengeTable || challengeTableName,
      previewBaseUrl: rawConfig.challengePreviewBaseUrl || ""
    };
  }

  function getChallengeSupabaseClient() {
    if (challengeSupabaseClient) {
      return challengeSupabaseClient;
    }

    const config = getChallengeSupabaseConfig();

    if (!config.enabled || !global.supabase || typeof global.supabase.createClient !== "function") {
      return null;
    }

    challengeSupabaseClient = global.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    return challengeSupabaseClient;
  }

  function createChallengeShortCode(length = shortCodeLength) {
    const size = Math.max(6, Number(length) || shortCodeLength);
    const bytes = new Uint8Array(size);
    const cryptoApi = global.crypto || global.msCrypto;

    if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
      return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, size);
    }

    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => shortCodeAlphabet[byte % shortCodeAlphabet.length]).join("");
  }

  async function createShortChallengeReference(payload) {
    const client = getChallengeSupabaseClient();
    const config = getChallengeSupabaseConfig();

    if (!client || !config.table) {
      return {
        code: "",
        warning: ""
      };
    }

    const packedPayload = packChallengePayload(payload);

    for (let attempt = 0; attempt < shortLinkMaxSaveAttempts; attempt += 1) {
      const code = createChallengeShortCode();
      const { error } = await client.from(config.table).insert({
        code,
        kind: payload.kind || "",
        payload: packedPayload
      });

      if (!error) {
        return {
          code,
          warning: ""
        };
      }

      const errorCode = String(error.code || "").toLowerCase();
      const duplicateKey = errorCode === "23505" || String(error.message || "").toLowerCase().includes("duplicate");

      if (duplicateKey) {
        continue;
      }

      console.warn("Failed to create short challenge link.", error);
      return {
        code: "",
        warning: "짧은 링크를 저장하지 못해서 일반 링크를 복사했어요."
      };
    }

    return {
      code: "",
      warning: "짧은 링크를 만드는 중 충돌이 생겨서 일반 링크를 복사했어요."
    };
  }

  async function createChallengePreviewLink(code) {
    const config = getChallengeSupabaseConfig();

    if (!config.enabled || !config.previewBaseUrl || !code) {
      return {
        url: "",
        warning: ""
      };
    }

    const normalizedBaseUrl = String(config.previewBaseUrl).replace(/\/+$/u, "");
    return {
      url: `${normalizedBaseUrl}/${encodeURIComponent(code)}`,
      warning: ""
    };
  }

  async function fetchShortChallengePayload(code) {
    const client = getChallengeSupabaseClient();
    const config = getChallengeSupabaseConfig();

    if (!client || !config.table || !code) {
      return null;
    }

    const { data, error } = await client
      .from(config.table)
      .select("payload")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.payload ? unpackChallengePayload(data.payload) : null;
  }

  async function loadPendingChallengePayload() {
    const { refCode, encoded } = readPendingChallengeLocation();
    const nextToken = refCode ? `ref:${refCode}` : encoded ? `inline:${encoded}` : "";

    if (!nextToken) {
      pendingChallengeToken = "";
      pendingChallengeLoadPromise = null;
      pendingChallengePayload = null;
      pendingChallengeLoadError = "";
      pendingChallengeErrorNotifiedToken = "";
      return null;
    }

    if (pendingChallengeToken === nextToken && pendingChallengeLoadPromise) {
      return pendingChallengeLoadPromise;
    }

    pendingChallengeToken = nextToken;
    pendingChallengeLoadPromise = (async () => {
      if (refCode) {
        try {
          const payload = await fetchShortChallengePayload(refCode);
          pendingChallengePayload = payload;
          pendingChallengeLoadError = payload ? "" : "도전 링크를 찾을 수 없거나 만료됐어요.";
          return payload;
        } catch (error) {
          console.error("Failed to fetch short challenge payload.", error);
          pendingChallengePayload = null;
          pendingChallengeLoadError = "도전 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
          return null;
        }
      }

      pendingChallengePayload = encoded ? decodeChallengePayload(encoded) : null;
      pendingChallengeLoadError = pendingChallengePayload ? "" : "도전 링크를 해석하지 못했어요.";
      return pendingChallengePayload;
    })();

    return pendingChallengeLoadPromise;
  }

  function readResultSummaryFromView(resultViewId) {
    const resultView = document.getElementById(resultViewId);

    if (!resultView || resultView.hidden) {
      return null;
    }

    const total = parseStatNumber(resultView.querySelector('[data-result-filter="all"] strong')?.textContent);
    const correct = parseStatNumber(resultView.querySelector('[data-result-filter="correct"] strong')?.textContent);
    const wrong = parseStatNumber(resultView.querySelector('[data-result-filter="wrong"] strong')?.textContent);

    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(correct) || !Number.isFinite(wrong)) {
      return null;
    }

    return {
      total,
      correct,
      wrong,
      accuracy: getAccuracy(total, correct)
    };
  }

  function readResultItemsFromView(resultViewId) {
    const resultView = document.getElementById(resultViewId);

    if (!resultView || resultView.hidden) {
      return [];
    }

    const items = Array.from(resultView.querySelectorAll(".match-result-item")).map((article) => {
      const title = normalizeText(article.querySelector("strong")?.textContent);
      const description = normalizeText(article.querySelector("p")?.textContent);

      if (!title) {
        return null;
      }

      return {
        title,
        description,
        status: article.classList.contains("is-correct") ? "correct" : "wrong"
      };
    });

    return mergeUniqueResultItems(items.filter(Boolean));
  }

  function getComparisonOutcome(sourceResult, currentResult) {
    if (currentResult.correct > sourceResult.correct) {
      return {
        text: "내가 앞서고 있어요",
        tone: "leading"
      };
    }

    if (currentResult.correct < sourceResult.correct) {
      return {
        text: "친구가 앞서고 있어요",
        tone: "trailing"
      };
    }

    if (currentResult.wrong < sourceResult.wrong) {
      return {
        text: "내가 앞서고 있어요",
        tone: "leading"
      };
    }

    if (currentResult.wrong > sourceResult.wrong) {
      return {
        text: "친구가 앞서고 있어요",
        tone: "trailing"
      };
    }

    return {
      text: "지금은 무승부예요",
      tone: "tied"
    };
  }

  function createComparisonMetricsText(result) {
    return `정답 ${result.correct}개 · 오답 ${result.wrong}개 · 정확도 ${result.accuracy}%`;
  }

  function createComparisonBuckets(items) {
    const uniqueItems = mergeUniqueResultItems(items);
    const correctItems = uniqueItems.filter((item) => item.status === "correct").map((item) => item.label);
    const wrongItems = uniqueItems.filter((item) => item.status !== "correct").map((item) => item.label);

    return {
      correct: {
        title: "맞힌 단어",
        count: correctItems.length,
        visibleItems: correctItems.slice(0, maxVisibleComparisonItems),
        hiddenCount: Math.max(correctItems.length - maxVisibleComparisonItems, 0)
      },
      wrong: {
        title: "틀린 단어",
        count: wrongItems.length,
        visibleItems: wrongItems.slice(0, maxVisibleComparisonItems),
        hiddenCount: Math.max(wrongItems.length - maxVisibleComparisonItems, 0)
      }
    };
  }

  function createComparisonPlayerCard(label, scoreText, metricsText) {
    const panel = document.createElement("article");
    const playerLabel = document.createElement("span");
    const score = document.createElement("strong");
    const metrics = document.createElement("p");

    panel.className = "challenge-result-comparison-player";
    playerLabel.className = "challenge-result-comparison-label";
    score.className = "challenge-result-comparison-score";
    metrics.className = "challenge-result-comparison-metrics";

    playerLabel.textContent = label;
    score.textContent = scoreText;
    metrics.textContent = metricsText;

    panel.append(playerLabel, score, metrics);
    return panel;
  }

  function createComparisonSectionCard(sectionData, toneClassName) {
    const section = document.createElement("section");
    const head = document.createElement("div");
    const title = document.createElement("strong");
    const count = document.createElement("span");
    const list = document.createElement("div");

    section.className = `challenge-result-comparison-section ${toneClassName || ""}`.trim();
    head.className = "challenge-result-comparison-section-head";
    title.className = "challenge-result-comparison-section-title";
    count.className = "challenge-result-comparison-section-count";
    list.className = "challenge-result-comparison-section-list";

    title.textContent = sectionData.title;
    count.textContent = `${sectionData.count}개`;

    if (!sectionData.visibleItems.length) {
      const empty = document.createElement("span");
      empty.className = "challenge-result-comparison-empty";
      empty.textContent = "없음";
      list.appendChild(empty);
    } else {
      sectionData.visibleItems.forEach((itemLabel) => {
        const chip = document.createElement("span");
        chip.className = "challenge-result-comparison-chip";
        chip.textContent = itemLabel;
        list.appendChild(chip);
      });
    }

    if (sectionData.hiddenCount > 0) {
      const more = document.createElement("span");
      more.className = "challenge-result-comparison-more";
      more.textContent = `외 ${sectionData.hiddenCount}개`;
      list.appendChild(more);
    }

    head.append(title, count);
    section.append(head, list);
    return section;
  }

  function createComparisonListFromItems(items) {
    const listWrap = document.createElement("div");
    const list = document.createElement("div");
    const uniqueItems = mergeUniqueResultItems(items);
    const visibleItems = uniqueItems.slice(0, maxVisibleComparisonItems);
    const hiddenCount = Math.max(uniqueItems.length - maxVisibleComparisonItems, 0);

    listWrap.className = "challenge-result-comparison-list-wrap";
    list.className = "challenge-result-comparison-list";

    if (!visibleItems.length) {
      const empty = document.createElement("span");
      empty.className = "challenge-result-comparison-empty";
      empty.textContent = "기록이 없어요.";
      list.appendChild(empty);
    } else {
      visibleItems.forEach((item) => {
        const row = document.createElement("div");
        const icon = document.createElement("span");
        const itemLabel = document.createElement("span");

        row.className = `challenge-result-comparison-item is-${item.status}`;
        icon.className = "challenge-result-comparison-item-icon";
        itemLabel.className = "challenge-result-comparison-item-label";

        icon.textContent = item.status === "correct" ? "⭕" : "❌";
        itemLabel.textContent = item.label;

        row.append(icon, itemLabel);
        list.appendChild(row);
      });
    }

    if (hiddenCount > 0) {
      const more = document.createElement("div");
      more.className = "challenge-result-comparison-more";
      more.textContent = `+${hiddenCount}개`;
      list.appendChild(more);
    }

    listWrap.appendChild(list);
    return listWrap;
  }

  function createComparisonColumn(label, result, items, modifierClassName) {
    const column = document.createElement("article");

    column.className = `challenge-result-comparison-column ${modifierClassName || ""}`.trim();

    column.appendChild(
      createComparisonPlayerCard(label, `${result.correct} / ${result.total}`, createComparisonMetricsText(result))
    );
    column.appendChild(createComparisonListFromItems(items));

    return column;
  }

  function getComparisonSnapshot(resultViewId) {
    if (!activeChallengeState || activeChallengeState.resultViewId !== resultViewId) {
      return null;
    }

    const sourceResult = activeChallengeState.payload?.sourceResult;
    const sourceItems = mergeUniqueResultItems(activeChallengeState.payload?.sourceItems);
    const currentResult = activeChallengeState.currentResult || readResultSummaryFromView(resultViewId);

    if (!sourceResult || !currentResult || sourceItems.length < sourceResult.total) {
      return null;
    }

    // 결과 필터를 바꿔도 비교 목록은 처음 완주했을 때의 전체 결과 기준으로 유지한다.
    if (!Array.isArray(activeChallengeState.currentItems) || !activeChallengeState.currentItems.length) {
      const currentItems = readResultItemsFromView(resultViewId);

      if (currentItems.length < currentResult.total) {
        return null;
      }

      activeChallengeState.currentItems = currentItems;
      activeChallengeState.currentResult = currentResult;
    }

    return {
      outcome: getComparisonOutcome(sourceResult, activeChallengeState.currentResult),
      sourceResult,
      currentResult: activeChallengeState.currentResult,
      sourceItems,
      currentItems: activeChallengeState.currentItems,
      sourceBuckets: createComparisonBuckets(sourceItems),
      currentBuckets: createComparisonBuckets(activeChallengeState.currentItems)
    };
  }

  function createComparisonCard(snapshot) {
    const card = document.createElement("section");
    const header = document.createElement("div");
    const eyebrow = document.createElement("span");
    const status = document.createElement("strong");
    const grid = document.createElement("div");

    card.className = `${comparisonCardClassName} is-${snapshot.outcome.tone}`;
    header.className = "challenge-result-comparison-head";
    eyebrow.className = "challenge-result-comparison-eyebrow";
    status.className = "challenge-result-comparison-status";
    grid.className = "challenge-result-comparison-grid";

    eyebrow.textContent = "친구 도전 비교";
    status.textContent = snapshot.outcome.text;

    grid.append(
      createComparisonColumn("친구 기록", snapshot.sourceResult, snapshot.sourceItems, "is-source"),
      createComparisonColumn("내 기록", snapshot.currentResult, snapshot.currentItems, "is-current")
    );

    header.append(eyebrow, status);
    card.append(header, grid);
    return card;
  }

  function removeComparisonCards(resultViewId) {
    if (resultViewId) {
      document.getElementById(resultViewId)?.querySelectorAll(`.${comparisonCardClassName}`).forEach((card) => card.remove());
      return;
    }

    document.querySelectorAll(`.${comparisonCardClassName}`).forEach((card) => card.remove());
  }

  function syncResultComparison(resultViewId) {
    const resultView = document.getElementById(resultViewId);

    if (!resultView) {
      return;
    }

    removeComparisonCards(resultViewId);

    const footer = resultView.querySelector(".match-result-share-footer");
    const snapshot = getComparisonSnapshot(resultViewId);

    if (!footer || !snapshot) {
      return;
    }

    footer.prepend(createComparisonCard(snapshot));
  }

  function clearActiveChallenge(resultViewId = "") {
    if (resultViewId && activeChallengeState && activeChallengeState.resultViewId !== resultViewId) {
      return;
    }

    activeChallengeState = null;
    removeComparisonCards(resultViewId);
  }

  function queueApplyAttempt() {
    if (applyAttemptQueued) {
      return;
    }

    applyAttemptQueued = true;
    global.setTimeout(() => {
      applyAttemptQueued = false;
      void attemptApplyPendingChallenge();
    }, 0);
  }

  async function attemptApplyPendingChallenge() {
    if (!pendingChallengePayload) {
      pendingChallengePayload = await loadPendingChallengePayload();
    }

    if (!pendingChallengePayload) {
      if (
        pendingChallengeLoadError &&
        pendingChallengeToken &&
        pendingChallengeErrorNotifiedToken !== pendingChallengeToken
      ) {
        pendingChallengeErrorNotifiedToken = pendingChallengeToken;
        notify(pendingChallengeLoadError);
      }

      return false;
    }

    pendingChallengeErrorNotifiedToken = "";

    const payloadKey = getPayloadKey(pendingChallengePayload);

    if (payloadKey && payloadKey === appliedChallengeKey) {
      return true;
    }

    const provider = providersByKind.get(pendingChallengePayload.kind);

    if (!provider || typeof provider.applyPayload !== "function") {
      return false;
    }

    try {
      const applied = provider.applyPayload(pendingChallengePayload);

      if (!applied) {
        return false;
      }

      appliedChallengeKey = payloadKey || `${pendingChallengePayload.kind}:${Date.now()}`;
      activeChallengeState = {
        resultViewId: provider.resultViewId,
        payload: pendingChallengePayload,
        currentResult: null,
        currentItems: null
      };
      global.setTimeout(() => {
        syncResultComparison(provider.resultViewId);
      }, 0);
      notify(provider.getApplyMessage?.(pendingChallengePayload) || "친구 도전이 열렸어요.");
      return true;
    } catch (error) {
      console.error("Failed to apply challenge payload.", error);
      return false;
    }
  }

  function registerProvider(provider) {
    if (!provider?.resultViewId || !provider?.kind) {
      return;
    }

    providersByResultViewId.set(provider.resultViewId, provider);
    providersByKind.set(provider.kind, provider);
    queueApplyAttempt();
  }

  async function buildChallengeLink(resultViewId) {
    const provider = providersByResultViewId.get(resultViewId);

    if (!provider || typeof provider.createPayload !== "function") {
      return {
        url: "",
        error: "아직 이 결과 화면에서는 도전 링크를 만들 수 없어요."
      };
    }

    const payload = provider.createPayload();

    if (!payload) {
      return {
        url: "",
        error: "먼저 결과를 만든 뒤에 도전 링크를 복사해 주세요."
      };
    }

    const sourceResult = readResultSummaryFromView(resultViewId);
    const sourceItems = readResultItemsFromView(resultViewId);

    // 비교용 단어 목록은 전체 결과가 모두 보이는 상태에서만 안전하게 담을 수 있다.
    if (sourceResult && sourceItems.length < sourceResult.total) {
      return {
        url: "",
        error: "비교용 단어 리스트를 담으려면 결과 필터를 전체로 바꿔 주세요."
      };
    }

    const basePayload = {
      v: 1,
      kind: provider.kind,
      createdAt: payload.createdAt || Date.now(),
      challengeId: payload.challengeId || `${provider.kind}-${Date.now()}`,
      ...payload,
      sourceResult: sourceResult || payload.sourceResult || null,
      sourceItems: sourceItems.length ? sourceItems : payload.sourceItems || []
    };
    const targetPath = provider.getTargetPath?.(basePayload) || global.location.pathname;
    const nextHash = provider.getTargetHash?.(basePayload);
    const completedPayload = {
      ...basePayload,
      targetOrigin: global.location.origin,
      targetPath,
      targetHash: nextHash || ""
    };
    const shortLink = await createShortChallengeReference(completedPayload);

    if (shortLink.code) {
      const shortTargetUrl = new URL(targetPath, global.location.href);

      shortTargetUrl.searchParams.delete(challengeParamKey);
      shortTargetUrl.searchParams.set(challengeRefParamKey, shortLink.code);

      if (nextHash) {
        shortTargetUrl.hash = nextHash;
      }

      const previewLink = await createChallengePreviewLink(shortLink.code);

      if (previewLink.url) {
        return {
          url: previewLink.url,
          error: ""
        };
      }

      return {
        url: shortTargetUrl.toString(),
        error: ""
      };
    }

    const encoded = encodeChallengePayload(completedPayload);

    if (encoded.length > maxEncodedChallengeLength) {
      return {
        url: "",
        error: "링크가 너무 길어서 복사할 수 없어요. 세션을 조금 줄여서 다시 시도해 주세요."
      };
    }

    const targetUrl = new URL(targetPath, global.location.href);
    targetUrl.searchParams.set(challengeParamKey, encoded);
    if (nextHash) {
      targetUrl.hash = nextHash;
    }

    return {
      url: targetUrl.toString(),
      error: ""
    };
  }

  function createChallengeButton(resultViewId) {
    if (!providersByResultViewId.has(resultViewId)) {
      return null;
    }

    const button = document.createElement("button");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    button.type = "button";
    button.className = "secondary-btn button-with-icon challenge-link-btn";
    const canNativeShare = typeof global.navigator?.share === "function";

    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = canNativeShare ? "share" : "link";

    label.textContent = canNativeShare ? "도전 링크 공유" : "도전 링크 복사";
    button.append(icon, label);

    button.addEventListener("click", async () => {
      const originalLabel = label.textContent;
      label.textContent = "링크 만드는 중...";
      button.disabled = true;
      const { url, error } = await buildChallengeLink(resultViewId);

      if (!url) {
        button.disabled = false;
        label.textContent = originalLabel;
        notify(error || "도전 링크를 만들 수 없어요.");
        return;
      }

      label.textContent = canNativeShare ? "공유하는 중..." : "복사하는 중...";
      const shareState = canNativeShare ? await shareChallengeLink(resultViewId, url) : "failed";
      const copied = shareState === "shared" ? true : await copyText(url);

      button.disabled = false;
      label.textContent = originalLabel;

      if (shareState === "cancelled") {
        return;
      }

      const successMessage = shareState === "shared" ? "친구 도전 링크를 공유했어요." : "친구 도전 링크를 복사했어요.";
      notify(copied ? successMessage : "링크 복사에 실패했어요.");
    });

    return button;
  }

  void loadPendingChallengePayload();

  global.addEventListener("DOMContentLoaded", queueApplyAttempt);
  global.addEventListener("load", queueApplyAttempt);
  global.addEventListener("japanote:supplementary-content-loaded", queueApplyAttempt);
  global.addEventListener("japanote:vocab-loaded", queueApplyAttempt);

  global.japanoteChallengeLinks = {
    registerProvider,
    createChallengeButton,
    buildChallengeLink,
    attemptApplyPendingChallenge,
    syncResultComparison,
    clearActiveChallenge,
    getComparisonSnapshot
  };
})(window);
