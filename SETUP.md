# Optimism — Reporting & Auto-Improvement Setup

This guide sets up the two external services the reporting system needs:
**Supabase** (collects user reports) and **GitHub Secrets** (runs the AI pipeline).

Estimated time: ~20 minutes.

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**, give it a name like `optimism`, choose a region close to you
3. Wait ~2 minutes for the project to spin up

---

## Step 2 — Create the reports table

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Paste and run this SQL:

```sql
-- Create the reports table
create table reports (
  id uuid default gen_random_uuid() primary key,
  video_title text not null,
  channel_name text,
  user_comment text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table reports enable row level security;

-- Allow anyone to INSERT (users submitting reports)
create policy "Allow anonymous inserts"
  on reports for insert
  to anon
  with check (true);

-- Only the service role can SELECT (your AI pipeline)
-- No policy needed — service role bypasses RLS by default
```

3. Click **Run**. You should see "Success" in the results panel.

---

## Step 3 — Get your Supabase credentials

1. In Supabase, go to **Settings → API** (in the left sidebar)
2. Copy these two values — you'll need them in steps 4 and 5:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)
   - **service_role key** (a different long string — keep this secret!)

---

## Step 4 — Update config.js in the extension

Open `config.js` and fill in your values:

```js
const OPTIMISM_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',   // ← paste Project URL
  SUPABASE_ANON_KEY: 'eyJ...',                         // ← paste anon key

  // After you push to GitHub, update this with your raw URL:
  // https://raw.githubusercontent.com/YOUR_USERNAME/youtube-filter/main/keywords.json
  REMOTE_KEYWORDS_URL: 'https://raw.githubusercontent.com/YOUR_USERNAME/youtube-filter/main/keywords.json',

  KEYWORD_REFRESH_HOURS: 24,
};
```

> **Note:** The anon key is safe to include in the extension — Row Level Security
> ensures users can only INSERT, never read other reports.

---

## Step 5 — Push to GitHub and add Secrets

1. Create a new GitHub repository (e.g. `youtube-filter`) and push this project folder to it:

```bash
git remote add origin https://github.com/YOUR_USERNAME/youtube-filter.git
git add .
git commit -m "Initial Optimism extension"
git push -u origin main
```

2. In your GitHub repo, go to **Settings → Secrets and variables → Actions**
3. Click **New repository secret** and add these three secrets:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase **service_role** key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from console.anthropic.com) |

---

## Step 6 — Update config.js with your GitHub raw URL

Now that your repo is live, update the `REMOTE_KEYWORDS_URL` in `config.js`:

```
https://raw.githubusercontent.com/YOUR_USERNAME/youtube-filter/main/keywords.json
```

Commit and push that change.

---

## Step 7 — Test the reporting system

1. Reload the extension in `chrome://extensions`
2. Go to YouTube — you should see a small 🚩 flag appear on hover over any video card
3. Click it, type a comment, and hit **Send Report**
4. Go to your Supabase dashboard → **Table Editor → reports** — your report should appear

---

## Step 8 — Test the keyword pipeline manually

In your GitHub repo, go to **Actions → Optimism Keyword Improvement Pipeline → Run workflow**.

It will:
1. Fetch all reports from Supabase
2. Send them to Claude for analysis
3. Update `keywords.json` if new keywords are found
4. Open a Pull Request for you to review

Once you merge the PR, every user's extension will pick up the new keywords within 24 hours automatically.

---

## How the weekly cycle works

```
Users flag videos → Reports land in Supabase
                           ↓
              Every Sunday: GitHub Action runs
                           ↓
              Claude reads reports, finds patterns
                           ↓
              keywords.json updated via Pull Request
                           ↓
              You review + merge → all users updated silently
```

---

## Viewing your reports

Log into Supabase → **Table Editor → reports** to see everything users have flagged.
You can filter by date, sort by channel, or export to CSV at any time.

To see which keywords are currently active in the filter (built-in + community), open the
extension's popup — it shows the category toggles. The underlying keyword lists are in
`content.js` (built-in) and `keywords.json` (community-sourced).
