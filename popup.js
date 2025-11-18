// Konfigurasi - Bearer Token
const API_URL =
  "https://servant-be.ilcs.co.id/ticket/service_now/incident/list?page=1&perPage=100&status=openteam";
const BEARER_TOKEN = "Bearer ZgZcYt8LHmjmDC1QKLN4wbwoTN8NAtVa";

const captureTokenBtn = document.getElementById("captureToken");
const generateHandoverBtn = document.getElementById("generateHandover");
const manualFetchBtn = document.getElementById("manualFetch");
const manualSection = document.getElementById("manualSection");
const tokenInfo = document.getElementById("tokenInfo");
const tokenPreview = document.getElementById("tokenPreview");
const authTokenInput = document.getElementById("authToken");
const saveTokenBtn = document.getElementById("saveToken");
const copyResultBtn = document.getElementById("copyResult");
const downloadFileBtn = document.getElementById("downloadFile");
const statusDiv = document.getElementById("status");
const resultTextarea = document.getElementById("result");

let currentAuthToken = null;

captureTokenBtn.addEventListener("click", captureTokenFromNetwork);
generateHandoverBtn.addEventListener("click", generateHandover);
manualFetchBtn.addEventListener("click", toggleManualInput);
saveTokenBtn.addEventListener("click", saveToken);
copyResultBtn.addEventListener("click", copyToClipboard);
downloadFileBtn.addEventListener("click", downloadFile);

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  // Cek jika ada token yang sudah tersimpan
  const savedToken = await loadSavedToken();
  if (savedToken) {
    currentAuthToken = savedToken;
    showTokenInfo(savedToken);
  }

  // Cek jika background script sudah capture token
  checkCapturedToken();
}

async function loadSavedToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken) {
        authTokenInput.value = result.authToken;
        resolve(result.authToken);
      } else {
        resolve(null);
      }
    });
  });
}

async function checkCapturedToken() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getCapturedToken",
    });

    if (response.token) {
      currentAuthToken = response.token;
      showTokenInfo(response.token);
      showStatus("Token berhasil diambil dari network!", "success");
    }
  } catch (error) {
    console.log("No token captured yet");
  }
}

async function captureTokenFromNetwork() {
  showStatus(
    "Memantau network requests... Pastikan Anda sudah membuka Developer Tools (F12) dan tab Network",
    "loading"
  );

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("ilcs.co.id")) {
      showStatus("Error: Buka halaman SERVANT terlebih dahulu!", "error");
      return;
    }

    // Execute script untuk memantau network requests dari halaman
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: monitorNetworkRequests,
    });

    showStatus(
      "Sedang memantau requests... Lakukan aksi di halaman SERVANT (refresh, klik menu, dll)",
      "loading"
    );

    // Tunggu beberapa saat untuk capture token
    setTimeout(async () => {
      await checkCapturedToken();
    }, 3000);
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  }
}

// Function untuk di-execute di context halaman
function monitorNetworkRequests() {
  console.log("Memantau network requests...");

  // Override fetch untuk menangkap headers
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    return originalFetch.apply(this, args).then((response) => {
      if (args[0] && args[0].includes("servant-be.ilcs.co.id")) {
        console.log("Intercepted fetch request to ILCS API");

        // Cek headers yang dikirim
        if (args[1] && args[1].headers) {
          const authToken =
            args[1].headers.get("Auth-Token") ||
            args[1].headers.get("auth-token");
          if (authToken) {
            console.log("Captured Auth-Token from fetch:", authToken);
            // Simpan ke localStorage agar bisa diambil oleh extension
            localStorage.setItem("captured_auth_token", authToken);
          }
        }
      }
      return response;
    });
  };

  // Override XMLHttpRequest untuk menangkap headers
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  const requestHeaders = {};

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    if (this._url && this._url.includes("servant-be.ilcs.co.id")) {
      requestHeaders[header] = value;
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  // Listen untuk ketika request selesai
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", function () {
      if (this._url && this._url.includes("servant-be.ilcs.co.id")) {
        const authToken =
          requestHeaders["Auth-Token"] || requestHeaders["auth-token"];
        if (authToken) {
          console.log("Captured Auth-Token from XHR:", authToken);
          localStorage.setItem("captured_auth_token", authToken);
        }
      }
    });
    return originalSend.apply(this, arguments);
  };

  return "Network monitoring activated";
}

function showTokenInfo(token) {
  tokenPreview.textContent = `${token.substring(0, 30)}...`;
  tokenInfo.style.display = "block";
  generateHandoverBtn.disabled = false;
}

