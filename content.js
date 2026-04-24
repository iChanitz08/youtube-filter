// ============================================================
// Optimism — content.js
// Filters YouTube videos to remove negative, distressing, or
// low-quality content. Keeps your feed positive.
//
// Uses a URL-based approach: finds all links to /watch?v=
// and walks up to find the card container. This is resilient
// to YouTube HTML structure changes — no brittle selectors.
// ============================================================

// --- Built-in negative content keyword categories ---
const CATEGORY_KEYWORDS = {
  news: [
    'breaking news', 'breaking:', 'news update', 'live news', 'latest news',
    'news alert', 'cnn', 'fox news', 'msnbc', 'bbc news', 'abc news', 'nbc news',
    'headlines', 'top stories', 'daily news', 'world news', 'night news',
  ],
  violence: [
    'shooting', 'murder', 'stabbing', 'attack', 'assault', 'crime', 'criminal',
    'killed', 'dead', 'death', 'dying', 'died', 'fatal', 'victim', 'arrested',
    'violent', 'violence', 'war', 'battle', 'explosion', 'bomb', 'terrorist',
    'terrorism', 'hostage', 'execution', 'massacre', 'genocide', 'casualties',
  ],
  politics: [
    'democrat', 'republican', 'congress', 'senate', 'politician', 'politics',
    'election', 'vote', 'ballot', 'campaign', 'president', 'white house',
    'supreme court', 'government', 'scandal', 'impeach', 'protest', 'riot',
    'controversy', 'controversial', 'debate', 'policy', 'legislation',
  ],
  disaster: [
    'earthquake', 'hurricane', 'tornado', 'flood', 'wildfire', 'tsunami',
    'disaster', 'emergency', 'crisis', 'pandemic', 'outbreak', 'epidemic',
    'crash', 'accident', 'collision', 'tragedy', 'tragic', 'catastrophe',
    'evacuation', 'destroyed', 'devastated', 'collapse',
  ],
  clickbait: [
    'you won\'t believe', 'shocking', 'disturbing', 'outrage', 'outraged',
    'caught on camera', 'gone wrong', 'worst ever',
    'i almost died', 'nearly killed', 'brutal', 'horrifying', 'terrifying',
    'disgusting', 'graphic', 'disturbing content', 'trigger warning',
    'meltdown', 'freakout', 'loses it', 'goes crazy',
  ],
  mentalHealth: [
    'suicide', 'suicidal', 'self harm', 'self-harm', 'depression', 'overdose',
    'anxiety attack', 'abuse', 'trauma', 'ptsd', 'breakdown', 'addiction',
    'relapse', 'eating disorder', 'anorexia', 'bulimia',
  ],
  aiDoom: [
    'ai takeover', 'ai apocalypse', 'ai doomsday', 'ai will kill', 'ai destroys',
    'ai extinction', 'robot uprising', 'robot takeover', 'ai threat', 'ai danger',
    'superintelligence', 'agi risk', 'agi danger',
    'ai end of humanity', 'end of humanity', 'ai singularity', 'ai overlords',
    'ai controlled world', 'machines take over', 'skynet', 'terminator ai',
    'existential risk ai', 'ai kills humans', 'ai wipes out', 'humanity doomed',
    'ai arms race', 'killer robots', 'autonomous weapons', 'ai weapon',
    'ai gone wrong', 'ai out of control', 'runaway ai', 'misaligned ai',
  ],
};

// --- Community keywords fetched from GitHub (updated weekly by AI pipeline) ---
let remoteKeywords = {};

async function loadRemoteKeywords() {
  try {
    const cached = await getCachedRemoteKeywords();
    if (cached) {
      remoteKeywords = cached;
      return;
    }

    const url = OPTIMISM_CONFIG.REMOTE_KEYWORDS_URL;
    if (!url || url.includes('YOUR_USERNAME')) return;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;

    const data = await res.json();
    remoteKeywords = data;

    chrome.storage.local.set({
      remoteKeywordsCache: data,
      remoteKeywordsCachedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[Optimism] Could not load remote keywords:', e.message);
  }
}

async function getCachedRemoteKeywords() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['remoteKeywordsCache', 'remoteKeywordsCachedAt'], (data) => {
      if (!data.remoteKeywordsCache || !data.remoteKeywordsCachedAt) {
        resolve(null);
        return;
      }
      const ageHours = (Date.now() - data.remoteKeywordsCachedAt) / (1000 * 60 * 60);
      const maxAge = OPTIMISM_CONFIG.KEYWORD_REFRESH_HOURS || 24;
      resolve(ageHours < maxAge ? data.remoteKeywordsCache : null);
    });
  });
}

// --- Build the active keyword list ---
function buildKeywordList(settings) {
  const allKeywords = [];
  const enabledCategories = settings.enabledCategories || {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (enabledCategories[category] !== false) {
      allKeywords.push(...keywords);
      const remote = remoteKeywords[category] || [];
      allKeywords.push(...remote.map(k => k.toLowerCase()));
    }
  }

  const customKeywords = settings.customKeywords || [];
  allKeywords.push(...customKeywords.map(k => k.toLowerCase()));

  return [...new Set(allKeywords)];
}

