// Content Script - Injected into web pages

let activeOverlay = null;

// Create analyze overlay for images
function createOverlay(img) {
  const overlay = document.createElement('div');
  overlay.className = 'rev-prompt-overlay';
  overlay.innerHTML = '<div class="rev-prompt-button">Analyze Image</div>';

  const rect = img.getBoundingClientRect();
  overlay.style.position = 'absolute';
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0, 0, 0, 0.5)';
  overlay.style.borderRadius = '4px';
  overlay.style.cursor = 'pointer';
  overlay.style.transition = 'opacity 0.2s';

  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
    analyzeImage(img);
    removeOverlay();
  });

  document.body.appendChild(overlay);
  return overlay;
}

function removeOverlay() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
}

// Extract best image URL
function getImageUrl(img) {
  // Try srcset first for highest resolution
  if (img.srcset) {
    const sources = img.srcset.split(',').map(s => {
      const parts = s.trim().split(' ');
      return { url: parts[0], width: parseInt(parts[1] || '0') };
    });
    sources.sort((a, b) => b.width - a.width);
    if (sources[0]) return sources[0].url;
  }
  return img.src;
}

// Analyze the image
async function analyzeImage(img) {
  const imageUrl = getImageUrl(img);

  try {
    // Open sidebar
    chrome.runtime.sendMessage({ action: 'openSidebar' });

    // Send image for analysis
    chrome.runtime.sendMessage({
      action: 'analyzeImage',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
  }
}

// Add hover listeners to images
function setupImageListeners() {
  const images = document.querySelectorAll('img');

  images.forEach(img => {
    if (img.dataset.revPromptInitialized) return;
    img.dataset.revPromptInitialized = 'true';

    img.addEventListener('mouseenter', () => {
      if (img.naturalWidth < 50 || img.naturalHeight < 50) return;
      removeOverlay();
      activeOverlay = createOverlay(img);
    });

    img.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (activeOverlay && !activeOverlay.matches(':hover')) {
          removeOverlay();
        }
      }, 100);
    });
  });
}

// Observe DOM for new images
const observer = new MutationObserver(() => {
  setupImageListeners();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial setup
setupImageListeners();

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ status: 'alive' });
  }
});
