export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { store = "carrefour", minDiscount = "0", category = "" } = req.query;
  const minDisc = parseInt(minDiscount, 10) || 0;

  const fakeHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9"
  };

  let items = [];

  try {
    // ----------------------------------------------------
    // PLATAFORMAS VTEX (Carrefour, Día Online, Easy)
    // Funcionan al 100% desde la nube sin bloqueos de IP
    // ----------------------------------------------------
    if (store === "carrefour" || store === "dia" || store === "easy") {
      const hosts = {
        carrefour: "www.carrefour.com.ar",
        dia: "diaonline.supermercadosdia.com.ar",
        easy: "www.easy.com.ar"
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

          // Detección de gangas o precios anormales por debajo de $1.200
          const isCheap = current > 10 && current < 1200;

          if (current > 0 && (disc >= minDisc || isCheap || minDisc === 0)) {
            items.push({
              tienda: store === "carrefour" ? "Carrefour" : store === "dia" ? "Día Online" : "Easy",
              nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
              precio: current,
              precioLista: original > current ? original : null,
              descuentoTienda: disc,
              isCheap,
              url: p.link || `https://${hosts[store]}/${p.linkText}/p`
            });
          }
        });
      }
    }

    // ----------------------------------------------------
    // FRÁVEGA (Modo adaptativo)
    // ----------------------------------------------------
    else if (store === "fravega") {
      const term = category ? encodeURIComponent(category) : "ofertas";
      const r = await fetch(`https://www.fravega.com/api/v2/products/search?keyword=${term}&size=35&sort=discount,desc`, {
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
              url: p.slug ? `https://www.fravega.com/p/${p.slug}` : "https://www.fravega.com"
            });
          }
        });
      }
    }

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
