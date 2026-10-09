// GENERADO por scripts/build-puente.js — no editar a mano
// Lectores de cada plataforma. Todos devuelven productos normalizados (ver build()).
const getMLToken = async () => { throw new Error("MercadoLibre no se consulta desde la extensión"); };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" };
export const PLACEHOLDER = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80";
export const STORE_TIMEOUT = 7000;

export class StoreError extends Error {}

async function rawFetch(url, init = {}, accept = "application/json, text/plain, */*") {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), STORE_TIMEOUT);
  try {
    return await fetch(url, { ...init, headers: { ...HEADERS, Accept: accept, ...(init.headers || {}) }, signal: ctrl.signal, redirect: "follow" });
  } catch (e) {
    throw new StoreError(e.name === "AbortError" ? "timeout" : `sin conexión (${e.cause?.code || e.message})`);
  } finally {
    clearTimeout(tid);
  }
}

export async function getJSON(url, init = {}) {
  const r = await rawFetch(url, init);
  if (!r.ok) throw new StoreError(`HTTP ${r.status}`);
  const text = await r.text();
  const t = text.trimStart();
  if (!(t.startsWith("[") || t.startsWith("{"))) throw new StoreError("respondió HTML (no es esta plataforma o bloqueó al bot)");
  try { return JSON.parse(text); } catch { throw new StoreError("JSON inválido"); }
}

async function getHTML(url) {
  const r = await rawFetch(url, {}, "text/html,application/xhtml+xml");
  if (!r.ok) throw new StoreError(`HTTP ${r.status}`);
  return { html: await r.text(), finalUrl: r.url };
}

// ---------------- utilidades ----------------
export const abs = (base, link) => {
  if (!link) return base;
  try { return new URL(link, base + "/").href; } catch { return base; }
};
const httpsUrl = (u) => (!u ? u : u.startsWith("//") ? "https:" + u : u.startsWith("http://") ? "https://" + u.slice(7) : u);
const pct = (list, price) => (list > price && price > 0 ? Math.round(((list - price) / list) * 100) : 0);

