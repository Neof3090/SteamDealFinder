// popup.js
//
// RULE: popup.js should only handle UI.
// It asks background.js for deals and renders them.

const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refresh");

// Filters
const maxPriceInput = document.getElementById("maxPrice");
const currencyInput = document.getElementById("currency");
const maxDealsInput = document.getElementById("maxDeals");

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

function convertCurrency(value) {
    switch(currencyInput.value) {
        case "USD": return value;           // Assume API returns USD
        case "SEK": value = value * 9.30;    // Rough conversion rate (changing daily)
    }

    return value.toFixed(2);
}

// Render list of deals into the popup.
function renderDeals(deals) {
  listEl.innerHTML = "";

  for (const d of deals) {
    const li = document.createElement("li");
    li.className = "item";

    const normalPrice = escapeHtml(convertCurrency(d.normalPrice) + " " + currencyInput.value);
    const salePrice = escapeHtml(convertCurrency(d.salePrice) + " " + currencyInput.value);

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

function scoreDeals(deals, weights) {
  // Compute ranges from the returned dataset (dynamic, simple)
  const prices = deals.map(d => Number(d.salePrice)).filter(Number.isFinite);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  return deals.map(d => {
    const savings = Number(d.savings);            
    const dealRating = Number(d.dealRating);      
    const meta = Number(d.metacriticScore);       // (may be missing)
    const price = Number(d.salePrice);

    const S = norm(savings, 0, 100);
    const R = norm(dealRating, 0, 10);
    const M = norm(meta, 0, 100);

    // Lower price = better => invert normalized price
    const P = 1 - norm(price, minP, maxP);

    // Handle missing values: if meta/dealRating missing, they contribute 0
    const score =
      weights.savings * S +
      weights.rating  * R +
      weights.meta    * M +
      weights.price   * P;

    return { ...d, _score: score };
  });
}

const WEIGHTS = { savings: 0.35, rating: 0.25, meta: 0.10, price: 0.30 }; // (must add up to 1.0)

// Request deals from background.js
function requestDeals(messageType) {
    statusEl.textContent = "Loading...";

    const maxPrice = maxPriceInput.value;
    const maxDeals = maxDealsInput.value;

    chrome.runtime.sendMessage(
        { 
            type: messageType,
            maxPrice: maxPrice,
            maxDeals: maxDeals
        },
        (resp) => 
        {
            if (!resp || !resp.ok) {
            statusEl.textContent = `Error: ${resp?.error || "unknown"}`;
            return;
            }

            statusEl.textContent = `Showing ${resp.deals.length} deals`;

            let deals = scoreDeals(resp.deals, WEIGHTS);
            deals.sort((a, b) => b._score - a._score);
            renderDeals(deals);
        }
    );
}

// Initial load when popup opens
requestDeals("GET_DEALS");

// Manual refresh button
refreshBtn.addEventListener("click", () => requestDeals("REFRESH_DEALS"));

// Input filters change
currencyInput.addEventListener("change", () => {
    requestDeals("GET_DEALS");
});