// Copia lib/adapters.js a la extensión "RadarBug Puente", sin la parte de MercadoLibre (que vive en el servidor).
import { readFileSync, writeFileSync } from "node:fs";
let src = readFileSync(new URL("../lib/adapters.js", import.meta.url), "utf8");
src = src.replace('import { getMLToken } from "./ml.js";', 'const getMLToken = async () => { throw new Error("MercadoLibre no se consulta desde la extensión"); };');
writeFileSync(new URL("../extension-puente/adapters.js", import.meta.url), "// GENERADO por scripts/build-puente.js — no editar a mano\n" + src);
console.log("extension-puente/adapters.js actualizado");
