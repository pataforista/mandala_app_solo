// Prueba de punta a punta: abre la app en Chromium, pide un libro de 28 mandalas, guarda el PDF
// y comprueba el aviso final, el número de páginas y que la app no dio errores.
// Los archivos de la app y las librerías de CDN se sirven desde la propia prueba (sin servidor).
//   npm run e2e            (español e inglés)
//   node scripts/e2e-book.cjs <carpeta de salida> [es|en]
// Requiere Playwright con Chromium (en los entornos de Claude Code ya viene instalado) y las
// devDependencies del proyecto (npm install): Shoelace y jsPDF se sirven desde node_modules.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "node_modules");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const serve = (route, file) => {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "no" });
  route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file), headers: { "access-control-allow-origin": "*" } });
};
(async () => {
  const out = process.argv[2] || fs.mkdtempSync(path.join(require("os").tmpdir(), "mandala-e2e-")), lang = process.argv[3] || "es";
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
  await p.route("http://app.local/**", (r) => { const u = new URL(r.request().url()); serve(r, path.join(ROOT, decodeURIComponent(u.pathname))); });
  await p.route("https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/**", (r) => serve(r, path.join(VENDOR, "@shoelace-style/shoelace", new URL(r.request().url()).pathname.split("shoelace@2.19.1/")[1])));
  await p.route("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", (r) => serve(r, path.join(VENDOR, "jspdf/dist/jspdf.umd.min.js")));
  await p.goto("http://app.local/index.html", { waitUntil: "load" });
  await p.waitForFunction(() => !!customElements.get("sl-button") && !!window.jspdf, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  // Pestaña del libro, 28 mandalas, idioma
  await p.click('sl-tab[panel="libro"]');
  await p.evaluate((lang) => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true })); el.dispatchEvent(new CustomEvent("sl-input", { bubbles: true })); };
    set("bookPages", "28"); set("bookLanguage", lang);
  }, lang);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/e2e_libro_${lang}.png` });
  const t0 = Date.now();
  const dl = p.waitForEvent("download", { timeout: 240000 });
  await p.evaluate(() => document.getElementById("downloadBook").click());
  const d = await dl;
  const file = `${out}/libro_${lang}.pdf`;
  await d.saveAs(file);
  await p.waitForTimeout(1500);
  const toasts = await p.evaluate(() => [...document.querySelectorAll("sl-alert")].map((a) => a.textContent.trim().replace(/\s+/g, " ").slice(0, 240)));
  console.log(JSON.stringify({ nombre: d.suggestedFilename(), MB: +(fs.statSync(file).size / 1e6).toFixed(1), segundos: Math.round((Date.now() - t0) / 1000) }));
  console.log("avisos:", JSON.stringify(toasts.slice(-3)));
  console.log("errores de la app:", JSON.stringify(errs.slice(0, 8)));
  await p.screenshot({ path: `${out}/e2e_fin_${lang}.png` });
  await b.close();
  // Criterios: sin errores de la app, aviso final «Listo para KDP», sin páginas flojas, PDF real
  const last = toasts.at(-1) || "";
  const problems = [];
  if (errs.length) problems.push("la app dio errores en consola");
  if (!/Libro creado \((\d+) páginas\)/.test(last)) problems.push("no apareció el aviso «Libro creado»");
  if (!/Listo para KDP/.test(last)) problems.push("el aviso final no dice «Listo para KDP»");
  if (!/ninguna floja/.test(last)) problems.push("el control de calidad dejó páginas flojas");
  if (fs.statSync(file).size < 2e6 || fs.readFileSync(file).subarray(0, 5).toString() !== "%PDF-") problems.push("el PDF no es válido");
  if (problems.length) { console.error("FALLO:", problems.join("; ")); process.exit(1); }
  console.log(`OK (${lang}): ${file}`);
})().catch((e) => { console.error("FALLO", e.message.slice(0, 400)); process.exit(1); });
