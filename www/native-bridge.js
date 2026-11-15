/* StructaNote — ponte para o APK (Capacitor).
   No browser não faz nada; dentro da app Android guarda as exportações na pasta
   Documentos/StructaNote e abre o menu de partilha (WhatsApp, e-mail, Drive…). */

(function () {
  'use strict';

  function isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  function plugins() {
    const P = (window.Capacitor && window.Capacitor.Plugins) || {};
    return { Filesystem: P.Filesystem, Share: P.Share };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.substring(result.indexOf(',') + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function saveAndShare(blob, filename) {
    const { Filesystem, Share } = plugins();
    if (!Filesystem || !Share) {
      alert('Não foi possível guardar o ficheiro: plugins nativos em falta.');
      return;
    }
    try {
      const data = await blobToBase64(blob);
      let uri = null;
      // Primeiro tenta a pasta pública Documentos; se o Android o impedir, usa o armazenamento da app.
      for (const directory of ['DOCUMENTS', 'DATA']) {
        try {
          await Filesystem.writeFile({ path: 'StructaNote/' + filename, data, directory, recursive: true });
          const res = await Filesystem.getUri({ path: 'StructaNote/' + filename, directory });
          uri = res.uri;
          break;
        } catch (err) {
          console.warn('Não foi possível gravar em ' + directory, err);
        }
      }
      if (!uri) throw new Error('sem local de gravação disponível');
      await Share.share({ title: filename, files: [uri], dialogTitle: 'Guardar ou enviar ' + filename });
    } catch (err) {
      console.error('Falha ao guardar/partilhar', err);
      alert('Erro ao guardar o ficheiro: ' + (err && err.message ? err.message : err));
    }
  }

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  window.SNFiles = { isNative, saveAndShare };

  // A descarga de fotos usa um <a download> que o WebView não trata: intercepta-se.
  document.addEventListener('click', function (event) {
    const btn = event.target.closest && event.target.closest('#btn-download-photo');
    if (!btn || !isNative()) return;
    const href = btn.getAttribute('href') || '';
    if (!href.startsWith('data:')) return;
    event.preventDefault();
    saveAndShare(dataUrlToBlob(href), btn.getAttribute('download') || 'StructaNote_foto.jpg');
  }, true);
})();
