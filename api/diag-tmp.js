// TEMPORAL — diagnóstico de tiendas durante la puesta a punto. Se elimina al terminar.
const K = "9f94b1cfcf317d993ec9c158";
export default async function handler(req, res) {
  if (req.query.k !== K) return res.status(404).end();
  let u;
  try { u = new URL(String(req.query.url || "")); } catch { return res.status(400).json({ error: "url inválida" }); }
  if (u.protocol !== "https:" || /^[\d.]+$/.test(u.hostname) || !u.hostname.includes(".")) return res.status(400).json({ error: "solo https" });
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
    const init = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", "Accept-Language": "es-AR,es;q=0.9", Accept: req.query.accept || "*/*" }, signal: ctrl.signal, redirect: "follow" };
    if (req.query.post) { init.method = "POST"; init.body = String(req.query.post); init.headers["Content-Type"] = req.query.ctype || "application/json"; }
    const r = await fetch(u.href, init);
    const t = await r.text();
    const ctx = Math.min(parseInt(req.query.ctx || "250", 10) || 250, 1500);
    let hits = null;
    if (req.query.grep) { hits = []; const low = t.toLowerCase(), g = String(req.query.grep).toLowerCase(); let i = -1; while ((i = low.indexOf(g, i + 1)) !== -1 && hits.length < 6) hits.push(t.slice(Math.max(0, i - ctx), i + ctx)); }
    const from = parseInt(req.query.from || "0", 10) || 0;
    return res.status(200).json({ status: r.status, finalUrl: r.url, type: r.headers.get("content-type"), len: t.length, head: t.slice(from, from + 2000), hits });
  } catch (e) { return res.status(200).json({ error: e.name === "AbortError" ? "timeout" : (e.cause?.code || e.message) }); }
}
