// RadarBug — API de búsqueda multi-tienda
// GET /api/search?ids=carrefour,dia&q=tv&minDiscount=20   → busca en esas tiendas
// GET /api/search?store=carrefour | ?rubro=tecnologia      → compatibilidad con la versión anterior
// GET /api/search?mode=health                              → estado de cada tienda (la web lo usa para armar el selector)
// GET /api/search?...&debug=1                              → agrega el motivo de falla de cada tienda

export const config = { maxDuration: 30 };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "es-AR,es;q=0.9" };
const PLACEHOLDER = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80";

const STORE_TIMEOUT = 6500;   // ms por request a una tienda
const GLOBAL_BUDGET = 12000;  // ms máximo que espera una búsqueda antes de responder con lo que tenga
const CONCURRENCY = 14;       // tiendas consultadas en paralelo

// platform: "vtex" = verificada con la API VTEX clásica. "auto" = se detecta sola (VTEX clásica, VTEX Intelligent Search, Shopify o WooCommerce).
// Las que no responden a ninguna se marcan como caídas y la web no las muestra.
const DIRECTORY = [
  // --- SUPERMERCADOS ---
  { id: "carrefour", name: "Carrefour", url: "https://www.carrefour.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "dia", name: "Día Online", url: "https://diaonline.supermercadosdia.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "jumbo", name: "Jumbo", url: "https://www.jumbo.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "disco", name: "Disco", url: "https://www.disco.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "vea", name: "Vea", url: "https://www.vea.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "changomas", name: "ChangoMás", url: "https://www.masonline.com.ar", rubro: "supermercados", platform: "vtex" },

  // --- TECNOLOGÍA ---
  { id: "cetrogar", name: "Cetrogar", url: "https://www.cetrogar.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "naldo", name: "Naldo", url: "https://www.naldo.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "sony", name: "Sony Store", url: "https://store.sony.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "motorola", name: "Motorola", url: "https://www.motorola.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "samsung", name: "Samsung", url: "https://shop.samsung.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "fravega", name: "Frávega", url: "https://www.fravega.com", rubro: "tecnologia", platform: "auto" },
  { id: "oncity", name: "On City", url: "https://www.oncity.com", rubro: "tecnologia", platform: "auto" },
  { id: "megatone", name: "Megatone", url: "https://www.megatone.net", rubro: "tecnologia", platform: "auto" },
  { id: "musimundo", name: "Musimundo", url: "https://www.musimundo.com", rubro: "tecnologia", platform: "auto" },
  { id: "bidcom", name: "Bidcom", url: "https://www.bidcom.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "lenovo", name: "Lenovo", url: "https://www.lenovo.com/ar/es", rubro: "tecnologia", platform: "auto" },
  { id: "start", name: "Start_", url: "https://www.start.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "atajo", name: "Atajo Gaming", url: "https://www.atajo.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "venex", name: "Venex", url: "https://www.venex.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "mexx", name: "Mexx Computación", url: "https://www.mexx.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "maximus", name: "Maximus Gaming", url: "https://www.maximus.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "compragamer", name: "Compra Gamer", url: "https://compragamer.com", rubro: "tecnologia", platform: "auto" },
  { id: "fullh4rd", name: "Full H4rd", url: "https://www.fullh4rd.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "libreopcion", name: "LibreOpción", url: "https://www.libreopcion.com", rubro: "tecnologia", platform: "auto" },

  // --- HERRAMIENTAS Y CONSTRUCCIÓN ---
  { id: "easy", name: "Easy", url: "https://www.easy.com.ar", rubro: "herramientas", platform: "vtex" },
  { id: "prestigio", name: "Pinturerías Prestigio", url: "https://www.prestigio.com.ar", rubro: "herramientas", platform: "vtex" },
  { id: "sodimac", name: "Sodimac", url: "https://www.sodimac.com.ar", rubro: "herramientas", platform: "auto" },
  { id: "blaisten", name: "Blaisten", url: "https://www.blaisten.com.ar", rubro: "herramientas", platform: "auto" },
  { id: "bercomat", name: "Familia Bercomat", url: "https://familiabercomat.com", rubro: "herramientas", platform: "auto" },
  { id: "rex", name: "Pinturerías Rex", url: "https://www.pintureriasrex.com", rubro: "herramientas", platform: "auto" },
  { id: "lusqtoff", name: "Lüsqtoff Oficial", url: "https://tienda.lusqtoff.com.ar", rubro: "herramientas", platform: "auto" },
  { id: "gamma", name: "Gamma Herramientas", url: "https://www.tiendagamma.com.ar", rubro: "herramientas", platform: "auto" },

  // --- HOGAR ---
  { id: "simmons", name: "Simmons", url: "https://www.simmons.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "cardeuse", name: "La Cardeuse", url: "https://www.lacardeuse.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "arredo", name: "Arredo", url: "https://www.arredo.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "sommiercenter", name: "SommierCenter", url: "https://www.sommiercenter.com", rubro: "hogar", platform: "auto" },
  { id: "cannon", name: "Colchones Cannon", url: "https://www.colchonescannon.com.ar", rubro: "hogar", platform: "auto" },
  { id: "morph", name: "Morph", url: "https://www.morph.com.ar", rubro: "hogar", platform: "auto" },
  { id: "colombraro", name: "Colombraro", url: "https://www.colombraro.com.ar", rubro: "hogar", platform: "auto" },

  // --- ELECTRO Y CLIMATIZACIÓN ---
  { id: "electrolux", name: "Electrolux", url: "https://tienda.electrolux.com.ar", rubro: "electro", platform: "vtex" },
  { id: "philips", name: "Philips Tienda", url: "https://tienda.philips.com.ar", rubro: "electro", platform: "vtex" },
  { id: "whirlpool", name: "Whirlpool", url: "https://www.whirlpool.com.ar", rubro: "electro", platform: "auto" },
  { id: "drean", name: "Drean", url: "https://tienda.drean.com.ar", rubro: "electro", platform: "auto" },
  { id: "longvie", name: "Longvie", url: "https://tienda.longvie.com", rubro: "electro", platform: "auto" },
  { id: "bgh", name: "BGH Store", url: "https://hogar.bgh.com.ar", rubro: "electro", platform: "auto" },
  { id: "peabody", name: "Peabody", url: "https://www.peabody.com.ar", rubro: "electro", platform: "auto" },
  { id: "liliana", name: "Liliana", url: "https://tienda.liliana.com.ar", rubro: "electro", platform: "auto" },
  { id: "yelmo", name: "Yelmo", url: "https://www.yelmo.com.ar", rubro: "electro", platform: "auto" },
  { id: "ultracomb", name: "Ultracomb", url: "https://www.ultracomb.com.ar", rubro: "electro", platform: "auto" },

  // --- DEPORTES ---
  { id: "topper", name: "Topper", url: "https://www.topper.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "sportline", name: "Sportline", url: "https://www.sportline.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "dash", name: "Dash Deportes", url: "https://www.tiendadash.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "grid", name: "Grid", url: "https://www.grid.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "scandinavian", name: "Scandinavian", url: "https://www.scandinavian.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "adidas", name: "Adidas", url: "https://www.adidas.com.ar", rubro: "deportes", platform: "auto" },
  { id: "nike", name: "Nike Argentina", url: "https://www.nike.com.ar", rubro: "deportes", platform: "auto" },
  { id: "puma", name: "Puma Argentina", url: "https://ar.puma.com", rubro: "deportes", platform: "auto" },
  { id: "dexter", name: "Dexter", url: "https://www.dexter.com.ar", rubro: "deportes", platform: "auto" },
  { id: "stockcenter", name: "Stock Center", url: "https://www.stockcenter.com.ar", rubro: "deportes", platform: "auto" },
  { id: "moov", name: "Moov", url: "https://www.moov.com.ar", rubro: "deportes", platform: "auto" },
  { id: "solodeportes", name: "Solo Deportes", url: "https://www.solodeportes.com.ar", rubro: "deportes", platform: "auto" },
  { id: "opensports", name: "Open Sports", url: "https://www.opensports.com.ar", rubro: "deportes", platform: "auto" },
  { id: "montagne", name: "Montagne", url: "https://www.montagne.com.ar", rubro: "deportes", platform: "auto" },
  { id: "cristobalcolon", name: "Cristóbal Colón", url: "https://www.cristobalcolon.com", rubro: "deportes", platform: "auto" },
  { id: "quiksilver", name: "Quiksilver", url: "https://www.quiksilver.com.ar", rubro: "deportes", platform: "auto" },
  { id: "ripcurl", name: "Rip Curl", url: "https://www.ripcurl.com.ar", rubro: "deportes", platform: "auto" },

  // --- MODA ---
  { id: "levis", name: "Levi's", url: "https://www.levi.com.ar", rubro: "moda", platform: "vtex" },
  { id: "lacoste", name: "Lacoste", url: "https://www.lacoste.com/ar", rubro: "moda", platform: "auto" },
  { id: "dafiti", name: "Dafiti", url: "https://www.dafiti.com.ar", rubro: "moda", platform: "auto" },
  { id: "bowen", name: "Bowen", url: "https://www.bowen.com.ar", rubro: "moda", platform: "auto" },
  { id: "kevingston", name: "Kevingston", url: "https://www.kevingston.com", rubro: "moda", platform: "auto" },

  // --- FARMACIA Y PERFUMERÍA ---
  { id: "farmacity", name: "Farmacity", url: "https://www.farmacity.com", rubro: "farmacia", platform: "vtex" },
  { id: "pigmento", name: "Pigmento", url: "https://www.perfumeriaspigmento.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "julieriaque", name: "Juleriaque", url: "https://www.juleriaque.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "rouge", name: "Rouge", url: "https://www.perfumeriasrouge.com", rubro: "farmacia", platform: "vtex" },
  { id: "lasmargaritas", name: "Las Margaritas", url: "https://www.lasmargaritas.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "simplicity", name: "Simplicity", url: "https://www.simplicity.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "centraloeste", name: "Central Oeste", url: "https://www.centraloeste.com.ar", rubro: "farmacia", platform: "auto" },
  { id: "delpuente", name: "Farmacias del Puente", url: "https://www.farmaciasdelpuente.com.ar", rubro: "farmacia", platform: "auto" },
  { id: "pedidosfarma", name: "PedidosFarma", url: "https://www.pedidosfarma.com.ar", rubro: "farmacia", platform: "auto" },
  { id: "parfumerie", name: "Parfumerie", url: "https://www.parfumerie.com.ar", rubro: "farmacia", platform: "auto" },
  { id: "natura", name: "Natura", url: "https://www.naturacosmeticos.com.ar", rubro: "farmacia", platform: "auto" },

  // --- LIBRERÍA Y JUGUETES ---
  { id: "cuspide", name: "Cúspide", url: "https://www.cuspide.com", rubro: "libreria", platform: "auto" },
  { id: "yenny", name: "Yenny / El Ateneo", url: "https://www.tematika.com", rubro: "libreria", platform: "auto" },
  { id: "staples", name: "Staples", url: "https://www.staples.com.ar", rubro: "libreria", platform: "auto" },
  { id: "citykids", name: "CityKids", url: "https://www.citykids.com.ar", rubro: "juguetes", platform: "auto" },
  { id: "creciendo", name: "Creciendo", url: "https://www.creciendo.com", rubro: "juguetes", platform: "auto" },
  { id: "carrousel", name: "Carrousel", url: "https://www.carrousel.com.ar", rubro: "juguetes", platform: "auto" },

  // --- MERCADOLIBRE (requiere token; ver README) ---
  { id: "mercadolibre", name: "MercadoLibre", url: "https://www.mercadolibre.com.ar", rubro: "tecnologia", platform: "mercadolibre" }
];

const BY_ID = new Map(DIRECTORY.map(s => [s.id, s]));

// Cachés en memoria: viven mientras la función de Vercel esté "caliente".
const platformCache = new Map(); // id -> plataforma detectada
const deadCache = new Map();     // id -> { motivo, until }
const DEAD_TTL = 30 * 60 * 1000;

// ---------------- utilidades ----------------
class StoreError extends Error {}

async function getJSON(url, init = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), STORE_TIMEOUT);
  let r;
  try {
    r = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers || {}) }, signal: ctrl.signal, redirect: "follow" });
  } catch (e) {
    throw new StoreError(e.name === "AbortError" ? "timeout" : `sin conexión (${e.cause?.code || e.message})`);
  } finally {
    clearTimeout(tid);
  }
  if (!r.ok) throw new StoreError(`HTTP ${r.status}`);
  const text = await r.text();
  const t = text.trimStart();
  if (!(t.startsWith("[") || t.startsWith("{"))) throw new StoreError("respondió HTML (no es esta plataforma o bloqueó al bot)");
  try { return JSON.parse(text); } catch { throw new StoreError("JSON inválido"); }
}

const abs = (base, link) => {
  if (!link) return base;
  try { return new URL(link, base + "/").href; } catch { return base; }
};
const https = (u) => (u && u.startsWith("http://") ? "https://" + u.slice(7) : u);
const pct = (list, price) => (list > price && price > 0 ? Math.round(((list - price) / list) * 100) : 0);

function isBugPrice(precio, descuento) {
  // Heurística: descuento extremo, o descuento fuerte sobre un precio ridículamente bajo.
  return descuento >= 65 || (precio > 10 && precio < 2000 && descuento >= 35);
}

function build(store, { nombre, precio, lista, img, url, extraDisc = 0 }) {
  precio = Number(precio) || 0;
  lista = Number(lista) || 0;
  if (precio <= 0 || !nombre) return null;
  const real = pct(lista, precio);
  const descuento = Math.max(real, extraDisc);
  return {
    tienda: store.name,
    tiendaId: store.id,
    rubro: store.rubro,
    nombre: String(nombre).trim(),
    precio,
    precioLista: lista > precio ? lista : null,
    descuento,
    ahorro: lista > precio ? Math.round(lista - precio) : 0,
    isBug: isBugPrice(precio, real), // un 2x1 es promo, no bug: solo cuenta la rebaja real del precio
    img: https(img) || PLACEHOLDER,
    url
  };
}

// ---------------- adaptadores ----------------
function vtexOffer(store, p) {
  // Elegimos el SKU/seller disponible con mejor precio
  let best = null;
  for (const it of p.items || []) {
    for (const s of it.sellers || []) {
      const o = s.commertialOffer;
      if (!o || !(o.Price > 0)) continue;
      if (o.AvailableQuantity === 0) continue;
      if (!best || o.Price < best.o.Price) best = { o, it };
    }
  }
  if (!best) return null;
  const { o, it } = best;
  let extra = 0;
  for (const t of [...(o.discountHighlights || []), ...(o.teasers || [])]) {
    const n = (t.name || t["<Name>k__BackingField"] || "").toLowerCase();
    if (n.includes("2x1")) extra = Math.max(extra, 50);
    else if (n.includes("3x2")) extra = Math.max(extra, 33);
    else if (/2(da|do)?\s*(unidad)?\s*al\s*70/.test(n)) extra = Math.max(extra, 35);
    else if (/2(da|do)?\s*(unidad)?\s*al\s*50/.test(n)) extra = Math.max(extra, 25);
  }
  return build(store, {
    nombre: `${p.brand ? p.brand + " - " : ""}${p.productName || p.productTitle || ""}`,
    precio: o.Price,
    lista: Math.max(o.ListPrice || 0, o.PriceWithoutDiscount || 0),
    img: it.images?.[0]?.imageUrl,
    url: abs(store.url, p.link || (p.linkText ? `/${p.linkText}/p` : "")),
    extraDisc: extra
  });
}

const ADAPTERS = {
  async vtex(store, q, limit) {
    const qs = new URLSearchParams({ O: "OrderByBestDiscountDESC", _from: "0", _to: String(Math.min(limit, 50) - 1) });
    if (q) qs.set("ft", q);
    const data = await getJSON(`${store.url}/api/catalog_system/pub/products/search?${qs}`);
    if (!Array.isArray(data)) throw new StoreError("formato VTEX inesperado");
    return data.map(p => vtexOffer(store, p)).filter(Boolean);
  },

  async vtexIS(store, q, limit) {
    const qs = new URLSearchParams({ query: q || "", count: String(Math.min(limit, 50)), page: "1", sort: "discount:desc", locale: "es-AR" });
    const data = await getJSON(`${store.url}/api/io/_v/api/intelligent-search/product_search/?${qs}`);
    if (!Array.isArray(data?.products)) throw new StoreError("formato Intelligent Search inesperado");
    return data.products.map(p => vtexOffer(store, p)).filter(Boolean);
  },

  async shopify(store, q, limit) {
    if (q) {
      const qs = new URLSearchParams({ q, "resources[type]": "product", "resources[limit]": String(Math.min(limit, 10)) });
      const data = await getJSON(`${store.url}/search/suggest.json?${qs}`);
      const prods = data?.resources?.results?.products;
      if (!Array.isArray(prods)) throw new StoreError("formato Shopify inesperado");
      return prods.map(p => build(store, {
        nombre: `${p.vendor ? p.vendor + " - " : ""}${p.title}`,
        precio: parseFloat(p.price),
        lista: parseFloat(p.compare_at_price_max || 0),
        img: p.image || p.featured_image?.url,
        url: abs(store.url, p.url)
      })).filter(Boolean);
    }
    const data = await getJSON(`${store.url}/products.json?limit=${Math.min(limit, 50)}`);
    if (!Array.isArray(data?.products)) throw new StoreError("formato Shopify inesperado");
    return data.products.map(p => {
      const v = (p.variants || []).find(v => v.available !== false) || p.variants?.[0];
      return build(store, {
        nombre: `${p.vendor ? p.vendor + " - " : ""}${p.title}`,
        precio: parseFloat(v?.price),
        lista: parseFloat(v?.compare_at_price || 0),
        img: p.images?.[0]?.src,
        url: abs(store.url, `/products/${p.handle}`)
      });
    }).filter(Boolean);
  },

  async woo(store, q, limit) {
    const qs = new URLSearchParams({ per_page: String(Math.min(limit, 50)), orderby: "price", order: "asc" });
    if (q) qs.set("search", q); else qs.set("on_sale", "true");
    const data = await getJSON(`${store.url}/wp-json/wc/store/v1/products?${qs}`);
    if (!Array.isArray(data)) throw new StoreError("formato WooCommerce inesperado");
    return data.map(p => {
      const d = 10 ** (p.prices?.currency_minor_unit ?? 2);
      return build(store, {
        nombre: p.name?.replace(/<[^>]+>/g, ""),
        precio: Number(p.prices?.price) / d,
        lista: Number(p.prices?.regular_price) / d,
        img: p.images?.[0]?.src,
        url: p.permalink
      });
    }).filter(Boolean);
  },

  async mercadolibre(store, q, limit) {
    // Desde 2025 la búsqueda pública de MercadoLibre devuelve 403 sin autenticación.
    const token = process.env.ML_ACCESS_TOKEN;
    if (!token) throw new StoreError("falta ML_ACCESS_TOKEN (la API de MercadoLibre exige token)");
    const qs = new URLSearchParams({ q: q || "ofertas", limit: String(Math.min(limit, 50)) });
    const data = await getJSON(`https://api.mercadolibre.com/sites/MLA/search?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    return (data.results || []).map(p => build(store, {
      nombre: p.title,
      precio: p.price,
      lista: p.original_price,
      img: p.thumbnail?.replace(/-I\.(jpg|webp)$/, "-O.$1"),
      url: p.permalink
    })).filter(Boolean);
  }
};

const AUTO_ORDER = ["vtex", "vtexIS", "shopify", "woo"];

// Consulta una tienda: usa la plataforma conocida, o la detecta probando adaptadores.
async function queryStore(store, q, limit) {
  const dead = deadCache.get(store.id);
  if (dead && dead.until > Date.now()) throw new StoreError(dead.motivo);

  const known = store.platform !== "auto" ? store.platform : platformCache.get(store.id);
  const order = known ? [known] : AUTO_ORDER;
  const motivos = [];

  for (const plat of order) {
    try {
      const items = await ADAPTERS[plat](store, q, limit);
      platformCache.set(store.id, plat);
      deadCache.delete(store.id);
      return { items, platform: plat };
    } catch (e) {
      motivos.push(`${plat}: ${e.message}`);
      if (!(e instanceof StoreError)) break;
      if (/timeout|sin conexión/.test(e.message)) break; // si el sitio no responde, no tiene sentido seguir probando
    }
  }
  const motivo = motivos.join(" | ");
  // Solo se "entierra" una tienda auto si falló todo; las verificadas se reintentan siempre.
  if (store.platform === "auto" || store.platform === "mercadolibre") deadCache.set(store.id, { motivo, until: Date.now() + DEAD_TTL });
  throw new StoreError(motivo);
}

async function runPool(stores, worker, concurrency, budgetMs) {
  const out = new Array(stores.length);
  let next = 0;
  const deadline = Date.now() + budgetMs;
  async function lane() {
    while (next < stores.length) {
      const i = next++;
      if (Date.now() > deadline) { out[i] = { store: stores[i], error: "sin tiempo (presupuesto global agotado)" }; continue; }
      const t0 = Date.now();
      try {
        const r = await worker(stores[i]);
        out[i] = { store: stores[i], ...r, ms: Date.now() - t0 };
      } catch (e) {
        out[i] = { store: stores[i], error: e.message, ms: Date.now() - t0 };
      }
    }
  }
  const lanes = Array.from({ length: Math.min(concurrency, stores.length) }, lane);
  await Promise.race([Promise.all(lanes), new Promise(r => setTimeout(r, budgetMs + 500))]);
  return out.map((o, i) => o || { store: stores[i], error: "sin tiempo (presupuesto global agotado)" });
}

// ---------------- handler ----------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { mode, store = "todas", rubro = "todos", ids = "", q = "", minDiscount = "0", debug } = req.query;
  const rawQ = String(q).trim().slice(0, 80);
  const minDisc = Math.max(0, Math.min(100, parseInt(minDiscount, 10) || 0));

  try {
    // ---- Modo salud: prueba todas las tiendas con una consulta mínima ----
    if (mode === "health") {
      const results = await runPool(DIRECTORY, s => queryStore(s, "", 2), 20, 20000);
      const stores = results.map(r => ({
        id: r.store.id, name: r.store.name, rubro: r.store.rubro,
        ok: !r.error, platform: r.platform || null, ms: r.ms ?? null,
        motivo: r.error || null
      }));
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.status(200).json({ checkedAt: new Date().toISOString(), total: stores.length, activas: stores.filter(s => s.ok).length, stores });
    }

    // ---- Selección de tiendas ----
    let pool;
    if (ids) {
      pool = String(ids).split(",").map(s => BY_ID.get(s.trim())).filter(Boolean);
    } else if (store !== "todas") {
      pool = BY_ID.has(store) ? [BY_ID.get(store)] : [];
    } else {
      pool = rubro === "todos" ? DIRECTORY : DIRECTORY.filter(d => d.rubro === rubro);
    }
    if (!pool.length) return res.status(400).json({ error: "No hay tiendas válidas para consultar." });

    const perStore = pool.length === 1 ? 40 : pool.length <= 6 ? 20 : 12;
    const results = await runPool(pool, s => queryStore(s, rawQ, perStore), CONCURRENCY, GLOBAL_BUDGET);

    let items = [];
    const seen = new Set();
    for (const r of results) {
      for (const it of r.items || []) {
        if (seen.has(it.url)) continue;
        seen.add(it.url);
        items.push(it);
      }
    }
    if (minDisc > 0) items = items.filter(it => it.descuento >= minDisc || it.isBug);

    items.sort((a, b) =>
      (b.isBug - a.isBug) || (b.descuento - a.descuento) || (b.ahorro - a.ahorro));

    const fallidas = results.filter(r => r.error);
    const body = {
      totalStores: DIRECTORY.length,
      consultadas: pool.length,
      respondieron: pool.length - fallidas.length,
      fallidas: fallidas.map(r => ({ id: r.store.id, name: r.store.name, ...(debug ? { motivo: r.error } : {}) })),
      results: items.slice(0, 400)
    };
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json(body);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
