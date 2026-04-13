const SUPABASE_URL = "https://nppaqezqwusbagzdnoqi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcGFxZXpxd3VzYmFnemRub3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU5MzIsImV4cCI6MjA5MDQzMTkzMn0.cVnznT2P0sOoX6nA9mCLLNtIID5m2I1LW8N36FY9iqA";
const DEFAULT_TITLE = "친구의 도전장이 도착했어요";
const DEFAULT_DESCRIPTION = "같은 문제로 바로 도전해 보세요";
const DEFAULT_SITE_NAME = "Japanote";
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidCode(code) {
  return /^[A-Za-z0-9]{6,32}$/u.test(code);
}

function isValidTargetPath(targetPath) {
  if (targetPath === "/") {
    return true;
  }

  return /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+(?:\.html)?$/u.test(targetPath);
}

function readResultSummary(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (Array.isArray(payload.sr) && payload.sr.length >= 3) {
    const total = Number(payload.sr[0]);
    const correct = Number(payload.sr[1]);
    const wrong = Number(payload.sr[2]);

    if (Number.isFinite(total) && Number.isFinite(correct) && Number.isFinite(wrong) && total > 0) {
      return { total, correct, wrong };
    }
  }

  const sourceResult = payload.sourceResult;

  if (sourceResult && typeof sourceResult === "object") {
    const total = Number(sourceResult.total);
    const correct = Number(sourceResult.correct);
    const wrong = Number(sourceResult.wrong);

    if (Number.isFinite(total) && Number.isFinite(correct) && Number.isFinite(wrong) && total > 0) {
      return { total, correct, wrong };
    }
  }

  return null;
}

function readTargetOrigin(payload, requestUrl) {
  const payloadOrigin = normalizeText(payload?.targetOrigin || payload?.o);

  if (payloadOrigin && /^https?:\/\/[^/]+$/u.test(payloadOrigin)) {
    return payloadOrigin.replace(/\/+$/u, "");
  }

  return requestUrl.origin;
}

function readTargetPath(payload) {
  const path = normalizeText(payload?.targetPath || payload?.p);

  if (!path) {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function readTargetHash(payload) {
  return normalizeText(payload?.targetHash || payload?.h);
}

function buildTargetUrl(code, origin, path, hash) {
  const url = new URL(path, origin);
  url.searchParams.set("c", code);

  if (hash) {
    url.hash = hash;
  }

  return url.toString();
}

function buildPreviewText() {
  return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION
    };
}

function buildPreviewImageUrl(requestUrl, code) {
  const imageUrl = new URL(requestUrl.toString());
  imageUrl.pathname = `/challenge-preview/${code}/image`;
  imageUrl.search = "";
  imageUrl.hash = "";
  return imageUrl.toString();
}

function buildPreviewImageSvg({ title, description }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_IMAGE_WIDTH}" height="${DEFAULT_IMAGE_HEIGHT}" viewBox="0 0 ${DEFAULT_IMAGE_WIDTH} ${DEFAULT_IMAGE_HEIGHT}" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff8f1" />
      <stop offset="52%" stop-color="#ffe9db" />
      <stop offset="100%" stop-color="#ffd7c2" />
    </linearGradient>

    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#fffaf6" />
    </linearGradient>

    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8a5b" />
      <stop offset="100%" stop-color="#ef4444" />
    </linearGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="#7c2d12" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect width="${DEFAULT_IMAGE_WIDTH}" height="${DEFAULT_IMAGE_HEIGHT}" fill="url(#bg)"/>

  <circle cx="1050" cy="110" r="120" fill="#ffffff" opacity="0.30"/>
  <circle cx="1120" cy="170" r="54" fill="#fff3eb" opacity="0.95"/>
  <circle cx="140" cy="560" r="96" fill="#fff1e7" opacity="0.9"/>

  <rect x="70" y="58" width="1060" height="514" rx="42" fill="url(#card)" filter="url(#shadow)"/>

  <rect x="116" y="108" width="146" height="46" rx="23" fill="#fff0e7"/>
  <text x="189" y="138" fill="#e85d3f" font-size="22" font-weight="800" text-anchor="middle" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">친구 도전</text>

  <text x="116" y="230" fill="#8f4e3c" font-size="28" font-weight="700" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">Japanote Challenge</text>

  <text x="116" y="350" fill="#1f1b1c" font-size="92" font-weight="900" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">${safeTitle}</text>

  <text x="116" y="426" fill="#5f4a43" font-size="34" font-weight="700" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">${safeDescription}</text>

  <rect x="116" y="470" width="508" height="62" rx="31" fill="#fff4ed"/>
  <circle cx="151" cy="501" r="11" fill="url(#accent)"/>
  <text x="178" y="509" fill="#8b5e51" font-size="22" font-weight="700" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">링크를 열면 같은 문제로 바로 시작돼요</text>

  <g transform="translate(820 160)">
    <rect x="0" y="0" width="200" height="238" rx="30" fill="#fff4ea"/>
    <rect x="24" y="24" width="152" height="190" rx="26" fill="#ffffff" stroke="#f6d7c7"/>
    <rect x="48" y="56" width="104" height="12" rx="6" fill="#ffd8c6"/>
    <rect x="48" y="84" width="88" height="12" rx="6" fill="#ffd8c6"/>
    <rect x="48" y="112" width="96" height="12" rx="6" fill="#ffd8c6"/>
    <circle cx="76" cy="162" r="22" fill="#1f1b1c"/>
    <circle cx="124" cy="162" r="22" fill="#1f1b1c"/>
    <circle cx="76" cy="157" r="6" fill="#ffffff"/>
    <circle cx="124" cy="157" r="6" fill="#ffffff"/>
    <path d="M84 194 Q100 208 116 194" fill="none" stroke="#ef5d4a" stroke-width="8" stroke-linecap="round"/>
    <rect x="120" y="-12" width="92" height="34" rx="17" fill="url(#accent)"/>
    <text x="166" y="10" fill="#ffffff" font-size="16" font-weight="800" text-anchor="middle" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">TRY</text>
  </g>

  <text x="1030" y="500" fill="#ef5d4a" font-size="44" font-weight="900" text-anchor="end" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">Japanote</text>
  <text x="1030" y="532" fill="#8d6a5d" font-size="20" font-weight="700" text-anchor="end" font-family="Pretendard, 'Noto Sans KR', system-ui, sans-serif">친구와 점수를 비교해 보세요</text>
</svg>`;
}

function buildHtml({ previewUrl, targetUrl, title, description, imageUrl }) {
  const safePreviewUrl = escapeHtml(previewUrl);
  const safeTargetUrl = escapeHtml(targetUrl);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${DEFAULT_SITE_NAME}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safePreviewUrl}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:width" content="${DEFAULT_IMAGE_WIDTH}">
  <meta property="og:image:height" content="${DEFAULT_IMAGE_HEIGHT}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImageUrl}">
  <meta name="twitter:image:alt" content="${safeTitle}">
  <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
  <main>
    <p>도전 링크로 이동하고 있어요.</p>
    <p><a href="${safeTargetUrl}">이동하지 않으면 여기를 눌러 주세요.</a></p>
  </main>
</body>
</html>`;
}

