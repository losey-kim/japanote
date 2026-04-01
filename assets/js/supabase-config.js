// Supabase 대시보드 → Project Settings → API
// - Project URL → 아래 SUPABASE_URL
// - Project API keys → anon public → SUPABASE_ANON_KEY
// 두 값을 넣으면 enabled 가 자동으로 true 가 됩니다. 실키는 커밋하지 마세요.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

window.japanoteSupabaseConfig = window.japanoteSupabaseConfig || {
  enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  stateTable: "user_state",
  emailRedirectTo: ""
};
