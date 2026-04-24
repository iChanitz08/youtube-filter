// ============================================================
// Optimism — config.js
// Fill in your Supabase credentials after setup.
// See SETUP.md for instructions.
// ============================================================

const OPTIMISM_CONFIG = {
  // Your Supabase project URL (from Supabase dashboard → Settings → API)
  SUPABASE_URL: 'https://jebhjwhjuxxmtazwjnvc.supabase.co',

  // Your Supabase anon/public key (safe to include — RLS restricts read access)
  SUPABASE_ANON_KEY: 'sb_publishable_FcKicCKxoH2gvxEoRe1X-g_LWn8qwtY',

  // URL of your keywords.json file on GitHub (raw content URL)
  // e.g. 'https://raw.githubusercontent.com/YOUR_USERNAME/youtube-filter/main/keywords.json'
  REMOTE_KEYWORDS_URL: 'https://raw.githubusercontent.com/getoptimism/youtube-filter/main/keywords.json',

  // How often to refresh remote keywords (in hours)
  KEYWORD_REFRESH_HOURS: 24,
};
