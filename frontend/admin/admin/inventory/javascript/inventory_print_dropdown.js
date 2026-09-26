// Handle the inventory Print dropdown menu.
const InventoryPrintDropdown = {
    init() {
        const trigger = document.getElementById('printStocksBtn');
        const menu = document.getElementById('inventoryPrintDropdown');

        trigger?.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = menu?.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', String(Boolean(isOpen)));
        });

        menu?.querySelectorAll('[data-print-action]').forEach(button => {
            button.addEventListener('click', () => {
                menu.classList.remove('is-open');
                trigger?.setAttribute('aria-expanded', 'false');
                if (button.dataset.printAction === 'qr') InventoryQrPrint.print();
                else InventoryPrint.print();
            });
        });

        document.addEventListener('click', () => {
            menu?.classList.remove('is-open');
            trigger?.setAttribute('aria-expanded', 'false');
        });
    }
};

window.InventoryPrintDropdown = InventoryPrintDropdown;
