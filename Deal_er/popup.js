// popup.js
//
// RULE: popup.js should only handle UI.
// It asks background.js for deals and renders them.

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const refreshBtn = document.getElementById("refresh");

// Filters
const maxPriceInput = document.getElementById("maxPrice");


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
            <span>${escapeHtml(d.normalPrice)} → ${escapeHtml(d.salePrice)}</span>
        </div>
    `;

    listEl.appendChild(li);
  }
}

// Request deals from background.js
function requestDeals(messageType) {
    statusEl.textContent = "Loading...";

    const maxPrice = maxPriceInput.value;

    chrome.runtime.sendMessage(
        { 
            type: messageType,
            maxPrice: maxPrice
        },
        (resp) => 
        {
            if (!resp || !resp.ok) {
            statusEl.textContent = `Error: ${resp?.error || "unknown"}`;
            return;
            }

            statusEl.textContent = `Showing ${resp.deals.length} deals`;
            renderDeals(resp.deals);
        }
    );
}

// Initial load when popup opens
requestDeals("GET_DEALS");

// Manual refresh button
refreshBtn.addEventListener("click", () => requestDeals("REFRESH_DEALS"));