async function fetchChallenge(code) {
  const requestUrl = new URL(`${SUPABASE_URL}/rest/v1/shared_challenges`);
  requestUrl.searchParams.set("select", "kind,payload");
  requestUrl.searchParams.set("code", `eq.${code}`);

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Challenge fetch failed: ${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadChallengePreviewContext(requestUrl, code) {
  const normalizedCode = normalizeText(code);

  if (!isValidCode(normalizedCode)) {
    return {
      error: new Response("Invalid challenge code", { status: 400 })
    };
  }

  const challenge = await fetchChallenge(normalizedCode);

  if (!challenge?.payload) {
    return {
      error: new Response("Challenge not found", { status: 404 })
    };
  }

  const payload = challenge.payload;
  const targetPath = readTargetPath(payload);
  const targetHash = readTargetHash(payload);

  if (!isValidTargetPath(targetPath)) {
    return {
      error: new Response("Invalid challenge target", { status: 400 })
    };
  }

  if (targetHash && !/^#[A-Za-z0-9_-]+$/u.test(targetHash)) {
    return {
      error: new Response("Invalid challenge target", { status: 400 })
    };
  }

  const targetOrigin = readTargetOrigin(payload, requestUrl);
  const targetUrl = buildTargetUrl(normalizedCode, targetOrigin, targetPath, targetHash);
  const previewText = buildPreviewText(payload);

  return {
    code: normalizedCode,
    targetUrl,
    ...previewText
  };
}

export async function handleChallengePreviewRequest(requestUrl, code) {
  try {
    const previewContext = await loadChallengePreviewContext(requestUrl, code);

    if (previewContext.error) {
      return previewContext.error;
    }

    const html = buildHtml({
      previewUrl: requestUrl.toString(),
      targetUrl: previewContext.targetUrl,
      title: previewContext.title,
      description: previewContext.description,
      imageUrl: buildPreviewImageUrl(requestUrl, previewContext.code)
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    return new Response("Failed to load challenge preview", { status: 500 });
  }
}

export async function handleChallengePreviewImageRequest(requestUrl, code) {
  try {
    const previewContext = await loadChallengePreviewContext(requestUrl, code);

    if (previewContext.error) {
      return previewContext.error;
    }

    const svg = buildPreviewImageSvg({
      title: previewContext.title,
      description: previewContext.description
    });

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    return new Response("Failed to render challenge preview image", { status: 500 });
  }
}