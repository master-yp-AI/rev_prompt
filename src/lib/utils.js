// Utility functions

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        const mimeType = blob.type || 'image/jpeg';
        resolve({ base64, mimeType });
      };
      reader.onerror = () => reject(new Error('FileReader failed to read the blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    // If direct fetch fails, try using canvas as fallback
    return convertImageToBase64ViaCanvas(imageUrl);
  }
}

// Convert image to base64 via canvas (fallback)
function convertImageToBase64ViaCanvas(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      } catch (error) {
        reject(new Error(`Canvas conversion failed: ${error.message}`));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image via canvas: ${imageUrl}`));
    img.src = imageUrl;
  });
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// Format JSON for display
function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

// Truncate string
function truncateString(str, maxLength = 100) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
