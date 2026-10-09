// MercadoLibre redirige acá después de autorizar la app; guardamos el refresh token en Supabase.
import { exchangeCode } from "../lib/ml.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!process.env.ADMIN_KEY || req.query.state !== process.env.ADMIN_KEY) return res.status(401).send("No autorizado");
  if (!req.query.code) return res.status(400).send("Falta el código de MercadoLibre");
  try {
    await exchangeCode(String(req.query.code), `https://${req.headers.host}/api/ml-callback`);
    return res.status(200).send("<h2>MercadoLibre conectado ✅</h2><p>El token se renueva solo. Ya podés cerrar esta pestaña.</p>");
  } catch (e) {
    return res.status(500).send(`<h2>No se pudo conectar</h2><p>${String(e.message).replace(/</g, "&lt;")}</p>`);
  }
}
