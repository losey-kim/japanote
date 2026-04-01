// `supabase-config.js`와 동일한 형식. 값만 채우면 됩니다.
// See README: Supabase 동기화 설정
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

window.japanoteSupabaseConfig = window.japanoteSupabaseConfig || {
  enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  stateTable: "user_state",
  emailRedirectTo: ""
};
