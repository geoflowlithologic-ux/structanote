/* StructaNote — mapa offline
   Guarda os tiles já vistos e permite descarregar uma área para uso sem internet,
   em IndexedDB (não depende de service worker, por isso funciona também no APK). */

(function () {
  'use strict';
  if (typeof L === 'undefined') return;

  const DB_NAME = 'structanote_offline';
  const DB_VERSION = 1;
  const STORE_TILES = 'tiles';
  const STORE_META = 'meta';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_TILES)) db.createObjectStore(STORE_TILES, { keyPath: 'url' });
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, action) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let request;
      try { request = action(s); } catch (err) { reject(err); return; }
      t.oncomplete = () => resolve(request ? request.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const SNStore = {
    getBlob(url) {
      return tx(STORE_TILES, 'readonly', (s) => s.get(url))
        .then((rec) => (rec && rec.blob ? rec.blob : null))
        .catch(() => null);
    },
    putBlob(url, blob) {
      return tx(STORE_TILES, 'readwrite', (s) => s.put({ url, blob, size: blob.size, ts: Date.now() }))
        .then(() => this.addBytes(blob.size))
        .catch(() => null);
    },
    has(url) {
      return tx(STORE_TILES, 'readonly', (s) => s.getKey(url)).then((k) => !!k).catch(() => false);
    },
    addBytes(n) {
      return tx(STORE_META, 'readwrite', (s) => {
        const req = s.get('bytes');
        req.onsuccess = () => s.put({ key: 'bytes', value: (req.result ? req.result.value : 0) + n });
      }).catch(() => null);
    },
    stats() {
      return Promise.all([
        tx(STORE_TILES, 'readonly', (s) => s.count()).catch(() => 0),
        tx(STORE_META, 'readonly', (s) => s.get('bytes')).catch(() => null)
      ]).then(([count, meta]) => ({ count: count || 0, bytes: meta ? meta.value : 0 }));
    },
    clear() {
      return Promise.all([
        tx(STORE_TILES, 'readwrite', (s) => s.clear()),
        tx(STORE_META, 'readwrite', (s) => s.clear())
      ]).catch(() => null);
    }
  };

  // Camada de tiles que lê primeiro do armazenamento local e guarda o que vai buscar.
  const OfflineTileLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      const url = this.getTileUrl(coords);

      SNStore.getBlob(url).then((blob) => {
        if (blob) {
          const objUrl = URL.createObjectURL(blob);
          img.onload = () => { URL.revokeObjectURL(objUrl); done(null, img); };
          img.onerror = (e) => { URL.revokeObjectURL(objUrl); done(e, img); };
          img.src = objUrl;
          return;
        }
        img.onload = () => done(null, img);
        img.onerror = (e) => done(e, img);
        img.src = url;
        if (navigator.onLine !== false) {
          fetch(url, { mode: 'cors' })
            .then((r) => (r.ok ? r.blob() : null))
            .then((b) => (b ? SNStore.putBlob(url, b) : null))
            .catch(() => null);
        }
      });
      return img;
    }
  });

  window.SNTiles = SNStore;
  window.SNOfflineTileLayer = OfflineTileLayer;
  window.createSNTileLayer = function (url, options) {
    return new OfflineTileLayer(url, options);
  };

  /* ---------- Descarregamento de área ---------- */

  function lon2tile(lon, z) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  }
  function lat2tile(lat, z) {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
  }

  function tileRange(bounds, z) {
    const xMin = lon2tile(bounds.getWest(), z);
    const xMax = lon2tile(bounds.getEast(), z);
    const yMin = lat2tile(bounds.getNorth(), z);
    const yMax = lat2tile(bounds.getSouth(), z);
    return { xMin, xMax, yMin, yMax, total: (xMax - xMin + 1) * (yMax - yMin + 1) };
  }

  async function downloadArea(layer, bounds, zMin, zMax, onProgress, isCancelled) {
    const jobs = [];
    for (let z = zMin; z <= zMax; z++) {
      const r = tileRange(bounds, z);
      for (let x = r.xMin; x <= r.xMax; x++) {
        for (let y = r.yMin; y <= r.yMax; y++) jobs.push({ x, y, z });
      }
    }
    let done = 0, stored = 0, failed = 0;
    const concurrency = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < jobs.length) {
        if (isCancelled()) return;
        const t = jobs[cursor++];
        const url = layer.getTileUrl({ x: t.x, y: t.y, z: t.z });
        try {
          if (!(await SNStore.has(url))) {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
              await SNStore.putBlob(url, await res.blob());
              stored++;
            } else {
              failed++;
            }
          }
        } catch (e) {
          failed++;
        }
        done++;
        if (done % 4 === 0 || done === jobs.length) onProgress(done, jobs.length, stored, failed);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    onProgress(done, jobs.length, stored, failed);
    return { total: jobs.length, stored, failed };
  }

  /* ---------- Interface ---------- */

  function buildUI() {
    const panel = document.getElementById('map-controls-panel');
    if (!panel || document.getElementById('btn-offline-map')) return;

    const bar = document.createElement('div');
    bar.className = 'flex gap-1 justify-between pt-1.5 border-t border-stone-800';
    bar.innerHTML =
      '<button type="button" id="btn-offline-map" onclick="SNOffline.open()" ' +
      'class="flex-1 px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold cursor-pointer text-[11px]">' +
      '<i class="fa-solid fa-cloud-arrow-down mr-1"></i>Mapa offline</button>';
    panel.appendChild(bar);

    const modal = document.createElement('div');
    modal.id = 'modal-offline-map';
    modal.className = 'hidden fixed inset-0 z-[2600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-md p-5 space-y-4 text-xs text-stone-200 font-mono">
        <div class="flex justify-between items-center border-b border-stone-800 pb-2">
          <h3 class="text-sm font-bold text-stone-100"><i class="fa-solid fa-cloud-arrow-down text-emerald-400 mr-1.5"></i>Mapa offline</h3>
          <button type="button" onclick="SNOffline.close()" class="text-stone-400 hover:text-white p-1 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="text-[11px] leading-relaxed text-stone-400">Descarregue a área visível no mapa para a usar sem internet, como um mapa impresso. Pode aproximar e afastar; o que já viu fica sempre guardado.</p>
        <div class="space-y-2">
          <label class="block text-[11px] font-bold text-stone-300">Camada</label>
          <select id="offline-layer" class="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-amber-400 font-bold">
            <option value="sat">Satélite</option>
            <option value="topo">Topografia</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-stone-300 mb-1">Zoom atual</label>
            <div id="offline-zmin" class="bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-amber-400 font-bold">--</div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-stone-300 mb-1">Zoom máximo</label>
            <select id="offline-zmax" class="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-amber-400 font-bold"></select>
          </div>
        </div>
        <div class="bg-stone-950 border border-stone-800 rounded-lg p-2.5 flex justify-between text-[11px]">
          <span class="text-stone-400">Tiles a descarregar</span>
          <span id="offline-estimate" class="text-amber-400 font-bold">--</span>
        </div>
        <div class="w-full h-2 bg-stone-800 rounded overflow-hidden hidden" id="offline-progress-wrap">
          <div id="offline-progress" class="h-full bg-emerald-500 w-0 transition-all"></div>
        </div>
        <p id="offline-status" class="text-[11px] text-stone-400">A área corresponde à vista atual do mapa.</p>
        <div class="flex gap-2">
          <button type="button" id="offline-start" onclick="SNOffline.start()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg cursor-pointer">Descarregar área</button>
          <button type="button" id="offline-cancel" onclick="SNOffline.cancel()" class="hidden flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold py-2 rounded-lg cursor-pointer">Cancelar</button>
        </div>
        <div class="border-t border-stone-800 pt-3 flex items-center justify-between text-[11px]">
          <span id="offline-stats" class="text-stone-400">--</span>
          <button type="button" onclick="SNOffline.clear()" class="text-red-400 hover:text-red-300 font-bold cursor-pointer"><i class="fa-solid fa-trash-can mr-1"></i>Limpar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) SNOffline.close(); });

    const zSel = document.getElementById('offline-zmax');
    const layerSel = document.getElementById('offline-layer');
    layerSel.addEventListener('change', refreshEstimate);
    zSel.addEventListener('change', refreshEstimate);
  }

  let cancelled = false;
  let busy = false;

  function currentLayer() {
    const which = document.getElementById('offline-layer').value;
    return (window.baseLayers && baseLayers[which]) || null;
  }

  function refreshEstimate() {
    const map = window.map;
    if (!map) return;
    const zMin = map.getZoom();
    document.getElementById('offline-zmin').textContent = zMin;
    const zSel = document.getElementById('offline-zmax');
    if (!zSel.options.length) {
      const maxNative = 17;
      for (let z = zMin; z <= maxNative; z++) {
        const o = document.createElement('option');
        o.value = z;
        o.textContent = z;
        zSel.appendChild(o);
      }
      zSel.value = Math.min(zMin + 2, maxNative);
    }
    const zMax = parseInt(zSel.value, 10) || zMin;
    let total = 0;
    for (let z = zMin; z <= zMax; z++) total += tileRange(map.getBounds(), z).total;
    document.getElementById('offline-estimate').textContent = total.toLocaleString('pt-PT') + ' tiles';
  }

  async function refreshStats() {
    const s = await SNStore.stats();
    const mb = (s.bytes / (1024 * 1024)).toFixed(1);
    document.getElementById('offline-stats').textContent = `${s.count.toLocaleString('pt-PT')} tiles guardados · ${mb} MB`;
  }

  window.SNOffline = {
    open() {
      const modal = document.getElementById('modal-offline-map');
      modal.classList.remove('hidden');
      const zSel = document.getElementById('offline-zmax');
      zSel.innerHTML = '';
      refreshEstimate();
      refreshStats();
    },
    close() {
      document.getElementById('modal-offline-map').classList.add('hidden');
    },
    cancel() {
      cancelled = true;
      document.getElementById('offline-status').textContent = 'A cancelar…';
    },
    async start() {
      if (busy) return;
      const map = window.map;
      const layer = currentLayer();
      if (!map || !layer) { alert('Abra primeiro o mapa.'); return; }
      const zMin = map.getZoom();
      const zMax = parseInt(document.getElementById('offline-zmax').value, 10) || zMin;
      const bounds = map.getBounds();
      let total = 0;
      for (let z = zMin; z <= zMax; z++) total += tileRange(bounds, z).total;
      if (total > 4000 && !confirm(`São ${total} tiles (pode ocupar várias centenas de MB). Continuar?`)) return;

      busy = true;
      cancelled = false;
      document.getElementById('offline-start').classList.add('hidden');
      document.getElementById('offline-cancel').classList.remove('hidden');
      document.getElementById('offline-progress-wrap').classList.remove('hidden');
      document.getElementById('offline-status').textContent = 'A descarregar…';

      const result = await downloadArea(
        layer, bounds, zMin, zMax,
        (done, all, stored, failed) => {
          const pct = all ? Math.round((done / all) * 100) : 0;
          document.getElementById('offline-progress').style.width = pct + '%';
          document.getElementById('offline-status').textContent =
            `${done.toLocaleString('pt-PT')} / ${all.toLocaleString('pt-PT')} tiles (${stored} novos${failed ? ', ' + failed + ' falhas' : ''})`;
        },
        () => cancelled
      );

      busy = false;
      document.getElementById('offline-start').classList.remove('hidden');
      document.getElementById('offline-cancel').classList.add('hidden');
      document.getElementById('offline-status').textContent = cancelled
        ? 'Cancelado. O que já foi descarregado fica disponível offline.'
        : `Concluído: ${result.stored.toLocaleString('pt-PT')} tiles guardados${result.failed ? ' (' + result.failed + ' falhas)' : ''}.`;
      refreshStats();
    },
    async clear() {
      if (!confirm('Apagar todos os tiles guardados para offline?')) return;
      await SNStore.clear();
      refreshStats();
      document.getElementById('offline-status').textContent = 'Mapa offline limpo.';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
