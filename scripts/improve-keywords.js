#!/usr/bin/env node
// ============================================================
// Optimism — improve-keywords.js
// Runs weekly via GitHub Actions.
//
// 1. Fetches new user reports from Supabase
// 2. Sends them to the Claude API for keyword extraction
// 3. Merges suggestions into keywords.json
// 4. GitHub Actions commits the update and opens a PR
//
// Required environment variables (set as GitHub Secrets):
//   SUPABASE_URL          — your Supabase project URL
//   SUPABASE_SERVICE_KEY  — service role key (can read reports)
//   ANTHROPIC_API_KEY     — your Claude API key
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const KEYWORDS_PATH = path.join(__dirname, '..', 'keywords.json');
const CATEGORIES = ['news', 'violence', 'politics', 'disaster', 'clickbait', 'mentalHealth', 'aiDoom'];

// --- Fetch reports from the last 7 days ---
async function fetchRecentReports() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${SUPABASE_URL}/rest/v1/reports?created_at=gte.${since}&select=video_title,channel_name,user_comment&limit=500`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed: ${res.status} ${text}`);
  }

  const reports = await res.json();
  console.log(`📥 Fetched ${reports.length} reports from the past 7 days.`);
  return reports;
}

// --- Ask Claude to extract new keywords from the reports ---
async function extractKeywordsWithClaude(reports) {
  if (reports.length === 0) {
    console.log('No new reports — skipping Claude analysis.');
    return null;
  }

  // Format reports as a readable list for the prompt
  const reportList = reports
    .slice(0, 200) // cap at 200 to stay within token limits
    .map((r, i) =>
      `${i + 1}. Title: "${r.video_title}" | Channel: "${r.channel_name || 'unknown'}" | Comment: "${r.user_comment || 'none'}"`
    )
    .join('\n');

  const prompt = `You are helping improve a YouTube content filter called Optimism.
Its goal is to hide negative, distressing, or low-quality content to keep users' feeds positive.

Users have reported the following videos as negative content that slipped through the filter.
Each entry has the video title, channel name, and the user's comment explaining why it's negative.

REPORTS:
${reportList}

The filter has these categories:
- news: Breaking news, major media outlets
- violence: Shootings, crime, war, death
- politics: Elections, politicians, controversy
- disaster: Natural disasters, emergencies, crashes
- clickbait: Rage-bait, shocking content, "you won't believe"
- mentalHealth: Suicide, self-harm, abuse, addiction
- aiDoom: AI apocalypse, killer robots, existential AI risk

Based on these reports, suggest NEW specific keyword phrases to add to each category.
Only suggest keywords that appear as clear patterns across multiple reports.
Keep keywords lowercase, 1–4 words each. Be specific — avoid overly broad words.
Do NOT repeat keywords that are already obvious (like "shooting" for violence).

Return ONLY valid JSON in this exact format:
{
  "news": ["keyword1", "keyword2"],
  "violence": ["keyword1"],
  "politics": [],
  "disaster": ["keyword1", "keyword2"],
  "clickbait": ["keyword1"],
  "mentalHealth": [],
  "aiDoom": ["keyword1", "keyword2"]
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();

  // Extract JSON from Claude's response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');

  const suggestions = JSON.parse(jsonMatch[0]);
  console.log('🤖 Claude keyword suggestions:', JSON.stringify(suggestions, null, 2));
  return suggestions;
}

// --- Merge new keywords into keywords.json ---
function mergeKeywords(existing, suggestions) {
  const updated = { ...existing };

  for (const category of CATEGORIES) {
    const existingList = existing[category] || [];
    const newList = (suggestions[category] || []).map(k => k.toLowerCase().trim());

    // Add only genuinely new keywords
    const merged = [...new Set([...existingList, ...newList])];
    updated[category] = merged;

    const added = merged.filter(k => !existingList.includes(k));
    if (added.length > 0) {
      console.log(`  ✅ ${category}: added ${added.length} keywords — ${added.join(', ')}`);
    }
  }

  return updated;
}

// --- Main ---
async function main() {
  console.log('🌅 Optimism keyword improvement pipeline starting…\n');

  // Validate env vars
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
    console.error('❌ Missing required environment variables. Check SETUP.md.');
    process.exit(1);
  }

  // Load current keywords.json
  const current = JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf8'));
  console.log('📄 Loaded current keywords.json');

  // Fetch reports
  const reports = await fetchRecentReports();

  // Get Claude's suggestions
  const suggestions = await extractKeywordsWithClaude(reports);
  if (!suggestions) {
    console.log('✅ No changes needed.');
    return;
  }

  // Merge and save
  const updated = mergeKeywords(current, suggestions);
  updated._meta = {
    ...current._meta,
    version: (current._meta?.version || 0) + 1,
    last_updated: new Date().toISOString().split('T')[0],
    reports_processed: reports.length,
  };

  fs.writeFileSync(KEYWORDS_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log('\n✅ keywords.json updated successfully.');
  console.log(`📊 Processed ${reports.length} reports, version → ${updated._meta.version}`);
}

main().catch((err) => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
