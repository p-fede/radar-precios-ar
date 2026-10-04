export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "todas", q = "", minDiscount = "0" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;
  const rawQ = q.trim();
  const searchPath = rawQ ? `${encodeURIComponent(rawQ)}?map=ft&` : "?";

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  // Motor universal VTEX (obtiene imágenes, precios limpios y calcula ahorros)
  async function fetchVtexStore(domain, storeName, limit = 25) {
    try {
      const url = `https://${domain}/api/catalog_system/pub/products/search/${searchPath}O=OrderByBestDiscountDESC&_from=0&_to=${limit}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 3800);

      const r = await fetch(url, { headers: fakeHeaders, signal: controller.signal });
      clearTimeout(tid);

      if (!r.ok) return [];
      const data = await r.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const item = p.items?.[0];
        const offer = item?.sellers?.[0]?.commertialOffer;
        const current = Number(offer?.Price || offer?.spotPrice || 0);
        const original = Number(offer?.ListPrice || 0);
        let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;

        // Detección de promociones 2x1 y 2da al 70% en Día/Carrefour
        const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
        for (const t of teasers) {
          const tName = (t.name || "").toLowerCase();
          if (tName.includes("2x1")) disc = Math.max(disc, 50);
          if (tName.includes("70%")) disc = Math.max(disc, 35);
        }

        if (current <= 0) return null;

        // Imagen en alta definición
        let img = item?.images?.[0]?.imageUrl || "";
        if (img.startsWith("http://")) img = img.replace("http://", "https://");

        // Detección de bug o liquidación extrema
        const isBug = (current < 1500 && current > 10 && disc >= 30) || disc >= 65;

        return {
          tienda: storeName,
          nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          ahorro: original > current ? Math.round(original - current) : 0,
          isBug: isBug,
          img: img || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300&q=80",
          url: p.link || `https://${domain}/${p.linkText}/p`
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  // Motor MercadoLibre Oficial
  async function fetchMercadoLibre(limit = 35) {
    try {
      const qParam = rawQ ? encodeURIComponent(rawQ) : "ofertas";
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${qParam}&limit=${limit}`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (!r.ok) return [];
      const data = await r.json();

      return (data.results || []).map(p => {
        const current = Number(p.price || 0);
        const original = Number(p.original_price || 0);
        let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;

        if (current <= 0) return null;

        const isBug = disc >= 65 || (current < 1500 && current > 10 && disc >= 30);
        const img = p.thumbnail?.replace("-I.jpg", "-O.jpg") || p.thumbnail;

        return {
          tienda: "MercadoLibre",
          nombre: p.title,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          ahorro: original > current ? Math.round(original - current) : 0,
          isBug: isBug,
          img: img || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300&q=80",
          url: p.permalink
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  let items = [];

  try {
    const STORES_MAP = {
      carrefour: () => fetchVtexStore("www.carrefour.com.ar", "Carrefour", 35),
      dia: () => fetchVtexStore("diaonline.supermercadosdia.com.ar", "Día Online", 35),
      easy: () => fetchVtexStore("www.easy.com.ar", "Easy", 35),
      cetrogar: () => fetchVtexStore("www.cetrogar.com.ar", "Cetrogar", 25),
      megatone: () => fetchVtexStore("www.megatone.net", "Megatone", 25),
      bidcom: () => fetchVtexStore("www.bidcom.com.ar", "Bidcom", 25),
      naldo: () => fetchVtexStore("www.naldo.com.ar", "Naldo", 25),
      mercadolibre: () => fetchMercadoLibre(35)
    };

    if (store !== "todas" && STORES_MAP[store]) {
      items = await STORES_MAP[store]();
    } else {
      // Rastrear todas en paralelo
      const jobs = Object.values(STORES_MAP).map(fn => fn());
      const settled = await Promise.allSettled(jobs);
      settled.forEach(r => {
        if (r.status === "fulfilled") items.push(...r.value);
      });
    }

    if (minDisc > 0) {
      items = items.filter(it => it.descuento >= minDisc || it.isBug);
    }

    // Ordenamiento estricto estilo Detector:
    // 1° Bugs primero (🚨)
    // 2° Mayor porcentaje de descuento (-90%, -80%, -70%)
    // 3° Mayor ahorro en pesos
    items.sort((a, b) => {
      if (b.isBug !== a.isBug) return (b.isBug ? 1 : 0) - (a.isBug ? 1 : 0);
      if (b.descuento !== a.descuento) return b.descuento - a.descuento;
      return b.ahorro - a.ahorro;
    });

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