export function decodeEntities(s = "") {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

// "$ 35.900" / "$35,900" / "1.234,56" / "1234.56" → número
export function parseMoney(s) {
  if (s == null) return 0;
  let t = String(s).replace(/[^\d.,]/g, "");
  if (!t) return 0;
  const dec = t.match(/[.,](\d{1,2})$/);
  if (dec) { t = t.slice(0, -dec[0].length).replace(/[.,]/g, "") + "." + dec[1]; }
  else t = t.replace(/[.,]/g, "");
  return parseFloat(t) || 0;
}

const cleanEan = (e) => (e && /^\d{8,14}$/.test(String(e).trim()) ? String(e).trim().replace(/^0+(?=\d{8})/, "") : null);

export function isBugPrice(precio, descuentoReal) {
  // Descuento extremo, o descuento fuerte sobre un precio ridículamente bajo.
  return descuentoReal >= 65 || (precio > 10 && precio < 2000 && descuentoReal >= 35);
}

// Más de 5 veces el precio (−80%) casi siempre es un dato roto de la tienda, no una rebaja: lo descartamos.
// Los bugs reales se detectan comparando contra el precio de mercado (lib/analysis.js), no contra este número.
export const MAX_RATIO_LISTA = 5;

export function build(store, { nombre, precio, lista, img, url, extraDisc = 0, promo = null, ean = null, listaConfiable = false }) {
  precio = Number(precio) || 0;
  lista = Number(lista) || 0;
  if (precio <= 0 || !nombre) return null;
  let listaSospechosa = null;
  if (!listaConfiable && lista > precio * MAX_RATIO_LISTA) { listaSospechosa = lista; lista = 0; }
  const real = pct(lista, precio);
  return {
    tienda: store.name,
    tiendaId: store.id,
    rubro: store.rubro,
    nombre: decodeEntities(String(nombre)).replace(/\s+/g, " ").trim(),
    precio: Math.round(precio * 100) / 100,
    precioLista: lista > precio ? lista : null,
    descuento: Math.max(real, extraDisc),
    descuentoReal: real,
    promo,                       // ej. "2x1", "3x2" (promos por cantidad, no rebajan el precio unitario)
    ahorro: lista > precio ? Math.round(lista - precio) : 0,
    listaSospechosa,             // precio tachado absurdo que publicó la tienda (se ignora)
    isBug: false,                // lo decide lib/analysis.js con el precio de mercado
    posibleBug: isBugPrice(precio, real), // solo según el precio tachado de la tienda: sin confirmar
    ean: cleanEan(ean),
    img: httpsUrl(img) || PLACEHOLDER,
    url
  };
}

function promoFromText(n) {
  n = (n || "").toLowerCase();
  if (n.includes("2x1")) return ["2x1", 50];
  if (n.includes("3x2")) return ["3x2", 33];
  if (/2(da|do|°)?\s*(unidad)?\s*al\s*80/.test(n)) return ["2da al 80%", 40];
  if (/2(da|do|°)?\s*(unidad)?\s*al\s*70/.test(n)) return ["2da al 70%", 35];
  if (/2(da|do|°)?\s*(unidad)?\s*al\s*50/.test(n)) return ["2da al 50%", 25];
  return [null, 0];
}

// ---------------- VTEX ----------------
function vtexOffer(store, p) {
  let best = null;
  for (const it of p.items || []) {
    for (const s of it.sellers || []) {
      const o = s.commertialOffer;
      if (!o || !(o.Price > 0) || o.AvailableQuantity === 0) continue;
      if (!best || o.Price < best.o.Price) best = { o, it };
    }
  }
  if (!best) return null;
  const { o, it } = best;
  let promo = null, extra = 0;
  // Las promos vienen con mayúscula o minúscula según la tienda; Cencosud (Disco/Jumbo/Vea) las publica como
  // "clusterHighlights" de campaña ("Hasta 2do al 70% en Almacén"), sin precio por producto.
  const textos = [
    ...[...(o.discountHighlights || []), ...(o.DiscountHighLight || []), ...(o.teasers || []), ...(o.Teasers || []), ...(o.PromotionTeasers || [])]
      .map(t => t?.name || t?.Name || t?.["<Name>k__BackingField"]),
    ...(Array.isArray(p.clusterHighlights) ? p.clusterHighlights.map(c => c?.name) : Object.values(p.clusterHighlights || {}))
  ].filter(t => typeof t === "string");
  for (const t of textos) {
    const [pName, pDisc] = promoFromText(t);
    const hasta = /hasta/i.test(t);
    if (pName && !hasta && pDisc > extra) { promo = pName; extra = pDisc; }
    else if (!promo && (pName || /\d+\s*%/.test(t))) promo = t.trim().slice(0, 60); // campaña: se muestra, no suma descuento
  }
  return build(store, {
    nombre: `${p.brand ? p.brand + " - " : ""}${p.productName || p.productTitle || ""}`,
    precio: o.Price,
    // PriceWithoutDiscount = precio antes de la promoción (confiable).
    // ListPrice viene roto en muchas tiendas (ej. aceite de $14.700 con "lista" de $1.214.876): solo lo usamos si es razonable.
    lista: o.PriceWithoutDiscount > o.Price ? o.PriceWithoutDiscount
      : (o.ListPrice > o.Price && o.ListPrice <= o.Price * 2.5 ? o.ListPrice : 0),
    listaConfiable: o.PriceWithoutDiscount > o.Price,
    img: it.images?.[0]?.imageUrl,
    url: abs(store.url, p.link || (p.linkText ? `/${p.linkText}/p` : "")),
    extraDisc: extra, promo,
    ean: it.ean || it.referenceId?.find?.(r => /ean/i.test(r.Key))?.Value
  });
}

async function vtexPage(store, { q, eans, order, from, to }) {
  const qs = new URLSearchParams({ _from: String(from), _to: String(to) });
  if (order) qs.set("O", order);
  let path = "";
  if (eans?.length) for (const e of eans) qs.append("fq", `alternateIds_Ean:${e}`); // varios fq de EAN = "O"
  else if (q) { path = "/" + encodeURIComponent(q); qs.set("map", "ft"); } // texto en la ruta: con ?ft= los espacios ("+") dan HTTP 400
  const url = `${store.url}/api/catalog_system/pub/products/search${path}?${qs}`;
  let data;
  try { data = await getJSON(url); }
  catch (e) { if (/HTTP 5\d\d/.test(e.message)) data = await getJSON(url); else throw e; } // reintento ante error temporal
  if (!Array.isArray(data)) throw new StoreError("formato VTEX inesperado");
  return data.map(p => vtexOffer(store, p)).filter(Boolean);
}

async function vtex(store, q, limit, opts = {}) {
  if (opts.eans?.length) return vtexPage(store, { eans: opts.eans.slice(0, 50), from: 0, to: Math.min(opts.eans.length * 2, 49) });
  if (opts.ean) return vtexPage(store, { eans: [opts.ean], from: 0, to: 9 });
  if (q) {
    const n = Math.min(limit, 50);
    const pages = [vtexPage(store, { q, order: "OrderByBestDiscountDESC", from: 0, to: n - 1 })];
    if (limit > 50) pages.push(vtexPage(store, { q, order: "OrderByBestDiscountDESC", from: 50, to: 99 }).catch(() => []));
    const out = dedupe((await Promise.all(pages)).flat());
    if (out.length) return out;
    // El buscador clásico es literal (acentos, plurales): si no encontró nada, probamos el buscador inteligente
    return vtexIS(store, q, limit).catch(() => []);
  }
  // Sin búsqueda: "más descontados" según la tienda (muchos traen precio de lista roto) + más vendidos;
  // nos quedamos con los que tienen una rebaja real o promo.
  const pages = await Promise.all([
    vtexPage(store, { order: "OrderByBestDiscountDESC", from: 0, to: 49 }),
    vtexPage(store, { order: "OrderByBestDiscountDESC", from: 50, to: 99 }).catch(() => []),
    vtexPage(store, { order: "OrderByTopSaleDESC", from: 0, to: 49 }).catch(() => [])
  ]);
  return dedupe(pages.flat());
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(i => i && !seen.has(i.url) && seen.add(i.url));
}

async function vtexIS(store, q, limit) {
  const qs = new URLSearchParams({ query: q || "", count: String(Math.min(limit, 50)), page: "1", sort: "discount:desc", locale: "es-AR" });
  const data = await getJSON(`${store.url}/api/io/_v/api/intelligent-search/product_search/?${qs}`);
  if (!Array.isArray(data?.products)) throw new StoreError("formato Intelligent Search inesperado");
  return data.products.map(p => vtexOffer(store, p)).filter(Boolean);
}

// ---------------- Shopify ----------------
async function shopify(store, q, limit) {
  if (q) {
    const qs = new URLSearchParams({ q, "resources[type]": "product", "resources[limit]": String(Math.min(limit, 10)) });
    const data = await getJSON(`${store.url}/search/suggest.json?${qs}`);
    const prods = data?.resources?.results?.products;
    if (!Array.isArray(prods)) throw new StoreError("formato Shopify inesperado");
    return prods.map(p => build(store, {
      nombre: `${p.vendor ? p.vendor + " - " : ""}${p.title}`,
      precio: parseFloat(p.price), lista: parseFloat(p.compare_at_price_max || 0),
      img: p.image || p.featured_image?.url, url: abs(store.url, p.url)
    })).filter(Boolean);
  }
  const data = await getJSON(`${store.url}/products.json?limit=${Math.min(limit, 50)}`);
  if (!Array.isArray(data?.products)) throw new StoreError("formato Shopify inesperado");
  return data.products.map(p => {
    const v = (p.variants || []).find(v => v.available !== false) || p.variants?.[0];
    return build(store, {
      nombre: `${p.vendor ? p.vendor + " - " : ""}${p.title}`,
      precio: parseFloat(v?.price), lista: parseFloat(v?.compare_at_price || 0),
      img: p.images?.[0]?.src, url: abs(store.url, `/products/${p.handle}`), ean: v?.barcode
    });
  }).filter(Boolean);
}

// ---------------- WooCommerce ----------------
async function woo(store, q, limit) {
  const get = async (extra) => {
    const qs = new URLSearchParams({ per_page: String(Math.min(Math.max(limit, 20), 50)), ...extra });
    const data = await getJSON(`${store.url}/wp-json/wc/store/v1/products?${qs}`);
    if (!Array.isArray(data)) throw new StoreError("formato WooCommerce inesperado");
    return data;
  };
  let data = q ? await get({ search: q }) : await get({ on_sale: "true" });
  if (!q && data.length < 6) data = data.concat(await get({ orderby: "popularity" }).catch(() => []));
  if (data.length && data.every(p => !(Number(p.prices?.price) > 0))) throw new StoreError("la tienda no publica precios (todos en $0)");
  return dedupe(data.map(p => {
    const d = 10 ** (p.prices?.currency_minor_unit ?? 2);
    return build(store, {
      nombre: p.name?.replace(/<[^>]+>/g, ""),
      precio: Number(p.prices?.price) / d, lista: Number(p.prices?.regular_price) / d,
      img: p.images?.[0]?.src, url: p.permalink, ean: p.sku
    });
  }));
}

// ---------------- Tiendanube ----------------
// Cada producto del listado trae data-variants (precio y precio tachado) y un JSON-LD con nombre y url.
// data-variants a veces trae JSON anidado mal escapado (cuotas), así que extraemos los campos con expresiones
// regulares en vez de parsear todo el bloque.
function tnVariants(attr) {
  const s = decodeEntities(attr);
  return s.split(/\{"product_id"/).slice(1).map(v => ({
    price: parseFloat(v.match(/"price_number":\s*([\d.]+)/)?.[1]) || 0,
    compare: parseFloat(v.match(/"compare_at_price_number":\s*([\d.]+)/)?.[1]) || 0,
    available: !/"available":\s*false/.test(v.split('"installments_data"')[0]),
    img: v.match(/"image_url":\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, "/"),
    sku: v.match(/"sku":\s*"([^"]*)"/)?.[1]
  })).filter(v => v.price > 0);
}

function tnParse(store, html, limit) {
  const ld = new Map();
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*structured-data\.item[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      const u = j.offers?.url || j.mainEntityOfPage?.["@id"];
      if (u) ld.set(u.replace(/^https?:\/\/(www\.)?/, ""), j);
    } catch { /* JSON-LD roto: se ignora */ }
  }
  const out = [];
  const seen = new Set();
  const re = /data-variants="(\[[^"]+\])"/g;
  const linkRe = /href="((?:https?:)?\/\/[^"]*\/productos\/[^"]+|\/productos\/[^"]+)"/;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const variants = tnVariants(m[1]);
    if (!variants.length) continue;
    const tail = html.slice(re.lastIndex, re.lastIndex + 8000); // con muchos talles, data-variants ocupa miles de caracteres
    const before = html.slice(Math.max(0, m.index - 3000), m.index);
    const link = tail.match(linkRe)?.[1] || [...before.matchAll(new RegExp(linkRe.source, "g"))].pop()?.[1];
    if (!link || /\/productos\/?$/.test(link)) continue;
    const full = abs(store.url, httpsUrl(link));
    const key = full.replace(/^https?:\/\/(www\.)?/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const v = variants.filter(x => x.available).sort((a, b) => a.price - b.price)[0] || variants[0];
    const info = ld.get(key) || {};
    const nombre = info.name || decodeEntities(tail.match(/title="([^"]+)"/)?.[1] || tail.match(/alt="([^"]+)"/)?.[1] || "");
    const brand = info.brand?.name;
    out.push(build(store, {
      nombre: brand && !nombre.toLowerCase().includes(brand.toLowerCase()) ? `${brand} - ${nombre}` : nombre,
      precio: v.price, lista: v.compare, img: v.img || info.image, url: full, ean: v.sku
    }));
  }
  return out.filter(Boolean);
}

