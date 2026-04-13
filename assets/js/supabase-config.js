// Supabase Authentication → Redirect URLs 에 Cloudflare Pages 주소와 로컬 URL(포트 포함)을 모두 넣어야 매직 링크가 그 주소로 돌아옵니다.
// anon public 키는 브라우저로 전달되는 값이라 저장소를 private으로 바꿔도 사용자에게는 계속 노출됩니다.
const SUPABASE_URL = "https://nppaqezqwusbagzdnoqi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcGFxZXpxd3VzYmFnemRub3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU5MzIsImV4cCI6MjA5MDQzMTkzMn0.cVnznT2P0sOoX6nA9mCLLNtIID5m2I1LW8N36FY9iqA";
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
