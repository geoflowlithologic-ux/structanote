/**
 * StructaNote — suporte iOS (Safari e app nativa).
 *
 * - O Safari ignora o atributo "download" em ficheiros gerados: usa-se a folha de
 *   partilha (Web Share) ou abre-se o ficheiro numa nova aba para "Guardar em Ficheiros".
 * - Aviso único de instalação no ecrã principal (o Safari apaga dados de sites não
 *   instalados após ~7 dias sem uso).
 * - Inputs a 16 px, para o Safari não ampliar o ecrã ao tocar nos campos.
 */
(function () {
    'use strict';

    const ua = navigator.userAgent || '';
    const isIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPad;
    const isStandalone = window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

    function isNative() {
        return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    }

    if (isIOS) {
        document.documentElement.classList.add('sn-ios');
    }

    /** Guarda ou partilha um ficheiro gerado pela app. */
    async function shareOrDownload(content, filename, type) {
        const mime = type || 'application/octet-stream';
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime });

        // App nativa (Android/iOS): ponte Capacitor.
        if (window.SNFiles && window.SNFiles.isNative()) {
            return window.SNFiles.saveAndShare(blob, filename);
        }

        const file = new File([blob], filename, { type: mime });
        const canShareFile = isIOS && navigator.canShare && navigator.canShare({ files: [file] });
        if (canShareFile) {
            try {
                await navigator.share({ files: [file], title: filename });
                return 'shared';
            } catch (err) {
                if (err && err.name === 'AbortError') return 'cancelled';
            }
        }

        const url = URL.createObjectURL(blob);
        if (isIOS) {
            // Safari não descarrega blobs: abre numa aba para "Partilhar → Guardar em Ficheiros".
            const win = window.open(url, '_blank');
            if (!win) window.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            return 'opened';
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        return 'downloaded';
    }

    function showInstallHint() {
        if (!isIOS || isStandalone || isNative()) return;
        try {
            if (localStorage.getItem('sn_ios_install_hint') === 'off') return;
        } catch (e) { /* modo privado */ }

        const bar = document.createElement('div');
        bar.id = 'sn-ios-install-hint';
        bar.setAttribute('role', 'note');
        bar.style.cssText = [
            'position:fixed', 'left:8px', 'right:8px', 'bottom:10px', 'z-index:9999',
            'background:#1c1917', 'color:#f5f5f4', 'border:1px solid #44403c',
            'border-radius:12px', 'padding:10px 12px', 'font-size:12px', 'line-height:1.45',
            'box-shadow:0 8px 24px rgba(0,0,0,.45)', 'display:flex', 'gap:10px', 'align-items:flex-start'
        ].join(';');
        bar.innerHTML = `
            <div style="flex:1">
                <b style="color:#F5A600">Instalar no iPhone</b><br>
                Toque em <b>Partilhar</b> (□↑) na barra do Safari e escolha
                <b>Adicionar ao Ecrã Principal</b>. Assim a app abre em ecrã inteiro e os
                dados não são apagados pelo Safari.
            </div>
            <button type="button" aria-label="Fechar" style="background:#292524;color:#d6d3d1;border:1px solid #44403c;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer">OK</button>`;
        bar.querySelector('button').addEventListener('click', () => {
            try { localStorage.setItem('sn_ios_install_hint', 'off'); } catch (e) { /* ignore */ }
            bar.remove();
        });
        document.body.appendChild(bar);
    }

    function sensorPermissionHelp() {
        if (isNative()) {
            alert('Permissão de sensores recusada.\n\nAbra Ajustes → StructaNote → Movimento e Fitness e permita o acesso.');
        } else if (isIOS) {
            alert('Permissão de sensores recusada.\n\nAbra Ajustes → Safari → Movimento e Orientação e ative o acesso; depois recarregue a app.');
        } else {
            alert('Permissão de sensores recusada. Ative o acesso a sensores do dispositivo nas definições do navegador.');
        }
    }

    /**
     * Na app nativa iOS o WKWebView não expõe o GPS de forma fiável: usa-se o plugin
     * @capacitor/geolocation por baixo da API normal (navigator.geolocation).
     */
    function setupNative() {
        if (!isNative()) return;
        const cap = window.Capacitor;
        const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
        const plugins = cap.Plugins || {};

        // Barra de estado com texto claro sobre o fundo escuro.
        try {
            if (plugins.StatusBar) {
                plugins.StatusBar.setStyle({ style: 'LIGHT' });
                if (platform === 'ios') plugins.StatusBar.setOverlaysWebView({ overlay: false });
            }
        } catch (e) { /* plugin opcional */ }

        if (platform !== 'ios') return;

        const geo = plugins.Geolocation;
        if (!geo) return;

        const toPosition = (pos) => ({
            coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed
            },
            timestamp: pos.timestamp || Date.now()
        });
        const toError = (err) => ({ code: 2, message: (err && err.message) || 'GPS indisponível', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        const watchIds = new Map();
        let sequence = 1;

        navigator.geolocation.getCurrentPosition = (success, error, options) => {
            const opts = options || {};
            geo.getCurrentPosition({
                enableHighAccuracy: opts.enableHighAccuracy !== false,
                timeout: opts.timeout || 25000,
                maximumAge: opts.maximumAge || 0
            }).then(pos => success(toPosition(pos))).catch(err => { if (error) error(toError(err)); });
        };

        navigator.geolocation.watchPosition = (success, error, options) => {
            const opts = options || {};
            const handle = sequence++;
            geo.watchPosition({
                enableHighAccuracy: opts.enableHighAccuracy !== false,
                timeout: opts.timeout || 25000
            }, (pos, err) => {
                if (pos) success(toPosition(pos));
                else if (error) error(toError(err));
            }).then(id => watchIds.set(handle, id)).catch(err => { if (error) error(toError(err)); });
            return handle;
        };

        navigator.geolocation.clearWatch = (handle) => {
            const id = watchIds.get(handle);
            if (id) {
                geo.clearWatch({ id }).catch(() => {});
                watchIds.delete(handle);
            }
        };
    }

    window.SNDownload = { shareOrDownload, isIOS, isStandalone, isNative };
    window.SNSensors = { permissionHelp: sensorPermissionHelp };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupNative);
    } else {
        setupNative();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showInstallHint);
    } else {
        showInstallHint();
    }
})();
