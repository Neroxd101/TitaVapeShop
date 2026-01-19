// High-level QR flow for Sales (POS)
// Exposed globally as SalesQrFlow.

(function () {
  function handleDecoded(state, decodedText) {
    if (!decodedText || !state) return;

    // Stop scanning as soon as we read one code
    if (window.SalesQrScanner && SalesQrScanner.stop) {
      SalesQrScanner.stop();
    }

    const qrModal = document.getElementById('qrModal');
    if (qrModal) {
      qrModal.classList.remove('show');
    }

    const code = (window.SalesQrUtils && SalesQrUtils.extractProductCode)
      ? SalesQrUtils.extractProductCode(decodedText)
      : String(decodedText || '').trim();

    const product = (window.SalesQrUtils && SalesQrUtils.findProductByCode)
      ? SalesQrUtils.findProductByCode(state.products, code)
      : null;

    if (!product) {
      alert('No matching product found for this QR code.');
      return;
    }

    // Add one unit by default when scanning
    if (window.SalesCart && SalesCart.addToCart) {
      const render = () => {
        if (window.SalesUI && SalesUI.renderProducts) {
          SalesUI.renderProducts(state);
        }
      };
      SalesCart.addToCart(state, product, 1, render);
    }

    alert(`Added 1 "${product.name}" to the cart.`);
  }

  window.SalesQrFlow = { handleDecoded };
})();

