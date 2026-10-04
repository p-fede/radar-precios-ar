export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "mercadolibre", minDiscount = "30", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 30;

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-419,es;q=0.9"
  };

  let items = [];

  // Coordenadas fijas de CABA (Obelisco) para habilitar Rappi y PedidosYa
  const LAT = "-34.6037";
  const LNG = "-58.3816";

  try {
    // -------------------------------------------------------------------------
    // 1. PEDIDOSYA (DMarket Express CABA - Ofertas y Precios Ridículos)
    // -------------------------------------------------------------------------
    if (store === "pedidosya") {
      const q = category ? encodeURIComponent(category) : "almacen";
      const url = `https://disco.api.pedidosya.com/v1/search/products?query=${q}&point=${LAT}%2C${LNG}&countryId=1&max=50`;
      
      const r = await fetch(url, {
        headers: {
          ...fakeHeaders,
          "Origin": "https://www.pedidosya.com.ar",
          "Referer": "https://www.pedidosya.com.ar/"
        }
      });

      if (r.ok) {
        const data = await r.json();
        const prods = data.products || data.data || [];

        prods.forEach(p => {
          const current = Number(p.price || 0);
          const original = Number(p.originalPrice || 0);
          let discount = 0;

          if (original > current && current > 0) {
            discount = Math.round(((original - current) / original) * 100);
          }

          // ANOMALÍA: Precio bug sin descuento anunciado (ej: comida a menos de $400)
          const isBugSinDescuento = current > 10 && current <= 400;
          const isBug = discount >= 65 || isBugSinDescuento;

          if (current > 0 && (discount >= minDisc || isBugSinDescuento)) {
            items.push({
              tienda: "PedidosYa",
              nombre: p.name || p.title,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount > 0 ? discount : (isBugSinDescuento ? 90 : 0),
              isBug: isBug,
              url: "https://www.pedidosya.com.ar/"
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. RAPPI (Turbo & Supermercados - Precios Bug y Promos)
    // -------------------------------------------------------------------------
    else if (store === "rappi") {
      const q = category ? encodeURIComponent(category) : "ofertas";
      const url = `https://services.rappi.com.ar/api/ms/product/search?query=${q}&lat=${LAT}&lng=${LNG}&limit=50`;

      const r = await fetch(url, {
        headers: {
          ...fakeHeaders,
          "Origin": "https://www.rappi.com.ar",
          "Referer": "https://www.rappi.com.ar/"
        }
      });

      if (r.ok) {
        const data = await r.json();
        const prods = data.products || data.items || [];

        prods.forEach(p => {
          const current = Number(p.price || p.real_price || 0);
          const original = Number(p.original_price || p.price_before_discount || 0);
          let discount = Number(p.discount || 0);

          if (original > current && current > 0 && !discount) {
            discount = Math.round(((original - current) / original) * 100);
          }

          const isBugSinDescuento = current > 10 && current <= 500;
          const isBug = discount >= 65 || isBugSinDescuento;

          if (current > 0 && (discount >= minDisc || isBugSinDescuento)) {
            items.push({
              tienda: "Rappi",
              nombre: p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount > 0 ? discount : (isBugSinDescuento ? 85 : 0),
              isBug: isBug,
              url: "https://www.rappi.com.ar/"
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. MERCADOLIBRE (Buscador Global de Descuentos Reales y Errores de Carga)
    // -------------------------------------------------------------------------
    else if (store === "mercadolibre") {
      const q = category ? encodeURIComponent(category) : "outlet";
      // Consultar la API abierta filtrando por publicaciones activas con stock
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&status=active&limit=50`;
      const r = await fetch(url, { headers: fakeHeaders });
      const data = await r.json();

      (data.results || []).forEach(p => {
        const current = Number(p.price || 0);
        const original = Number(p.original_price || 0);

        let discount = 0;
        if (original > current && current > 0) {
          discount = Math.round(((original - current) / original) * 100);
        }

        // Detectar si el precio es irrisorio para la categoría o tiene descuento masivo
        const isBug = discount >= 65 || (current > 50 && current < 1500 && original > 6000);

        if (current > 100 && (discount >= minDisc || isBug)) {
          items.push({
            tienda: "MercadoLibre",
            nombre: p.title,
            precio: current,
            precioLista: original > current ? original : null,
            descuento: discount,
            isBug: isBug,
            url: p.permalink
          });
        }
      });
    }

    // -------------------------------------------------------------------------
    // 4. SUPERMERCADOS DÍA (Atrapa Precios Descuento + Bugs Sin Descuento como Chorizo $200)
    // -------------------------------------------------------------------------
    else if (store === "dia") {
      const q = category ? encodeURIComponent(category) : "";
      // Consultamos catálogo general ordenado por mayor descuento
      const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
      const r = await fetch(url, { headers: fakeHeaders });
      
      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);

          let discount = 0;
          if (original > current && current > 0) {
            discount = Math.round(((original - current) / original) * 100);
          }

          // Atrapa promociones 2x1 y 2do al 70%
          const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
          for (const t of teasers) {
            const tName = (t.name || "").toLowerCase();
            if (tName.includes("2x1")) discount = Math.max(discount, 50);
            if (tName.includes("70%")) discount = Math.max(discount, 35);
          }

          // PRECIO BUG ABSOLUTO: Productos de carnicería/fiambrería/almacén con precio menor a $500
          const isBugSinDescuento = current > 10 && current <= 500;
          const isBug = discount >= 70 || isBugSinDescuento;

          if (current > 0 && (discount >= minDisc || isBugSinDescuento)) {
            items.push({
              tienda: "Día Online",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount > 0 ? discount : (isBugSinDescuento ? 95 : 0),
              isBug: isBug,
              url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. FRÁVEGA (API nativa con fallback directo)
    // -------------------------------------------------------------------------
    else if (store === "fravega") {
      const q = category ? `keyword=${encodeURIComponent(category)}&` : "";
      const url = `https://www.fravega.com/api/v2/products/search?${q}size=50&sort=discount,desc`;
      const r = await fetch(url, { headers: fakeHeaders });
      
      if (r.ok) {
        const data = await r.json();
        const list = data.products || data.items || [];

        list.forEach(p => {
          const current = Number(p.price || p.salePrice || 0);
          const original = Number(p.listPrice || p.originalPrice || 0);
          let discount = Number(p.discount || p.discountPercentage || 0);

          if (original > current && current > 0 && !discount) {
            discount = Math.round(((original - current) / original) * 100);
          }

          const isBug = discount >= 60 || (current > 0 && current < 5000 && original > 25000);

          if (current > 0 && (discount >= minDisc || isBug)) {
            items.push({
              tienda: "Frávega",
              nombre: p.title || p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: isBug,
              url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com"
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 6. CARREFOUR & EASY (VTEX)
    // -------------------------------------------------------------------------
    else if (store === "carrefour" || store === "easy") {
      const host = store === "carrefour" ? "www.carrefour.com.ar" : "www.easy.com.ar";
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://${host}/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
      const r = await fetch(url, { headers: fakeHeaders });

      if (r.ok) {
        const data = await r.json();
        (Array.isArray(data) ? data : []).forEach(p => {
          const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
          const current = Number(offer?.Price || offer?.spotPrice || 0);
          const original = Number(offer?.ListPrice || 0);

          let discount = 0;
          if (original > current && current > 0) {
            discount = Math.round(((original - current) / original) * 100);
          }

          const isBug = discount >= 70 || (current > 10 && current < 800);

          if (current > 0 && (discount >= minDisc || isBug)) {
            items.push({
              tienda: store === "carrefour" ? "Carrefour" : "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: isBug,
              url: p.link || `https://${host}/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 7. COTO DIGITAL (Búsqueda directa por enlace de ofertas)
    // -------------------------------------------------------------------------
    else if (store === "coto") {
      // Como Coto bloquea llamadas directas desde la nube, generamos los accesos directos
      // a las secciones de liquidación real para evitar fallos de conexión
      const term = category ? encodeURIComponent(category).replace(/%20/g, "+") : "ofertas";
      return res.status(200).json([
        {
          tienda: "Coto Digital",
          nombre: `Liquidaciones destacadas de Coto (${category || 'General'})`,
          precio: 0,
          precioLista: null,
          descuento: 0,
          isBug: true,
          url: `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${term}`,
          isDirectLink: true
        }
      ]);
    }

    // Ordenar priorizando los PRECIOS BUG primero, y luego mayor descuento
    items.sort((a, b) => (b.isBug ? 1 : 0) - (a.isBug ? 1 : 0) || b.descuento - a.descuento);

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
