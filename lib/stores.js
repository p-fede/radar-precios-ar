// Directorio de tiendas.
// platform:
//   vtex / vtexIS / shopify / woo  → APIs JSON públicas
//   tiendanube / magento / sfcc / coto / pow / falabella / prestashop → lectores a medida (lib/adapters.js)
//   mercadolibre → API oficial con token
//   extension → la tienda bloquea servidores; solo la puede consultar la extensión de Chrome
//   auto → se prueba vtex, vtexIS, shopify y woo; si nada funciona queda oculta

export const DIRECTORY = [
  // --- SUPERMERCADOS ---
  { id: "carrefour", name: "Carrefour", url: "https://www.carrefour.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "dia", name: "Día Online", url: "https://diaonline.supermercadosdia.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "jumbo", name: "Jumbo", url: "https://www.jumbo.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "disco", name: "Disco", url: "https://www.disco.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "vea", name: "Vea", url: "https://www.vea.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "changomas", name: "ChangoMás", url: "https://www.masonline.com.ar", rubro: "supermercados", platform: "vtex" },
  { id: "coto", name: "Coto Digital", url: "https://www.coto.com.ar", rubro: "supermercados", platform: "coto" },

  // --- TECNOLOGÍA ---
  { id: "fravega", name: "Frávega", url: "https://www.fravega.com", rubro: "tecnologia", platform: "vtex" },
  { id: "oncity", name: "On City", url: "https://www.oncity.com", rubro: "tecnologia", platform: "vtex" },
  { id: "cetrogar", name: "Cetrogar", url: "https://www.cetrogar.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "naldo", name: "Naldo", url: "https://www.naldo.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "sony", name: "Sony Store", url: "https://store.sony.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "motorola", name: "Motorola", url: "https://www.motorola.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "samsung", name: "Samsung", url: "https://shop.samsung.com.ar", rubro: "tecnologia", platform: "vtex" },
  { id: "megatone", name: "Megatone", url: "https://www.megatone.net", rubro: "tecnologia", platform: "extension" },
  { id: "musimundo", name: "Musimundo", url: "https://www.musimundo.com", rubro: "tecnologia", platform: "auto" },
  { id: "bidcom", name: "Bidcom", url: "https://www.bidcom.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "venex", name: "Venex", url: "https://www.venex.com.ar", rubro: "tecnologia", platform: "venex" },
  { id: "compragamer", name: "Compra Gamer", url: "https://compragamer.com", rubro: "tecnologia", platform: "extension" },
  { id: "maximus", name: "Maximus Gaming", url: "https://www.maximus.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "mexx", name: "Mexx Computación", url: "https://www.mexx.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "start", name: "Start_", url: "https://www.start.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "atajo", name: "Atajo Gaming", url: "https://www.atajo.com.ar", rubro: "tecnologia", platform: "auto" },
  { id: "fullh4rd", name: "Full H4rd", url: "https://www.fullh4rd.com.ar", rubro: "tecnologia", platform: "extension" },
  { id: "libreopcion", name: "LibreOpción", url: "https://libreopcion.com.ar", rubro: "tecnologia", platform: "extension" },
  { id: "mercadolibre", name: "MercadoLibre", url: "https://www.mercadolibre.com.ar", rubro: "tecnologia", platform: "mercadolibre" },

  // --- HERRAMIENTAS Y CONSTRUCCIÓN ---
  { id: "easy", name: "Easy", url: "https://www.easy.com.ar", rubro: "herramientas", platform: "vtex" },
  { id: "prestigio", name: "Pinturerías Prestigio", url: "https://www.prestigio.com.ar", rubro: "herramientas", platform: "vtex" },
  { id: "blaisten", name: "Blaisten", url: "https://www.blaisten.com.ar", rubro: "herramientas", platform: "vtex" },
  { id: "sodimac", name: "Sodimac", url: "https://www.sodimac.com.ar", rubro: "herramientas", platform: "falabella" },
  { id: "gamma", name: "Gamma Herramientas", url: "https://www.gammaherramientas.com.ar", rubro: "herramientas", platform: "woo" },
  { id: "bercomat", name: "Familia Bercomat", url: "https://www.familiabercomat.com", rubro: "herramientas", platform: "auto" },
  { id: "lusqtoff", name: "Lüsqtoff", url: "https://www.lusqtoff.com.ar", rubro: "herramientas", platform: "auto" },
  { id: "rex", name: "Pinturerías Rex", url: "https://somosrex.com", rubro: "herramientas", platform: "extension" },

  // --- HOGAR ---
  { id: "simmons", name: "Simmons", url: "https://www.simmons.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "cardeuse", name: "La Cardeuse", url: "https://www.lacardeuse.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "arredo", name: "Arredo", url: "https://www.arredo.com.ar", rubro: "hogar", platform: "vtex" },
  { id: "colombraro", name: "Colombraro", url: "https://www.colombraro.com.ar", rubro: "hogar", platform: "woo" },
  { id: "morph", name: "Morph", url: "https://www.morph.com.ar", rubro: "hogar", platform: "tiendanube" },
  { id: "carrousel", name: "Carrousel (deco)", url: "https://www.carrousel.com.ar", rubro: "hogar", platform: "tiendanube" },
  { id: "sommiercenter", name: "SommierCenter", url: "https://www.sommiercenter.com", rubro: "hogar", platform: "extension" },

  // --- ELECTRO Y CLIMATIZACIÓN ---
  { id: "electrolux", name: "Electrolux", url: "https://tienda.electrolux.com.ar", rubro: "electro", platform: "vtex" },
  { id: "philips", name: "Philips Tienda", url: "https://tienda.philips.com.ar", rubro: "electro", platform: "vtex" },
  { id: "whirlpool", name: "Whirlpool", url: "https://www.whirlpool.com.ar", rubro: "electro", platform: "vtex" },
  { id: "bgh", name: "BGH Store", url: "https://www.bgh.com.ar", rubro: "electro", platform: "vtex" },
  { id: "liliana", name: "Liliana", url: "https://www.liliana.com.ar", rubro: "electro", platform: "vtex" },
  { id: "longvie", name: "Longvie", url: "https://longvie.com", rubro: "electro", platform: "tiendanube" },
  { id: "yelmo", name: "Yelmo", url: "https://www.yelmo.com.ar", rubro: "electro", platform: "tiendanube" },
  { id: "ultracomb", name: "Ultracomb", url: "https://ultracomb.com.ar", rubro: "electro", platform: "tiendanube" },
  { id: "drean", name: "Drean", url: "https://drean.com.ar", rubro: "electro", platform: "auto" },
  { id: "peabody", name: "Peabody", url: "https://peabody.com.ar", rubro: "electro", platform: "auto" },

  // --- DEPORTES ---
  { id: "topper", name: "Topper", url: "https://www.topper.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "sportline", name: "Sportline", url: "https://www.sportline.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "dash", name: "Dash Deportes", url: "https://www.tiendadash.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "grid", name: "Grid", url: "https://www.grid.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "scandinavian", name: "Scandinavian", url: "https://www.scandinavian.com.ar", rubro: "deportes", platform: "vtex" },
  { id: "cristobalcolon", name: "Cristóbal Colón", url: "https://www.cristobalcolon.com", rubro: "deportes", platform: "woo" },
  { id: "ripcurl", name: "Rip Curl", url: "https://www.ripcurlargentina.com", rubro: "deportes", platform: "woo" },
  { id: "stockcenter", name: "Stock Center", url: "https://www.stockcenter.com.ar", rubro: "deportes", platform: "sfcc" },
  { id: "moov", name: "Moov", url: "https://www.moov.com.ar", rubro: "deportes", platform: "sfcc" },
  { id: "dexter", name: "Dexter", url: "https://www.dexter.com.ar", rubro: "deportes", platform: "sfcc" },
  { id: "puma", name: "Puma Argentina", url: "https://ar.puma.com", rubro: "deportes", platform: "auto" },
  { id: "montagne", name: "Montagne", url: "https://www.montagne.com.ar", rubro: "deportes", platform: "prestashop" },
  { id: "adidas", name: "Adidas", url: "https://www.adidas.com.ar", rubro: "deportes", platform: "extension" },
  { id: "nike", name: "Nike Argentina", url: "https://www.nike.com.ar", rubro: "deportes", platform: "extension" },
  { id: "opensports", name: "Open Sports", url: "https://www.opensports.com.ar", rubro: "deportes", platform: "extension" },
  { id: "quiksilver", name: "Quiksilver", url: "https://www.quiksilver.com.ar", rubro: "deportes", platform: "extension" },

  // --- MODA ---
  { id: "levis", name: "Levi's", url: "https://www.levi.com.ar", rubro: "moda", platform: "vtex" },
  { id: "kevingston", name: "Kevingston", url: "https://www.kevingston.com", rubro: "moda", platform: "auto" },
  { id: "bowen", name: "Bowen", url: "https://bowen.com.ar", rubro: "moda", platform: "extension" },
  { id: "lacoste", name: "Lacoste", url: "https://www.lacoste.com/ar", rubro: "moda", platform: "extension" },

  // --- ROPA INFANTIL ---
  { id: "mimo", name: "Mimo & Co", url: "https://www.mimo.com.ar", rubro: "infantil", platform: "vtex" },
  { id: "cheeky", name: "Cheeky", url: "https://www.cheeky.com.ar", rubro: "infantil", platform: "pow" },
  { id: "grisino", name: "Grisino", url: "https://www.grisino.com", rubro: "infantil", platform: "magento" },
  { id: "babycottons", name: "Baby Cottons", url: "https://www.babycottons.com.ar", rubro: "infantil", platform: "magento" },
  { id: "owoko", name: "Owoko", url: "https://www.owoko.com.ar", rubro: "infantil", platform: "tiendanube" },
  { id: "pioppa", name: "Pioppa", url: "https://pioppa.com.ar", rubro: "infantil", platform: "tiendanube" },
  { id: "littleakiabara", name: "Little Akiabara", url: "https://littleakiabara.com", rubro: "infantil", platform: "prestashop" },
  { id: "magdalenaesposito", name: "Magdalena Esposito", url: "https://magdalenaesposito.com", rubro: "infantil", platform: "auto" },

  // --- JUGUETES ---
  { id: "citykids", name: "CityKids", url: "https://www.citykids.com.ar", rubro: "juguetes", platform: "tiendanube" },
  { id: "creciendo", name: "Creciendo", url: "https://www.creciendo.com", rubro: "juguetes", platform: "tiendanube" },
  { id: "imaginarte", name: "Imaginarte", url: "https://www.imaginarte.com.ar", rubro: "juguetes", platform: "auto" },

  // --- FARMACIA Y PERFUMERÍA ---
  { id: "farmacity", name: "Farmacity", url: "https://www.farmacity.com", rubro: "farmacia", platform: "vtex" },
  { id: "pigmento", name: "Pigmento", url: "https://www.perfumeriaspigmento.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "julieriaque", name: "Juleriaque", url: "https://www.juleriaque.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "rouge", name: "Rouge", url: "https://www.perfumeriasrouge.com", rubro: "farmacia", platform: "vtex" },
  { id: "lasmargaritas", name: "Las Margaritas", url: "https://www.lasmargaritas.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "simplicity", name: "Simplicity", url: "https://www.simplicity.com.ar", rubro: "farmacia", platform: "vtex" },
  { id: "centraloeste", name: "Central Oeste", url: "https://www.centraloeste.com.ar", rubro: "farmacia", platform: "extension" },
  { id: "delpuente", name: "Farmacias del Puente", url: "https://www.farmaciasdelpuente.com.ar", rubro: "farmacia", platform: "auto" },
  { id: "parfumerie", name: "Parfumerie", url: "https://www.parfumerie.com.ar", rubro: "farmacia", platform: "extension" },
  { id: "natura", name: "Natura", url: "https://www.naturacosmeticos.com.ar", rubro: "farmacia", platform: "extension" },

  // --- LIBRERÍA ---
  { id: "cuspide", name: "Cúspide", url: "https://www.cuspide.com", rubro: "libreria", platform: "woo" },
  { id: "yenny", name: "Yenny / El Ateneo", url: "https://www.tematika.com", rubro: "libreria", platform: "tiendanube" },
  { id: "staples", name: "Staples", url: "https://www.staples.com.ar", rubro: "libreria", platform: "extension" }
];

export const BY_ID = new Map(DIRECTORY.map(s => [s.id, s]));
