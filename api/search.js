export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", minDiscount = "0", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"
  };

  // Comparador de mercado con fallback inteligente
  async function checkMarket(title, storePrice) {
    try {
      const clean = title
        .replace(/[\(\)\[\],.\/]/g, " ")
        .replace(/\b(supermercados|dia|carrefour|expert|easy|fravega|oferta|promo|gr|kg|ml|lt|un|de|para|con)\b/gi, "")
        .replace(/[^\w\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 3)
        .join(" ");

      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 1600);

      const r = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(clean)}&limit=5`, {
        headers: fakeHeaders,
        signal: controller.signal
      });
      clearTimeout(tId);

      if (!r.ok) return null;
      const data = await r.json();
      const prices = (data.results || []).map(x => x.price).filter(p => p > 100);
      if (prices.length === 0) return null;
      prices.sort((a, b) => a - b);
      return prices[Math.floor(prices.length / 2)];
    } catch {
      return null;
    }
  }

  let items = [];

  try {
    // ----------------------------------------------------
    // 1. CARREFOUR, DÍA & EASY (VTEX Directo)
    // ----------------------------------------------------
    if (store === "carrefour" || store === "dia" || store === "easy") {
      const hosts = {
        carrefour: "www.carrefour.com.ar",
        dia: "diaonline.supermercadosdia.com.ar",
        easy: "www.easy.com.ar"
      };
      const term = category ? encodeURIComponent(category) : "";
      const url = `https://${hosts[store]}/api/catalog_system/pub/products/search/${term}?O=OrderByBestDiscountDESC&_from=0&_to=39`;
      
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

          // Atrapa promociones 2x1 y 70% en Día
          const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
          for (const t of teasers) {
            const tName = (t.name || "").toLowerCase();
            if (tName.includes("2x1")) disc = Math.max(disc, 50);
            if (tName.includes("70%")) disc = Math.max(disc, 35);
          }

          // Detección de ganga extrema por precio absoluto (ej: repelente o alimento < $1000)
          const isSuperGanga = (current > 10 && current < 1200) || disc >= 65;

          if (current > 0 && (disc >= minDisc || isSuperGanga || minDisc === 0)) {
            items.push({
              tienda: store === "carrefour" ? "Carrefour" : store === "dia" ? "Día Online" : "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              isSuperGanga,
              url: p.link || `https://${hosts[store]}/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // 2. MERCADOLIBRE (Catálogo real de ofertas)
    // ----------------------------------------------------
    else if (store === "mercadolibre") {
      const q = category ? encodeURIComponent(category) : "ofertas";
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&sort=relevance&limit=45`;
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
          if (current > 0 && (disc >= minDisc || minDisc === 0 || original > current)) {
            items.push({
              tienda: "MercadoLibre",
              nombre: p.title,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              isSuperGanga: disc >= 50,
              url: p.permalink
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // 3. FRÁVEGA (API nativa adaptada)
    // ----------------------------------------------------
    else if (store === "fravega") {
      const q = category ? encodeURIComponent(category) : "tecnologia";
      const url = `https://www.fravega.com/api/v2/products/search?keyword=${q}&size=40&sort=discount,desc`;
      const r = await fetch(url, { 
        headers: { 
          ...fakeHeaders,
          "Referer": "https://www.fravega.com/"
        } 
      });
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
          if (current > 0 && (disc >= minDisc || minDisc === 0)) {
            items.push({
              tienda: "Frávega",
              nombre: p.title || p.name,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              isSuperGanga: disc >= 50,
              url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com"
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // 4. PEDIDOSYA & RAPPI (Mercados Express)
    // ----------------------------------------------------
    else if (store === "pedidosya" || store === "rappi") {
      const r = await fetch(`https://card-service.pedidosya.com/v1/cards?countryId=1&maxIndex=40`, { 
        headers: {
          ...fakeHeaders,
          "Origin": "https://www.pedidosya.com.ar",
          "Referer": "https://www.pedidosya.com.ar/"
        }
      });
      if (r.ok) {
        const data = await r.json();
        (data.cards || []).forEach(c => {
          (c.items || []).forEach(prod => {
            const current = Number(prod.price || 0);
            const original = Number(prod.originalPrice || 0);
            let disc = Number(prod.discount || 0);
            if (original > current && current > 0 && !disc) {
              disc = Math.round(((original - current) / original) * 100);
            }
            const isBug = current > 10 && current < 600;
            if (current > 0 && (disc >= minDisc || isBug || minDisc === 0)) {
              items.push({
                tienda: store === "pedidosya" ? "PedidosYa Market" : "Rappi Turbo",
                nombre: prod.name || prod.title,
                precio: current,
                precioLista: original > current ? original : null,
                descuentoTienda: disc,
                isSuperGanga: isBug || disc >= 50,
                url: store === "pedidosya" ? "https://www.pedidosya.com.ar/" : "https://www.rappi.com.ar/"
              });
            }
          });
        });
      }
    }

    // ----------------------------------------------------
    // 5. COTO DIGITAL (Acceso por catálogo estructurado)
    // ----------------------------------------------------
    else if (store === "coto") {
      const term = category ? encodeURIComponent(category).replace(/%20/g, "+") : "almacen";
      const url = `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${term}`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/<li class="clearfix"[\s\S]*?<\/li>/gi) || [];
        matches.slice(0, 30).forEach(block => {
          const titleM = block.match(/<div class="descrip_full">(.*?)<\/div>/i);
          const priceM = block.match(/<span class="atg_store_newPrice">\s*\$([\d.,]+)/i);
          const oldM = block.match(/<span class="atg_store_oldPrice">\s*\$([\d.,]+)/i);
          const linkM = block.match(/href="([^"]*\/sitios\/cdigi\/producto\/[^"]*)"/i);

          if (titleM && priceM) {
            const current = parseFloat(priceM[1].replace(/\./g, "").replace(",", "."));
            const original = oldM ? parseFloat(oldM[1].replace(/\./g, "").replace(",", ".")) : 0;
            let disc = 0;
            if (original > current && current > 0) {
              disc = Math.round(((original - current) / original) * 100);
            }
            if (current > 0 && (disc >= minDisc || minDisc === 0)) {
              items.push({
                tienda: "Coto Digital",
                nombre: titleM[1].replace(/<[^>]*>/g, "").trim(),
                precio: current,
                precioLista: original > current ? original : null,
                descuentoTienda: disc,
                isSuperGanga: disc >= 50,
                url: linkM ? `https://www.cotodigital3.com.ar${linkM[1]}` : "https://www.cotodigital3.com.ar"
              });
            }
          }
        });
      }
    }

    // ----------------------------------------------------
    // AUDITORÍA ANTIESTAFA EN PARALELO (Sin bloquear)
    // ----------------------------------------------------
    const targetSlice = items.slice(0, 16);
    const audited = await Promise.all(targetSlice.map(async (item) => {
      const benchmark = await checkMarket(item.nombre, item.precio);
      let verdict = "REGULAR";
      let verdictBadge = "🟡 PRECIO REGULAR";
      let verdictColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
      let marketInfo = "Sin comparación directa";

      if (benchmark && benchmark > 0) {
        marketInfo = `En otras tiendas: $ ${benchmark.toLocaleString("es-AR")}`;

        // 1. PRECIO INFLADO (Estafa de precio tachado falso)
        if (item.precio >= benchmark * 1.05) {
          verdict = "INFLADO";
          verdictBadge = "🔴 ESTAFA: PRECIO INFLADO";
          verdictColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
        }
        // 2. OFERTA REAL COMPROBADA (Al menos 15% más barato que en el mercado)
        else if (item.precio < benchmark * 0.85) {
          const ahorro = Math.round(((benchmark - item.precio) / benchmark) * 100);
          verdict = "REAL";
          verdictBadge = `🟢 OFERTA REAL (-${ahorro}% vs Mercado)`;
          verdictColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
        }
      } else if (item.isSuperGanga) {
        // Si no está en MercadoLibre porque es marca propia pero vale menos de $1.200 o tiene -70% real
        verdict = "REAL";
        verdictBadge = "🔥 LIQUIDACIÓN CONFIRMADA";
        verdictColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
        marketInfo = "Precio de remate de la tienda";
      }

      return {
        ...item,
        verdict,
        verdictBadge,
        verdictColor,
        marketInfo
      };
    }));

    // Ordenar: Ofertas Reales primero, luego regulares y al final las infladas
    const weights = { "REAL": 1, "REGULAR": 2, "INFLADO": 3 };
    audited.sort((a, b) => (weights[a.verdict] - weights[b.verdict]) || (b.descuentoTienda - a.descuentoTienda));

    return res.status(200).json(audited);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
