// construir.mjs — mete los archivos nuevos dentro de aplicar-enlaces-sevac.mjs, para que el
// script se pueda descargar y correr como un solo archivo.
//   node construir.mjs          regenera el bloque ARCHIVOS
//   node construir.mjs --check  solo comprueba que esté al día (código 1 si no)

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const AQUI = new URL("./", import.meta.url);
const SCRIPT = new URL("aplicar-enlaces-sevac.mjs", AQUI);
export const FUENTES = {
  "lib/sevac-enlaces/enlaces.js": "lib/sevac-enlaces/enlaces.js",
  "lib/sevac-enlaces/servir-documento.js": "lib/sevac-enlaces/servir-documento.js",
  "app/(con-footer)/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js": "plantillas/route.js",
};

export function bloque() {
  const archivos = Object.fromEntries(
    Object.entries(FUENTES).map(([destino, fuente]) => [destino, fs.readFileSync(new URL(fuente, AQUI), "utf8")]),
  );
  return `// <<ARCHIVOS\nexport const ARCHIVOS = ${JSON.stringify(archivos, null, 2)};\n// ARCHIVOS>>`;
}

export function construido() {
  const t = fs.readFileSync(SCRIPT, "utf8");
  const re = /\/\/ <<ARCHIVOS\n[\s\S]*?\n\/\/ ARCHIVOS>>/;
  if (!re.test(t)) throw new Error("no encontré el bloque ARCHIVOS en aplicar-enlaces-sevac.mjs");
  return { actual: t, nuevo: t.replace(re, () => bloque()) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { actual, nuevo } = construido();
  if (process.argv.includes("--check")) {
    if (actual !== nuevo) {
      console.error("aplicar-enlaces-sevac.mjs no está al día: corre `node construir.mjs`");
      process.exitCode = 1;
    } else console.log("al día");
  } else {
    fs.writeFileSync(SCRIPT, nuevo);
    console.log("aplicar-enlaces-sevac.mjs actualizado");
  }
}
