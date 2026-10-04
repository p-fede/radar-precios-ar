export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "mercadolibre", minDiscount = "50", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 50;

  let items = [];

  try {
    // ----------------------------------------------------
    // 1. MERCADOLIBRE (API pública de ofertas y descuentos)
    // ----------------------------------------------------
    if (store === "mercadolibre") {
      const q = category ? encodeURIComponent(category) : "liquidacion";
      // Ordenamos por mayor relevancia de ofertas
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&sort=price_asc&limit=50`;
      const r = await fetch(url);
      const data = await r.json();

      (data.results || []).forEach(p => {
        const current = Number(p.price || 0);
        const original = Number(p.original_price || 0);

        let discount = 0;
        if (original > current && current > 0) {
          discount = Math.round(((original - current) / original) * 100);
        }

        // Si tiene descuento significativo o es un precio ridículamente bajo
        if (discount >= minDisc || (original > 0 && discount >= 40)) {
          items.push({
            tienda: "MercadoLibre",
            nombre: p.title,
            precio: current,
            precioLista: original > current ? original : null,
            descuento: discount,
            isBug: discount >= 70,
            url: p.permalink,
            img: p.thumbnail?.replace("-I.jpg", "-O.jpg")
          });
        }
      });
    }

    // ----------------------------------------------------
    // 2. FRÁVEGA (API nativa ordenada por mayor descuento)
    // ----------------------------------------------------
    else if (store === "fravega") {
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://www.fravega.com/api/v2/products/search?${q ? `keyword=${q}&` : ""}size=50&sort=discount,desc`;
      const r = await fetch(url);
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
            url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com",
            img: p.image || null
          });
        }
      });
    }

    // ----------------------------------------------------
    // 3. DÍA ONLINE (API VTEX de mayor descuento)
    // ----------------------------------------------------
    else if (store === "dia") {
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
      const r = await fetch(url);
      const data = await r.json();

      (Array.isArray(data) ? data : []).forEach(p => {
        const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
        const current = Number(offer?.Price || offer?.spotPrice || 0);
        const original = Number(offer?.ListPrice || 0);

        let discount = 0;
        if (original > current && current > 0) {
          discount = Math.round(((original - current) / original) * 100);
        }

        // Revisar promociones de volumen (2x1, 2do al 70%)
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
            url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`,
            img: p.items?.[0]?.images?.[0]?.imageUrl || null
          });
        }
      });
    }

    // ----------------------------------------------------
    // 4. EASY (API VTEX ordenada por mayor descuento)
    // ----------------------------------------------------
    else if (store === "easy") {
      const q = category ? encodeURIComponent(category) : "";
      const url = `https://www.easy.com.ar/api/catalog_system/pub/products/search/${q}?O=OrderByBestDiscountDESC&_from=0&_to=49`;
      const r = await fetch(url);
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
            url: `https://www.easy.com.ar/${p.linkText}/p`,
            img: p.items?.[0]?.images?.[0]?.imageUrl || null
          });
        }
      });
    }

    // Ordenar de mayor a menor porcentaje de descuento
    items.sort((a, b) => b.descuento - a.descuento);

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
