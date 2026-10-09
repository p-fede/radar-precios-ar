// Tarea diaria (Vercel Cron, ver vercel.json): toma una foto de precios de todas las tiendas para armar el historial.
// Vercel la llama con el header Authorization: Bearer CRON_SECRET.
import { DIRECTORY } from "../lib/stores.js";
import { queryStore, runPool } from "../lib/adapters.js";
import { savePrices, dbEnabled } from "../lib/db.js";

export const config = { maxDuration: 60 };

// Búsquedas genéricas por rubro, además del listado "más descontado" de cada tienda
const TERMINOS = {
  supermercados: ["leche", "aceite", "cafe", "yerba", "detergente"],
  tecnologia: ["celular", "notebook", "smart tv", "auriculares"],
  electro: ["heladera", "lavarropas", "aire acondicionado", "microondas"],
  herramientas: ["taladro", "pintura", "amoladora"],
  hogar: ["colchon", "sabanas", "sillon"],
  deportes: ["zapatillas", "remera", "buzo"],
  moda: ["jean", "camisa", "campera"],
  infantil: ["body", "remera", "pantalon", "campera"],
  juguetes: ["muñeca", "lego", "auto", "juego de mesa"],
  farmacia: ["perfume", "shampoo", "protector solar"],
  libreria: ["cuaderno", "libro"]
};

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "no autorizado" });
  if (!dbEnabled) return res.status(200).json({ ok: false, motivo: "Supabase no configurado" });

  const tiendas = DIRECTORY.filter(s => !["extension", "auto", "mercadolibre"].includes(s.platform));
  const tareas = [];
  for (const s of tiendas) {
    tareas.push({ store: s, q: "" });
    for (const t of TERMINOS[s.rubro] || []) tareas.push({ store: s, q: t });
  }

  let guardados = 0;
  const results = await runPool(tareas, async (t) => {
    const r = await queryStore(t.store, t.q, 40);
    await savePrices(r.items, 8000);
    guardados += r.items.length;
    return r;
  }, 12, 52000);

  const errores = results.filter(r => r.error).length;
  return res.status(200).json({ ok: true, tareas: tareas.length, errores, guardados });
}
