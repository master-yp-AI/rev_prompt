// Background Service Worker

importScripts('lib/utils.js', 'lib/supabase-client.js', 'lib/api-client.js');

// Default vision config — only used for display in settings panel
// Actual default analysis goes through Supabase Edge Function (no client-side key)
const DEFAULT_CONFIG = {
  protocol: 'openai',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  apiKey: '',
  model: 'mimo-v2.5',
  isDefault: true
};

// Store for pending analysis
let currentAnalysis = null;
let analysisHistory = [];

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Configure side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Listen for messages from content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openSidebar':
      handleOpenSidebar(sender);
      break;
    case 'analyzeImage':
      handleAnalyzeImage(message, sendResponse);
      return true; // Keep port open for async response
    case 'saveApiConfig':
      handleSaveApiConfig(message.config, sendResponse);
      return true;
    case 'getApiConfig':
      handleGetApiConfig(sendResponse);
      return true;
    case 'getHistory':
      handleGetHistory(sendResponse);
      return true;
    case 'clearHistory':
      handleClearHistory(sendResponse);
      return true;
  }
});

// Open sidebar
async function handleOpenSidebar(sender) {
  if (sender.tab && sender.tab.windowId) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
}

// Analyze image
async function handleAnalyzeImage(message, sendResponse) {
  try {
    const { imageUrl } = message;

    // Get API configuration
    const result = await chrome.storage.local.get('apiConfig');
    const userConfig = result.apiConfig;
    const usingDefault = !userConfig || !userConfig.apiKey;
    const config = usingDefault ? DEFAULT_CONFIG : userConfig;

    // Notify sidebar analysis is starting
    sendToSidebar({
      action: 'analysisStarted',
      imageUrl: imageUrl
    });

    // Fetch and convert image to base64
    const imageBase64 = await fetchImageAsBase64(imageUrl);

    // Call AI analysis + retrieve similar prompts
    const { analysis, similarPrompts } = await analyzeAndRetrieve(imageBase64, config, usingDefault);

    // Save to history
    const historyItem = {
      id: Date.now(),
      imageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      analysis: analysis,
      similarPrompts: similarPrompts
    };

    analysisHistory.unshift(historyItem);
    if (analysisHistory.length > 50) analysisHistory.pop();
    await chrome.storage.local.set({ analysisHistory });

    // Send result to sidebar
    sendToSidebar({
      action: 'analysisComplete',
      result: analysis,
      similarPrompts: similarPrompts,
      historyItem: historyItem
    });

    sendResponse({ success: true, analysis, similarPrompts });

  } catch (error) {
    console.error('Analysis error:', error);
    sendToSidebar({
      action: 'analysisError',
      error: error.message || 'Analysis failed'
    });
    sendResponse({ success: false, error: error.message });
  }
}

// Save API configuration
async function handleSaveApiConfig(config, sendResponse) {
  try {
    await chrome.storage.local.set({ apiConfig: config });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Get API configuration
async function handleGetApiConfig(sendResponse) {
  try {
    const result = await chrome.storage.local.get('apiConfig');
    sendResponse({ success: true, config: result.apiConfig || DEFAULT_CONFIG });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Get history
async function handleGetHistory(sendResponse) {
  try {
    const result = await chrome.storage.local.get('analysisHistory');
    analysisHistory = result.analysisHistory || [];
    sendResponse({ success: true, history: analysisHistory });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Clear history
async function handleClearHistory(sendResponse) {
  try {
    analysisHistory = [];
    await chrome.storage.local.set({ analysisHistory: [] });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Send message to sidebar
function sendToSidebar(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Sidebar might not be open yet
  });
}

// Initialize on load
chrome.storage.local.get(['analysisHistory'], (result) => {
  analysisHistory = result.analysisHistory || [];
});
