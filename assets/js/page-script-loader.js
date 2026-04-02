(function loadJapanotePageScripts(global) {
  const pageName = (() => {
    const path = global.location?.pathname || "";
    const segments = path.split("/").filter(Boolean);
    return segments[segments.length - 1] || "index.html";
  })();

  const pageScriptMap = {
    "index.html": [
      "assets/js/theme.js",
      "assets/js/app.js"
    ],
    "starter.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js",
      "assets/js/supabase-sync.js",
      "assets/js/theme.js",
      "assets/js/vocab-registry.js",
      "assets/js/app.js"
    ],
    "grammar.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js",
      "assets/js/supabase-sync.js",
      "assets/js/theme.js",
      "assets/js/shared-quiz-layouts.js",
      "assets/js/app.js"
    ],
    "reading.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js",
      "assets/js/supabase-sync.js",
      "assets/js/theme.js",
      "assets/js/shared-quiz-layouts.js",
      "assets/js/app.js"
    ],
    "vocab.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js",
      "assets/js/supabase-sync.js",
      "assets/js/theme.js",
      "assets/js/vocab-registry.js",
      "assets/js/shared-quiz-layouts.js",
      "assets/js/shared-match-game.js",
      "assets/js/shared-match-copy.js",
      "assets/js/app.js",
      "assets/js/match-game.js"
    ],
    "kanji.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js",
      "assets/js/supabase-sync.js",
      "assets/js/theme.js",
      "assets/js/vocab-registry.js",
      "assets/js/shared-quiz-layouts.js",
      "assets/js/shared-match-game.js",
      "assets/js/shared-match-copy.js",
      "assets/js/app.js",
      "assets/js/kanji-match-game.js"
    ],
    "characters.html": [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "assets/js/supabase-config.js?v=20260330a",
      "assets/js/supabase-sync.js?v=20260330a",
      "assets/js/theme.js?v=20260330a",
      "assets/js/vocab-registry.js?v=20260330a",
      "assets/js/kana-strokes.js?v=20260330a",
      "assets/js/app.js?v=20260330a"
    ]
  };

  const scripts = pageScriptMap[pageName] || [];

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
