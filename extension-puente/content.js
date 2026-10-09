// Corre dentro de radar-precios-ar.vercel.app y hace de mensajero entre la página y el service worker.
window.addEventListener("message", (ev) => {
  if (ev.source !== window || ev.origin !== location.origin) return;
  const msg = ev.data;
  if (!msg || msg.source !== "radar-web") return;

  if (msg.type === "ping") {
    window.postMessage({ source: "radar-ext", type: "pong", version: chrome.runtime.getManifest().version }, location.origin);
    return;
  }
  if (msg.type === "search" && typeof msg.reqId === "string" && Array.isArray(msg.stores)) {
    chrome.runtime.sendMessage({ type: "search", q: String(msg.q || "").slice(0, 80), stores: msg.stores }, (resp) => {
      const items = chrome.runtime.lastError ? [] : (resp?.items || []);
      window.postMessage({ source: "radar-ext", type: "results", reqId: msg.reqId, items }, location.origin);
    });
  }
});