function toggleManualInput() {
  manualSection.style.display =
    manualSection.style.display === "none" ? "block" : "none";
}

async function generateHandover() {
  if (!currentAuthToken) {
    showStatus(
      "Tidak ada token yang tersedia. Capture token terlebih dahulu!",
      "error"
    );
    return;
  }

  await fetchDataWithToken(currentAuthToken);
}

async function saveToken() {
  const authToken = authTokenInput.value.trim();

  if (!authToken) {
    showStatus("Harap isi auth token!", "error");
    return;
  }

  currentAuthToken = authToken;
  await saveTokenToStorage(authToken);
  showTokenInfo(authToken);
}

async function saveTokenToStorage(authToken) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        authToken: authToken,
      },
      () => {
        showStatus("Auth Token berhasil disimpan!", "success");
        resolve();
      }
    );
  });
}

async function fetchDataWithToken(authToken) {
  showStatus("Mengambil data dari API...", "loading");

  try {
    const headers = {
      Authorization: BEARER_TOKEN,
      "Auth-Token": authToken,
      "Content-Type": "application/json",
    };

    const response = await fetch(API_URL, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Auth Token tidak valid atau sudah expired");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    processData(data);
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error("Fetch error:", error);
  }
}

function processData(data) {
  try {
    if (
      !data.message ||
      !data.message.data ||
      !Array.isArray(data.message.data)
    ) {
      throw new Error("Format data tidak sesuai");
    }

    const tickets = data.message.data;

    // Process tickets
    const processedTickets = tickets.map((ticket) => ({
      ticket_number: `[${ticket.ticket_number}]`,
      service_offering: ticket.service_offering?.includes("IBS")
        ? "IBS"
        : ticket.service_offering,
      title:
        ticket.title?.length > 50
          ? ticket.title.substring(0, 50) + "..."
          : ticket.title,
      status: ticket.status,
    }));

    // Group by service_offering
    const grouped = {};
    processedTickets.forEach((ticket) => {
      const service = ticket.service_offering || "Unknown";
      if (!grouped[service]) {
        grouped[service] = [];
      }
      grouped[service].push(ticket);
    });

    // Generate output
    const output = generateOutput(grouped);
    resultTextarea.value = output;

    showStatus(
      `Data berhasil diambil! ${tickets.length} tiket ditemukan.`,
      "success"
    );
  } catch (error) {
    showStatus(`Error processing data: ${error.message}`, "error");
  }
}

function generateOutput(groupedTickets) {
  const now = new Date();
  const currentHour = now.getHours();

  // Determine greeting and shift
  const greeting =
    currentHour < 12
      ? "Selamat Pagi, rekan-rekan semua"
      : "Selamat Malam, rekan-rekan semua";
  const shiftMessage =
    currentHour < 12 ? "Handover ke shift Pagi" : "Handover ke shift Malam";

  // Format date in Indonesian style
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const dayName = days[now.getDay()];
  const date = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();

  const currentDate = `${dayName}, ${date} ${monthName} ${year}`;

  const outputLines = [
    greeting,
    "Izin handover tiket",
    shiftMessage,
    currentDate,
    "",
    "Nicho, Edo, Abyan",
    "",
    "======== HANDOVER CASE ========",
    "",
  ];

  // Add tickets grouped by service offering
  Object.keys(groupedTickets)
    .sort()
    .forEach((service) => {
      outputLines.push(service);
      groupedTickets[service].forEach((ticket) => {
        outputLines.push(
          `${ticket.ticket_number} ${ticket.title} (${ticket.status})`
        );
      });
      outputLines.push("");
    });

  outputLines.push("CC:");

  return outputLines.join("\n");
}

async function copyToClipboard() {
  if (!resultTextarea.value) {
    showStatus("Tidak ada data untuk disalin!", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(resultTextarea.value);
    showStatus("Data berhasil disalin ke clipboard!", "success");
  } catch (error) {
    showStatus("Gagal menyalin data: " + error.message, "error");
  }
}

function downloadFile() {
  if (!resultTextarea.value) {
    showStatus("Tidak ada data untuk didownload!", "error");
    return;
  }

  const now = new Date();
  const filename = `HandOverCase_${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.txt`;

  const blob = new Blob([resultTextarea.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus("File berhasil didownload!", "success");
}

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  if (type !== "loading") {
    setTimeout(() => {
      statusDiv.textContent = "";
      statusDiv.className = "status";
    }, 5000);
  }
}