async function tiendanube(store, q, limit) {
  if (q) {
    const { html } = await getHTML(`${store.url}/search/?q=${encodeURIComponent(q)}`);
    const out = tnParse(store, html, Math.max(limit, 24));
    if (!out.length && !/data-variants=|No encontramos|no-results|no hay resultados/i.test(html)) throw new StoreError("no se encontró el listado de Tiendanube");
    return out;
  }
  // Sin búsqueda: dos páginas de los más vendidos; después nos quedamos con los que tienen rebaja
  const pages = await Promise.all([
    getHTML(`${store.url}/productos/?sort_by=best-selling`),
    getHTML(`${store.url}/productos/page/2/?sort_by=best-selling`).catch(() => ({ html: "" }))
  ]);
  const out = dedupe(pages.flatMap(p => tnParse(store, p.html, 60)));
  if (!out.length) throw new StoreError("no se encontró el listado de Tiendanube");
  return out;
}

// ---------------- Magento 2 (GraphQL) ----------------
async function magento(store, q, limit) {
  const items = "items{name sku url_key url_suffix small_image{url} price_range{minimum_price{regular_price{value} final_price{value}}}}";
  const query = q
    ? `{products(search:${JSON.stringify(q)},pageSize:${Math.min(limit, 40)}){${items}}}`
    : `{products(filter:{price:{from:"1"}},pageSize:${Math.min(limit, 40)}){${items}}}`;
  const data = await getJSON(`${store.url}/graphql?query=${encodeURIComponent(query)}`, { headers: { Store: "default" } });
  if (data.errors && !data.data?.products) throw new StoreError("GraphQL: " + (data.errors[0]?.message || "error"));
  const list = data?.data?.products?.items;
  if (!Array.isArray(list)) throw new StoreError("formato Magento inesperado");
  return list.map(p => {
    const mp = p.price_range?.minimum_price;
    return build(store, {
      nombre: p.name, precio: mp?.final_price?.value, lista: mp?.regular_price?.value,
      img: p.small_image?.url, url: abs(store.url, `/${p.url_key}${p.url_suffix ?? ".html"}`)
    });
  }).filter(Boolean);
}

