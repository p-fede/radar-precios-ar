export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", q = "", minDiscount = "0" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;
  const rawQ = q.trim();
  const searchPath = rawQ ? `${encodeURIComponent(rawQ)}?map=ft&` : "?";

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  async function fetchCatalog(domain, storeName, limit = 35) {
    try {
      const url = `https://${domain}/api/catalog_system/pub/products/search/${searchPath}O=OrderByBestDiscountDESC&_from=0&_to=${limit}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 3500);

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

        // Detección de promociones 2x1 y 2do al 70%
        const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
        for (const t of teasers) {
          const tName = (t.name || "").toLowerCase();
          if (tName.includes("2x1")) disc = Math.max(disc, 50);
          if (tName.includes("70%")) disc = Math.max(disc, 35);
        }

        if (current <= 0) return null;
        const isBug = (current < 1500 && current > 10 && disc >= 30) || disc >= 65;

        return {
          tienda: storeName,
          nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          isBug: isBug,
          url: p.link || `https://${domain}/${p.linkText}/p`
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  let items = [];

  try {
    if (store === "carrefour") {
      items = await fetchCatalog("www.carrefour.com.ar", "Carrefour", 40);
    } else if (store === "dia") {
      items = await fetchCatalog("diaonline.supermercadosdia.com.ar", "Día Online", 40);
    } else if (store === "easy") {
      items = await fetchCatalog("www.easy.com.ar", "Easy", 40);
    } else if (store === "locales") {
      const targets = [
        { domain: "www.cetrogar.com.ar", name: "Cetrogar" },
        { domain: "www.megatone.net", name: "Megatone" },
        { domain: "www.bidcom.com.ar", name: "Bidcom" },
        { domain: "www.naldo.com.ar", name: "Naldo" }
      ];

      const fetches = targets.map(t => fetchCatalog(t.domain, t.name, 15));
      const settled = await Promise.allSettled(fetches);
      settled.forEach(r => {
        if (r.status === "fulfilled") items.push(...r.value);
      });
    }

    if (minDisc > 0) {
      items = items.filter(it => it.descuento >= minDisc || it.isBug);
    }

    // Ordenamiento prioritario: Bugs arriba, luego mayor % de descuento, luego menor precio
    items.sort((a, b) => {
      if (b.isBug !== a.isBug) return (b.isBug ? 1 : 0) - (a.isBug ? 1 : 0);
      if (b.descuento !== a.descuento) return b.descuento - a.descuento;
      return a.precio - b.precio;
    });

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
