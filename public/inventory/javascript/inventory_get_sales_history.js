// Logic for Sales History Modal
const InventoryHistory = {
    async init() {
        await this.loadHistoryModal();
    },

    async loadHistoryModal() {
        const container = document.getElementById('history-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/inventory/inventory-history-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                InventoryDOM.historyModal = document.getElementById('historyModal');
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
        InventoryState.historyPage = 1;
        InventoryState.historyPageSize = 6;
        InventoryState.historyTotal = 0;
        
        // Set product name
        document.getElementById('historyProductName').textContent = item.name;
        
        // Reset date filter dropdowns
        const monthSelect = document.getElementById('historyMonthFilter');
        const daySelect = document.getElementById('historyDayFilter');
        const yearSelect = document.getElementById('historyYearFilter');
        if (monthSelect) monthSelect.value = '';
        if (daySelect) daySelect.innerHTML = '<option value="">Day</option>';
        if (yearSelect) yearSelect.value = '';
        
        // Setup date filter dropdowns
        this.setupDateFilter(itemId);
        
        // Setup pagination controls
        this.setupPagination(itemId);
        
        // Show loading state
        document.getElementById('historyLoading').style.display = 'block';
        document.getElementById('historyTableBody').innerHTML = '';
        document.getElementById('historyEmpty').style.display = 'none';
        document.getElementById('historyPagination').style.display = 'none';
        
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
            
            const response = await fetch(`/inventory/inventory_get_sales_history/${itemId}?limit=${pageSize}&offset=${offset}`);
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

            // Filter sales by date if date filter is set (client-side filtering for current page)
            let filteredSales = sales;
            if (InventoryState.historyFilterDate) {
                const filterDate = new Date(InventoryState.historyFilterDate);
                filterDate.setHours(0, 0, 0, 0);
                filteredSales = sales.filter(sale => {
                    const saleDate = new Date(sale.sale_date);
                    saleDate.setHours(0, 0, 0, 0);
                    return saleDate.getTime() === filterDate.getTime();
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

            // Update stats based on all sales (need to load all for accurate stats)
            // For now, calculate from current page only
            const totalSales = filteredSales.length;
            const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0);
            const totalCost = filteredSales.reduce((sum, sale) => {
                const qty = parseFloat(sale.quantity_sold || 0);
                const cost = parseFloat(sale.cost_price || 0);
                return sum + (qty * cost);
            }, 0);
            
            // Calculate margin percentage
            let marginPercent = 0;
            if (totalRevenue > 0) {
                marginPercent = ((totalRevenue - totalCost) / totalRevenue) * 100;
            }
            
            document.getElementById('historyTotalSales').textContent = totalSales;
            document.getElementById('historyTotalRevenue').textContent = InventoryUtils.formatCurrency(totalRevenue);
            document.getElementById('historyMarginPercent').textContent = `${marginPercent.toFixed(1)}%`;
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
            <tr>
                <td>${saleDate}</td>
                <td>${quantity}</td>
                <td>${price}</td>
                <td><strong>${subtotal}</strong></td>
                <td>${customer}</td>
                <td>${soldBy}</td>
            </tr>
        `;
    },

    setupDateFilter(itemId) {
        const monthSelect = document.getElementById('historyMonthFilter');
        const daySelect = document.getElementById('historyDayFilter');
        const yearSelect = document.getElementById('historyYearFilter');
        
        if (!monthSelect || !daySelect || !yearSelect) return;
        
        // Populate year dropdown (current year and past 10 years)
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">Year</option>';
        for (let year = currentYear; year >= currentYear - 10; year--) {
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        }
        
        // Update days when month or year changes
        const updateDays = () => {
            const month = monthSelect.value;
            const year = yearSelect.value;
            
            daySelect.innerHTML = '<option value="">Day</option>';
            
            if (month && year) {
                const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayStr = day.toString().padStart(2, '0');
                    daySelect.innerHTML += `<option value="${dayStr}">${day}</option>`;
                }
            }
            
            // Apply filter when all three are selected
            this.applyDateFilter(itemId);
        };
        
        monthSelect.onchange = updateDays;
        yearSelect.onchange = updateDays;
        daySelect.onchange = () => this.applyDateFilter(itemId);
    },
    
    applyDateFilter(itemId) {
        const month = document.getElementById('historyMonthFilter')?.value;
        const day = document.getElementById('historyDayFilter')?.value;
        const year = document.getElementById('historyYearFilter')?.value;
        
        if (month && day && year) {
            InventoryState.historyFilterDate = `${year}-${month}-${day}`;
        } else {
            InventoryState.historyFilterDate = null;
        }
        
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
        InventoryState.historyPage = 1;
        InventoryState.historyTotal = 0;
    }
};
