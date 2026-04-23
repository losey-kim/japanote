(function redirectChallengePreview(global) {
  function getPreviewRefCode() {
    const pathname = String(global.location?.pathname || "");
    const segments = pathname.split("/").filter(Boolean);
    const idx = segments.indexOf("challenge-preview");
    if (idx >= 0 && segments.length >= idx + 2) {
      return String(segments[idx + 1] || "").trim();
    }

    return "";
  }

  function getSupabaseConfig() {
    const raw =
      global.japanoteSupabaseConfig && typeof global.japanoteSupabaseConfig === "object"
        ? global.japanoteSupabaseConfig
        : {};

    return {
      enabled: Boolean(raw.enabled && raw.url && raw.anonKey),
      url: raw.url || "",
      anonKey: raw.anonKey || "",
      table: raw.challengeTable || "shared_challenges"
    };
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/gu, " ").trim();
  }

  function getTargetPathFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    return normalizeText(payload.p || payload.targetPath || "");
  }

  const JAPANOTE_BASE = "/japanote";

  function targetUrlFromPayloadPath(rawPath) {
    const baseDir = new URL(JAPANOTE_BASE + "/", global.location.origin);
    if (!rawPath || !String(rawPath).trim()) {
      return new URL("index.html", baseDir);
    }
    const t = String(rawPath).trim();
    if (t === JAPANOTE_BASE || t.startsWith(JAPANOTE_BASE + "/")) {
      return new URL(t, global.location.origin);
    }
    if (t.startsWith("/")) {
      return new URL(JAPANOTE_BASE + t, global.location.origin);
    }
    return new URL(t, baseDir);
  }

  function getTargetHashFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const value = normalizeText(payload.h || payload.targetHash || "");
    if (!value) {
      return "";
    }

    return value.startsWith("#") ? value : `#${value}`;
  }

  async function redirectToTarget() {
    const refCode = getPreviewRefCode();
    if (!refCode) {
      return;
    }

    const config = getSupabaseConfig();
    if (!config.enabled || !global.supabase || typeof global.supabase.createClient !== "function") {
      console.error("Challenge preview redirect is unavailable because Supabase is not configured.");
      return;
    }

    try {
      const client = global.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data, error } = await client
        .from(config.table)
        .select("payload")
        .eq("code", refCode)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const payload = data?.payload;
      const targetHash = getTargetHashFromPayload(payload);
      const targetUrl = targetUrlFromPayloadPath(getTargetPathFromPayload(payload));

      targetUrl.searchParams.set("c", refCode);

      if (targetHash) {
        targetUrl.hash = targetHash;
      }

      global.location.replace(targetUrl.toString());
    } catch (error) {
      console.error("Failed to redirect challenge preview.", error);
    }
  }

  redirectToTarget();
})(window);
