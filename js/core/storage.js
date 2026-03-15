// js/core/storage.js
import { get, set, update } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

const FAVORITES_KEY = 'mandala_favorites';

export async function saveToFavorites(state, svgThumbnail) {
    const id = Date.now();
    const entry = {
        id,
        date: new Date().toISOString(),
        state: JSON.parse(JSON.stringify(state)),
        thumbnail: svgThumbnail || null,
    };

    await update(FAVORITES_KEY, (val) => {
        const favorites = val || [];
        return [entry, ...favorites];
    });

    return entry;
}

export async function getFavorites() {
    return (await get(FAVORITES_KEY)) || [];
}

export async function deleteFavorite(id) {
    await update(FAVORITES_KEY, (val) => {
        const favorites = val || [];
        return favorites.filter(f => f.id !== id);
    });
}
