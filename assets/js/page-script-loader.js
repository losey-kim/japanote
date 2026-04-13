(function loadJapanotePageScripts(global) {
  const assetVersion = "20260413q";
  const pageName = (() => {
    const path = global.location?.pathname || "";
    const segments = path.split("/").filter(Boolean);
    const rawPageName = segments[segments.length - 1] || "index.html";
    return rawPageName.includes(".") ? rawPageName : `${rawPageName}.html`;
  })();

  const pageScriptMap = {
    "index.html": [
      "assets/js/theme.js?v=0cb88168",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/app.js?v=33a15021"
    ],
    "grammar.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=587210d3",
      "assets/js/supabase-sync.js?v=475dffb1",
      "assets/js/theme.js?v=0cb88168",
      "assets/js/shared-quiz-layouts.js?v=1de1e6a7",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/shared-match-game.js?v=2c46766b",
      "assets/js/challenge-links.js?v=02833806",
      "assets/js/app.js?v=33a15021",
      "assets/js/grammar-match-game.js?v=4087c18c",
      "assets/js/share-result.js?v=441dcdce"
    ],
    "reading.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=587210d3",
      "assets/js/supabase-sync.js?v=475dffb1",
      "assets/js/theme.js?v=0cb88168",
      "assets/js/shared-quiz-layouts.js?v=1de1e6a7",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/shared-match-game.js?v=2c46766b",
      "assets/js/challenge-links.js?v=02833806",
      "assets/js/app.js?v=33a15021",
      "assets/js/share-result.js?v=441dcdce"
    ],
    "vocab.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=587210d3",
      "assets/js/supabase-sync.js?v=475dffb1",
      "assets/js/theme.js?v=0cb88168",
      "assets/js/vocab-registry.js?v=eb163433",
      "assets/js/shared-quiz-layouts.js?v=1de1e6a7",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/shared-match-game.js?v=2c46766b",
      "assets/js/shared-match-copy.js?v=42df64f0",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/challenge-links.js?v=02833806",
      "assets/js/app.js?v=33a15021",
      "assets/js/match-game.js?v=3f2e2e22",
      "assets/js/share-result.js?v=441dcdce",
      "assets/js/study-tools.js?v=9b778c4f"
    ],
    "kanji.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=587210d3",
      "assets/js/supabase-sync.js?v=475dffb1",
      "assets/js/theme.js?v=0cb88168",
      "assets/js/vocab-registry.js?v=eb163433",
      "assets/js/shared-quiz-layouts.js?v=1de1e6a7",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/shared-match-game.js?v=2c46766b",
      "assets/js/shared-match-copy.js?v=42df64f0",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/challenge-links.js?v=02833806",
      "assets/js/app.js?v=33a15021",
      "assets/js/kanji-match-game.js?v=74bea83e",
      "assets/js/share-result.js?v=441dcdce"
    ],
    "characters.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=587210d3",
      "assets/js/supabase-sync.js?v=475dffb1",
      "assets/js/theme.js?v=0cb88168",
      "assets/js/vocab-registry.js?v=eb163433",
      "assets/js/app-study-view-helpers.js?v=444dc3dc",
      "assets/js/shared-timer.js?v=a53be2de",
      "assets/js/challenge-links.js?v=02833806",
      "assets/js/app.js?v=33a15021",
      "assets/js/share-result.js?v=441dcdce"
    ]
  };

  function resolveScriptSrc(src) {
    if (!src || /^https?:\/\//.test(src)) {
      return src;
    }

    if (/[?&]v=/u.test(src)) {
      return src.replace(/([?&])v=[^&]*/u, `$1v=${assetVersion}`);
    }

    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}v=${assetVersion}`;
  }

  const scripts = (pageScriptMap[pageName] || []).map(resolveScriptSrc);

  function hasScript(src) {
    return Boolean(document.querySelector(`script[data-japanote-src="${src}"]`));
  }

  function loadSequentially(index) {
    if (index >= scripts.length) {
      return;
    }

    const src = scripts[index];

    if (!src) {
      loadSequentially(index + 1);
      return;
    }

    if (hasScript(src)) {
      loadSequentially(index + 1);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.japanoteSrc = src;
    script.onload = () => {
      loadSequentially(index + 1);
    };
    script.onerror = () => {
      console.error(`Failed to load script: ${src}`);
      loadSequentially(index + 1);
    };
    document.body.appendChild(script);
  }

  loadSequentially(0);
})(window);
