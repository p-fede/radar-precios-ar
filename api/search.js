export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", minDiscount = "20", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 20;

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-419,es;q=0.9"
  };

  // Comparador de mercado ultrarrápido (timeout de 1.5s para no trabar Vercel)
  async function quickBenchmark(title) {
    try {
      const clean = title
        .replace(/[\(\)\[\],.\/]/g, " ")
        .replace(/\b(supermercados|dia|carrefour|easy|fravega|oferta|promo|gr|kg|ml|lt|un|de|para)\b/gi, "")
        .replace(/[^\w\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 3)
        .join(" ");

      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 1400);

      const res = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(clean)}&limit=4`, {
        headers: fakeHeaders,
        signal: controller.signal
      });
      clearTimeout(tId);

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

  let items = [];

  try {
    // ----------------------------------------------------
    // 1. MERCADOLIBRE (Búsqueda general o de ofertas)
    // ----------------------------------------------------
    if (store === "mercadolibre") {
      const q = category ? encodeURIComponent(category) : "herramientas";
      const url = `https://api.mercadolibre.com/sites/MLA/search?q=${q}&sort=relevance&limit=40`;
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
          if (current > 0 && (disc >= minDisc || original > current || minDisc <= 20)) {
            items.push({
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

    // ----------------------------------------------------
    // 2. FRÁVEGA (API oficial por palabra clave o genérica)
    // ----------------------------------------------------
    else if (store === "fravega") {
      const term = category ? encodeURIComponent(category) : "ofertas";
      const url = `https://www.fravega.com/api/v2/products/search?keyword=${term}&size=40&sort=discount,desc`;
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
          if (current > 0 && (disc >= minDisc || minDisc <= 20)) {
            items.push({
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

    // ----------------------------------------------------
    // 3. CARREFOUR & EASY & DÍA (VTEX Clusters)
    // ----------------------------------------------------
    else if (store === "carrefour" || store === "easy" || store === "dia") {
      const hosts = {
        carrefour: "www.carrefour.com.ar",
        easy: "www.easy.com.ar",
        dia: "diaonline.supermercadosdia.com.ar"
      };
      const term = category ? encodeURIComponent(category) : "";
      const url = `https://${hosts[store]}/api/catalog_system/pub/products/search/${term}?O=OrderByBestDiscountDESC&_from=0&_to=35`;
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
          if (current > 0 && (disc >= minDisc || minDisc <= 20)) {
            items.push({
              tienda: store.toUpperCase(),
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              url: p.link || `https://${hosts[store]}/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // 4. COTO DIGITAL (Búsqueda limpia de catálogo)
    // ----------------------------------------------------
    else if (store === "coto") {
      const term = category ? encodeURIComponent(category).replace(/%20/g, "+") : "ofertas";
      const url = `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=${term}`;
      const r = await fetch(url, { headers: fakeHeaders });
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/<li class="clearfix"[\s\S]*?<\/li>/gi) || [];
        matches.slice(0, 25).forEach(block => {
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
            if (current > 0) {
              items.push({
                tienda: "Coto Digital",
                nombre: titleM[1].replace(/<[^>]*>/g, "").trim(),
                precio: current,
                precioLista: original > current ? original : null,
                descuentoTienda: disc,
                url: linkM ? `https://www.cotodigital3.com.ar${linkM[1]}` : "https://www.cotodigital3.com.ar"
              });
            }
          }
        });
      }
    }

    // ----------------------------------------------------
    // 5. PEDIDOSYA & RAPPI (Catálogo de Mercados / Super)
    // ----------------------------------------------------
    else if (store === "pedidosya" || store === "rappi") {
      // Como son de delivery de alimentos, si no escriben nada o ponen "herramientas", se busca almacén
      const queryWord = (category && !category.toLowerCase().includes("herramienta")) ? category : "almacen";
      
      const r = await fetch(`https://card-service.pedidosya.com/v1/cards?countryId=1&maxIndex=30`, { headers: fakeHeaders });
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
            if (current > 0 && (disc >= minDisc || minDisc <= 20)) {
              items.push({
                tienda: store === "pedidosya" ? "PedidosYa Market" : "Rappi Turbo",
                nombre: prod.name || prod.title,
                precio: current,
                precioLista: original > current ? original : null,
                descuentoTienda: disc,
                url: store === "pedidosya" ? "https://www.pedidosya.com.ar/" : "https://www.rappi.com.ar/"
              });
            }
          });
        });
      }
    }

    // ----------------------------------------------------
    // AUDITORÍA ANTIESTAFA EN PARALELO (Máximo 12 ítems simultáneos)
    // ----------------------------------------------------
    const targetSlice = items.slice(0, 15);
    const audited = await Promise.all(targetSlice.map(async (item) => {
      const benchmark = await quickBenchmark(item.nombre);
      let verdict = "REGULAR";
      let verdictLabel = "🟡 PRECIO ESTÁNDAR";
      let verdictColor = "text-yellow-400 font-semibold";
      let marketInfo = "Sin datos de mercado";

      if (benchmark && benchmark > 0) {
        marketInfo = `En otras tiendas: $ ${benchmark.toLocaleString("es-AR")}`;
        // Si el precio de la supuesta oferta es superior al promedio de mercado: INFLADO
        if (item.precio >= benchmark * 1.05) {
          verdict = "INFLADO";
          verdictLabel = "🔴 ESTAFA: PRECIO INFLADO";
          verdictColor = "text-red-500 font-black";
        }
        // Si realmente es 15%+ más económico que el promedio de mercado: OFERTA REAL
        else if (item.precio < benchmark * 0.85) {
          const ahorro = Math.round(((benchmark - item.precio) / benchmark) * 100);
          verdict = "REAL";
          verdictLabel = `🟢 OFERTA REAL (-${ahorro}% vs Mercado)`;
          verdictColor = "text-emerald-400 font-black";
        }
      }

      return {
        ...item,
        verdict,
        verdictLabel,
        verdictColor,
        marketInfo
      };
    }));

    // Ordenar priorizando las ofertas reales comprobadas
    const weights = { "REAL": 1, "REGULAR": 2, "INFLADO": 3 };
    audited.sort((a, b) => (weights[a.verdict] - weights[b.verdict]) || (b.descuentoTienda - a.descuentoTienda));

    return res.status(200).json(audited);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
