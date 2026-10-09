// RadarBug — API de búsqueda multi-tienda
// GET /api/search?ids=carrefour,dia&q=tv&minDiscount=20   → busca en esas tiendas
// GET /api/search?store=carrefour | ?rubro=tecnologia      → compatibilidad con la versión anterior
// GET /api/search?mode=health                              → estado de cada tienda (la web lo usa para armar el selector)
// GET /api/search?...&debug=1                              → agrega el motivo de falla de cada tienda
import { DIRECTORY, BY_ID } from "../lib/stores.js";
import { queryStore, runPool } from "../lib/adapters.js";
import { annotate } from "../lib/analysis.js";
import { savePrices, dbEnabled } from "../lib/db.js";

export const config = { maxDuration: 40 };

const GLOBAL_BUDGET = 11000; // búsqueda en tiendas
const MARKET_BUDGET = 8000;  // comparación de mercado
const CONCURRENCY = 14;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { mode, store = "todas", rubro = "todos", ids = "", q = "", minDiscount = "0", debug } = req.query;
  const rawQ = String(q).trim().slice(0, 80);
  const minDisc = Math.max(0, Math.min(100, parseInt(minDiscount, 10) || 0));

  try {
    // ---- Estado de cada tienda ----
    if (mode === "health") {
      const servidor = DIRECTORY.filter(s => s.platform !== "extension");
      const results = await runPool(servidor, s => queryStore(s, "", 3), 20, 22000);
      const stores = results.map(r => ({
        id: r.store.id, name: r.store.name, rubro: r.store.rubro, url: r.store.url,
        ok: !r.error, platform: r.platform || r.store.platform, ms: r.ms ?? null, motivo: r.error || null
      }));
      // Tiendas que bloquean servidores: las informa para que la extensión de Chrome las consulte
      const extension = DIRECTORY.filter(s => s.platform === "extension").map(s => ({ id: s.id, name: s.name, rubro: s.rubro, url: s.url }));
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.status(200).json({
        checkedAt: new Date().toISOString(), total: stores.length, activas: stores.filter(s => s.ok).length,
        historial: dbEnabled, stores, extension
      });
    }

    // ---- Selección de tiendas ----
    let pool;
    if (ids) pool = String(ids).split(",").map(s => BY_ID.get(s.trim())).filter(Boolean);
    else if (store !== "todas") pool = BY_ID.has(store) ? [BY_ID.get(store)] : [];
    else pool = rubro === "todos" ? DIRECTORY : DIRECTORY.filter(d => d.rubro === rubro);
    pool = pool.filter(s => s.platform !== "extension");
    if (!pool.length) return res.status(400).json({ error: "No hay tiendas válidas para consultar." });

    const perStore = pool.length === 1 ? 100 : pool.length <= 6 ? 30 : 15;
    const results = await runPool(pool, s => queryStore(s, rawQ, perStore), CONCURRENCY, GLOBAL_BUDGET);

    let items = [];
    const seen = new Set();
    for (const r of results) {
      let propios = (r.items || []).filter(it => !seen.has(it.url) && seen.add(it.url));
      // Sin búsqueda mostramos ofertas: si la tienda tiene productos con rebaja, priorizamos esos
      if (!rawQ) {
        const conRebaja = propios.filter(it => it.descuento > 0 || it.promo);
        if (conRebaja.length >= 3) propios = conRebaja;
      }
      propios.sort((a, b) => (b.descuento - a.descuento) || (b.ahorro - a.ahorro));
      items.push(...propios.slice(0, perStore));
    }

    // Comparamos contra el precio de mercado y guardamos la foto de precios (alimenta el historial)
    await Promise.all([annotate(items, { budgetMs: MARKET_BUDGET }), savePrices(items, 2500)]);

    if (minDisc > 0) items = items.filter(it => it.descuento >= minDisc || it.isBug || it.veredicto?.tipo === "real");
    const peso = { bug: 5, real: 4, sinConfirmar: 3, normal: 2, sinDatos: 2, inflado: 0 };
    items.sort((a, b) =>
      ((peso[b.veredicto?.tipo] ?? 2) - (peso[a.veredicto?.tipo] ?? 2)) ||
      ((b.mercado?.bajoMercado ?? -99) - (a.mercado?.bajoMercado ?? -99)) ||
      (b.descuento - a.descuento) || (b.ahorro - a.ahorro));

    const fallidas = results.filter(r => r.error);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      totalStores: DIRECTORY.length,
      consultadas: pool.length,
      respondieron: pool.length - fallidas.length,
      historial: dbEnabled,
      fallidas: fallidas.map(r => ({ id: r.store.id, name: r.store.name, ...(debug ? { motivo: r.error } : {}) })),
      results: items.slice(0, 400)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
