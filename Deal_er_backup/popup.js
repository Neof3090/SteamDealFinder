// popup.js
//
// RULE: popup.js should only handle UI.
// It asks background.js for deals and renders them.

const listEl = document.getElementById("dealList");
const statusEl = document.getElementById("status");

const searchBtn = document.getElementById("search");

// Filters
const maxPriceInput = document.getElementById("maxPrice");
const maxDealsInput = document.getElementById("maxDeals");
const sortByInput = document.getElementById("sortBy");

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

    const normalPrice = escapeHtml(d.normalPrice + " USD");
    const salePrice = escapeHtml(d.salePrice + " USD");

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
            <span>${escapeHtml(normalPrice)} → ${escapeHtml(salePrice)}</span>
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
requestDeals();

// Buttons
searchBtn.addEventListener("click", () => requestDeals());

// Input filters change
maxPriceInput.addEventListener("input", () => {
  const val = maxPriceInput.value;
  document.getElementById("maxPriceValue").textContent = val;
});
maxDealsInput.addEventListener("input", () => {
  const val = maxDealsInput.value;
  document.getElementById("maxDealsValue").textContent = val;
});