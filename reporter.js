// ============================================================
// Optimism — reporter.js
// Injects a 🚩 flag button next to each video title.
// Avoids thumbnail overflow:hidden issues entirely.
// ============================================================

function injectFlagButtons() {
  if (window.location.pathname === '/watch') return;

  // Find all video title links that haven't been processed yet
  const titleLinks = document.querySelectorAll('a[href*="/watch?v="]:not([optimism-flag-added])');

  titleLinks.forEach(link => {
    // Skip links with very short or no text (nav links, ads, etc.)
    const titleText =
      link.getAttribute('aria-label') ||
      link.textContent?.trim() || '';
    if (titleText.length < 5) return;

    link.setAttribute('optimism-flag-added', '1');

    // Walk up to find the card
    let card = link;
    for (let i = 0; i < 8; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (card.querySelector('[id*="channel-name"]') ||
          card.querySelector('ytd-channel-name')) break;
    }

    const channel =
      card.querySelector('[id*="channel-name"]')?.textContent?.trim() ||
      card.querySelector('ytd-channel-name')?.textContent?.trim() ||
      '';

    // Create a small inline flag button that sits right after the title
    const btn = document.createElement('button');
    btn.textContent = '🚩';
    btn.title = 'Report as negative content';
    btn.style.cssText = `
      display: inline-block;
      margin-left: 6px;
      background: none;
      border: none;
      font-size: 13px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
      vertical-align: middle;
      padding: 0;
      line-height: 1;
    `;

    // Show when hovering the card
    card.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    card.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openReportModal(titleText.trim(), channel.trim());
    });

    // Insert the flag right after the title link
    link.insertAdjacentElement('afterend', btn);
  });
}

// --- Open the report modal ---
function openReportModal(title, channel) {
  document.getElementById('optimism-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'optimism-modal-overlay';
  overlay.innerHTML = `
    <div id="optimism-modal">
      <div class="om-header">
        <span class="om-sun">☀</span>
        <span class="om-title">Report Negative Content</span>
        <button class="om-close" id="optimismClose">×</button>
      </div>
      <div class="om-video-info">
        <div class="om-label">Video</div>
        <div class="om-video-title">${escapeHtml(title)}</div>
        <div class="om-channel">${escapeHtml(channel)}</div>
      </div>
      <div class="om-field">
        <label class="om-label" for="optimismComment">Why is this negative?</label>
        <textarea
          id="optimismComment"
          class="om-textarea"
          placeholder="e.g. Fear-mongering about AI, violent news story, doom and gloom…"
          rows="3"
          maxlength="300"
        ></textarea>
        <div class="om-char-count"><span id="optimismCharCount">0</span>/300</div>
      </div>
      <div class="om-actions">
        <button class="om-cancel" id="optimismCancel">Cancel</button>
        <button class="om-submit" id="optimismSubmit">Send Report ✓</button>
      </div>
      <div class="om-success" id="optimismSuccess" style="display:none">
        <span>✅ Thanks! Your report helps improve Optimism for everyone.</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const textarea = document.getElementById('optimismComment');
  const charCount = document.getElementById('optimismCharCount');
  textarea.addEventListener('input', () => { charCount.textContent = textarea.value.length; });

  document.getElementById('optimismClose').addEventListener('click', closeModal);
  document.getElementById('optimismCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('optimismSubmit').addEventListener('click', () => {
    submitReport(title, channel, textarea.value.trim());
  });

  setTimeout(() => textarea.focus(), 50);
}

function closeModal() {
  document.getElementById('optimism-modal-overlay')?.remove();
}

async function submitReport(title, channel, comment) {
  const submitBtn = document.getElementById('optimismSubmit');
  submitBtn.textContent = 'Sending…';
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${OPTIMISM_CONFIG.SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': OPTIMISM_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${OPTIMISM_CONFIG.SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        video_title: title,
        channel_name: channel,
        user_comment: comment || null,
      }),
    });

    if (!response.ok) throw new Error(await response.text());

    document.getElementById('optimismSubmit').style.display = 'none';
    document.getElementById('optimismCancel').textContent = 'Close';
    document.getElementById('optimismSuccess').style.display = 'block';
    setTimeout(closeModal, 2500);

  } catch (err) {
    console.error('[Optimism] Failed to submit report:', err);
    submitBtn.textContent = 'Failed — try again';
    submitBtn.disabled = false;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const reporterObserver = new MutationObserver(() => injectFlagButtons());
reporterObserver.observe(document.body, { childList: true, subtree: true });

injectFlagButtons();
