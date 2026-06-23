const TARGET_HOST = "https://servant-tms.ilcs.co.id/*";

chrome.webRequest.onBeforeSendHeaders.addListener(
  async function (details) {
    const headers = details.requestHeaders || [];

    const authorizationHeader = headers.find(
      (h) => h.name.toLowerCase() === "authorization",
    );

    const apiKeyHeader = headers.find(
      (h) => h.name.toLowerCase() === "x-api-key",
    );

    if (authorizationHeader?.value || apiKeyHeader?.value) {
      const current = await chrome.storage.local.get([
        "authorization",
        "xApiKey",
      ]);

      await chrome.storage.local.set({
        authorization:
          authorizationHeader?.value || current.authorization || "",
        xApiKey: apiKeyHeader?.value || current.xApiKey || "",
        lastCapturedAt: new Date().toISOString(),
      });

      console.log("Header SERVANT berhasil dicapture");
    }
  },
  {
    urls: [TARGET_HOST],
  },
  ["requestHeaders", "extraHeaders"],
);
