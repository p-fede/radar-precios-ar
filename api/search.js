export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "todas", rubro = "todos", q = "", minDiscount = "0" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;
  const rawQ = q.trim();
  const searchPath = rawQ ? `${encodeURIComponent(rawQ)}?map=ft&` : "?";

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  // DIRECTORIO DE MÁS DE 100 TIENDAS POR RUBRO
  const DIRECTORY = [
    // --- SUPERMERCADOS ---
    { id: "carrefour", name: "Carrefour", domain: "www.carrefour.com.ar", rubro: "supermercados" },
    { id: "dia", name: "Día Online", domain: "diaonline.supermercadosdia.com.ar", rubro: "supermercados" },
    { id: "jumbo", name: "Jumbo", domain: "www.jumbo.com.ar", rubro: "supermercados" },
    { id: "disco", name: "Disco", domain: "www.disco.com.ar", rubro: "supermercados" },
    { id: "vea", name: "Vea", domain: "www.vea.com.ar", rubro: "supermercados" },
    { id: "changomas", name: "ChangoMás", domain: "www.masonline.com.ar", rubro: "supermercados" },

    // --- TECNOLOGÍA, COMPUTACIÓN Y CELULARES ---
    { id: "cetrogar", name: "Cetrogar", domain: "www.cetrogar.com.ar", rubro: "tecnologia" },
    { id: "megatone", name: "Megatone", domain: "www.megatone.net", rubro: "tecnologia" },
    { id: "musimundo", name: "Musimundo", domain: "www.musimundo.com", rubro: "tecnologia" },
    { id: "naldo", name: "Naldo", domain: "www.naldo.com.ar", rubro: "tecnologia" },
    { id: "bidcom", name: "Bidcom", domain: "www.bidcom.com.ar", rubro: "tecnologia" },
    { id: "sony", name: "Sony Store", domain: "store.sony.com.ar", rubro: "tecnologia" },
    { id: "motorola", name: "Motorola", domain: "www.motorola.com.ar", rubro: "tecnologia" },
    { id: "samsung", name: "Samsung", domain: "shop.samsung.com.ar", rubro: "tecnologia" },
    { id: "lenovo", name: "Lenovo", domain: "www.lenovo.com/ar", rubro: "tecnologia" },
    { id: "start", name: "Start_", domain: "www.start.com.ar", rubro: "tecnologia" },
    { id: "atajo", name: "Atajo Gaming", domain: "www.atajo.com.ar", rubro: "tecnologia" },
    { id: "venex", name: "Venex", domain: "www.venex.com.ar", rubro: "tecnologia" },
    { id: "mexx", name: "Mexx Computación", domain: "www.mexx.com.ar", rubro: "tecnologia" },
    { id: "maximus", name: "Maximus Gaming", domain: "www.maximus.com.ar", rubro: "tecnologia" },
    { id: "compragamer", name: "CompreGamer Tienda", domain: "compragamer.com", rubro: "tecnologia" },
    { id: "fullh4rd", name: "Full H4rd", domain: "www.fullh4rd.com.ar", rubro: "tecnologia" },
    { id: "libreopcion", name: "LibreOpción", domain: "www.libreopcion.com", rubro: "tecnologia" },

    // --- HERRAMIENTAS, CONSTRUCCIÓN Y HOGAR ---
    { id: "easy", name: "Easy", domain: "www.easy.com.ar", rubro: "herramientas" },
    { id: "sodimac", name: "Sodimac", domain: "www.sodimac.com.ar", rubro: "herramientas" },
    { id: "blaisten", name: "Blaisten", domain: "www.blaisten.com.ar", rubro: "herramientas" },
    { id: "bercomat", name: "Familia Bercomat", domain: "familiabercomat.com", rubro: "herramientas" },
    { id: "prestigio", name: "Pinturerías Prestigio", domain: "www.prestigio.com.ar", rubro: "herramientas" },
    { id: "rex", name: "Pinturerías Rex", domain: "www.pintureriasrex.com", rubro: "herramientas" },
    { id: "lusqtoff", name: "Lüsqtoff Oficial", domain: "tienda.lusqtoff.com.ar", rubro: "herramientas" },
    { id: "gamma", name: "Gamma Herramientas", domain: "www.tiendagamma.com.ar", rubro: "herramientas" },
    { id: "sommiercenter", name: "SommierCenter", domain: "www.sommiercenter.com", rubro: "hogar" },
    { id: "cardeuse", name: "La Cardeuse", domain: "www.lacardeuse.com.ar", rubro: "hogar" },
    { id: "simmons", name: "Simmons", domain: "www.simmons.com.ar", rubro: "hogar" },
    { id: "cannon", name: "Colchones Cannon", domain: "www.colchonescannon.com.ar", rubro: "hogar" },
    { id: "arredo", name: "Arredo", domain: "www.arredo.com.ar", rubro: "hogar" },
    { id: "morph", name: "Morph", domain: "www.morph.com.ar", rubro: "hogar" },
    { id: "colombraro", name: "Colombraro", domain: "www.colombraro.com.ar", rubro: "hogar" },

    // --- ELECTRODOMÉSTICOS Y CLIMATIZACIÓN ---
    { id: "whirlpool", name: "Whirlpool", domain: "tienda.whirlpool.com.ar", rubro: "electro" },
    { id: "drean", name: "Drean", domain: "tienda.drean.com.ar", rubro: "electro" },
    { id: "longvie", name: "Longvie", domain: "tienda.longvie.com", rubro: "electro" },
    { id: "bgh", name: "BGH Store", domain: "hogar.bgh.com.ar", rubro: "electro" },
    { id: "philips", name: "Philips Tienda", domain: "tienda.philips.com.ar", rubro: "electro" },
    { id: "electrolux", name: "Electrolux", domain: "tienda.electrolux.com.ar", rubro: "electro" },
    { id: "peabody", name: "Peabody", domain: "www.peabody.com.ar", rubro: "electro" },
    { id: "liliana", name: "Liliana Electrodomésticos", domain: "tienda.liliana.com.ar", rubro: "electro" },
    { id: "yelmo", name: "Yelmo", domain: "www.yelmo.com.ar", rubro: "electro" },
    { id: "ultracomb", name: "Ultracomb", domain: "www.ultracomb.com.ar", rubro: "electro" },

    // --- DEPORTES, ZAPATILLAS Y MODA ---
    { id: "adidas", name: "Adidas", domain: "www.adidas.com.ar", rubro: "deportes" },
    { id: "nike", name: "Nike Argentina", domain: "www.nike.com.ar", rubro: "deportes" },
    { id: "puma", name: "Puma Argentina", domain: "ar.puma.com", rubro: "deportes" },
    { id: "topper", name: "Topper", domain: "www.topper.com.ar", rubro: "deportes" },
    { id: "dexter", name: "Dexter Deportes", domain: "www.dexter.com.ar", rubro: "deportes" },
    { id: "stockcenter", name: "Stock Center", domain: "www.stockcenter.com.ar", rubro: "deportes" },
    { id: "moov", name: "Moov", domain: "www.moov.com.ar", rubro: "deportes" },
    { id: "solodeportes", name: "Solo Deportes", domain: "www.solodeportes.com.ar", rubro: "deportes" },
    { id: "opensports", name: "Open Sports", domain: "www.opensports.com.ar", rubro: "deportes" },
    { id: "sportline", name: "Sportline", domain: "www.sportline.com.ar", rubro: "deportes" },
    { id: "dash", name: "Dash Deportes", domain: "www.tiendadash.com.ar", rubro: "deportes" },
    { id: "grid", name: "Grid", domain: "www.grid.com.ar", rubro: "deportes" },
    { id: "montagne", name: "Montagne Outdoors", domain: "www.montagne.com.ar", rubro: "deportes" },
    { id: "scandinavian", name: "Scandinavian", domain: "www.scandinavian.com.ar", rubro: "deportes" },
    { id: "cristobalcolon", name: "Cristóbal Colón", domain: "www.cristobalcolon.com", rubro: "deportes" },
    { id: "quiksilver", name: "Quiksilver", domain: "www.quiksilver.com.ar", rubro: "deportes" },
    { id: "ripcurl", name: "Rip Curl", domain: "www.ripcurl.com.ar", rubro: "deportes" },
    { id: "levis", name: "Levi's Argentina", domain: "www.levi.com.ar", rubro: "moda" },
    { id: "lacoste", name: "Lacoste Argentina", domain: "www.lacoste.com/ar", rubro: "moda" },
    { id: "dafiti", name: "Dafiti", domain: "www.dafiti.com.ar", rubro: "moda" },
    { id: "bowen", name: "Bowen", domain: "www.bowen.com.ar", rubro: "moda" },
    { id: "kevingston", name: "Kevingston", domain: "www.kevingston.com", rubro: "moda" },

    // --- FARMACIA, PERFUMERÍA Y CUIDADO PERSONAL ---
    { id: "farmacity", name: "Farmacity", domain: "www.farmacity.com", rubro: "farmacia" },
    { id: "centraloeste", name: "Central Oeste", domain: "www.centraloeste.com.ar", rubro: "farmacia" },
    { id: "delpuente", name: "Farmacias del Puente", domain: "www.farmaciasdelpuente.com.ar", rubro: "farmacia" },
    { id: "pedidosfarma", name: "PedidosFarma", domain: "www.pedidosfarma.com.ar", rubro: "farmacia" },
    { id: "pigmento", name: "Perfumerías Pigmento", domain: "www.perfumeriaspigmento.com.ar", rubro: "farmacia" },
    { id: "julieriaque", name: "Juleriaque", domain: "www.juleriaque.com.ar", rubro: "farmacia" },
    { id: "rouge", name: "Rouge", domain: "www.perfumeriasrouge.com", rubro: "farmacia" },
    { id: "parfumerie", name: "Parfumerie", domain: "www.parfumerie.com.ar", rubro: "farmacia" },
    { id: "lasmargaritas", name: "Las Margaritas", domain: "www.lasmargaritas.com.ar", rubro: "farmacia" },
    { id: "simplicity", name: "Simplicity", domain: "www.simplicity.com.ar", rubro: "farmacia" },
    { id: "natura", name: "Natura Cosméticos", domain: "www.naturacosmeticos.com.ar", rubro: "farmacia" },

    // --- BAZAR, JUGUETES Y LIBRERÍA ---
    { id: "cuspide", name: "Librería Cúspide", domain: "www.cuspide.com", rubro: "libreria" },
    { id: "yenny", name: "Yenny / El Ateneo", domain: "www.tematika.com", rubro: "libreria" },
    { id: "citykids", name: "CityKids Juguetería", domain: "www.citykids.com.ar", rubro: "juguetes" },
    { id: "creciendo", name: "Creciendo Bebés", domain: "www.creciendo.com", rubro: "juguetes" },
    { id: "carrousel", name: "Jugueterías Carrousel", domain: "www.carrousel.com.ar", rubro: "juguetes" },
    { id: "staples", name: "Staples Argentina", domain: "www.staples.com.ar", rubro: "libreria" }
  ];

  // Fetch genérico para endpoints VTEX
  async function fetchStore(target, limit = 15) {
    try {
      const url = `https://${target.domain}/api/catalog_system/pub/products/search/${searchPath}O=OrderByBestDiscountDESC&_from=0&_to=${limit}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 2800);

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

        const teasers = [...(offer?.discountHighlights || []), ...(offer?.teasers || [])];
        for (const t of teasers) {
          const tName = (t.name || "").toLowerCase();
          if (tName.includes("2x1")) disc = Math.max(disc, 50);
          if (tName.includes("70%")) disc = Math.max(disc, 35);
        }

        if (current <= 0) return null;

        let img = item?.images?.[0]?.imageUrl || "";
        if (img.startsWith("http://")) img = img.replace("http://", "https://");

        const isBug = (current < 2000 && current > 10 && disc >= 35) || disc >= 65;

        return {
          tienda: target.name,
          rubro: target.rubro,
          nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          ahorro: original > current ? Math.round(original - current) : 0,
          isBug: isBug,
          img: img || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80",
          url: p.link || `https://${target.domain}/${p.linkText}/p`
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  // MercadoLibre
  async function fetchML(limit = 25) {
    try {
      const qParam = rawQ ? encodeURIComponent(rawQ) : "ofertas";
      const r = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${qParam}&limit=${limit}`, { headers: fakeHeaders });
      if (!r.ok) return [];
      const data = await r.json();

      return (data.results || []).map(p => {
        const current = Number(p.price || 0);
        const original = Number(p.original_price || 0);
        let disc = original > current && current > 0 ? Math.round(((original - current) / original) * 100) : 0;
        if (current <= 0) return null;

        const isBug = disc >= 65 || (current < 1500 && current > 10 && disc >= 30);
        const img = p.thumbnail?.replace("-I.jpg", "-O.jpg") || p.thumbnail;

        return {
          tienda: "MercadoLibre",
          rubro: "general",
          nombre: p.title,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          ahorro: original > current ? Math.round(original - current) : 0,
          isBug: isBug,
          img: img || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80",
          url: p.permalink
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  let items = [];

  try {
    // 1. Si el usuario eligió una tienda específica
    if (store !== "todas") {
      if (store === "mercadolibre") {
        items = await fetchML(35);
      } else {
        const found = DIRECTORY.find(d => d.id === store);
        if (found) items = await fetchStore(found, 35);
      }
    } 
    // 2. Si eligió un rubro específico o todas
    else {
      let pool = DIRECTORY;
      if (rubro !== "todos") {
        pool = DIRECTORY.filter(d => d.rubro === rubro);
      }

      // Rastrear hasta 12 tiendas simultáneas para no saturar memoria en Vercel
      const batch = pool.slice(0, 12).map(target => fetchStore(target, 10));
      if (rubro === "todos" || rubro === "tecnologia") {
        batch.push(fetchML(15));
      }

      const settled = await Promise.allSettled(batch);
      settled.forEach(r => {
        if (r.status === "fulfilled") items.push(...r.value);
      });
    }

    if (minDisc > 0) {
      items = items.filter(it => it.descuento >= minDisc || it.isBug);
    }

    // Ordenamiento estricto: BUGS arriba, mayor porcentaje de descuento, mayor ahorro en pesos
    items.sort((a, b) => {
      if (b.isBug !== a.isBug) return (b.isBug ? 1 : 0) - (a.isBug ? 1 : 0);
      if (b.descuento !== a.descuento) return b.descuento - a.descuento;
      return b.ahorro - a.ahorro;
    });

    return res.status(200).json({
      totalStores: DIRECTORY.length + 1,
      results: items
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
