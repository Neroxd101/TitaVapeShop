// QR helper utilities for Sales (POS)
// Exposed globally as SalesQrUtils (no module bundler required).

(function () {
  function normalizeText(value) {
    return String(value || '').trim();
  }

  function extractProductCode(decodedText) {
    const raw = normalizeText(decodedText);
    if (!raw) return '';

    const upper = raw.toUpperCase();

    // If the QR contains our code directly, return it.
    if (upper.startsWith('TVS-')) return upper;

    // If the QR contains a URL, try extracting typical params.
    try {
      const url = new URL(raw);
      const candidates = [
        url.searchParams.get('url'),
        url.searchParams.get('code'),
        url.searchParams.get('qr'),
        url.searchParams.get('product'),
        url.searchParams.get('productCode'),
      ].filter(Boolean);

      for (const c of candidates) {
        const v = String(c).trim().toUpperCase();
        if (v.startsWith('TVS-')) return v;
        const m = v.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
        if (m) return m[0];
      }

      // Fall back to scanning the full URL string.
      const m = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
      if (m) return m[0];
    } catch (_) {
      // Not a valid URL; continue with plain string matching below.
    }

    // Final fallback: search for the code pattern inside the text.
    const match = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
    if (match) return match[0];

    return upper;
  }

  function findProductByCode(products, code) {
    const normalizedCode = normalizeText(code).toUpperCase();
    if (!normalizedCode) return null;
    const list = Array.isArray(products) ? products : [];

    // Try direct property matches first (if backend includes product_code or similar)
    let item = list.find(p =>
      String(p?.product_code || '').toUpperCase() === normalizedCode ||
      String(p?.code || '').toUpperCase() === normalizedCode ||
      String(p?.qr_code || '').toUpperCase() === normalizedCode
    );
    if (item) return item;

    // Fallback: match our generated product code format TVS-SAFENAME-...
    const match = normalizedCode.match(/^TVS-([A-Z0-9]+)-/);
    if (match) {
      const safeName = match[1];
      item = list.find(p => {
        if (!p?.name) return false;
        const normalized = String(p.name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        return normalized === safeName;
      });
    }

    return item || null;
  }

  // Global export
  window.SalesQrUtils = {
    normalizeText,
    extractProductCode,
    findProductByCode,
  };
})();

