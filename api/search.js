export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", q = "", minDiscount = "0" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;
  const rawQ = q.trim();
  const queryParam = rawQ ? `${encodeURIComponent(rawQ)}?map=ft&` : "?";

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  async function fetchVtexStore(domain, storeName, limit = 20) {
    try {
      const url = `https://${domain}/api/catalog_system/pub/products/search/${queryParam}O=OrderByBestDiscountDESC&_from=0&_to=${limit}`;
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

        if (current <= 0) return null;

        return {
          tienda: storeName,
          nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          isBug: (current < 2000 && current > 10) || disc >= 65,
          url: p.link || `https://${domain}/${p.linkText}/p`
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  let items = [];

  try {
    // 1. CARREFOUR (Individual)
    if (store === "carrefour") {
      items = await fetchVtexStore("www.carrefour.com.ar", "Carrefour", 35);
    }
    // 2. DÍA ONLINE (Individual)
    else if (store === "dia") {
      items = await fetchVtexStore("diaonline.supermercadosdia.com.ar", "Día Online", 35);
    }
    // 3. EASY (Individual)
    else if (store === "easy") {
      items = await fetchVtexStore("www.easy.com.ar", "Easy", 35);
    }
    // 4. TIENDAS LOCALES, MINORISTAS Y ELECTRO (Megatone, Cetrogar, Naldo, Bidcom)
    else if (store === "locales") {
      const targets = [
        { domain: "www.cetrogar.com.ar", name: "Cetrogar" },
        { domain: "www.megatone.net", name: "Megatone" },
        { domain: "www.naldo.com.ar", name: "Naldo" },
        { domain: "www.bidcom.com.ar", name: "Bidcom" }
      ];

      const batch = targets.map(t => fetchVtexStore(t.domain, t.name, 12));
      const settled = await Promise.allSettled(batch);
      settled.forEach(r => {
        if (r.status === "fulfilled") items.push(...r.value);
      });
    }

    // Filtrar por descuento mínimo
    if (minDisc > 0) {
      items = items.filter(it => it.descuento >= minDisc || it.isBug);
    }

    items.sort((a, b) => a.precio - b.precio);

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
