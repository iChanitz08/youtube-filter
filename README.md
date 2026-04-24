# YouTube Filter — Chrome Extension

Filter YouTube videos by keyword, channel name, and duration. Future-proofed with automated daily selector monitoring.

---

## Project Structure

```
youtube-filter/
├── manifest.json               ← Extension config (Manifest V3)
├── content.js                  ← Runs on YouTube, hides matching videos
├── content.css                 ← Injected styles
├── popup.html                  ← Settings UI
├── popup.css                   ← Popup styles
├── popup.js                    ← Settings logic
├── icons/                      ← Extension icons (16, 48, 128px)
├── tests/
│   ├── youtube.test.js         ← Daily selector health checks
│   └── playwright.config.js    ← Playwright config
└── .github/
    └── workflows/
        └── monitor.yml         ← GitHub Action: runs tests every morning
```

---

## Load the Extension Locally (Development)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** → select this `youtube-filter/` folder
4. Go to YouTube — the extension is running
5. Click the extension icon in your toolbar to open the settings popup

---

## Run the Selector Monitor Locally

```bash
npm install
npx playwright install chromium
npm run test:monitor
```

---

## Set Up Automated Daily Monitoring (GitHub)

1. Push this folder to a GitHub repo
2. Go to **Settings → Actions → General** → enable Actions
3. Go to **Settings → Notifications** → enable email for Issues
4. The monitor runs automatically every morning at 9am UTC
5. If YouTube's HTML breaks your selectors → you get an email + a GitHub Issue is opened with fix instructions

---

## How to Fix a Broken Selector

When you get an alert:

1. Open the GitHub Actions log to see which selector failed
2. Go to YouTube → right-click a video card → **Inspect Element**
3. Copy the video card HTML
4. Paste it into Claude with this prompt:

> "My YouTube filter extension's selectors broke. Here's the current HTML: [paste]. My broken selectors are: [paste from log]. Give me updated selectors for: card container, title, channel name, and duration."

5. Update `content.js` → push → done

---

## Features

- ✅ Block videos by keyword (title match)
- ✅ Block videos by channel name
- ✅ Filter by minimum / maximum duration
- ✅ Enable/disable with one toggle
- ✅ Session counter (videos hidden this session)
- ✅ Settings sync across Chrome devices
- ✅ Resilient selectors with multiple fallbacks
- ✅ Daily automated health monitoring

---

## Built With

- Chrome Extensions (Manifest V3)
- Playwright (automated testing)
- GitHub Actions (scheduled monitoring)
