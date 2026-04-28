// popup.js
//
// RULE: popup.js should only handle UI.
// It asks background.js for deals and renders them.
const USD_TO_SEK = 9.14;

const settingsEl = document.getElementById("settingPage");
const searchCont = document.getElementById("searchCont");
const listEl = document.getElementById("dealList");
const statusEl = document.getElementById("status");

const settingBtn = document.getElementById("settingBtn");
const searchBtn = document.getElementById("search");
const showCacheBtn = document.getElementById("showCacheBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");

// Filters
const maxPriceInput = document.getElementById("maxPrice");
const maxDealsInput = document.getElementById("maxDeals");
const sortByInput = document.getElementById("sortBy");
const currencyInput = document.getElementById("currency");

function saveElementValue(elementId) {
  const value = document.getElementById(elementId).value.trim();
  chrome.storage.local.set({ [elementId]: value });
}
// Fetches that value
function fetchElementValue(elementId) {
  chrome.storage.local.get(elementId, ({ [elementId]: savedValue }) => {
    if (savedValue) document.getElementById(elementId).value = savedValue;
  });
}
function setInputValue(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function saveFilters() {
  saveElementValue("maxPrice");
  saveElementValue("maxDeals");
  saveElementValue("sortBy");
  saveElementValue("currency");
}

async function loadFilters() {
  const saved = await chrome.storage.local.get(["maxPrice", "maxDeals", "sortBy", "currency"]);
  
  if (saved.currency)  setInputValue(currencyInput, saved.currency);
  if (saved.maxPrice)  setInputValue(maxPriceInput, saved.maxPrice);
  if (saved.maxDeals)  setInputValue(maxDealsInput, saved.maxDeals);
  if (saved.sortBy)    sortByInput.value = saved.sortBy;
}

function dumpCacheInLog() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    alert("Not running inside the extension!");
    return;
  }
  chrome.storage.local.get(null, (result) => {
    alert(JSON.stringify(result, null, 2));
  });
}

// Simple HTML escaping to prevent XSS.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

// Render list of deals into the popup.
function renderDeals(deals) {
  listEl.innerHTML = "";

  for (const d of deals) {
    const li = document.createElement("li");
    li.className = "item";

    const currency = currencyInput.value;
    const isSEK = currency === "SEK";

    const normalPrice = isSEK ? (d.normalPrice * USD_TO_SEK).toFixed(2) : Number(d.normalPrice).toFixed(2);
    const salePrice   = isSEK ? (d.salePrice   * USD_TO_SEK).toFixed(2) : Number(d.salePrice).toFixed(2);

    const suffix = isSEK ? "kr" : "$";
    const normalPriceString = `${normalPrice} ${suffix}`;
    const salePriceString   = `${salePrice} ${suffix}`;

    const savings = Number(d.savings || 0).toFixed(0);
    li.innerHTML = `
        <div class="title">
            <a
                href="https://store.steampowered.com/app/${escapeHtml(d.steamAppID)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                ${escapeHtml(d.title || "Untitled")}
            </a>
        </div>
        <div class="meta">
            <span class="badge">${savings}% off</span>
            <span>${escapeHtml(normalPriceString)} → ${escapeHtml(salePriceString)}</span>
        </div>
    `;

    listEl.appendChild(li);
  }
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function norm(x, min, max) {
  if (!isFinite(x) || max <= min) return 0;
  return clamp01((x - min) / (max - min));
}

// Request deals from background.js
async function requestDeals() {
  saveFilters();

  console.log("Requesting deals from background.js");
  
  statusEl.textContent = "Loading...";
  
  const maxPrice = maxPriceInput.value;
  const maxDeals = maxDealsInput.value;
  const sortBy = sortByInput.value;
  
  const msgType = "GET_DEALS";
  
  chrome.runtime.sendMessage(
  { 
    type: msgType,
    maxPrice: maxPrice,
    maxDeals: maxDeals,
    sortBy: sortBy
  },
  (resp) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }

    if (!resp || !resp.ok) {
      statusEl.textContent = `Error: ${resp?.error || "unknown"}`;
      return;
    }

    const numOfDeals = resp.deals.length;

    if (numOfDeals > 0)
      statusEl.textContent = `Showing ${numOfDeals} deals`;
    else
      statusEl.textContent = `No deals matched your filters.`;

    renderDeals(resp.deals);
  });
}

// Initial load when popup opens
async function init() {
  await loadFilters();
  requestDeals();
}

init();

// Buttons
settingBtnInUse = false;
settingBtn.addEventListener("click", () => { 
  if(settingBtnInUse) return;
  settingBtnInUse = true;
  const app = document.getElementById("window");

  // Skips the excess height and jump to what is visible
  app.style.transition = "none";
  app.style.maxHeight = "600px";
  app.style.transition = "max-height 0.8s ease";
  
  // Force reflow (dont know why)
  app.offsetHeight;

  // Collapse to up to header
  app.style.maxHeight = "70px";

  setTimeout(() => {
    settingsEl.classList.toggle("hidden");
    searchCont.classList.toggle("hidden");

    // Expand to fit what is visible
    app.style.maxHeight = "600px";

    // After expanding, remove fixed height so it can resize naturally
    setTimeout(() => {
      app.style.maxHeight = "";
      settingBtnInUse = false;
    }, 799);
  }, 800);

  document.getElementById("settingBtn").disabled = true;
  setTimeout(() => document.getElementById("settingBtn").disabled = false, 800)
  document.getElementById("cogImage").classList.toggle("rotate"); // CSS animation
});
searchBtn.addEventListener("click", () => requestDeals());
showCacheBtn.addEventListener("click", () => dumpCacheInLog());
clearCacheBtn.addEventListener("click", () => { chrome.storage.local.clear(); });

// Input filters change
maxPriceInput.addEventListener("input", () => {
  const val = maxPriceInput.value;
  const isSEK = currencyInput.value === "SEK";
  document.getElementById("maxPriceValue").textContent = isSEK 
    ? (val * (USD_TO_SEK + 0.5)).toFixed(0)  // display in kr
    : val;        // display in $
});
maxDealsInput.addEventListener("input", () => {
  const val = maxDealsInput.value;
  document.getElementById("maxDealsValue").textContent = val;
});

currencyInput.addEventListener("input", () => { 
  const isSEK = currencyInput.value === "SEK";
  document.getElementById("maxPriceCurrency").textContent = isSEK ? "kr" : "$"; 
  maxPriceInput.dispatchEvent(new Event("input")); // Re-trigger the price display update
  saveElementValue("currency"); 
});