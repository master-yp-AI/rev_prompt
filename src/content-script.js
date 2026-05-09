// Content Script - Injected into web pages

let activeButton = null;
let activeImg = null;
let hideTimer = null;

// Create small floating analyze button — positioned on body, anchored to image
function showButton(img) {
  removeButton();

  const btn = document.createElement('div');
  btn.className = 'rev-prompt-btn';
  btn.textContent = '破解prompt';

  function position() {
    const rect = img.getBoundingClientRect();
    btn.style.top = `${rect.bottom + window.scrollY - 32}px`;
    btn.style.left = `${rect.right + window.scrollX - 68}px`;
  }

  btn.style.cssText = `
    position: absolute;
    z-index: 999999;
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(16px) saturate(1.8);
    -webkit-backdrop-filter: blur(16px) saturate(1.8);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
    pointer-events: auto;
    user-select: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  `;

  position();
  document.body.appendChild(btn);
  requestAnimationFrame(() => { btn.style.opacity = '1'; });

  // Reposition on scroll/resize
  const reposition = () => position();
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    analyzeImage(img);
    removeButton();
  });

  // When mouse enters button, cancel pending hide
  btn.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
  });

  // When mouse leaves button, schedule hide
  btn.addEventListener('mouseleave', () => {
    scheduleHide();
  });

  activeButton = btn;
  activeImg = img;
  btn._reposition = reposition;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    // Only hide if mouse is not on button AND not on image
    if (activeButton && !activeButton.matches(':hover') && activeImg && !activeImg.matches(':hover')) {
      removeButton();
    }
  }, 400);
}

function removeButton() {
  clearTimeout(hideTimer);
  if (activeButton) {
    if (activeButton._reposition) {
      window.removeEventListener('scroll', activeButton._reposition);
      window.removeEventListener('resize', activeButton._reposition);
    }
    activeButton.remove();
    activeButton = null;
    activeImg = null;
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
function analyzeImage(img) {
  const imageUrl = getImageUrl(img);

  // Open sidebar first, then trigger analysis
  chrome.runtime.sendMessage({ action: 'openSidebar' });
  chrome.runtime.sendMessage({ action: 'analyzeImage', imageUrl: imageUrl });
}

// Add hover listeners to images
function setupImageListeners() {
  const images = document.querySelectorAll('img');

  images.forEach(img => {
    if (img.dataset.revPromptInitialized) return;
    img.dataset.revPromptInitialized = 'true';

    img.addEventListener('mouseenter', () => {
      if (img.naturalWidth < 50 || img.naturalHeight < 50) return;
      showButton(img);
    });

    img.addEventListener('mouseleave', () => {
      scheduleHide();
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
