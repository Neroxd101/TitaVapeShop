// Logic for Sales History Modal
const InventoryHistory = {
    async init() {
        await this.loadHistoryModal();
    },

    async loadHistoryModal() {
        const container = document.getElementById('history-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/inventory/inventory-history-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.historyModal = document.getElementById('historyModal');

                document.getElementById('closeHistoryModalBtn')?.addEventListener('click', () => {
                    this.closeHistoryModal();
                });
            }
        } catch (error) {
            console.error('Error loading history modal:', error);
        }
    },

    async openHistoryModal(itemId) {
        if (!InventoryDOM.historyModal) {
            await this.loadHistoryModal();
        }

        const item = InventoryState.inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        InventoryState.viewingHistoryItemId = itemId;
        InventoryState.historyFilterDate = null;
        InventoryState.historyStartDate = null;
        InventoryState.historyEndDate = null;
        InventoryState.historyPage = 1;
        InventoryState.historyPageSize = 6;
        InventoryState.historyTotal = 0;
        
        // Set product name
        document.getElementById('historyProductName').textContent = item.name;
        
        // Reset date filter inputs
        const startDateInput = document.getElementById('historyStartDate');
        const endDateInput = document.getElementById('historyEndDate');
        if (startDateInput) {
            startDateInput.value = '';
            startDateInput.removeAttribute('max');
        }
        if (endDateInput) {
            endDateInput.value = '';
            endDateInput.removeAttribute('min');
        }
        
        // Setup date filter handlers
        this.setupDateFilter(itemId);
        
        // Setup pagination controls
        this.setupPagination(itemId);
        
        // Show loading state and reset stats
        document.getElementById('historyLoading').style.display = 'block';
        document.getElementById('historyTableBody').innerHTML = '';
        document.getElementById('historyEmpty').style.display = 'none';
        document.getElementById('historyPagination').style.display = 'none';
        const totalSalesEl = document.getElementById('historyTotalSales');
        const totalProfitEl = document.getElementById('historyTotalProfit') || document.getElementById('historyTotalRevenue');
        if (totalSalesEl) totalSalesEl.textContent = '0';
        if (totalProfitEl) totalProfitEl.textContent = '₱0.00';
        
        // Attach close button
        const closeBtn = document.getElementById('closeHistoryModalBtn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeHistoryModal();
        }

        // Show modal
        InventoryDOM.historyModal.classList.add('show');
        
        // Load sales history
        await this.loadSalesHistory(itemId);
    },

    async loadSalesHistory(itemId, page = null) {
        try {
            if (page !== null) {
                InventoryState.historyPage = page;
            }
            
            const pageSize = InventoryState.historyPageSize || 7;
            const offset = (InventoryState.historyPage - 1) * pageSize;
            
            // Show loading state when changing pages
            const loadingState = document.getElementById('historyLoading');
            const tbody = document.getElementById('historyTableBody');
            if (page !== null) {
                loadingState.style.display = 'block';
                tbody.innerHTML = '';
            }
            
            let url = `/inventory/inventory_get_sales_history/${itemId}?limit=${pageSize}&offset=${offset}`;
            if (InventoryState.historyStartDate) {
                url += `&start_date=${encodeURIComponent(new Date(InventoryState.historyStartDate + 'T00:00:00').toISOString())}`;
            }
            if (InventoryState.historyEndDate) {
                url += `&end_date=${encodeURIComponent(new Date(InventoryState.historyEndDate + 'T23:59:59.999').toISOString())}`;
            }

            const response = await fetch(url);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load sales history');
            }

            const sales = result.sales || [];
            const total = result.total || 0;
            InventoryState.historyTotal = total;
            
            const emptyState = document.getElementById('historyEmpty');
            const pagination = document.getElementById('historyPagination');

            loadingState.style.display = 'none';

            // Filter sales by date range if set (fallback for client-side assurance)
            let filteredSales = sales;
            if (InventoryState.historyStartDate || InventoryState.historyEndDate) {
                const startTime = InventoryState.historyStartDate ? new Date(InventoryState.historyStartDate + 'T00:00:00').getTime() : null;
                const endTime = InventoryState.historyEndDate ? new Date(InventoryState.historyEndDate + 'T23:59:59.999').getTime() : null;
                filteredSales = sales.filter(sale => {
                    const saleTime = new Date(sale.sale_date).getTime();
                    if (startTime !== null && saleTime < startTime) return false;
                    if (endTime !== null && saleTime > endTime) return false;
                    return true;
                });
            }

            if (filteredSales.length === 0 && sales.length === 0) {
                emptyState.style.display = 'block';
                pagination.style.display = 'none';
                tbody.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                tbody.innerHTML = filteredSales.map(sale => this.createSaleRow(sale)).join('');
                
                // Show pagination if there are more than pageSize items
                const totalPages = Math.ceil(total / pageSize);
                if (totalPages > 1) {
                    pagination.style.display = 'flex';
                    this.updatePaginationUI(totalPages);
                } else {
                    pagination.style.display = 'none';
                }
                
                // Scroll table to top when changing pages
                if (page !== null) {
                    const tableContainer = document.querySelector('.history-table-container');
                    if (tableContainer) {
                        tableContainer.scrollTop = 0;
                    }
                }
            }

            // Update stats based on loaded sales
            const currentItem = InventoryState.inventoryItems.find(i => i.id === itemId);
            const itemCostPrice = parseFloat(currentItem?.cost_price || 0);

            const totalUnitsSold = filteredSales.reduce((sum, sale) => sum + parseInt(sale.quantity_sold || 0), 0);
            const totalProfit = filteredSales.reduce((sum, sale) => {
                const qty = parseInt(sale.quantity_sold || 0);
                const salePrice = parseFloat(sale.sale_price || 0);
                const costPrice = parseFloat(sale.cost_price !== undefined && sale.cost_price !== null ? sale.cost_price : itemCostPrice);
                const profit = sale.profit !== undefined && sale.profit !== null
                    ? parseFloat(sale.profit)
                    : ((salePrice - costPrice) * qty);
                return sum + profit;
            }, 0);
            
            const totalSalesEl = document.getElementById('historyTotalSales');
            const totalProfitEl = document.getElementById('historyTotalProfit') || document.getElementById('historyTotalRevenue');
            if (totalSalesEl) totalSalesEl.textContent = totalUnitsSold;
            if (totalProfitEl) totalProfitEl.textContent = InventoryUtils.formatCurrency(totalProfit);
        } catch (error) {
            console.error('Error loading sales history:', error);
            document.getElementById('historyLoading').style.display = 'none';
            document.getElementById('historyTableBody').innerHTML = 
                `<tr><td colspan="6" style="text-align: center; color: var(--error);">Error: ${error.message}</td></tr>`;
        }
    },

    createSaleRow(sale) {
        const saleDate = InventoryUtils.formatDate(sale.sale_date);
        const quantity = sale.quantity_sold || 0;
        const price = InventoryUtils.formatCurrency(sale.sale_price || 0);
        const subtotal = InventoryUtils.formatCurrency(sale.subtotal || 0);
        const customer = sale.customer_name || sale.customer_email || '-';
        const soldBy = sale.user_email || '-';

        return `
            <tr class="history-row">
                <td class="col-date" data-label="Date">
                    <span class="history-date-text">${saleDate}</span>
                </td>
                <td class="col-qty" data-label="Quantity">
                    <span class="mobile-cell-label">Qty:</span>
                    <span class="history-qty-pill">${quantity}</span>
                </td>
                <td class="col-price" data-label="Price">
                    <span class="mobile-cell-label">Unit:</span>
                    <span class="history-price-text">${price}</span>
                </td>
                <td class="col-subtotal" data-label="Subtotal">
                    <span class="mobile-cell-label">Total:</span>
                    <span class="history-subtotal-text">${subtotal}</span>
                </td>
                <td class="col-customer" data-label="Customer" title="${customer}">
                    <span class="mobile-cell-label">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        Customer:
                    </span>
                    <span class="history-customer-text">${customer}</span>
                </td>
                <td class="col-staff" data-label="Sold By" title="${soldBy}">
                    <span class="mobile-cell-label">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
                        </svg>
                        Sold By:
                    </span>
                    <span class="history-staff-text">${soldBy}</span>
                </td>
            </tr>
        `;
    },

    setupDateFilter(itemId) {
        const startDateInput = document.getElementById('historyStartDate');
        const endDateInput = document.getElementById('historyEndDate');
        const clearBtn = document.getElementById('historyClearDateBtn');
        
        if (!startDateInput || !endDateInput) return;
        
        const handleDateChange = () => {
            if (startDateInput.value && endDateInput.value && startDateInput.value > endDateInput.value) {
                endDateInput.value = startDateInput.value;
            }
            if (startDateInput.value) {
                endDateInput.min = startDateInput.value;
            } else {
                endDateInput.removeAttribute('min');
            }
            if (endDateInput.value) {
                startDateInput.max = endDateInput.value;
            } else {
                startDateInput.removeAttribute('max');
            }
            this.applyDateFilter(itemId);
        };

        startDateInput.onchange = handleDateChange;
        endDateInput.onchange = handleDateChange;

        if (clearBtn) {
            clearBtn.onclick = () => {
                startDateInput.value = '';
                endDateInput.value = '';
                startDateInput.removeAttribute('max');
                endDateInput.removeAttribute('min');
                this.applyDateFilter(itemId);
            };
        }
    },
    
    applyDateFilter(itemId) {
        const startDate = document.getElementById('historyStartDate')?.value || null;
        const endDate = document.getElementById('historyEndDate')?.value || null;
        
        InventoryState.historyStartDate = startDate;
        InventoryState.historyEndDate = endDate;
        InventoryState.historyFilterDate = null;
        InventoryState.historyPage = 1; // Reset to first page when filtering
        this.loadSalesHistory(itemId);
    },

    setupPagination(itemId) {
        const prevBtn = document.getElementById('historyPrevBtn');
        const nextBtn = document.getElementById('historyNextBtn');
        
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (InventoryState.historyPage > 1) {
                    this.loadSalesHistory(itemId, InventoryState.historyPage - 1);
                }
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                const totalPages = Math.ceil(InventoryState.historyTotal / (InventoryState.historyPageSize || 7));
                if (InventoryState.historyPage < totalPages) {
                    this.loadSalesHistory(itemId, InventoryState.historyPage + 1);
                }
            };
        }
    },

    updatePaginationUI(totalPages) {
        const prevBtn = document.getElementById('historyPrevBtn');
        const nextBtn = document.getElementById('historyNextBtn');
        const pageInfo = document.getElementById('historyPageInfo');
        
        if (prevBtn) {
            prevBtn.disabled = InventoryState.historyPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = InventoryState.historyPage >= totalPages;
        }
        
        if (pageInfo) {
            pageInfo.textContent = `Page ${InventoryState.historyPage} of ${totalPages}`;
        }
    },

    closeHistoryModal() {
        InventoryDOM.historyModal?.classList.remove('show');
        InventoryState.viewingHistoryItemId = null;
        InventoryState.historyFilterDate = null;
        InventoryState.historyStartDate = null;
        InventoryState.historyEndDate = null;
        InventoryState.historyPage = 1;
        InventoryState.historyTotal = 0;
    }
};
