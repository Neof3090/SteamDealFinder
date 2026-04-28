// background.js (Manifest V3 service worker)
//
// RULE: background.js does the network work.
// popup.js should NOT fetch directly; it should ask background.js.
// This keeps things stable and debuggable.

const API_BASE_URL = "https://www.cheapshark.com/api/1.0/deals";

// Simple cache so opening the popup 10 times doesn't spam the API.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedDeals = null;
let cachedAt = 0;

// Remember last used filters for caching.
let lastMaxPrice = null;
let lastMaxDeals = null;
let lastSortBy = null;

function buildApiUrl(maxPrice, maxDeals, sortBy){
    const url = new URL(API_BASE_URL);

    // Fundamentals
    url.searchParams.set("storeID", "1");       // Steam search
    url.searchParams.set("steamworks", "1");    // Redeemable on steam
    url.searchParams.set("onSale", "1");        // Is on sale
    // Optionals
    //url.searchParams.set("desc", "1");          // With description
    
    // Only add user params if the user entered one
    if (maxPrice !== undefined && maxPrice !== "") {
        url.searchParams.set("upperPrice", maxPrice);
    }
    if (maxDeals !== undefined && maxDeals !== "") {
        url.searchParams.set("pageSize", maxDeals);
    }else{
        url.searchParams.set("pageSize", "10");
    }
    if (sortBy !== undefined && sortBy !== "") {
        url.searchParams.set("sortBy", sortBy);
    }

    console.log("Built API URL:", url.toString());

    return url.toString();
}

async function fetchDeals(maxPrice, maxDeals, sortBy) {
    // Check if we can use the cache.
    if (
        maxPrice === lastMaxPrice &&
        maxDeals === lastMaxDeals &&
        sortBy === lastSortBy
    ) {
        // If cache is still "fresh", return it.
        const age = Date.now() - cachedAt;
        if (cachedDeals && age < CACHE_TTL_MS) {
            return cachedDeals;
        }
    }
    
    // Update last used filters.
    lastMaxPrice = maxPrice;
    lastMaxDeals = maxDeals;
    lastSortBy = sortBy;

    // Otherwise, build url and fetch from the API.
    const apiUrl = buildApiUrl(maxPrice, maxDeals, sortBy);
    const res = await fetch(apiUrl);

    // If HTTP fails (429, 500, etc.) throw an error that popup can show.
    if (!res.ok) {
        throw new Error(`CheapShark HTTP ${res.status}`);
    }

    // Defensive check: expected array.
    const data = await res.json();
    if (!Array.isArray(data)) {
        throw new Error("CheapShark returned unexpected data");
    }

    // Update cache.
    cachedDeals = data;
    cachedAt = Date.now();

    console.log("fetchDeals: fetched", data.length, "deals");
    return data;
}

// Communication channel popup.js -> background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    
    // Popup asks: "give me deals"
    if (msg?.type === "GET_DEALS") {
        fetchDeals(msg.maxPrice, msg.maxDeals, msg.sortBy)
        .then((deals) => sendResponse({ ok: true, deals }))
        .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));

        // IMPORTANT in MV3:
        // Returning true tells Chrome/Opera: "I will respond async"
        return true;
    }
    // Popup asks: "force refresh (ignore cache)"
    else if (msg?.type === "REFRESH_DEALS") {
        cachedDeals = null;
        cachedAt = 0;

        fetchDeals(msg.maxPrice, msg.maxDeals, msg.sortBy)
        .then((deals) => sendResponse({ ok: true, deals }))
        .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));

        return true;
    }
});