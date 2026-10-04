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

  async function fetchCatalog(domain, storeName, limit = 30) {
    try {
      const url = `https://${domain}/api/catalog_system/pub/products/search/${searchPath}O=OrderByBestDiscountDESC&_from=0&_to=${limit}`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (!r.ok) return [];
      const data = await r.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const item = p.items?.[0];
        const offer = item?.sellers?.[0]?.commertialOffer;
        const current = Number(offer?.Price || offer?.spotPrice || 0);
        const original = Number(offer?.ListPrice || 0);
        let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;

        // Detección 2x1 y promociones en Día
        const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
        for (const t of teasers) {
          const tName = (t.name || "").toLowerCase();
          if (tName.includes("2x1")) disc = Math.max(disc, 50);
          if (tName.includes("70%")) disc = Math.max(disc, 35);
        }

        if (current <= 0) return null;

        // Es BUG si el precio es menor a $1.500 en alimentos/bazar o el descuento supera el 65%
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
      // Consulta en paralelo a tiendas locales y pymes
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

    // Filtrar por descuento mínimo si se seleccionó
    if (minDisc > 0) {
      items = items.filter(it => it.descuento >= minDisc || it.isBug);
    }

    // ORDENAMIENTO ESTRICTO:
    // 1° BUGS / GANGA primero
    // 2° MAYOR % DE DESCUENTO (-80%, -70%, -50%...)
    // 3° Precio más bajo en caso de empate
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
