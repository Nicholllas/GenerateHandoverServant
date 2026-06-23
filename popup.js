const API_URL =
  "https://servant-tms.ilcs.co.id/api/servicenow/incidents?page=1&limit=300&state=2,-5&assignmentGroup=4f50ec894762c290415f7569116d4341";

const btnFetch = document.getElementById("btnFetch");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const output = document.getElementById("output");
const statusDiv = document.getElementById("status");

function setStatus(message, isWarning = false) {
  statusDiv.textContent = `Status: ${message}`;
  statusDiv.className = isWarning ? "status warning" : "status";
}

function cleanText(value) {
  if (!value || typeof value !== "string") return "";

  return value.replace(/\s+/g, " ").trim();
}

function truncateTitle(title, maxLength = 50) {
  if (!title || typeof title !== "string") return "";

  const cleaned = cleanText(title);

  if (cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength) + "...";
  }

  return cleaned;
}

function formatTicketNumber(ticketNumber) {
  if (!ticketNumber || typeof ticketNumber !== "string") return "";
  return `[${ticketNumber}]`;
}

function formatServiceOffering(serviceOffering) {
  if (!serviceOffering || typeof serviceOffering !== "string") {
    return "Unknown";
  }

  if (serviceOffering.includes("IBS")) {
    return "IBS";
  }

  return serviceOffering;
}

function getIndonesianDate() {
  const now = new Date();

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
}

function buildHandoverText(tickets) {
  const now = new Date();
  const currentHour = now.getHours();

  let greeting;
  let shiftMessage;

  if (currentHour < 12) {
    greeting = "Selamat Pagi, rekan-rekan semua";
    shiftMessage = "Handover ke shift Pagi";
  } else {
    greeting = "Selamat Malam, rekan-rekan semua";
    shiftMessage = "Handover ke shift Malam";
  }

  const grouped = {};

  tickets.forEach((item) => {
    const ticketNumber = item?.number?.display_value || "";
    const serviceOfferingRaw =
      item?.service_offering?.display_value || "Unknown";
    const titleRaw = item?.short_description?.display_value || "";
    const statusRaw = item?.state?.display_value || "";

    const serviceOffering = formatServiceOffering(serviceOfferingRaw);

    if (!grouped[serviceOffering]) {
      grouped[serviceOffering] = [];
    }

    grouped[serviceOffering].push({
      ticketNumber: formatTicketNumber(ticketNumber),
      title: truncateTitle(titleRaw),
      status: statusRaw,
    });
  });

  const lines = [];

  lines.push(greeting);
  lines.push("Izin handover tiket");
  lines.push(shiftMessage);
  lines.push(getIndonesianDate());
  lines.push("");
  lines.push("Nicho, Edo, Abyan, James");
  lines.push("");
  lines.push("======== HANDOVER CASE ========");
  lines.push("");

  Object.keys(grouped).forEach((serviceOffering) => {
    lines.push(serviceOffering);

    grouped[serviceOffering].forEach((ticket) => {
      lines.push(`${ticket.ticketNumber} ${ticket.title} (${ticket.status})`);
    });

    lines.push("");
  });

  lines.push("CC:");

  return lines.join("\n");
}

async function getStoredHeaders() {
  const storage = await chrome.storage.local.get([
    "authorization",
    "xApiKey",
    "lastCapturedAt",
  ]);

  return {
    authorization: storage.authorization || "",
    xApiKey: storage.xApiKey || "",
    lastCapturedAt: storage.lastCapturedAt || "",
  };
}

async function fetchTickets() {
  try {
    setStatus("mengambil header tersimpan...");

    const { authorization, xApiKey, lastCapturedAt } = await getStoredHeaders();

    if (!authorization || !xApiKey) {
      setStatus(
        "Authorization / x-api-key belum ketangkap. Buka SERVANT dulu, refresh halaman tiket, lalu coba lagi.",
        true,
      );
      return;
    }

    setStatus(
      lastCapturedAt
        ? `header ditemukan, terakhir capture ${new Date(lastCapturedAt).toLocaleString("id-ID")}`
        : "header ditemukan",
    );

    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "x-api-key": xApiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.data || !Array.isArray(result.data)) {
      output.value = JSON.stringify(result, null, 2);
      setStatus("data tidak ditemukan atau format response tidak sesuai", true);
      return;
    }

    const handoverText = buildHandoverText(result.data);

    output.value = handoverText;

    setStatus(`berhasil tarik ${result.data.length} tiket`);
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  }
}

async function copyOutput() {
  if (!output.value.trim()) {
    setStatus("belum ada data untuk dicopy", true);
    return;
  }

  await navigator.clipboard.writeText(output.value);
  setStatus("hasil berhasil dicopy ke clipboard");
}

function downloadOutput() {
  if (!output.value.trim()) {
    setStatus("belum ada data untuk didownload", true);
    return;
  }

  const now = new Date();

  const pad = (number) => String(number).padStart(2, "0");

  const filename = `HandOverCase_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;

  const blob = new Blob([output.value], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);

  setStatus(`file berhasil didownload: ${filename}`);
}

btnFetch.addEventListener("click", fetchTickets);
btnCopy.addEventListener("click", copyOutput);
btnDownload.addEventListener("click", downloadOutput);
