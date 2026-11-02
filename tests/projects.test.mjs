import test from "node:test";
import assert from "node:assert/strict";
import {
  autoSaveProject,
  loadAutoSave,
  saveNamedProject,
  listProjects,
  loadProject,
  deleteProject,
  duplicateProject,
  serializeProject,
  deserializeProject,
  PROJECT_FORMAT,
} from "../js/core/projects.js";

test("proyectos: autoguardado y recuperación básica", async () => {
  const dummy = {
    name: "Mi Libro Océano",
    bookSettings: { title: "Océano Mágico", pages: 40, theme: "oceano" },
    userFigures: [{ name: "orca", use: "figura" }],
  };

  await autoSaveProject(dummy);
  const loaded = await loadAutoSave();
  assert.equal(loaded.name, "Mi Libro Océano");
  assert.equal(loaded.bookSettings.pages, 40);
  assert.equal(loaded.userFigures.length, 1);
});

test("proyectos: guardar con nombre, listar, duplicar y eliminar", async () => {
  const p1 = await saveNamedProject("Proyecto Espacio", { theme: "espacio", pages: 50 });
  assert.ok(p1.id);
  assert.equal(p1.name, "Proyecto Espacio");

  const list = await listProjects();
  assert.ok(list.some((p) => p.name === "Proyecto Espacio"));

  const loaded = await loadProject(p1.id);
  assert.equal(loaded.theme, "espacio");

  const dup = await duplicateProject(p1.id);
  assert.equal(dup.name, "Proyecto Espacio (Copia)");
  assert.notEqual(dup.id, p1.id);

  await deleteProject(p1.id);
  const afterDelete = await loadProject(p1.id);
  assert.equal(afterDelete, null);
});

test("proyectos: serialización y deserialización JSON", () => {
  const orig = {
    name: "Libro Místico",
    theme: "mistico",
    pages: 30,
    figuresCount: 12,
  };
  const json = serializeProject(orig);
  assert.ok(json.includes(PROJECT_FORMAT));

  const parsed = deserializeProject(json);
  assert.equal(parsed.name, "Libro Místico");
  assert.equal(parsed.theme, "mistico");
  assert.equal(parsed.pages, 30);

  assert.throws(() => deserializeProject(JSON.stringify({ format: "otro" })), /no es un proyecto válido/);
});
