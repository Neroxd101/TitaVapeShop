// Reusable main header for Dashboard, Inventory, and Sales
// Renders: menu toggle + page title + googleStatus + currentDate + optional actions.

(function () {
  function template({ title, actionsHtml = '' }) {
    return `
      <div class="header-left">
        <button class="menu-toggle" id="menuToggle">
          <svg viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <h2>${title}</h2>
      </div>
      <div class="header-right">
        <div id="googleStatus"></div>
        <span class="current-date" id="currentDate"></span>
        ${actionsHtml}
      </div>
    `;
  }

  function render({ page, title }) {
    const headerEl = document.querySelector('.main-content .main-header');
    if (!headerEl) return;

    let actionsHtml = '';

    switch (page) {
      case 'dashboard':
        actionsHtml = '';
        break;
      case 'inventory':
        actionsHtml = `
          <button class="btn btn-primary" id="addItemBtn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span>Add Item</span>
          </button>
        `;
        break;
      case 'sales':
        actionsHtml = `
          <button class="btn btn-primary" id="openCartModalBtn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span>Checkout</span>
            <span id="cartBadge" class="cart-badge">0</span>
          </button>
        `;
        break;
      default:
        break;
    }

    headerEl.innerHTML = template({ title, actionsHtml });
  }

  window.MainHeader = { render };
})();

