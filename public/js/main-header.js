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
        // Add Item button is now in filters-bar, not in header
        actionsHtml = '';
        break;
      case 'sales':
        // Checkout button is now in filters-bar, not in header
        actionsHtml = '';
        break;
      default:
        break;
    }

    headerEl.innerHTML = template({ title, actionsHtml });
  }

  window.MainHeader = { render };
})();

