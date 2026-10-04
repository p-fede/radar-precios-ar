export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "mercadolibre", minDiscount = "40", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 40;

  // Encabezados para evitar bloqueos 403 de Cloudflare/Servidores
  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-419,es;q=0.9"
  };

  let items = [];

  try {
    // -------------------------------------------------------------------------
    // 1. MERCADOLIBRE (Feed oficial de descuentos y ofertas relámpago)
    // -------------------------------------------------------------------------
    if (store === "mercadolibre") {
      const q = category ? `&q=${encodeURIComponent(category)}` : "";
      // Consultar ofertas de hasta el 100% de descuento
      const url = `https://api.mercadolibre.com/sites/MLA/search?deal_ids=MLA1000&sort=relevance&limit=50${q}`;
      const r = await fetch(url, { headers: fakeHeaders });
      const data = await r.json();

      (data.results || []).forEach(p => {
        const current = Number(p.price || 0);
        const original = Number(p.original_price || 0);

        let discount = 0;
        if (original > current && current > 0) {
          discount = Math.round(((original - current) / original) * 100);
        }

        if (current > 0 && (discount >= minDisc || (original > 0 && discount >= 35))) {
          items.push({
            tienda: "MercadoLibre",
            nombre: p.title,
            precio: current,
            precioLista: original > current ? original : null,
            descuento: discount,
            isBug: discount >= 70,
            url: p.permalink
          });
        }
      });
    }

    // -------------------------------------------------------------------------
    // 2. FRÁVEGA (API nativa con headers de navegador)
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

          if (current > 0 && discount >= minDisc) {
            items.push({
              tienda: "Frávega",
              nombre: p.title || p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: discount >= 65,
              url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com"
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. CARREFOUR (VTEX Intelligent Search - Promociones y Descuentos)
    // -------------------------------------------------------------------------
    else if (store === "carrefour") {
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
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

          if (current > 0 && discount >= minDisc) {
            items.push({
              tienda: "Carrefour",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: discount >= 70,
              url: p.link || `https://www.carrefour.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 4. SUPERMERCADOS DÍA (VTEX - Descuentos y 2x1)
    // -------------------------------------------------------------------------
    else if (store === "dia") {
      const q = category ? encodeURIComponent(category) : "";
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

          const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
          for (const t of teasers) {
            const tName = (t.name || "").toLowerCase();
            if (tName.includes("2x1")) discount = Math.max(discount, 50);
            if (tName.includes("70%")) discount = Math.max(discount, 35);
            if (tName.includes("80%")) discount = Math.max(discount, 40);
          }

          if (current > 0 && discount >= minDisc) {
            items.push({
              tienda: "Día Online",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: discount >= 75,
              url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. EASY (VTEX - Mayor descuento en Herramientas y Hogar)
    // -------------------------------------------------------------------------
    else if (store === "easy") {
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://www.easy.com.ar/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
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

          if (current > 0 && discount >= minDisc) {
            items.push({
              tienda: "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: discount >= 70,
              url: `https://www.easy.com.ar/${p.linkText}/p`
            });
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 6. COTO DIGITAL (Scraper de ofertas de catálogo)
    // -------------------------------------------------------------------------
    else if (store === "coto") {
      const term = category ? encodeURIComponent(category).replace(/%20/g, "+") : "ofertas";
      const url = `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${term}`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const html = await r.text();
        // Regex de extracción rápida de tarjetas en Coto
        const productBlocks = html.match(/<li class="clearfix"[\s\S]*?<\/li>/gi) || [];

        productBlocks.forEach(block => {
          const titleMatch = block.match(/<div class="descrip_full">(.*?)<\/div>/i);
          const priceMatch = block.match(/<span class="atg_store_newPrice">\s*\$([\d.,]+)/i);
          const oldPriceMatch = block.match(/<span class="atg_store_oldPrice">\s*\$([\d.,]+)/i);
          const linkMatch = block.match(/href="([^"]*\/sitios\/cdigi\/producto\/[^"]*)"/i);

          if (titleMatch && priceMatch) {
            const cleanTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
            const current = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
            const original = oldPriceMatch ? parseFloat(oldPriceMatch[1].replace(/\./g, "").replace(",", ".")) : 0;

            let discount = 0;
            if (original > current && current > 0) {
              discount = Math.round(((original - current) / original) * 100);
            }

            if (current > 0 && (discount >= minDisc || original > current)) {
              items.push({
                tienda: "Coto Digital",
                nombre: cleanTitle,
                precio: current,
                precioLista: original > current ? original : null,
                descuento: discount,
                isBug: discount >= 60,
                url: linkMatch ? `https://www.cotodigital3.com.ar${linkMatch[1]}` : "https://www.cotodigital3.com.ar"
              });
            }
          }
        });
      }
    }

    // -------------------------------------------------------------------------
    // 7. PEDIDOSYA (Markets y Descuentos Express)
    // -------------------------------------------------------------------------
    else if (store === "pedidosya") {
      // Endpoint público de catálogo y promociones de PedidosYa Market
      const url = `https://card-service.pedidosya.com/v1/cards?countryId=1&maxIndex=40`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        const cards = data.cards || [];

        cards.forEach(c => {
          (c.items || []).forEach(prod => {
            const current = Number(prod.price || 0);
            const original = Number(prod.originalPrice || 0);
            let discount = Number(prod.discount || 0);

            if (original > current && current > 0 && !discount) {
              discount = Math.round(((original - current) / original) * 100);
            }

            if (current > 0 && discount >= minDisc) {
              items.push({
                tienda: "PedidosYa",
                nombre: prod.name || prod.title,
                precio: current,
                precioLista: original > current ? original : null,
                descuento: discount,
                isBug: discount >= 65,
                url: "https://www.pedidosya.com.ar/"
              });
            }
          });
        });
      }
    }

    // -------------------------------------------------------------------------
    // 8. RAPPI (Ofertas y Promociones Turbo)
    // -------------------------------------------------------------------------
    else if (store === "rappi") {
      // Fallback a través del motor público de búsqueda de promociones de Rappi
      const term = category || "ofertas";
      const url = `https://www.rappi.com.ar/api/ms/product/search?query=${encodeURIComponent(term)}&limit=40`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const data = await r.json();
        const products = data.products || data.items || [];

        products.forEach(p => {
          const current = Number(p.price || p.real_price || 0);
          const original = Number(p.original_price || p.price_before_discount || 0);
          let discount = Number(p.discount || 0);

          if (original > current && current > 0 && !discount) {
            discount = Math.round(((original - current) / original) * 100);
          }

          if (current > 0 && discount >= minDisc) {
            items.push({
              tienda: "Rappi",
              nombre: p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuento: discount,
              isBug: discount >= 60,
              url: "https://www.rappi.com.ar/"
            });
          }
        });
      }
    }

    // Ordenar de mayor a menor porcentaje de descuento
    items.sort((a, b) => b.descuento - a.descuento);

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
