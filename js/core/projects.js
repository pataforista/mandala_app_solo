// js/core/projects.js
// Gestión de proyectos de libro con persistencia local en IndexedDB y exportación/importación JSON.
// Sin dependencias externas; funciona offline y cuenta con fallback en memoria para tests en Node.js.

const DB_NAME = "MandalaStudioDB";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const AUTOSAVE_ID = "_autosave";

// Fallback en memoria si indexedDB no está disponible (ej. Node.js unit tests)
const memStore = new Map();

let dbPromise = null;

function openDB() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openDB().then((db) => {
    if (!db) {
      // Memory fallback
      return fn({
        get: (key) => Promise.resolve(memStore.get(key)),
        put: (val) => Promise.resolve(memStore.set(val.id, val)),
        delete: (key) => Promise.resolve(memStore.delete(key)),
        getAll: () => Promise.resolve(Array.from(memStore.values())),
      });
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, mode);
      const store = tx.objectStore(STORE_PROJECTS);
      const reqStore = {
        get: (key) => new Promise((res, rej) => {
          const r = store.get(key);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        }),
        put: (val) => new Promise((res, rej) => {
          const r = store.put(val);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        }),
        delete: (key) => new Promise((res, rej) => {
          const r = store.delete(key);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        }),
        getAll: () => new Promise((res, rej) => {
          const r = store.getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        }),
      };
      fn(reqStore).then(resolve).catch(reject);
    });
  });
}

/** Formato estándar de un proyecto */
export const PROJECT_FORMAT = "mandala-project";
export const PROJECT_VERSION = 1;

/**
 * Guarda el estado actual en el slot de autoguardado.
 */
export async function autoSaveProject(projectData) {
  const entry = {
    id: AUTOSAVE_ID,
    name: projectData.name || "Autoguardado",
    updatedAt: Date.now(),
    project: projectData,
  };
  await withStore("readwrite", (s) => s.put(entry));
  return entry;
}

/**
 * Recupera el último autoguardado si existe.
 */
export async function loadAutoSave() {
  const entry = await withStore("readonly", (s) => s.get(AUTOSAVE_ID));
  return entry ? entry.project : null;
}

/**
 * Guarda un proyecto con nombre.
 */
export async function saveNamedProject(name, projectData, existingId = null) {
  const id = existingId && existingId !== AUTOSAVE_ID ? existingId : `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    id,
    name: name.trim() || "Libro Sin Título",
    updatedAt: Date.now(),
    project: { ...projectData, id, name: name.trim() || "Libro Sin Título" },
  };
  await withStore("readwrite", (s) => s.put(entry));
  return entry;
}

/**
 * Obtiene la lista de proyectos guardados (excluyendo el autoguardado).
 */
export async function listProjects() {
  const all = await withStore("readonly", (s) => s.getAll());
  return all
    .filter((e) => e && e.id !== AUTOSAVE_ID)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Carga un proyecto guardado por ID.
 */
export async function loadProject(id) {
  const entry = await withStore("readonly", (s) => s.get(id));
  return entry ? entry.project : null;
}

/**
 * Elimina un proyecto por ID.
 */
export async function deleteProject(id) {
  await withStore("readwrite", (s) => s.delete(id));
}

/**
 * Duplica un proyecto existente.
 */
export async function duplicateProject(id) {
  const orig = await loadProject(id);
  if (!orig) throw new Error("Proyecto no encontrado");
  const newName = `${orig.name || "Proyecto"} (Copia)`;
  return saveNamedProject(newName, { ...orig, id: null, name: newName });
}

/**
 * Serializa un proyecto a formato JSON descargable.
 */
export function serializeProject(projectData) {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    project: projectData,
  }, null, 2);
}

/**
 * Deserializa y valida un archivo JSON de proyecto.
 */
export function deserializeProject(jsonString) {
  const data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
  if (!data || data.format !== PROJECT_FORMAT) {
    throw new Error("El archivo no es un proyecto válido de Mandala Studio");
  }
  return data.project;
}
