// `supabase-config.js`와 동일한 형식. 값만 채우면 됩니다.
// See README: Supabase 동기화 설정
// anon public 키는 클라이언트 공개 키이므로 배포 후 브라우저에서 보이는 값입니다.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const CHALLENGE_PREVIEW_BASE_URL =
  typeof window !== "undefined" && !/^(localhost|127\.0\.0\.1)$/u.test(window.location.hostname)
    ? `${window.location.origin}/challenge-preview`
    : "";

window.japanoteSupabaseConfig = window.japanoteSupabaseConfig || {
  enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  stateTable: "user_state",
  challengePreviewBaseUrl: CHALLENGE_PREVIEW_BASE_URL,
  emailRedirectTo: ""
};
