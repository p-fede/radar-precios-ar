export default async function handler(req, res) {
  // Configurar permisos para que el frontend pueda consultar
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Falta el término de búsqueda" });
  }

  const query = encodeURIComponent(q.trim());

  // Consultar en paralelo las APIs oficiales
  const [diaRes, easyRes, fravegaRes] = await Promise.allSettled([
    // 1. Día Online
    fetch(`https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`)
      .then(r => r.json())
      .then(items => (Array.isArray(items) ? items : []).map(p => {
        const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
        const sp = Number(offer?.Price || offer?.spotPrice || 0);
        const lp = Number(offer?.ListPrice || 0);
        return {
          tienda: "Día Online",
          nombre: p.productName || p.productTitle,
          marca: p.brand || "",
          precio: sp,
          precioLista: lp > sp ? lp : null,
          descuento: lp > sp ? Math.round(((lp - sp) / lp) * 100) : 0,
          url: p.link || `https://diaonline.supermercadosdia.com.ar/${p.linkText}/p`
        };
      })),

    // 2. Easy
    fetch(`https://www.easy.com.ar/api/catalog_system/pub/products/search/${query}?_from=0&_to=8`)
      .then(r => r.json())
      .then(items => (Array.isArray(items) ? items : []).map(p => {
        const offer = p.items?.[0]?.sellers?.[0]?.commertialOffer;
        const sp = Number(offer?.Price || offer?.spotPrice || 0);
        const lp = Number(offer?.ListPrice || 0);
        return {
          tienda: "Easy",
          nombre: p.productName || p.productTitle,
          marca: p.brand || "",
          precio: sp,
          precioLista: lp > sp ? lp : null,
          descuento: lp > sp ? Math.round(((lp - sp) / lp) * 100) : 0,
          url: `https://www.easy.com.ar/${p.linkText}/p`
        };
      })),

    // 3. Frávega
    fetch(`https://www.fravega.com/api/v2/products/search?keyword=${query}&size=8`)
      .then(r => r.json())
      .then(data => (data.products || data.items || []).map(p => {
        const sp = Number(p.price || p.salePrice || 0);
        const lp = Number(p.listPrice || p.originalPrice || 0);
        return {
          tienda: "Frávega",
          nombre: p.title || p.name,
          marca: p.brand || "",
          precio: sp,
          precioLista: lp > sp ? lp : null,
          descuento: lp > sp ? Math.round(((lp - sp) / lp) * 100) : (p.discount || 0),
          url: p.slug ? `https://www.fravega.com/p/${p.slug}` : `https://www.fravega.com`
        };
      }))
  ]);

  const resultados = [];
  if (diaRes.status === "fulfilled") resultados.push(...diaRes.value);
  if (easyRes.status === "fulfilled") resultados.push(...easyRes.value);
  if (fravegaRes.status === "fulfilled") resultados.push(...fravegaRes.value);

  // Filtrar productos válidos y ordenar de menor a mayor precio
  const validos = resultados.filter(item => item.precio > 0);
  validos.sort((a, b) => a.precio - b.precio);

  return res.status(200).json(validos);
}
