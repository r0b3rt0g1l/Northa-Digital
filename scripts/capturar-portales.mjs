// Captura la página de inicio real de cada portal municipal del portafolio
// (lib/content/proyectos.js) y la guarda en public/portafolio/portales/ como
// WebP 1440 × 900, más un índice en lib/content/capturas.json con la fecha.
//
// Uso (no cambia package.json):
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/capturar-portales.mjs            # todos
//   node scripts/capturar-portales.mjs Aconchi    # solo uno o varios
//
// Variables opcionales: PLAYWRIGHT_MODULE (ruta al módulo de Playwright) y
// CHROMIUM_PATH (Chromium ya instalado). Si un portal no responde, se conserva
// su captura anterior y el sitio sigue mostrando la que haya.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "public/portafolio/portales");
const INDICE = path.join(RAIZ, "lib/content/capturas.json");
const ANCHO = 1440;
const ALTO = 900;

const { proyectoDestacado } = await import(path.join(RAIZ, "lib/content/proyectos.js"));
const { slugMunicipio } = await import(path.join(RAIZ, "lib/content/slug.js"));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const filtro = process.argv.slice(2).map((n) => slugMunicipio(n));
const portales = proyectoDestacado.enlaces.filter((e) => !filtro.length || filtro.includes(slugMunicipio(e.nombre)));

await mkdir(DESTINO, { recursive: true });
let indice = {};
try {
  indice = JSON.parse(await readFile(INDICE, "utf8"));
} catch {}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, locale: "es-MX" });
let fallos = 0;
for (const p of portales) {
  const slug = slugMunicipio(p.nombre);
  const page = await ctx.newPage();
  try {
    await page.goto(p.url, { waitUntil: "load", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready);
    // Los portales abren con un aviso de términos de uso sobre la portada:
    // se cierra con su propio botón para capturar la página de inicio.
    const aviso = page.getByRole("button", { name: "Acepto", exact: true });
    if (await aviso.isVisible().catch(() => false)) {
      await aviso.click();
      await aviso.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(2500); // animaciones de entrada y carruseles
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: ANCHO, height: ALTO } });
    await sharp(png).webp({ quality: 80 }).toFile(path.join(DESTINO, `${slug}.webp`));
    indice[slug] = {
      src: `/portafolio/portales/${slug}.webp`,
      width: ANCHO,
      height: ALTO,
      fecha: new Date().toISOString().slice(0, 10),
    };
    console.log(`ok     ${p.nombre}`);
  } catch (e) {
    fallos++;
    console.log(`falla  ${p.nombre}: ${e.message.split("\n")[0]}${indice[slug] ? " (se conserva la anterior)" : ""}`);
  } finally {
    await page.close();
  }
}
await browser.close();
const ordenado = Object.fromEntries(Object.entries(indice).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(INDICE, JSON.stringify(ordenado, null, 2) + "\n");
console.log(`\n${portales.length - fallos}/${portales.length} capturas actualizadas`);
process.exit(fallos ? 1 : 0);
