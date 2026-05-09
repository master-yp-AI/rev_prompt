// Sidebar JavaScript

let currentResult = null;
let currentView = 'json';
let currentSimilarPrompts = [];

// DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const protocolSelect = document.getElementById('protocolSelect');
const baseUrlInput = document.getElementById('baseUrlInput');
const modelInput = document.getElementById('modelInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const currentAnalysis = document.getElementById('currentAnalysis');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const historySection = document.getElementById('historySection');

const previewImg = document.getElementById('previewImg');
const jsonView = document.getElementById('jsonView');
const naturalView = document.getElementById('naturalView');
const jsonPrompt = document.getElementById('jsonPrompt');
const naturalPrompt = document.getElementById('naturalPrompt');
const errorMessage = document.getElementById('errorMessage');
const historyList = document.getElementById('historyList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
  loadHistory();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Settings toggle with fade
  settingsBtn.addEventListener('click', () => {
    toggleSettingsPanel();
  });

  // Protocol change - update placeholders
  protocolSelect.addEventListener('change', updatePlaceholders);

  // Save configuration
  saveConfigBtn.addEventListener('click', saveApiConfig);

  // Clear history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyPrompt(btn.dataset.target);
    });
  });
}

// Update input placeholders based on selected protocol
function updatePlaceholders() {
  const protocol = protocolSelect.value;
  if (protocol === 'openai') {
    baseUrlInput.placeholder = 'https://api.openai.com/v1';
    modelInput.placeholder = 'gpt-5.4';
  } else if (protocol === 'anthropic') {
    baseUrlInput.placeholder = 'https://api.anthropic.com';
    modelInput.placeholder = 'claude-opus-4.7';
  }
}

// Settings panel fade toggle
function toggleSettingsPanel() {
  if (settingsPanel.classList.contains('collapsed')) {
    settingsPanel.classList.remove('collapsed');
  } else {
    settingsPanel.addEventListener('transitionend', function handler() {
      settingsPanel.removeEventListener('transitionend', handler);
    });
    settingsPanel.classList.add('collapsed');
  }
}

// Load API Configuration
async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiConfig' });
    if (response.success && response.config) {
      const config = response.config;
      protocolSelect.value = config.protocol || 'openai';
      baseUrlInput.value = config.baseUrl || '';
      modelInput.value = config.model || '';
      apiKeyInput.value = config.apiKey || '';
      updatePlaceholders();
    }
  } catch (e) {
    console.log('Could not load API config');
    updatePlaceholders();
  }
}

// Save API Configuration
async function saveApiConfig() {
  const config = {
    protocol: protocolSelect.value,
    baseUrl: baseUrlInput.value.trim(),
    model: modelInput.value.trim(),
    apiKey: apiKeyInput.value.trim()
  };

  // API key 为空时清除自定义配置，回退到默认
  if (!config.apiKey) {
    try {
      await chrome.runtime.sendMessage({ action: 'saveApiConfig', config: null });
      saveConfigBtn.textContent = '已恢复默认';
      setTimeout(() => {
        saveConfigBtn.textContent = 'Save Configuration';
        toggleSettingsPanel();
      }, 800);
    } catch (e) {
      alert('操作失败');
    }
    return;
  }

  if (!config.baseUrl) {
    alert('Please enter a Base URL');
    return;
  }
  if (!config.model) {
    alert('Please enter a Model Name');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveApiConfig',
      config: config
    });

    if (response.success) {
      saveConfigBtn.textContent = 'Saved!';
      saveConfigBtn.style.background = 'linear-gradient(135deg, #64c864 0%, #4a9f4a 100%)';
      setTimeout(() => {
        saveConfigBtn.textContent = 'Save Configuration';
        saveConfigBtn.style.background = '';
        toggleSettingsPanel();
      }, 800);
    }
  } catch (e) {
    alert('Failed to save configuration');
  }
}

// Load history
async function loadHistory() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
    if (response.success && response.history.length > 0) {
      renderHistory(response.history);
      historySection.classList.remove('hidden');
    }
  } catch (e) {
    console.log('Could not load history');
  }
}

