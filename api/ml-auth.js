// Paso único para conectar MercadoLibre: abrí /api/ml-auth?key=TU_ADMIN_KEY y aceptá los permisos.
export default function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(401).send("No autorizado");
  if (!process.env.ML_CLIENT_ID) return res.status(500).send("Falta ML_CLIENT_ID en las variables de Vercel");
  const redirect = `https://${req.headers.host}/api/ml-callback`;
  const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${encodeURIComponent(process.env.ML_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(process.env.ADMIN_KEY)}`;
  res.writeHead(302, { Location: url });
  res.end();
}