// ---------------- Salesforce Commerce Cloud (Stock Center, Moov, Dexter, Puma) ----------------
async function sfcc(store, q, limit) {
  const term = q || "zapatillas";
  let html = null, lastErr;
  for (const path of [`/buscar?q=`, `/search?q=`]) {
    try { ({ html } = await getHTML(`${store.url}${path}${encodeURIComponent(term)}`)); if (html.includes('data-pid="')) break; }
    catch (e) { lastErr = e; html = null; }
  }
  if (!html) throw lastErr || new StoreError("sin resultados SFCC");
  const chunks = html.split(/class="product"\s+data-pid="/).slice(1);
  if (!chunks.length) throw new StoreError("no se encontró el listado SFCC");
  return chunks.slice(0, limit).map(c => {
    c = c.slice(0, 9000);
    const href = c.match(/href="([^"]+\.html[^"]*)"/)?.[1];
    const nombre = c.match(/class="link"[^>]*title="([^"]+)"/)?.[1] || c.match(/class="link"[^>]*>([^<]+)</)?.[1] || c.match(/alt="([^"]+)"/)?.[1];
    const sales = c.match(/class="sales"[\s\S]*?content="([\d.]+)"/)?.[1];
    const list = c.match(/strike-through[\s\S]*?content="([\d.]+)"/)?.[1];
    const img = c.match(/tile-image[^"]*"\s+src="([^"]+)"/)?.[1] || c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    return build(store, { nombre, precio: parseFloat(sales), lista: parseFloat(list), img: img && decodeEntities(img), url: abs(store.url, href) });
  }).filter(Boolean);
}

// ---------------- Coto Digital (Oracle Endeca, JSON) ----------------
async function coto(store, q, limit, opts = {}) {
  const term = opts.ean || q;
  const base = "https://www.coto.com.ar/sitios/cdigi/browse?format=json&Nrpp=48";
  // Con búsqueda: 1-2 páginas. Sin búsqueda: recorremos 4 páginas del catálogo (más vendidos) y nos quedamos con lo que tiene descuento.
  const urls = term
    ? [`${base}&Ntt=${encodeURIComponent(term)}`, ...(limit > 40 ? [`${base}&Ntt=${encodeURIComponent(term)}&No=48`] : [])]
    : [0, 48, 96, 144].map(no => `${base}&No=${no}`);
  const datas = (await Promise.all(urls.map((u, i) => i === 0 ? getJSON(u) : getJSON(u).catch(() => null)))).filter(Boolean);
  const items = datas.flatMap(d => cotoParse(store, d));
  if (term) return dedupe(items).slice(0, Math.max(limit, 40));
  const conDesc = dedupe(items).filter(i => i.descuento > 0);
  return conDesc.length >= 8 ? conDesc : dedupe(items);
}

function cotoParse(store, data) {
  const recs = [];
  const seen = new Set();
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const a = n.attributes;
    if (a?.["product.displayName"] && a?.["sku.activePrice"]) {
      const id = a["product.repositoryId"]?.[0] || a["product.displayName"][0];
      if (!seen.has(id)) { seen.add(id); recs.push(n); }
      return;
    }
    for (const k in n) if (n[k] && typeof n[k] === "object") walk(n[k]);
  })(data);

  return recs.map(r => {
    const a = r.attributes;
    const regular = parseFloat(a["sku.activePrice"]?.[0]);
    let precio = regular, lista = 0, promo = null, extra = 0;
    try {
      const dtos = JSON.parse(a["product.dtoDescuentos"]?.[0] || "[]");
      for (const d of dtos) {
        const texto = (d.textoDescuento || "").trim();
        const desc = parseFloat(d.precioDesc);
        if (!(desc > 0)) continue;
        const porUnidadEnCombo = /c\/u/i.test(d.precioDescuento || "") || /x\d|\d\s*x|2(da|do)/i.test(texto);
        if (!porUnidadEnCombo && /%/.test(texto) && desc < precio) { precio = desc; lista = regular; }
        else if (porUnidadEnCombo) {
          const [pName] = promoFromText(texto);
          const eff = pct(regular, desc);
          if (eff > extra) { extra = eff; promo = pName || texto; }
        }
      }
    } catch { /* sin descuentos */ }
    const path = (r.detailsAction?.recordState || "").split("?")[0];
    const eanKey = Object.keys(a).find(k => /ean/i.test(k) && /^\d{8,14}$/.test(a[k]?.[0] || ""));
    return build(store, {
      nombre: a["product.displayName"][0], precio, lista,
      img: a["product.mediumImage.url"]?.[0] || a["product.largeImage.url"]?.[0],
      url: path ? `https://www.cotodigital.com.ar/sitios/cdigi/productos${path}` : store.url,
      extraDisc: extra, promo, ean: eanKey ? a[eanKey][0] : null
    });
  }).filter(Boolean);
}

