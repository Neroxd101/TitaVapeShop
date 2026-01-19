// QR scanner wrapper for Sales (POS)
// Exposed globally as SalesQrScanner (no module bundler required).

(function () {
  let scanner = null;
  let scanning = false;

  async function start({ elementId = 'qrScanner', onDecoded, onError } = {}) {
    if (scanning) return;

    if (typeof Html5Qrcode === 'undefined') {
      const err = new Error('QR scanner library not loaded');
      if (typeof onError === 'function') onError(err);
      return;
    }

    try {
      scanner = new Html5Qrcode(elementId);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10 },
        (decodedText) => {
          if (typeof onDecoded === 'function') onDecoded(decodedText);
        },
        () => {}
      );
      scanning = true;
    } catch (err) {
      if (typeof onError === 'function') onError(err);
      await stop();
    }
  }

  async function stop() {
    if (!scanner || !scanning) return;
    try {
      await scanner.stop();
      await scanner.clear();
    } catch (_) {
      // ignore
    } finally {
      scanner = null;
      scanning = false;
    }
  }

  window.SalesQrScanner = { start, stop };
})();

