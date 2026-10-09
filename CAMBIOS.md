# RadarBug — estado y configuración

## Qué hay
- **61 tiendas activas desde la web** (VTEX, WooCommerce, Tiendanube, Magento, Salesforce, Coto, Cheeky, Sodimac, PrestaShop, Venex, Montagne).
- **14 tiendas vía extensión** (bloquean servidores): Adidas, Nike, Lacoste, Natura, Staples, Full H4rd, LibreOpción, Quiksilver, Open Sports, Bowen, Rex, SommierCenter, Central Oeste, Parfumerie.
- **Ocultas por ahora** (sitios armados con JavaScript o caídos): Megatone, CompraGamer, Bidcom, Maximus, Mexx, Start, Atajo, Kevingston, Lüsqtoff, Bercomat, Drean, Peabody, Puma, Magdalena Esposito, Imaginarte, Farmacias del Puente, Musimundo (en mantenimiento).
- Ocultas porque no publican precios: Gamma Herramientas y Colombraro.
- Fuera de la lista: Dafiti (dejó de vender en Argentina), y dominios que ya no existen (El Mundo del Juguete, Minimimo, Mapamundi, Yamp, PedidosFarma).
- Carrousel resultó ser una tienda de decoración: quedó en "Hogar".

## Análisis de ofertas (cómo decide)
El precio tachado de las tiendas NO es confiable (ej.: en VTEX, `ListPrice` de una cafetera de $65.280 decía $74.776.664).
Por eso cada producto se compara contra el **precio de mercado**: el mismo código de barras (EAN) en todas las tiendas
VTEX y Coto, consultados en cada búsqueda.

- 🚨 **Bug confirmado**: 50% o más debajo de la mediana de al menos 2 tiendas.
- ✅ **Oferta real**: es el más barato y está 8% o más debajo del resto.
- ⚠️ **Descuento inflado**: muestra descuento pero cuesta lo mismo que en otras tiendas.
- 📊 **Precio de mercado**: precio normal; muestra si está más barato en otra tienda.
- ❔ **Descuento muy alto (sin confirmar)**: la tienda marca 65%+ pero el producto no aparece en otras tiendas.
- ℹ️ **Sin comparar**: tiendas que no publican código de barras (ropa, juguetes, Sodimac, Salesforce...).

Reglas de datos: se ignora un precio tachado mayor a 5× el precio (dato roto); en VTEX se usa `PriceWithoutDiscount`
(confiable) y `ListPrice` solo si es razonable. Las promos por cantidad (2x1, 3x2, 2da al 70%) y las campañas
("Hasta 35% en Almacén") se muestran como 🎁 promo, sin inventar un porcentaje.

Con Supabase configurado se suma el historial propio (precio más bajo en N días / cuesta lo de siempre).

## Configuración pendiente (la hacés vos, una sola vez)

### 1. Supabase (historial)
1. Crear cuenta y proyecto gratis en supabase.com (región São Paulo).
2. SQL Editor → pegar `supabase/schema.sql` → Run.
3. Project Settings → API: copiar **Project URL** y la clave **service_role**.

### 2. Variables en Vercel (Settings → Environment Variables)
| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_KEY` | clave service_role (secreta) |
| `CRON_SECRET` | cualquier texto largo al azar |
| `ADMIN_KEY` | otro texto largo al azar (para conectar MercadoLibre) |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | de tu app de MercadoLibre (paso 3) |

Después de cargarlas: Deployments → Redeploy.

### 3. MercadoLibre
1. developers.mercadolibre.com.ar → Crear aplicación.
2. Redirect URI: `https://radar-precios-ar.vercel.app/api/ml-callback`
3. Cargar Client ID y Secret en Vercel (paso 2) y redeployar.
4. Abrir una vez `https://radar-precios-ar.vercel.app/api/ml-auth?key=TU_ADMIN_KEY` y aceptar.
   El token se renueva solo y queda guardado en Supabase.
   Aviso: MercadoLibre viene restringiendo su búsqueda pública incluso con token; si sigue dando 403, queda oculto solo.

### 4. Extensión "RadarBug Puente"
1. Chrome → `chrome://extensions` → activar "Modo desarrollador".
2. "Cargar descomprimida" → elegir la carpeta `extension-puente` del repo.
3. Con la extensión activa, la web suma automáticamente esas 14 tiendas.
Si cambiás `lib/adapters.js`, corré `npm run puente` para actualizar la copia de la extensión.

## Endpoints
- `/api/search?ids=a,b&q=texto&minDiscount=20` — búsqueda (agregá `&debug=1` para ver motivos de falla)
- `/api/search?mode=health` — estado de cada tienda
- `/api/compare?ean=7790895000997` — mismo producto en todas las tiendas
- `/api/cron` — foto diaria de precios (la llama Vercel a las 6:00 de Argentina)
