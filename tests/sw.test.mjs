// El precache del service worker debe llevar el hash real de cada archivo. Si falla:
//   npm run sw:rev
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileRevision, precacheEntries } from "../scripts/sw-revisions.mjs";

test("sw.js: cada archivo del precache lleva la revisión de su contenido actual", () => {
  const entries = precacheEntries(fs.readFileSync("sw.js", "utf8"));
  assert.ok(entries.some(e => e.url === "index.html"), "index.html debe estar en el precache");
  const stale = entries.filter(e => !fs.existsSync(e.url) || fileRevision(e.url) !== e.revision).map(e => e.url);
  assert.deepEqual(stale, [], `Revisiones desactualizadas (ejecuta «npm run sw:rev»): ${stale.join(", ")}`);
});
