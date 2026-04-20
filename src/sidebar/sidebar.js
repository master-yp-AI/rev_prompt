// Sidebar JavaScript

let currentResult = null;
let currentView = 'json';

// DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
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
  // Settings toggle
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // API Key save
  saveApiKeyBtn.addEventListener('click', saveApiKey);

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

// Load API Key
async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    if (response.success && response.apiKey) {
      apiKeyInput.value = response.apiKey;
    }
  } catch (e) {
    console.log('Could not load API key');
  }
}

// Save API Key
async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveApiKey',
      apiKey: apiKey
    });

    if (response.success) {
      saveApiKeyBtn.textContent = 'Saved!';
      saveApiKeyBtn.style.background = 'linear-gradient(135deg, #64c864 0%, #4a9f4a 100%)';
      setTimeout(() => {
        saveApiKeyBtn.textContent = 'Save API Key';
        saveApiKeyBtn.style.background = '';
      }, 2000);
    }
  } catch (e) {
    alert('Failed to save API key');
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
    <div class="history-item" data-id="${item.id}">
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
      const id = parseInt(item.dataset.id);
      const historyItem = history.find(h => h.id === id);
      if (historyItem) {
        showResult(historyItem.analysis, historyItem.imageUrl);
      }
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
  if (target === 'jsonPrompt' && currentResult?.json_prompt) {
    text = JSON.stringify(currentResult.json_prompt, null, 2);
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
function showResult(result, imageUrl) {
  currentResult = result;
  hideAllSections();
  currentAnalysis.classList.remove('hidden');

  if (imageUrl) {
    previewImg.src = imageUrl;
  }

  // Display JSON prompt
  if (result.json_prompt) {
    jsonPrompt.textContent = JSON.stringify(result.json_prompt, null, 2);
  } else {
    jsonPrompt.textContent = 'No structured prompt available';
  }

  // Display natural language prompt
  if (result.natural_language_prompt) {
    naturalPrompt.textContent = result.natural_language_prompt;
  } else {
    naturalPrompt.textContent = 'No natural language prompt available';
  }

  // Refresh history
  loadHistory();
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
      showResult(message.result, message.imageUrl);
      break;
    case 'analysisError':
      showError(message.error);
      break;
  }
});
