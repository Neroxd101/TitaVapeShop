// Logic for Orders Filters, Search debounce, Date validation and KPI filtering
const OrdersFilter = {
    controller: null,
    searchDebounceTimer: null,
    activeKpi: null,

    init(controller) {
        this.controller = controller;
        this.setupEventListeners();
    },

    setupEventListeners() {
        const c = this.controller;
        if (!c || !c.elements) return;

        // Search input debounce
        if (c.elements.orderSearchInput) {
            c.elements.orderSearchInput.addEventListener('input', (e) => {
                if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => {
                    c.state.filters.search = e.target.value.trim();
                    c.state.filters.offset = 0;
                    if (this.activeKpi === 'pickup' || this.activeKpi === 'delivery') {
                        this.activeKpi = null;
                        this.updateActiveKpiCards();
                    }
                    c.loadOrders();
                }, 300);
            });
        }

        // Status select dropdown
        if (c.elements.filterStatus) {
            c.elements.filterStatus.addEventListener('change', () => {
                c.state.filters.status = c.elements.filterStatus.value;
                c.state.filters.offset = 0;
                if (c.state.filters.status === 'pending') {
                    this.activeKpi = 'pending';
                } else if (c.state.filters.status === 'confirmed') {
                    this.activeKpi = 'confirmed';
                } else {
                    this.activeKpi = null;
                }
                this.updateActiveKpiCards();
                c.loadOrders();
            });
        }

        this.syncDateHints();

        // Date range inputs
        const dateInputs = [c.elements.filterStartDate, c.elements.filterEndDate];
        for (const input of dateInputs) {
            if (!input) continue;
            input.addEventListener('input', () => this.syncDateHints());
            input.addEventListener('change', () => {
                this.syncDateHints();
                const start = c.elements.filterStartDate;
                const end = c.elements.filterEndDate;
                if (end) end.setCustomValidity('');
                if (start && end && start.value && end.value && start.value > end.value) {
                    end.setCustomValidity('End date must be on or after start date.');
                    end.reportValidity();
                    return;
                }
                c.state.filters.start_date = start && start.value ? new Date(start.value + 'T00:00:00').toISOString() : '';
                c.state.filters.end_date = end && end.value ? new Date(end.value + 'T23:59:59.999').toISOString() : '';
                c.state.filters.offset = 0;
                if (this.activeKpi === 'pickup' || this.activeKpi === 'delivery') {
                    this.activeKpi = null;
                    this.updateActiveKpiCards();
                }
                c.loadOrders();
            });
        }

        // Reset filter button
        if (c.elements.resetFiltersBtn) {
            c.elements.resetFiltersBtn.addEventListener('click', (e) => {
                if (e) e.preventDefault();
                this.resetFilters();
            });
        }

        // KPI summary card click & keyboard bindings
        const kpiBindings = [
            { el: c.elements.kpiCardPending, action: () => this.filterByStatus('pending') },
            { el: c.elements.kpiCardReady, action: () => this.filterByStatus('confirmed') },
            { el: c.elements.kpiCardPickup, action: () => this.filterByOrderType('pickup') },
            { el: c.elements.kpiCardDelivery, action: () => this.filterByOrderType('delivery') }
        ];

        kpiBindings.forEach(({ el, action }) => {
            if (!el) return;
            el.addEventListener('click', (e) => {
                e.preventDefault();
                action();
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    action();
                }
            });
        });
    },

    filterByStatus(status) {
        const c = this.controller;
        if (!c) return;

        if (this.activeKpi === status) {
            this.activeKpi = null;
            if (c.elements.filterStatus) c.elements.filterStatus.value = '';
            c.state.filters.status = '';
        } else {
            this.activeKpi = status;
            if (c.elements.filterStatus) c.elements.filterStatus.value = status;
            c.state.filters.status = status;

            if (c.elements.orderSearchInput) c.elements.orderSearchInput.value = '';
            c.state.filters.search = '';
            if (c.elements.filterStartDate) c.elements.filterStartDate.value = '';
            if (c.elements.filterEndDate) c.elements.filterEndDate.value = '';
            c.state.filters.start_date = '';
            c.state.filters.end_date = '';
            this.syncDateHints();
        }

        c.state.filters.offset = 0;
        this.updateActiveKpiCards();
        c.loadOrders();
    },

    filterByOrderType(type) {
        const c = this.controller;
        if (!c) return;

        if (this.activeKpi === type) {
            this.activeKpi = null;
        } else {
            this.activeKpi = type;
            if (c.elements.filterStatus) c.elements.filterStatus.value = '';
            c.state.filters.status = '';

            if (c.elements.filterStartDate) c.elements.filterStartDate.value = '';
            if (c.elements.filterEndDate) c.elements.filterEndDate.value = '';
            c.state.filters.start_date = '';
            c.state.filters.end_date = '';
            this.syncDateHints();

            if (c.elements.orderSearchInput) c.elements.orderSearchInput.value = '';
            c.state.filters.search = '';
        }

        c.state.filters.offset = 0;
        this.updateActiveKpiCards();
        c.loadOrders();
    },

    updateActiveKpiCards() {
        const el = this.controller?.elements;
        if (!el) return;

        if (el.kpiCardPending) {
            el.kpiCardPending.classList.toggle('is-active', this.activeKpi === 'pending');
        }
        if (el.kpiCardReady) {
            el.kpiCardReady.classList.toggle('is-active', this.activeKpi === 'confirmed');
        }
        if (el.kpiCardPickup) {
            el.kpiCardPickup.classList.toggle('is-active', this.activeKpi === 'pickup');
        }
        if (el.kpiCardDelivery) {
            el.kpiCardDelivery.classList.toggle('is-active', this.activeKpi === 'delivery');
        }
    },

    syncDateHints() {
        const el = this.controller?.elements;
        if (!el) return;

        if (el.filterStartDate) {
            el.filterStartDate.dataset.empty = String(!el.filterStartDate.value);
        }
        if (el.filterEndDate) {
            el.filterEndDate.dataset.empty = String(!el.filterEndDate.value);
        }
    },

    resetFilters() {
        const c = this.controller;
        if (!c) return;

        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }

        if (c.elements.orderSearchInput) c.elements.orderSearchInput.value = '';
        if (c.elements.filterStatus) c.elements.filterStatus.value = '';
        if (c.elements.filterStartDate) c.elements.filterStartDate.value = '';
        if (c.elements.filterEndDate) {
            c.elements.filterEndDate.value = '';
            c.elements.filterEndDate.setCustomValidity('');
        }
        this.syncDateHints();

        c.state.filters = {
            status: '',
            search: '',
            start_date: '',
            end_date: '',
            limit: 20,
            offset: 0
        };

        this.activeKpi = null;
        this.updateActiveKpiCards();
        c.loadOrders();
    }
};

window.OrdersFilter = OrdersFilter;
