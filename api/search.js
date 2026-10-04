export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", minDiscount = "30", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 30;

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-419,es;q=0.9"
  };

  // Helper para consultar la mediana de precio en MercadoLibre y contrastar
  async function checkMarketBenchmark(title) {
    try {
      const clean = title
        .replace(/[\(\)\[\],.\/]/g, " ")
        .replace(/\b(supermercados|dia|carrefour|easy|fravega|oferta|promo|gr|kg|ml|lt|un)\b/gi, "")
        .replace(/[^\w\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 3)
        .join(" ");

      const res = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(clean)}&limit=5`, { headers: fakeHeaders });
      if (!res.ok) return null;
      const data = await res.json();
      const prices = (data.results || []).map(r => r.price).filter(p => p > 100);
      if (prices.length === 0) return null;
      prices.sort((a, b) => a - b);
      return prices[Math.floor(prices.length / 2)];
    } catch {
      return null;
    }
  }

  let rawItems = [];

  try {
    // -------------------------------------------------------------------------
    // 1. CARREFOUR (VTEX)
    // -------------------------------------------------------------------------
    if (store === "carrefour") {
      const term = category ? encodeURIComponent(category) : "";
      const url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search/${term}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = 0;
          if (original > current && current > 0) {
            disc = Math.round(((original - current) / original) * 100);
          }
          if (current > 0 && disc >= minDisc) {
            rawItems.push({
              tienda: "Carrefour",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              url: p.link || `https://www.carrefour.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. DÍA ONLINE (VTEX)
    // -------------------------------------------------------------------------
    else if (store === "dia") {
      const term = category ? encodeURIComponent(category) : "";
      const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${term}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = 0;
          if (original > current && current > 0) {
            disc = Math.round(((original - current) / original) * 100);
          }
          const isBugSinDescuento = current > 10 && current <= 500;
          if (current > 0 && (disc >= minDisc || isBugSinDescuento)) {
            rawItems.push({
              tienda: "Día Online",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc > 0 ? disc : (isBugSinDescuento ? 85 : 0),
              url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. EASY (VTEX)
    // -------------------------------------------------------------------------
    else if (store === "easy") {
      const term = category ? encodeURIComponent(category) : "";
      const url = `https://www.easy.com.ar/api/catalog_system/pub/products/search/${term}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);
          let disc = 0;
          if (original > current && current > 0) {
            disc = Math.round(((original - current) / original) * 100);
          }
          if (current > 0 && disc >= minDisc) {
            rawItems.push({
              tienda: "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              url: `https://www.easy.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 4. FRÁVEGA (API nativa)
    // -------------------------------------------------------------------------
    else if (store === "fravega") {
      const term = category ? `keyword=${encodeURIComponent(category)}&` : "";
      const url = `https://www.fravega.com/api/v2/products/search?${term}size=35&sort=discount,desc`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        const list = data.products || data.items || [];
        list.forEach(p => {
          const current = Number(p.price || p.salePrice || 0);
          const original = Number(p.listPrice || p.originalPrice || 0);
          let disc = Number(p.discount || p.discountPercentage || 0);
          if (original > current && current > 0 && !disc) {
            disc = Math.round(((original - current) / original) * 100);
          }
          if (current > 0 && disc >= minDisc) {
            rawItems.push({
              tienda: "Frávega",
              nombre: p.title || p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com"
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. MERCADOLIBRE (Ofertas oficiales activas)
    // -------------------------------------------------------------------------
    else if (store === "mercadolibre") {
      const term = category ? encodeURIComponent(category) : "tecnologia";
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${term}&sort=relevance&limit=40`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        (data.results || []).forEach(p => {
          const current = Number(p.price || 0);
          const original = Number(p.original_price || 0);
          let disc = 0;
          if (original > current && current > 0) {
            disc = Math.round(((original - current) / original) * 100);
          }
          if (current > 0 && (disc >= minDisc || original > current)) {
            rawItems.push({
              tienda: "MercadoLibre",
              nombre: p.title,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              url: p.permalink
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 6. COTO, RAPPI Y PEDIDOSYA (Acceso asistido directo)
    // -------------------------------------------------------------------------
    else if (store === "coto" || store === "rappi" || store === "pedidosya") {
      const configs = {
        coto: {
          name: "Coto Digital",
          desc: "Coto requiere acceso directo para no bloquear la conexión.",
          url: `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${encodeURIComponent(category || "ofertas").replace(/%20/g, "+")}`
        },
        rappi: {
          name: "Rappi Turbo",
          desc: "Rappi requiere sesión y ubicación activa en tu zona.",
          url: "https://www.rappi.com.ar/"
        },
        pedidosya: {
          name: "PedidosYa Markets",
          desc: "PedidosYa exige ubicación de entrega local para cotizar.",
          url: "https://www.pedidosya.com.ar/"
        }
      };

      const c = configs[store];
      return res.status(200).json([{
        tienda: c.name,
        nombre: `Abrir ofertas en ${c.name} (${category || 'Liquidaciones'})`,
        precio: 0,
        precioLista: null,
        descuentoTienda: 0,
        url: c.url,
        isDirectLink: true,
        desc: c.desc
      }]);
    }

    // -------------------------------------------------------------------------
    // AUDITORÍA ANTIESTAFA CRUZADA: Comparar contra el mercado real
    // -------------------------------------------------------------------------
    const auditedItems = [];
    const candidates = rawItems.slice(0, 20); // Analizar los 20 mejores

    for (const item of candidates) {
      const benchmark = await checkMarketBenchmark(item.nombre);
      let verdict = "REGULAR";
      let verdictLabel = "🟡 PRECIO COMÚN";
      let verdictColor = "text-yellow-400";
      let marketInfo = "Sin datos externos suficientes";

      if (benchmark && benchmark > 0) {
        marketInfo = `Mercado / Otras tiendas: $ ${benchmark.toLocaleString("es-AR")}`;

        // CASO 1: ESTAFA / PRECIO INFLADO (Como la barra LG de la foto)
        // La tienda dice tener descuento, pero su precio actual es mayor o igual al mercado
        if (item.precio >= benchmark * 1.05) {
          verdict = "INFLADO";
          verdictLabel = "🔴 ESTAFA: PRECIO INFLADO";
          verdictColor = "text-red-500 font-black";
        }
        // CASO 2: OFERTA REAL COMPROBADA
        // El precio actual es al menos un 15% más barato que en el resto del mercado
        else if (item.precio < benchmark * 0.85) {
          const ahorroReal = Math.round(((benchmark - item.precio) / benchmark) * 100);
          verdict = "REAL";
          verdictLabel = `🟢 OFERTA REAL (-${ahorroReal}% vs Mercado)`;
          verdictColor = "text-emerald-400 font-black";
        } else {
          verdict = "REGULAR";
          verdictLabel = "🟡 PRECIO ESTÁNDAR";
          verdictColor = "text-yellow-400 font-semibold";
        }
      }

      auditedItems.push({
        ...item,
        verdict,
        verdictLabel,
        verdictColor,
        marketInfo,
        benchmarkPrice: benchmark
      });
    }

    // Ordenar: Primero las Ofertas Reales contrastadas, luego regulares y al final las infladas
    const weights = { "REAL": 1, "REGULAR": 2, "INFLADO": 3 };
    auditedItems.sort((a, b) => (weights[a.verdict] - weights[b.verdict]) || (b.descuentoTienda - a.descuentoTienda));

    return res.status(200).json(auditedItems);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
