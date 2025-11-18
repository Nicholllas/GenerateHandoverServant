let capturedAuthToken = null;

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.url.includes("servant-be.ilcs.co.id")) {
      // Cari header Auth-Token
      const authHeader = details.requestHeaders?.find(
        (header) => header.name.toLowerCase() === "auth-token"
      );

      if (authHeader && authHeader.value) {
        capturedAuthToken = authHeader.value;
        console.log("Auth Token captured from network:", capturedAuthToken);

        // Simpan ke storage
        chrome.storage.local.set({ authToken: capturedAuthToken });
      }
    }
  },
  { urls: ["https://servant-be.ilcs.co.id/*"] },
  ["requestHeaders"]
);

// Listen untuk messages dari popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCapturedToken") {
    sendResponse({ token: capturedAuthToken });
  }

  if (request.action === "clearToken") {
    capturedAuthToken = null;
    sendResponse({ success: true });
  }
});