// Render history
function renderHistory(history) {
  historyList.innerHTML = history.map(item => `
    <div class="history-item" data-id="${item.id}" data-analysis='${JSON.stringify(item.analysis).replace(/'/g, "&#39;")}' data-image-url="${item.imageUrl}">
      <img src="${item.imageUrl}" alt="" onerror="this.style.display='none'">
      <div class="history-item-content">
        <p>${truncateText(item.analysis?.natural_language_prompt || 'No prompt', 80)}</p>
        <span>${formatDate(item.timestamp)}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const analysis = JSON.parse(item.dataset.analysis);
      const imageUrl = item.dataset.imageUrl;
      showResult(analysis, imageUrl);
    });
  });
}

// Clear history
async function clearHistory() {
  if (!confirm('Are you sure you want to clear history?')) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'clearHistory' });
    if (response.success) {
      historySection.classList.add('hidden');
      historyList.innerHTML = '';
    }
  } catch (e) {
    alert('Failed to clear history');
  }
}

// Switch view
function switchView(view) {
  currentView = view;

  // Update buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Update views
  jsonView.classList.toggle('hidden', view !== 'json');
  naturalView.classList.toggle('hidden', view !== 'natural');
}

// Copy prompt
async function copyPrompt(target) {
  let text = '';
  if (target === 'jsonPrompt' && currentResult?.structured_prompt) {
    text = JSON.stringify(currentResult.structured_prompt, null, 2);
  } else if (target === 'naturalPrompt' && currentResult?.natural_language_prompt) {
    text = currentResult.natural_language_prompt;
  }

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.querySelector(`.copy-btn[data-target="${target}"]`);
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  } catch (e) {
    alert('Failed to copy');
  }
}

// Show loading state
function showLoading(imageUrl) {
  hideAllSections();
  loadingState.classList.remove('hidden');
  if (imageUrl) {
    previewImg.src = imageUrl;
  }
}

// Show result
function showResult(result, imageUrl, similarPrompts = []) {
  currentResult = result;
  currentSimilarPrompts = similarPrompts;
  hideAllSections();
  currentAnalysis.classList.remove('hidden');

  if (imageUrl) {
    previewImg.src = imageUrl;
  }

  // Display scene and tags
  const sceneEl = document.getElementById('sceneText');
  const tagsEl = document.getElementById('tagsContainer');
  if (sceneEl) sceneEl.textContent = result.scene || '';
  if (tagsEl) {
    if (result.tags && result.tags.length > 0) {
      tagsEl.innerHTML = result.tags.map(t => `<span class="result-tag">${t}</span>`).join('');
      tagsEl.classList.remove('hidden');
    } else {
      tagsEl.classList.add('hidden');
    }
  }

  // Display structured prompt
  if (result.structured_prompt) {
    jsonPrompt.textContent = JSON.stringify(result.structured_prompt, null, 2);
  } else {
    jsonPrompt.textContent = 'No structured prompt available';
  }

  // Display natural language prompt
  if (result.natural_language_prompt) {
    naturalPrompt.textContent = result.natural_language_prompt;
  } else {
    naturalPrompt.textContent = 'No natural language prompt available';
  }

  // Display similar prompts
  const similarSection = document.getElementById('similarPromptsSection');
  const similarList = document.getElementById('similarPromptsList');
  const similarEmpty = document.getElementById('similarPromptsEmpty');

  similarSection.classList.remove('hidden');
  if (similarPrompts && similarPrompts.length > 0) {
    renderSimilarPrompts(similarPrompts);
    document.getElementById('similarCount').textContent = `${similarPrompts.length} results`;
    similarList.classList.remove('hidden');
    similarEmpty.classList.add('hidden');
  } else {
    document.getElementById('similarCount').textContent = '0 results';
    similarList.classList.add('hidden');
    similarEmpty.classList.remove('hidden');
  }

  // Refresh history
  loadHistory();
}

// Render similar prompts
function renderSimilarPrompts(prompts) {
  const list = document.getElementById('similarPromptsList');
  list.innerHTML = prompts.map((p, i) => `
    <div class="similar-prompt-item" data-index="${i}">
      <div class="similar-prompt-title">
        ${p.title || 'Untitled'}
        <span class="similar-prompt-similarity">${Math.round(p.similarity * 100)}% match</span>
      </div>
      ${p.description ? `<div class="similar-prompt-desc">${truncateText(p.description, 120)}</div>` : ''}
      ${p.tags && p.tags.length > 0 ? `
        <div class="similar-prompt-tags">
          ${p.tags.map(t => `<span class="similar-prompt-tag">${t}</span>`).join('')}
        </div>
      ` : ''}
      <div class="similar-prompt-actions">
        <button class="similar-prompt-expand" data-index="${i}">展开详情</button>
        <button class="similar-prompt-copy" data-index="${i}">📋 Copy</button>
      </div>
      <div class="similar-prompt-detail" data-index="${i}">
        <pre class="similar-prompt-detail-content">${escapeHtml(p.contentRaw || p.contentJson || '')}</pre>
      </div>
    </div>
  `).join('');

  // Copy buttons
  list.querySelectorAll('.similar-prompt-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copySimilarPrompt(parseInt(btn.dataset.index));
    });
  });

  // Expand/collapse with fade animation
  list.querySelectorAll('.similar-prompt-expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.similar-prompt-item');
      const detail = item.querySelector('.similar-prompt-detail');
      const isExpanding = !detail.classList.contains('expanded');

      // Collapse all other items
      list.querySelectorAll('.similar-prompt-detail.expanded').forEach(d => {
        if (d !== detail) {
          d.classList.remove('expanded');
          d.closest('.similar-prompt-item').querySelector('.similar-prompt-expand').textContent = '展开详情';
        }
      });

      // Toggle current
      detail.classList.toggle('expanded');
      btn.textContent = isExpanding ? '收起' : '展开详情';
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy similar prompt
async function copySimilarPrompt(index) {
  const p = currentSimilarPrompts[index];
  if (!p) return;

  const text = p.contentJson || p.contentRaw;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.querySelector(`.similar-prompt-copy[data-index="${index}"]`);
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    alert('Failed to copy');
  }
}

// Show error
function showError(message) {
  hideAllSections();
  errorState.classList.remove('hidden');
  errorMessage.textContent = message;
}

// Hide all sections
function hideAllSections() {
  currentAnalysis.classList.add('hidden');
  loadingState.classList.add('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
}

// Utility functions
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'analysisStarted':
      showLoading(message.imageUrl);
      break;
    case 'analysisComplete':
      showResult(message.result, message.imageUrl, message.similarPrompts || []);
      break;
    case 'analysisError':
      showError(message.error);
      break;
  }
});
