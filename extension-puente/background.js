// Service worker: consulta las tiendas bloqueadas usando la conexión de tu navegador.
// Usa los mismos lectores que la API (copia en ./adapters.js; regenerala con `npm run puente` si cambian).
import { ADAPTERS, AUTO_ORDER, StoreError } from "./adapters.js";

const RADAR_ORIGIN = "https://radar-precios-ar.vercel.app";
const PERMITIDOS = new Set(chrome.runtime.getManifest().host_permissions.map(p => new URL(p.replace("/*", "/")).hostname));
const ORDEN = [...AUTO_ORDER, "sfcc", "magento", "tiendanube", "prestashop"];
const plataformaDetectada = new Map(); // id → plataforma que funcionó

async function consultar(store, q) {
  const host = new URL(store.url).hostname;
  if (!PERMITIDOS.has(host)) return [];
  const conocida = plataformaDetectada.get(store.id);
  for (const plat of conocida ? [conocida] : ORDEN) {
    try {
      const items = await ADAPTERS[plat]({ ...store, platform: plat }, q, 12);
      plataformaDetectada.set(store.id, plat);
      return items;
    } catch (e) {
      if (!(e instanceof StoreError) || /timeout|sin conexión/.test(e.message)) break;
    }
  }
  return [];
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "search" || !sender.url?.startsWith(RADAR_ORIGIN)) return false;
  const stores = (msg.stores || [])
    .filter(s => s && typeof s.id === "string" && typeof s.url === "string" && typeof s.name === "string")
    .slice(0, 20);
  Promise.allSettled(stores.map(s => consultar(s, msg.q || "")))
    .then(rs => sendResponse({ items: rs.flatMap(r => (r.status === "fulfilled" ? r.value : [])) }));
  return true; // respuesta asíncrona
});