// ---------------- Pow (Cheeky) ----------------
async function pow(store, q, limit) {
  const { html } = await getHTML(`${store.url}/buscar?q=${encodeURIComponent(q || "")}`);
  const chunks = html.split(/<article class="ProductCard-module/).slice(1);
  if (!chunks.length) throw new StoreError("no se encontró el listado");
  return chunks.slice(0, limit).map(c => {
    c = c.split("</article>")[0];
    const nombre = c.match(/aria-label="([^"]+)"/)?.[1];
    const href = c.match(/href="([^"]+)"/)?.[1];
    const img = c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const row = c.match(/__priceRow">([\s\S]*?)<\/div>/)?.[1] || "";
    const nums = [...row.matchAll(/\$\s?([\d.,]+)/g)].map(x => parseMoney(x[1])).filter(Boolean);
    if (!nums.length) return null;
    return build(store, { nombre, precio: Math.min(...nums), lista: Math.max(...nums), img: img && decodeEntities(img), url: abs(store.url, decodeEntities(href || "")) });
  }).filter(Boolean);
}

// ---------------- Falabella / Sodimac (Next.js) ----------------
async function falabella(store, q, limit) {
  const { html } = await getHTML(`${store.url}/sodimac-ar/search?Ntt=${encodeURIComponent(q || "oferta")}`);
  const raw = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new StoreError("no se encontró __NEXT_DATA__");
  let results;
  try { results = JSON.parse(raw)?.props?.pageProps?.searchProps?.searchData?.results; } catch { throw new StoreError("JSON inválido"); }
  if (!Array.isArray(results)) throw new StoreError("formato Falabella inesperado");
  return results.slice(0, limit).map(r => {
    const prices = (r.prices || []).map(p => ({ type: p.type, v: Number(p.priceWithoutFormatting) || parseMoney(p.price) })).filter(p => p.v > 0);
    const normal = prices.find(p => p.type === "NORMAL")?.v || 0;
    const otros = prices.filter(p => p.type !== "NORMAL").map(p => p.v);
    const precio = otros.length ? Math.min(...otros) : normal;
    const slug = (r.displayName || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return build(store, {
      nombre: `${r.brand ? r.brand + " - " : ""}${r.displayName}`, precio, lista: normal,
      img: r.mediaUrls?.[0] || (r.media?.id ? `https://media.falabella.com/sodimacAR/${r.media.id}_01/w=300,h=300,fit=contain,q=85` : null),
      url: r.url || `${store.url}/sodimac-ar/articulo/${r.productId}/${slug}/${r.skuId}`
    });
  }).filter(Boolean);
}

// ---------------- PrestaShop 1.6 (Little Akiabara) ----------------
async function prestashop(store, q, limit) {
  const url = (t) => `${store.url}/buscar?controller=search&search_query=${encodeURIComponent(t)}&n=48`;
  let { html } = await getHTML(q ? url(q) : `${store.url}/index.php?controller=prices-drop&n=48`);
  if (!q && !html.includes('class="product-container"')) ({ html } = await getHTML(url("body"))); // sin página de ofertas: catálogo general
  const chunks = html.split(/class="product-container"/).slice(1);
  if (!chunks.length) throw new StoreError("no se encontró el listado PrestaShop");
  return chunks.slice(0, limit).map(c => {
    c = c.slice(0, 7000);
    const a = c.match(/class="product-name"[^>]*href="([^"]+)"[^>]*title="([^"]+)"/) || c.match(/href="([^"]+)"[^>]*class="product-name"[^>]*title="([^"]+)"/);
    const precio = parseFloat(c.match(/itemprop="price"\s+content="([\d.]+)"/)?.[1]);
    const lista = parseMoney(c.match(/old-price[^>]*>\s*([^<]+)</)?.[1]);
    const img = c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    return a ? build(store, { nombre: a[2], precio, lista, img, url: a[1] }) : null;
  }).filter(Boolean);
}

// ---------------- Venex (plataforma propia) ----------------
async function venex(store, q, limit) {
  const { html } = await getHTML(`${store.url}/resultado-busqueda.htm?keywords=${encodeURIComponent(q || "notebook")}`);
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/class="product-box-price[^"]*"\s+href="([^"]+)"\s+onclick='enhancedClick\((\{[^']+\})\)'/g)) {
    if (out.length >= limit) break;
    let info; try { info = JSON.parse(m[2]); } catch { continue; }
    const url = decodeEntities(m[1]).split("?")[0];
    if (seen.has(url)) continue;
    seen.add(url);
    const start = html.lastIndexOf("product-box", m.index - 200);
    const block = html.slice(Math.max(0, start - 2500), m.index + 600);
    const img = [...block.matchAll(/<img[^>]+(?:data-src|src)="([^"]+)"/g)].map(x => x[1]).filter(s => !/logo|icon|svg/i.test(s)).pop();
    const old = block.match(/(?:old-price|precio-anterior|price-old)[^>]*>\s*([^<]+)</)?.[1];
    out.push(build(store, { nombre: `${info.brand ? info.brand + " - " : ""}${info.name}`, precio: parseFloat(info.price), lista: parseMoney(old), img, url }));
  }
  if (!out.length && !/no se encontraron|sin resultados/i.test(html)) throw new StoreError("no se encontró el listado de Venex");
  return out.filter(Boolean);
}

