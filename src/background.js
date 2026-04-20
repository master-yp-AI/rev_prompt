// Background Service Worker

importScripts('lib/doubao-api.js', 'lib/utils.js');

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
    case 'saveApiKey':
      handleSaveApiKey(message.apiKey, sendResponse);
      return true;
    case 'getApiKey':
      handleGetApiKey(sendResponse);
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

    // Get API key
    const result = await chrome.storage.local.get('doubaoApiKey');
    if (!result.doubaoApiKey) {
      sendToSidebar({
        action: 'analysisError',
        error: 'Please set your Doubao API key first'
      });
      sendResponse({ success: false, error: 'No API key' });
      return;
    }

    // Notify sidebar analysis is starting
    sendToSidebar({
      action: 'analysisStarted',
      imageUrl: imageUrl
    });

    // Fetch and convert image to base64
    const imageBase64 = await fetchImageAsBase64(imageUrl);

    // Call Doubao API
    const analysis = await analyzeImageWithDoubao(imageBase64, result.doubaoApiKey);

    // Save to history
    const historyItem = {
      id: Date.now(),
      imageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      analysis: analysis
    };

    analysisHistory.unshift(historyItem);
    if (analysisHistory.length > 50) analysisHistory.pop();
    await chrome.storage.local.set({ analysisHistory });

    // Send result to sidebar
    sendToSidebar({
      action: 'analysisComplete',
      result: analysis,
      historyItem: historyItem
    });

    sendResponse({ success: true, analysis });

  } catch (error) {
    console.error('Analysis error:', error);
    sendToSidebar({
      action: 'analysisError',
      error: error.message || 'Analysis failed'
    });
    sendResponse({ success: false, error: error.message });
  }
}

// Save API key
async function handleSaveApiKey(apiKey, sendResponse) {
  try {
    await chrome.storage.local.set({ doubaoApiKey: apiKey });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Get API key
async function handleGetApiKey(sendResponse) {
  try {
    const result = await chrome.storage.local.get('doubaoApiKey');
    sendResponse({ success: true, apiKey: result.doubaoApiKey || '' });
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
