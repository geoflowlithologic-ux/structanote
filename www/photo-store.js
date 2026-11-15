/**
 * StructaNote — armazenamento de fotografias em IndexedDB.
 *
 * O localStorage tem ~5 MB (no Safari é mesmo esse o limite) e as fotos em base64
 * enchem-no em poucos registos. Aqui as imagens vivem em IndexedDB (centenas de MB)
 * e na base de dados fica apenas a referência "idb:<photo_id>".
 */
(function () {
    'use strict';

    const DB_NAME = 'structanote_media';
    const STORE = 'photos';
    const REF_PREFIX = 'idb:';
    let dbPromise = null;

    function available() {
        try {
            return typeof indexedDB !== 'undefined' && indexedDB !== null;
        } catch (e) {
            return false;
        }
    }

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const idb = req.result;
                if (!idb.objectStoreNames.contains(STORE)) idb.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    async function put(id, dataUrl) {
        const idb = await open();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(dataUrl, String(id));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function get(id) {
        const idb = await open();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(String(id));
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function del(id) {
        const idb = await open();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(String(id));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    function isRef(value) {
        return typeof value === 'string' && value.indexOf(REF_PREFIX) === 0;
    }

    function refFor(id) {
        return REF_PREFIX + id;
    }

    /** Devolve a imagem: aceita tanto "idb:<id>" como um data URL antigo. */
    async function resolve(path, id) {
        if (isRef(path)) return get(path.slice(REF_PREFIX.length));
        if (typeof path === 'string' && path.indexOf('data:') === 0) return path;
        if (id !== undefined) return get(id);
        return null;
    }

    /** Migra fotografias guardadas em base64 dentro da base de dados para IndexedDB. */
    async function hydrate(database) {
        if (!available() || !database || !Array.isArray(database.georeferenced_photos)) return false;
        let changed = false;
        for (const photo of database.georeferenced_photos) {
            const path = photo.photo_path;
            if (typeof path === 'string' && path.indexOf('data:') === 0) {
                try {
                    await put(photo.photo_id, path);
                    photo.photo_path = refFor(photo.photo_id);
                    photo.storage = 'idb';
                    changed = true;
                } catch (e) {
                    // Sem IndexedDB (modo privado, por exemplo): mantém o base64 no localStorage.
                }
            } else if (isRef(path) && photo.storage !== 'idb') {
                photo.storage = 'idb';
                changed = true;
            }
        }
        return changed;
    }

    /** Cópia da base de dados com as fotos embutidas — usada no backup .json. */
    async function inlineForBackup(database) {
        const copy = JSON.parse(JSON.stringify(database));
        if (!Array.isArray(copy.georeferenced_photos)) return copy;
        for (const photo of copy.georeferenced_photos) {
            if (isRef(photo.photo_path)) {
                const dataUrl = await get(photo.photo_path.slice(REF_PREFIX.length));
                if (dataUrl) {
                    photo.photo_path = dataUrl;
                    delete photo.storage;
                }
            }
        }
        return copy;
    }

    /** Restaura um backup: as fotos em base64 voltam para o IndexedDB. */
    async function restoreFromBackup(database) {
        if (!available() || !database || !Array.isArray(database.georeferenced_photos)) return database;
        for (const photo of database.georeferenced_photos) {
            if (typeof photo.photo_path === 'string' && photo.photo_path.indexOf('data:') === 0) {
                try {
                    await put(photo.photo_id, photo.photo_path);
                    photo.photo_path = refFor(photo.photo_id);
                    photo.storage = 'idb';
                } catch (e) {
                    // mantém base64
                }
            }
        }
        return database;
    }

    window.SNMedia = {
        available,
        put,
        get,
        del,
        resolve,
        isRef,
        refFor,
        hydrate,
        inlineForBackup,
        restoreFromBackup
    };
})();
