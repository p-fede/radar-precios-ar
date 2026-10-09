// Acceso a Supabase vía REST (PostgREST). Si faltan las variables de entorno, todo queda desactivado sin romper la web.
// Variables: SUPABASE_URL, SUPABASE_SERVICE_KEY (clave "service_role", NUNCA la pongas en el HTML).

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
export const dbEnabled = Boolean(URL_ && KEY);

async function call(path, { method = "GET", body, prefer, timeout = 4000 } = {}) {
  if (!dbEnabled) return null;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${URL_}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    if (!r.ok) { console.error("supabase", path, r.status, (await r.text()).slice(0, 300)); return null; }
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  } catch (e) {
    console.error("supabase", path, e.message);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

export const productKey = (it) => `${it.tiendaId}|${String(it.url).split("?")[0].replace(/^https?:\/\/(www\.)?/, "")}`;

// Guarda una foto diaria de precios (una fila por producto por día; si se repite el día, se actualiza).
export async function savePrices(items, timeout = 4000) {
  if (!dbEnabled || !items.length) return;
  const rows = [];
  const seen = new Set();
  for (const it of items) {
    const k = productKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({
      tienda_id: it.tiendaId, product_key: k, ean: it.ean || null, nombre: it.nombre.slice(0, 300),
      precio: it.precio, precio_lista: it.precioLista, url: it.url, img: it.img
    });
  }
  for (let i = 0; i < rows.length; i += 500) {
    await call("precios?on_conflict=product_key,fecha", { method: "POST", body: rows.slice(i, i + 500), prefer: "resolution=merge-duplicates,return=minimal", timeout });
  }
}

export async function priceStats(keys) {
  if (!dbEnabled || !keys.length) return new Map();
  const res = await call("rpc/stats_precios", { method: "POST", body: { keys, dias: 60 } });
  return new Map((res || []).map(r => [r.product_key, r]));
}

export async function latestByEan(eans) {
  if (!dbEnabled || !eans.length) return [];
  return (await call("rpc/ultimos_por_ean", { method: "POST", body: { eans } })) || [];
}

export async function getConfig(key) {
  const r = await call(`config?key=eq.${encodeURIComponent(key)}&select=value`);
  return r?.[0]?.value ?? null;
}

export async function setConfig(key, value) {
  return call("config?on_conflict=key", { method: "POST", body: [{ key, value, updated_at: new Date().toISOString() }], prefer: "resolution=merge-duplicates,return=minimal" });
}