// ---------------- Montagne (PrestaShop con tema propio) ----------------
async function montagne(store, q, limit) {
  const { html } = await getHTML(`${store.url}/buscar?search_query=${encodeURIComponent(q || "campera")}`);
  const chunks = html.split(/<div class="product-list(?:\s[^"]*)?">/).slice(1);
  if (!chunks.length) throw new StoreError("no se encontró el listado de Montagne");
  return chunks.slice(0, limit).map(c => {
    c = c.slice(0, 5000);
    const a = c.match(/product-list-info-container[\s\S]*?<a href="([^"]+)"\s+title="([^"]+)"/);
    if (!a) return null;
    const regular = parseMoney(c.match(/price-regular[^>]*>\s*([^<]+)</)?.[1]);
    const oferta = parseMoney(c.match(/price-offer[^>]*>\s*([^<]+)</)?.[1]);
    const etiqueta = c.match(/price-name[^>]*>\s*([^<]+)</)?.[1]?.trim();
    const img = c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const esSocios = /comunidad|socio|club/i.test(etiqueta || "");
    return build(store, {
      nombre: decodeEntities(a[2]), precio: oferta || regular, lista: oferta ? regular : 0, img, url: a[1],
      promo: esSocios ? `Precio ${etiqueta} (registro gratis)` : null
    });
  }).filter(Boolean);
}

