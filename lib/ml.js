// Token de MercadoLibre con renovación automática.
// Variables: ML_CLIENT_ID, ML_CLIENT_SECRET (de tu app en developers.mercadolibre.com.ar).
// El refresh token se obtiene una sola vez entrando a /api/ml-auth?key=ADMIN_KEY y queda guardado en Supabase.
// MercadoLibre entrega un refresh token NUEVO en cada renovación (el anterior deja de servir), por eso se guarda en la base.
import { getConfig, setConfig, dbEnabled } from "./db.js";

let cached = { token: null, exp: 0 };

export class MLError extends Error {}

export async function getMLToken() {
  if (process.env.ML_ACCESS_TOKEN) return process.env.ML_ACCESS_TOKEN;
  if (cached.token && cached.exp > Date.now() + 60_000) return cached.token;

  const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new MLError("faltan ML_CLIENT_ID / ML_CLIENT_SECRET");
  if (!dbEnabled) throw new MLError("MercadoLibre necesita Supabase para guardar el token");

  // Token de acceso vigente guardado por otra instancia
  const savedAccess = await getConfig("ml_access_token");
  const savedExp = Number(await getConfig("ml_access_exp")) || 0;
  if (savedAccess && savedExp > Date.now() + 60_000) { cached = { token: savedAccess, exp: savedExp }; return savedAccess; }

  const refresh = await getConfig("ml_refresh_token");
  if (!refresh) throw new MLError("falta autorizar la app: entrá una vez a /api/ml-auth?key=TU_ADMIN_KEY");

  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: id, client_secret: secret, refresh_token: refresh })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new MLError(`no se pudo renovar el token (${j.error || r.status})`);

  const exp = Date.now() + (j.expires_in || 21600) * 1000;
  cached = { token: j.access_token, exp };
  await setConfig("ml_access_token", j.access_token);
  await setConfig("ml_access_exp", String(exp));
  if (j.refresh_token) await setConfig("ml_refresh_token", j.refresh_token);
  return j.access_token;
}

export async function exchangeCode(code, redirectUri) {
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET,
      code, redirect_uri: redirectUri
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) throw new MLError(`MercadoLibre rechazó el código (${j.error || r.status}: ${j.message || ""})`);
  const exp = Date.now() + (j.expires_in || 21600) * 1000;
  cached = { token: j.access_token, exp };
  await setConfig("ml_refresh_token", j.refresh_token);
  await setConfig("ml_access_token", j.access_token);
  await setConfig("ml_access_exp", String(exp));
}
