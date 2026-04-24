// ============================================================
// Optimism — popup.js
// Handles settings UI: category toggles, custom keywords,
// blocked channels, and save/load from chrome.storage.sync
// ============================================================

let customKeywords = [];
let blockedChannels = [];

// --- Render tag pills ---
function renderTags(list, containerId, onRemove) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  list.forEach((item, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${item} <span class="remove" data-index="${index}">×</span>`;
    tag.querySelector('.remove').addEventListener('click', () => {
      onRemove(index);
    });
    container.appendChild(tag);
  });
}

function renderKeywordTags() {
  renderTags(customKeywords, 'keywordTags', (i) => {
    customKeywords.splice(i, 1);
    renderKeywordTags();
  });
}

function renderChannelTags() {
  renderTags(blockedChannels, 'channelTags', (i) => {
    blockedChannels.splice(i, 1);
    renderChannelTags();
  });
}

// --- Add custom keyword ---
document.getElementById('addKeyword').addEventListener('click', () => {
  const input = document.getElementById('keywordInput');
  const value = input.value.trim().toLowerCase();
  if (value && !customKeywords.includes(value)) {
    customKeywords.push(value);
    renderKeywordTags();
  }
  input.value = '';
  input.focus();
});

document.getElementById('keywordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addKeyword').click();
});

// --- Add blocked channel ---
document.getElementById('addChannel').addEventListener('click', () => {
  const input = document.getElementById('channelInput');
  const value = input.value.trim();
  if (value && !blockedChannels.includes(value)) {
    blockedChannels.push(value);
    renderChannelTags();
  }
  input.value = '';
  input.focus();
});

document.getElementById('channelInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addChannel').click();
});

// --- Read all category toggle states ---
function getEnabledCategories() {
  const categories = {};
  document.querySelectorAll('.category-toggle').forEach(checkbox => {
    categories[checkbox.dataset.category] = checkbox.checked;
  });
  return categories;
}

// --- Set category toggle states ---
function setEnabledCategories(enabledCategories) {
  document.querySelectorAll('.category-toggle').forEach(checkbox => {
    const category = checkbox.dataset.category;
    // Default to true (enabled) if not set
    checkbox.checked = enabledCategories?.[category] !== false;
  });
}

// --- Save all settings ---
document.getElementById('saveBtn').addEventListener('click', () => {
  const enabled = document.getElementById('enabledToggle').checked;
  const enabledCategories = getEnabledCategories();

  chrome.storage.sync.set({
    enabled,
    enabledCategories,
    customKeywords,
    blockedChannels,
  }, () => {
    const msg = document.getElementById('savedMsg');
    msg.textContent = '✓ Saved!';
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  });
});

// --- Load saved settings on popup open ---
chrome.storage.sync.get(
  ['enabled', 'enabledCategories', 'customKeywords', 'blockedChannels'],
  (data) => {
    // Master on/off toggle
    document.getElementById('enabledToggle').checked = data.enabled !== false;

    // Category toggles (all on by default)
    setEnabledCategories(data.enabledCategories);

    // Custom lists
    customKeywords = data.customKeywords || [];
    blockedChannels = data.blockedChannels || [];

    renderKeywordTags();
    renderChannelTags();
  }
);

// --- Show hidden video count ---
try {
  chrome.storage.local.get(['hiddenCount'], (data) => {
    document.getElementById('hiddenCount').textContent = data?.hiddenCount || 0;
  });
} catch(e) {}
