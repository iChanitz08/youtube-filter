// ============================================================
// YouTube Selector Monitor — youtube.test.js
// Run daily via GitHub Actions to detect when YouTube
// changes its HTML structure and breaks the extension.
// ============================================================

const { test, expect } = require('@playwright/test');

const REQUIRED_SELECTORS = [
  {
    name: 'Video card container',
    selectors: [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
    ],
  },
  {
    name: 'Video title',
    selectors: [
      '#video-title',
      'yt-formatted-string#video-title',
    ],
  },
  {
    name: 'Channel name',
    selectors: [
      '#channel-name a',
      'ytd-channel-name a',
    ],
  },
  {
    name: 'Video watch link',
    selectors: [
      'a[href*="/watch?v="]',
    ],
  },
];

test.describe('YouTube HTML Selector Monitor', () => {

  test('YouTube homepage loads and has video cards', async ({ page }) => {
    // Navigate to YouTube homepage
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the main app shell to appear
    await page.waitForSelector('ytd-app', { timeout: 15000 });

    // Give the page a moment to render video cards
    await page.waitForTimeout(3000);

    // Check each required selector group
    for (const group of REQUIRED_SELECTORS) {
      let found = false;
      let foundCount = 0;
      let foundSelector = '';

      for (const selector of group.selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          found = true;
          foundCount = count;
          foundSelector = selector;
          break;
        }
      }

      if (found) {
        console.log(`✅ "${group.name}" — found ${foundCount} elements using: ${foundSelector}`);
      } else {
        console.error(`❌ BROKEN: "${group.name}" — none of these selectors found any elements:`);
        group.selectors.forEach(s => console.error(`   - ${s}`));
      }

      expect(found,
        `BROKEN SELECTOR: "${group.name}" — YouTube may have changed its HTML. ` +
        `Tried: ${group.selectors.join(', ')}`
      ).toBe(true);
    }
  });

  test('Video links still use /watch?v= format', async ({ page }) => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('ytd-app', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const watchLinks = await page.locator('a[href*="/watch?v="]').count();

    console.log(`Watch links found: ${watchLinks}`);

    expect(watchLinks,
      'BROKEN: No /watch?v= links found. YouTube may have changed its URL structure.'
    ).toBeGreaterThan(0);
  });

  test('At least 5 video cards visible on homepage', async ({ page }) => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('ytd-app', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // Try all card selectors, count whichever has the most results
    const counts = await Promise.all([
      page.locator('ytd-rich-item-renderer').count(),
      page.locator('ytd-video-renderer').count(),
    ]);

    const maxCount = Math.max(...counts);
    console.log(`Video cards found: ${maxCount}`);

    expect(maxCount,
      `BROKEN: Only ${maxCount} video cards found on homepage — expected at least 5. ` +
      'YouTube may have significantly restructured its homepage.'
    ).toBeGreaterThanOrEqual(5);
  });

});
