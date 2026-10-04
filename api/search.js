export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { q = "taladro", category = "todas" } = req.query;
  const query = encodeURIComponent(q.trim());

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json"
  };

  // Catálogo de Tiendas Locales Argentinas por rubro
  const LOCAL_STORES = [
    // --- HERRAMIENTAS Y MAQUINARIA ---
    {
      name: "Easy Argentina",
      type: "vtex",
      rubro: "herramientas",
      url: `https://www.easy.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=8`
    },
    {
      name: "Carrefour Herramientas / Bazar",
      type: "vtex",
      rubro: "herramientas",
      url: `https://www.carrefour.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=8`
    },

    // --- ELECTRODOMÉSTICOS Y TECNOLOGÍA ---
    {
      name: "Megatone",
      type: "vtex",
      rubro: "tecnologia",
      url: `https://www.megatone.net/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`
    },
    {
      name: "Musimundo",
      type: "vtex",
      rubro: "tecnologia",
      url: `https://www.musimundo.com/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`
    },
    {
      name: "Naldo",
      type: "vtex",
      rubro: "electro",
      url: `https://www.naldo.com.ar/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`
    },
    {
      name: "Cetrogar",
      type: "vtex",
      rubro: "electro",
      url: `https://www.cetrogar.com.ar/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`
    },

    // --- CELULARES, ACCESORIOS Y ELECTRÓNICA ---
    {
      name: "Día Online Tech & Almacén",
      type: "vtex",
      rubro: "general",
      url: `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${query}?O=OrderByBestDiscountDESC&_from=0&_to=8`
    }
  ];

  // Filtrar tiendas según la categoría elegida (o todas juntas)
  const activeStores = category === "todas" 
    ? LOCAL_STORES 
    : LOCAL_STORES.filter(s => s.rubro === category || s.rubro === "general");

  // CONSULTA SIMULTÁNEA EN PARALELO
  // Promise.allSettled garantiza que si 1 tienda falla o no tiene stock, las demás sigan funcionando
  const requests = activeStores.map(async (store) => {
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 3500); // 3.5 segundos máx por tienda

      const res = await fetch(store.url, { headers, signal: controller.signal });
      clearTimeout(tId);

      if (!res.ok) return [];
      const data = await res.json();

      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const item = p.items?.[0];
        const offer = item?.sellers?.[0]?.commertialOffer;
        const current = Number(offer?.Price || offer?.spotPrice || 0);
        const original = Number(offer?.ListPrice || 0);

        let disc = 0;
        if (original > current && current > 0) {
          disc = Math.round(((original - current) / original) * 100);
        }

        if (current <= 0) return null;

        // Detección de ganga: si es accesorio o herramienta menor a $2.500 o tiene más de 55% OFF
        const isBug = (current < 2500 && disc >= 40) || disc >= 65;

        return {
          tienda: store.name,
          nombre: `${p.brand ? p.brand + ' - ' : ''}${p.productName || p.productTitle}`,
          precio: current,
          precioLista: original > current ? original : null,
          descuento: disc,
          isBug: isBug,
          url: p.link || `https://${store.name.toLowerCase().replace(/\s+/g, '')}.com.ar`
        };
      }).filter(Boolean);
    } catch {
      return []; // Si una tienda cae o da error, retorna array vacío sin romper el resto
    }
  });

  const results = await Promise.allSettled(requests);
  const allProducts = results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value);

  // Ordenar: primero los precios más baratos
  allProducts.sort((a, b) => a.precio - b.precio);

  return res.status(200).json(allProducts);
}
