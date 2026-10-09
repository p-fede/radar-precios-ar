// Análisis de ofertas: ¿el descuento es real? ¿se consigue más barato en otra tienda?
import { priceStats, latestByEan, productKey } from "./db.js";
import { BY_ID } from "./stores.js";

const DIAS_MINIMOS = 5; // días de historial necesarios para opinar

// veredicto.tipo:
//   "real"     → el precio actual es el más bajo de los últimos 60 días
//   "inflado"  → muestra descuento pero el precio es el de siempre (precio tachado inflado)
//   "normal"   → precio dentro de lo habitual
//   "nuevo"    → todavía no hay historial suficiente
export function verdict(it, st) {
  if (!st || st.dias_con_datos < DIAS_MINIMOS) {
    return { tipo: "nuevo", texto: st ? `Historial en construcción (${st.dias_con_datos} días)` : "Sin historial todavía" };
  }
  const min = Number(st.min_precio), prom = Number(st.prom_precio);
  if (it.precio < min * 0.98) {
    return { tipo: "real", texto: `Precio más bajo en ${st.dias_con_datos} días (antes mín. $${fmt(min)})`, min, prom };
  }
  if (it.descuentoReal >= 15 && it.precio >= prom * 0.97) {
    return { tipo: "inflado", texto: `Descuento de cartel: suele costar ~$${fmt(prom)}`, min, prom };
  }
  return { tipo: "normal", texto: `Precio habitual (prom. $${fmt(prom)}, mín. $${fmt(min)})`, min, prom };
}

const fmt = (n) => Math.round(n).toLocaleString("es-AR");

// Agrega a cada producto: veredicto del historial y comparación con otras tiendas por EAN.
export async function annotate(items) {
  if (!items.length) return items;

  const [stats, dbEan] = await Promise.all([
    priceStats(items.map(productKey)),
    latestByEan([...new Set(items.map(i => i.ean).filter(Boolean))])
  ]);

  // Índice EAN → ofertas por tienda (resultados de esta búsqueda + últimos precios guardados)
  const byEan = new Map();
  const add = (ean, o) => {
    if (!ean) return;
    if (!byEan.has(ean)) byEan.set(ean, new Map());
    const m = byEan.get(ean);
    const prev = m.get(o.tiendaId);
    if (!prev || o.precio < prev.precio) m.set(o.tiendaId, o);
  };
  for (const it of items) add(it.ean, { tiendaId: it.tiendaId, tienda: it.tienda, precio: it.precio, url: it.url });
  for (const r of dbEan) add(r.ean, { tiendaId: r.tienda_id, tienda: BY_ID.get(r.tienda_id)?.name || r.tienda_id, precio: Number(r.precio), url: r.url });

  for (const it of items) {
    it.veredicto = verdict(it, stats.get(productKey(it)));
    if (it.veredicto.tipo === "inflado") it.isBug = false; // un "bug" con precio tachado inflado no es bug

    const otros = it.ean ? [...(byEan.get(it.ean)?.values() || [])].filter(o => o.tiendaId !== it.tiendaId) : [];
    if (otros.length) {
      const mejor = otros.sort((a, b) => a.precio - b.precio)[0];
      if (mejor.precio < it.precio * 0.99) {
        it.comparacion = { tipo: "masBarato", tienda: mejor.tienda, precio: mejor.precio, url: mejor.url, diferencia: Math.round(it.precio - mejor.precio) };
      } else {
        it.comparacion = { tipo: "mejorPrecio", tiendasComparadas: otros.length };
      }
    }
  }
  return items;
}