// --- Check if a text matches any keyword ---
function matchesAny(text, keywords) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// --- Find the video card container by walking up from a watch link ---
// Stops when it finds a parent that contains a YouTube thumbnail image.
function findCardContainer(link) {
  // Tags that represent the feed itself — we don't want to hide these
  const FEED_TAGS = new Set([
    'YTD-APP', 'YTD-BROWSE', 'YTD-TWO-COLUMN-BROWSE-RESULTS-RENDERER',
    'YTD-RICH-GRID-RENDERER', 'YTD-ITEM-SECTION-RENDERER',
    'BODY', 'HTML',
  ]);

  let el = link.parentElement;
  let depth = 0;

  while (el && depth < 12) {
    if (FEED_TAGS.has(el.tagName)) break;

    // A video card will contain a YouTube thumbnail image
    if (
      el.querySelector('img[src*="ytimg.com"]') ||
      el.querySelector('img[src*="yt3.gg"]') ||
      el.querySelector('ytd-thumbnail')
    ) {
      return el;
    }
    el = el.parentElement;
    depth++;
  }

  // Fallback: go up 5 levels from the link
  let fallback = link;
  for (let i = 0; i < 5; i++) {
    if (fallback.parentElement) fallback = fallback.parentElement;
  }
  return fallback;
}

// --- Extract the video title from or near a watch link ---
function getTitleText(link) {
  // Best source: aria-label on the link (YouTube often puts the full title here)
  const ariaLabel = link.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length > 4) return ariaLabel;

  // Next: visible text of the link itself
  const linkText = link.textContent?.trim();
  if (linkText && linkText.length > 4) return linkText;

  // Fallback: look for a title element inside the card
  const card = findCardContainer(link);
  const titleEl =
    card.querySelector('[id*="video-title"]') ||
    card.querySelector('h3') ||
    card.querySelector('h4') ||
    card.querySelector('[class*="title"]');

  return titleEl?.textContent?.trim() || '';
}

// --- Get channel name from inside a card ---
function getChannelText(card) {
  const channelEl =
    card.querySelector('[id*="channel-name"]') ||
    card.querySelector('[class*="channel-name"]') ||
    card.querySelector('ytd-channel-name') ||
    card.querySelector('[id*="byline"]') ||
    card.querySelector('[class*="byline"]');

  return channelEl?.textContent?.trim() || '';
}

// --- Settings state ---
let settings = {
  enabled: true,
  enabledCategories: {
    news: true, violence: true, politics: true,
    disaster: true, clickbait: true, mentalHealth: true, aiDoom: true,
  },
  customKeywords: [],
  blockedChannels: [],
};

let hiddenCount = 0;

// --- Main filter pass ---
function filterCards() {
  if (!settings.enabled) return;

  // Only filter on feed pages — not on the video watch page itself
  if (window.location.pathname === '/watch') return;

  const keywords = buildKeywordList(settings);
  const blockedChannels = (settings.blockedChannels || []).map(c => c.toLowerCase());

  // Find all links to YouTube watch pages that haven't been checked yet.
  // This works regardless of what YouTube names their wrapper elements.
  const watchLinks = document.querySelectorAll('a[href*="/watch?v="]:not([optimism-checked])');

  watchLinks.forEach(link => {
    link.setAttribute('optimism-checked', '1');

    const title = getTitleText(link);

    // Skip links with no real title (navigation, ads, related section headers, etc.)
    if (!title || title.length < 4) return;

    const card = findCardContainer(link);
    const channel = getChannelText(card);

    let shouldHide = false;

    if (!shouldHide && keywords.length > 0) {
      shouldHide = matchesAny(title, keywords);
    }

    if (!shouldHide && blockedChannels.length > 0) {
      shouldHide = matchesAny(channel, blockedChannels);
    }

    if (shouldHide) {
      card.style.display = 'none';
      hiddenCount++;
      try { chrome.storage.local.set({ hiddenCount }); } catch(e) {}
    }
  });
}

// --- Re-run filter when settings change ---
function resetAndFilter() {
  document.querySelectorAll('[optimism-checked]').forEach(el => {
    el.removeAttribute('optimism-checked');
  });
  // Re-show all hidden cards
  document.querySelectorAll('[style*="display: none"]').forEach(el => {
    el.style.display = '';
  });
  hiddenCount = 0;
  filterCards();
}

// --- Load settings ---
function loadSettings(callback) {
  chrome.storage.sync.get(
    ['enabled', 'enabledCategories', 'customKeywords', 'blockedChannels'],
    (data) => {
      settings = {
        enabled: data.enabled !== false,
        enabledCategories: data.enabledCategories ?? {
          news: true, violence: true, politics: true,
          disaster: true, clickbait: true, mentalHealth: true, aiDoom: true,
        },
        customKeywords: data.customKeywords || [],
        blockedChannels: data.blockedChannels || [],
      };
      if (callback) callback();
    }
  );
}

// --- Watch for new content (YouTube is a single-page app) ---
const observer = new MutationObserver(() => filterCards());
observer.observe(document.body, { childList: true, subtree: true });

// --- React to settings changes from popup ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    loadSettings(resetAndFilter);
  }
});

// --- Un-hide everything when navigating to a watch page ---
// YouTube is a SPA so hidden homepage cards can persist into the watch page.
let lastPath = window.location.pathname;
const navObserver = new MutationObserver(() => {
  const currentPath = window.location.pathname;
  if (currentPath !== lastPath) {
    lastPath = currentPath;
    if (currentPath === '/watch') {
      // Navigated to a video — restore all hidden elements
      document.querySelectorAll('[style*="display: none"]').forEach(el => {
        el.style.display = '';
      });
      document.querySelectorAll('[optimism-checked]').forEach(el => {
        el.removeAttribute('optimism-checked');
      });
    }
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });

// --- Start ---
loadRemoteKeywords().then(() => loadSettings(filterCards));
