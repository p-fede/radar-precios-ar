export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", q = "", minDiscount = "0" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;
  const query = encodeURIComponent(q.trim());

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  let items = [];

  try {
    // ----------------------------------------------------
    // OPCIÓN 1: CARREFOUR (Individual)
    // ----------------------------------------------------
    if (store === "carrefour") {
      const url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;
          if (current > 0 && (disc >= minDisc || minDisc === 0)) {
            items.push({
              tienda: "Carrefour",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: disc,
              isBug: (current < 1200 && current > 10) || disc >= 65,
              url: p.link || `https://www.carrefour.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // OPCIÓN 2: SUPERMERCADOS DÍA (Individual)
    // ----------------------------------------------------
    else if (store === "dia") {
      const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;

          const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
          for (const t of teasers) {
            const tName = (t.name || "").toLowerCase();
            if (tName.includes("2x1")) disc = Math.max(disc, 50);
            if (tName.includes("70%")) disc = Math.max(disc, 35);
          }

          if (current > 0 && (disc >= minDisc || minDisc === 0)) {
            items.push({
              tienda: "Día Online",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: disc,
              isBug: (current < 1200 && current > 10) || disc >= 65,
              url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // OPCIÓN 3: EASY (Individual)
    // ----------------------------------------------------
    else if (store === "easy") {
      const url = `https://www.easy.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;
          if (current > 0 && (disc >= minDisc || minDisc === 0)) {
            items.push({
              tienda: "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: disc,
              isBug: (current < 1500 && current > 10) || disc >= 65,
              url: `https://www.easy.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // OPCIÓN 4: TIENDAS LOCALES, MINORISTAS Y PYMES (Todas juntas)
    // ----------------------------------------------------
    else if (store === "locales") {
      const LOCAL_TARGETS = [
        {
          name: "Bidcom",
          url: `https://www.bidcom.com.ar/api/catalog_system/pub/products/search/${query || 'ofertas'}?O=OrderByBestDiscountDESC&_from=0&_to=10`
        },
        {
          name: "Megatone",
          url: `https://www.megatone.net/api/catalog_system/pub/products/search/${query || 'ofertas'}?O=OrderByBestDiscountDESC&_from=0&_to=10`
        },
        {
          name: "Cetrogar",
          url: `https://www.cetrogar.com.ar/api/catalog_system/pub/products/search/${query || 'ofertas'}?O=OrderByBestDiscountDESC&_from=0&_to=10`
        },
        {
          name: "Naldo",
          url: `https://www.naldo.com.ar/api/catalog_system/pub/products/search/${query || 'ofertas'}?O=OrderByBestDiscountDESC&_from=0&_to=10`
        }
      ];

      const localFetches = LOCAL_TARGETS.map(async (t) => {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(t.url, { headers: fakeHeaders, signal: controller.signal });
          clearTimeout(tid);

          if (!res.ok) return [];
          const data = await res.json();
          if (!Array.isArray(data)) return [];

          return data.map(p => {
            const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
            const current = Number(offer?.Price || offer?.spotPrice || 0);
            const original = Number(offer?.ListPrice || 0);
            let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;

            if (current <= 0) return null;
            return {
              tienda: t.name,
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: disc,
              isBug: (current < 2500 && disc >= 40) || disc >= 65,
              url: p.link || `https://${t.name.toLowerCase()}.com.ar`
            };
          }).filter(Boolean);
        } catch {
          return [];
        }
      });

      const settled = await Promise.allSettled(localFetches);
      settled.forEach(r => {
        if (r.status === "fulfilled") items.push(...r.value);
      });
    }

    // Filtrar duplicados y ordenar de menor a mayor precio
    items = items.filter(it => it.precio > 0);
    items.sort((a, b) => a.precio - b.precio);

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
