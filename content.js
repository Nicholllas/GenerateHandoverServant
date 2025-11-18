(() => {
  const token =
    localStorage.getItem("authToken") ||
    localStorage.getItem("Auth-Token") ||
    sessionStorage.getItem("authToken") ||
    null;

  if (token) {
    chrome.runtime.sendMessage({ type: "SET_TOKEN", token });
    console.log(
      "🔐 Auth token dikirim ke background:",
      token.substring(0, 20) + "..."
    );
  } else {
    console.log("⚠️ Tidak menemukan Auth-Token di localStorage.");
  }
})();
