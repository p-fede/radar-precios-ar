// GET /api/compare?ean=7790070418098  → precio de ese producto (por código de barras) en todas las tiendas que permiten buscar por EAN
import { DIRECTORY } from "../lib/stores.js";
import { queryStore, runPool } from "../lib/adapters.js";
import { latestByEan, savePrices } from "../lib/db.js";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const ean = String(req.query.ean || "").replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(ean)) return res.status(400).json({ error: "EAN inválido" });

  const pool = DIRECTORY.filter(s => s.platform === "vtex" || s.platform === "coto");
  const results = await runPool(pool, s => queryStore(s, "", 5, { ean }), 16, 12000);

  const ofertas = [];
  for (const r of results) for (const it of r.items || []) {
    if (it.ean && it.ean !== ean.replace(/^0+(?=\d{8})/, "")) continue; // Coto busca por texto: descartamos coincidencias que no son el mismo EAN
    ofertas.push({ tienda: it.tienda, tiendaId: it.tiendaId, nombre: it.nombre, precio: it.precio, precioLista: it.precioLista, url: it.url, fuente: "en vivo" });
  }
  await savePrices(results.flatMap(r => r.items || []).filter(i => i.ean), 2500);

  // Completa con tiendas que no permiten buscar por EAN pero cuyo precio ya tenemos guardado
  const vivos = new Set(ofertas.map(o => o.tiendaId));
  for (const r of await latestByEan([ean])) {
    if (vivos.has(r.tienda_id)) continue;
    const s = DIRECTORY.find(d => d.id === r.tienda_id);
    ofertas.push({ tienda: s?.name || r.tienda_id, tiendaId: r.tienda_id, nombre: r.nombre, precio: Number(r.precio), precioLista: null, url: r.url, fuente: `guardado ${r.fecha}` });
  }

  ofertas.sort((a, b) => a.precio - b.precio);
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  return res.status(200).json({ ean, tiendasConsultadas: pool.length, ofertas });
}
