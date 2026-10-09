# RadarBug — estado y configuración

## Qué hay
- **63 tiendas activas desde la web** (VTEX, WooCommerce, Tiendanube, Magento, Salesforce, Coto, Cheeky, Sodimac, PrestaShop, Venex, Montagne).
- **14 tiendas vía extensión** (bloquean servidores): Adidas, Nike, Lacoste, Natura, Staples, Full H4rd, LibreOpción, Quiksilver, Open Sports, Bowen, Rex, SommierCenter, Central Oeste, Parfumerie.
- **Ocultas por ahora** (sitios armados con JavaScript o caídos): Megatone, CompraGamer, Bidcom, Maximus, Mexx, Start, Atajo, Kevingston, Lüsqtoff, Bercomat, Drean, Peabody, Puma, Magdalena Esposito, Imaginarte, Farmacias del Puente, Musimundo (en mantenimiento).
- Fuera de la lista: Dafiti (dejó de vender en Argentina), y dominios que ya no existen (El Mundo del Juguete, Minimimo, Mapamundi, Yamp, PedidosFarma).
- Carrousel resultó ser una tienda de decoración: quedó en "Hogar".

## Análisis de ofertas
- **Comparación por código de barras (EAN)**: cada tarjeta muestra "💡 $X más barato en Tienda" o "🏆 Mejor precio entre N tiendas". El botón "🔎 Comparar en otras tiendas" busca ese EAN en vivo en todas las tiendas VTEX y Coto.
- **Historial** (requiere Supabase): cada búsqueda y una tarea diaria guardan precios. Con 5+ días de datos, cada oferta se etiqueta:
  - ✅ **Oferta real**: precio más bajo de los últimos 60 días.
  - ⚠️ **Descuento inflado**: muestra descuento pero cuesta lo de siempre (y deja de contar como "precio bug").
  - 📊 **Precio habitual**.
- Promos por cantidad (2x1, 3x2, 2da al 70%) se muestran aparte y no cuentan como "precio bug".

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
