(function redirectChallengePreview(global) {
  function getPreviewRefCode() {
    const pathname = String(global.location?.pathname || "");
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length >= 2 && segments[0] === "challenge-preview") {
      return String(segments[1] || "").trim();
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
      const targetPath = getTargetPathFromPayload(payload) || "/index.html";
      const targetHash = getTargetHashFromPayload(payload);
      const targetUrl = new URL(targetPath, global.location.origin);

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