// ---------------- MercadoLibre ----------------
async function mercadolibre(store, q, limit) {
  const token = await getMLToken();
  const qs = new URLSearchParams({ q: q || "ofertas", limit: String(Math.min(limit, 50)) });
  const data = await getJSON(`https://api.mercadolibre.com/sites/MLA/search?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  return (data.results || []).map(p => build(store, {
    nombre: p.title, precio: p.price, lista: p.original_price,
    img: p.thumbnail?.replace(/-I\.(jpg|webp)$/, "-O.$1"), url: p.permalink,
    ean: p.attributes?.find?.(x => x.id === "GTIN")?.value_name
  })).filter(Boolean);
}

async function extension() {
  throw new StoreError("bloquea servidores: se consulta desde la extensión de Chrome");
}

export const ADAPTERS = { vtex, vtexIS, shopify, woo, tiendanube, magento, sfcc, coto, pow, falabella, prestashop, venex, montagne, mercadolibre, extension };
export const AUTO_ORDER = ["vtex", "vtexIS", "shopify", "woo"];

// ---------------- orquestación ----------------
const platformCache = new Map();
const deadCache = new Map();
const DEAD_TTL = 30 * 60 * 1000;

export async function queryStore(store, q, limit, opts = {}) {
  const dead = deadCache.get(store.id);
  if (dead && dead.until > Date.now()) throw new StoreError(dead.motivo);

  const known = store.platform !== "auto" ? store.platform : platformCache.get(store.id);
  const order = known ? [known] : AUTO_ORDER;
  const motivos = [];
  for (const plat of order) {
    try {
      const items = await ADAPTERS[plat](store, q, limit, opts);
      platformCache.set(store.id, plat);
      deadCache.delete(store.id);
      return { items, platform: plat };
    } catch (e) {
      motivos.push(`${plat}: ${e.message}`);
      if (!(e instanceof StoreError)) break;
      if (/timeout|sin conexión/.test(e.message)) break;
    }
  }
  const motivo = motivos.join(" | ");
  if (store.platform === "auto" || store.platform === "extension") deadCache.set(store.id, { motivo, until: Date.now() + DEAD_TTL });
  throw new StoreError(motivo);
}

export async function runPool(stores, worker, concurrency, budgetMs) {
  const out = new Array(stores.length);
  let next = 0;
  const deadline = Date.now() + budgetMs;
  async function lane() {
    while (next < stores.length) {
      const i = next++;
      if (Date.now() > deadline) { out[i] = { store: stores[i], error: "sin tiempo" }; continue; }
      const t0 = Date.now();
      try { out[i] = { store: stores[i], ...(await worker(stores[i])), ms: Date.now() - t0 }; }
      catch (e) { out[i] = { store: stores[i], error: e.message, ms: Date.now() - t0 }; }
    }
  }
  const lanes = Array.from({ length: Math.min(concurrency, stores.length) }, lane);
  await Promise.race([Promise.all(lanes), new Promise(r => setTimeout(r, budgetMs + 500))]);
  return out.map((o, i) => o || { store: stores[i], error: "sin tiempo" });
}
