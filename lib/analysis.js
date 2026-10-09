// Análisis de ofertas: se compara cada producto contra el PRECIO DE MERCADO (lo que cobran otras tiendas por el
// mismo código de barras), no contra el precio tachado de la tienda, que muchas veces está inflado o roto.
import { priceStats, latestByEan, productKey } from "./db.js";
import { DIRECTORY, BY_ID } from "./stores.js";
import { queryStore, runPool } from "./adapters.js";

const fmt = (n) => Math.round(n).toLocaleString("es-AR");
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const VTEX = DIRECTORY.filter(s => s.platform === "vtex");
const MAX_EANS = 75;

// Busca los EAN en todas las tiendas VTEX (un pedido por tienda con todos los EAN) y en Coto.
async function precioDeMercado(items, budgetMs) {
  // Repartimos los EAN entre todas las tiendas (ronda por tienda, los de mayor descuento primero),
  // para que una sola tienda no se lleve toda la comparación.
  const porTienda = new Map();
  for (const it of [...items].filter(i => i.ean).sort((a, b) => (b.descuento - a.descuento) || (b.ahorro - a.ahorro))) {
    if (!porTienda.has(it.tiendaId)) porTienda.set(it.tiendaId, []);
    porTienda.get(it.tiendaId).push(it.ean);
  }
  const eans = [];
  const colas = [...porTienda.values()];
  for (let i = 0; eans.length < MAX_EANS && colas.some(c => c.length); i = (i + 1) % colas.length) {
    const e = colas[i].shift();
    if (e && !eans.includes(e)) eans.push(e);
  }
  const mapa = new Map(); // ean → Map(tiendaId → oferta)
  if (!eans.length) return mapa;

  const add = (it) => {
    if (!it?.ean || !eans.includes(it.ean)) return;
    if (!mapa.has(it.ean)) mapa.set(it.ean, new Map());
    const m = mapa.get(it.ean);
    const prev = m.get(it.tiendaId);
    if (!prev || it.precio < prev.precio) m.set(it.tiendaId, { tiendaId: it.tiendaId, tienda: it.tienda, precio: it.precio, url: it.url });
  };

  const tandas = [];
  for (let i = 0; i < eans.length; i += 25) tandas.push(eans.slice(i, i + 25));
  const tareas = [
    ...VTEX.flatMap(s => tandas.map(t => ({ store: s, opts: { eans: t } }))),
    ...eans.slice(0, 12).map(e => ({ store: BY_ID.get("coto"), opts: { ean: e } }))
  ];
  const res = await runPool(tareas, t => queryStore(t.store, "", 50, t.opts), 32, budgetMs);
  for (const r of res) for (const it of r.items || []) add(it);
  for (const it of items) add(it);
  for (const r of await latestByEan(eans)) {
    add({ ean: r.ean, tiendaId: r.tienda_id, tienda: BY_ID.get(r.tienda_id)?.name || r.tienda_id, precio: Number(r.precio), url: r.url });
  }
  return mapa;
}

export async function annotate(items, { budgetMs = 7000 } = {}) {
  if (!items.length) return items;
  const [mercado, stats] = await Promise.all([
    precioDeMercado(items, budgetMs),
    priceStats(items.map(productKey))
  ]);

  for (const it of items) {
    // ---- 1) Mercado (otras tiendas, mismo código de barras) ----
    const otros = it.ean ? [...(mercado.get(it.ean)?.values() || [])].filter(o => o.tiendaId !== it.tiendaId) : [];
    if (otros.length) {
      const ref = median(otros.map(o => o.precio));
      const min = otros.reduce((a, b) => (b.precio < a.precio ? b : a));
      const bajoMercado = Math.round((1 - it.precio / ref) * 100); // % por debajo de la mediana de otras tiendas
      it.mercado = { referencia: Math.round(ref), tiendas: otros.length, bajoMercado, minimo: { tienda: min.tienda, precio: min.precio, url: min.url } };

      if (min.precio < it.precio * 0.99) {
        it.comparacion = { tipo: "masBarato", tienda: min.tienda, precio: min.precio, url: min.url, diferencia: Math.round(it.precio - min.precio) };
      } else {
        it.comparacion = { tipo: "mejorPrecio", tiendasComparadas: otros.length };
      }

      if (bajoMercado >= 40) {
        it.isBug = true;
        it.veredicto = { tipo: "bug", texto: `${bajoMercado}% debajo del precio de mercado ($${fmt(ref)} en ${otros.length} tienda${otros.length > 1 ? "s" : ""})` };
      } else if (bajoMercado >= 8 && it.comparacion.tipo === "mejorPrecio") {
        it.veredicto = { tipo: "real", texto: `El más barato: ${bajoMercado}% menos que el resto ($${fmt(ref)} prom.)` };
      } else if (it.descuento >= 10 && bajoMercado <= 2) {
        it.veredicto = { tipo: "inflado", texto: `El descuento es de cartel: otras tiendas lo venden a ~$${fmt(ref)}` };
      } else {
        it.veredicto = { tipo: "normal", texto: `Precio de mercado: ~$${fmt(ref)} (${otros.length} tienda${otros.length > 1 ? "s" : ""})` };
      }
    }

    // ---- 2) Historial propio (si hay Supabase con datos) ----
    const st = stats.get(productKey(it));
    if (st && st.dias_con_datos >= 5) {
      const minH = Number(st.min_precio), prom = Number(st.prom_precio);
      it.historial = it.precio < minH * 0.98
        ? { tipo: "minimo", texto: `Precio más bajo en ${st.dias_con_datos} días` }
        : it.precio >= prom * 0.97 && it.descuento >= 10
          ? { tipo: "habitual", texto: `Cuesta lo de siempre (prom. $${fmt(prom)})` }
          : { tipo: "normal", texto: `Prom. ${st.dias_con_datos} días: $${fmt(prom)}` };
      if (!it.veredicto && it.historial.tipo === "habitual") it.veredicto = { tipo: "inflado", texto: it.historial.texto };
      if (!it.veredicto && it.historial.tipo === "minimo") it.veredicto = { tipo: "real", texto: it.historial.texto };
    }

    // ---- 3) Sin con qué comparar ----
    if (!it.veredicto) {
      it.veredicto = it.posibleBug
        ? { tipo: "sinConfirmar", texto: "Descuento fuerte según la tienda; no encontramos el mismo producto en otras tiendas para confirmarlo" }
        : { tipo: "sinDatos", texto: it.descuento > 0 ? "Descuento según la tienda (sin comparar)" : "" };
    }
  }
  return items;
}
