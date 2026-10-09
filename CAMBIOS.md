# RadarBug — qué se corrigió

## Diagnóstico (probado en vivo contra radar-precios-ar.vercel.app, 09/10/2026)
- 30 de 88 tiendas devolvían productos; 58 devolvían 0 resultados sin ningún error visible.
- Causa principal: el código consultaba a TODAS las tiendas con la API de VTEX (`/api/catalog_system/...`),
  pero muchas no usan VTEX (Megatone, Adidas, Kevingston, Solo Deportes —Magento—, Musimundo en mantenimiento, etc.)
  o bloquean bots. El `catch { return [] }` escondía el error, así que la tienda simplemente "no mostraba nada".
- MercadoLibre: su API de búsqueda exige token desde 2025; sin token responde 403.
- En "Todas" y en cada rubro sólo se consultaban las primeras 12 tiendas (`pool.slice(0, 12)`); el resto nunca aparecía.
- Lenovo y Lacoste tenían una ruta (`/ar`) metida en el dominio y armaban URLs rotas.
- El HTML insertaba nombres de productos sin escapar (riesgo de XSS) y el contador "106 tiendas" estaba fijo.

## Qué hace la versión nueva
- **Chequeo de salud** (`/api/search?mode=health`): prueba todas las tiendas y la web arma el selector y las pestañas
  SOLO con las que responden. Las caídas no se muestran. Vercel cachea el chequeo 30 min.
- **Detección automática de plataforma**: VTEX clásica → VTEX Intelligent Search → Shopify → WooCommerce.
- Consulta todas las tiendas del rubro (no sólo 12), en paralelo con límite de tiempo global.
- Muestra abajo cuántas tiendas respondieron y cuáles no.
- `&debug=1` en la URL de la API muestra el motivo exacto de cada falla.
- Filtro de descuento mínimo, rubros Moda / Librería / Juguetes, escape de HTML, imágenes con respaldo.
- "Precio bug" ya no se activa por un 2x1 (eso es promo); sólo por rebaja real del precio.
- Se agregaron Frávega y On City como candidatas (si no responden, quedan ocultas solas).

## MercadoLibre (opcional)
En Vercel → Settings → Environment Variables agregar `ML_ACCESS_TOKEN` con un token OAuth de una app de
developers.mercadolibre.com.ar. Ojo: ese token vence cada 6 h; sin él, MercadoLibre queda oculto.

## Deploy
Reemplazar `api/search.js` e `index.html` en el repo y hacer push; Vercel redepliega solo.
