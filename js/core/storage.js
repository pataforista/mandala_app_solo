// js/core/storage.js
// Carga perezosa: si el CDN falla, sólo fallan los favoritos, no el arranque de la app.
let idbPromise = null;
const idb = () => (idbPromise ??= import('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/+esm')
    .catch(err => { idbPromise = null; throw err; }));

const FAVORITES_KEY = 'mandala_favorites';

export async function saveToFavorites(state, thumbnailDataUrl) {
    const id = Date.now();
    const entry = {
        id,
        date: new Date().toISOString(),
        state: JSON.parse(JSON.stringify(state)),
        thumbnail: thumbnailDataUrl || null,
    };

    const { update } = await idb();
    await update(FAVORITES_KEY, (val) => {
        const favorites = val || [];
        return [entry, ...favorites];
    });

    return entry;
}

export async function getFavorites() {
    const { get } = await idb();
    return (await get(FAVORITES_KEY)) || [];
}

export async function deleteFavorite(id) {
    const { update } = await idb();
    await update(FAVORITES_KEY, (val) => {
        const favorites = val || [];
        return favorites.filter(f => f.id !== id);
    });
}
