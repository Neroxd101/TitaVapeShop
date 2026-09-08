/**
 * Print Transactions Module
 * Handles printing of all transactions
 */
const TransactionsPrint = {
    /**
     * Initialize print functionality
     * @param {Object} uiController - The TransactionsUI controller instance
     */
    init(uiController) {
        const printBtn = document.getElementById('printTransactionsBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printTransactions(uiController);
            });
        }
    },

    /**
     * Print all transactions
     * @param {Object} uiController - The TransactionsUI controller instance
     */
    async printTransactions(uiController) {
        // Show loading
        const printBtn = document.getElementById('printTransactionsBtn');
        if (printBtn) {
            printBtn.disabled = true;
            printBtn.innerHTML = '<span>Loading...</span>';
        }

        try {
            // Fetch all transactions (no pagination)
            const filters = uiController.getFiltersFromDOM();
            filters.limit = 10000; // Large limit to get all
            filters.offset = 0;

            const result = await TransactionsGetAll.get(filters);

            if (!result || !result.success || !result.transactions || result.transactions.length === 0) {
                alert('No transactions to print');
                return;
            }

            const transactions = result.transactions;
            const printWindow = window.open('', '_blank');
            
            // Get current date for header
            const currentDate = new Date().toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Build print HTML
            let printHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Transactions Report - ${currentDate}</title>
    <style>
        @media print {
            @page {
                margin: 1cm;
            }
        }
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #000;
        }
        .print-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .print-header h1 {
            margin: 0;
            font-size: 24px;
        }
        .print-header p {
            margin: 5px 0;
            font-size: 14px;
        }
        .print-filters {
            margin-bottom: 20px;
            font-size: 12px;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-size: 12px;
        }
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
        }
        .badge-sale {
            background-color: #d1fae5;
            color: #065f46;
        }
        .badge-add {
            background-color: #dbeafe;
            color: #1e40af;
        }
        .badge-edit {
            background-color: #fef3c7;
            color: #92400e;
        }
        .badge-delete {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .amount-positive {
            color: #065f46;
            font-weight: 600;
        }
        .print-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>Tita\'s Vape Shop</h1>
        <p>Activity Log / Transactions Report</p>
        <p>Date: ${currentDate}</p>
    </div>
    <div class="print-filters">
        ${this.getPrintFilters(uiController)}
    </div>
    <table>
        <thead>
            <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Details</th>
                <th>User</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>`;

            // Add all transaction rows
            transactions.forEach(t => {
                const date = uiController.formatDate(t.created_at);
                const badge = uiController.getActionBadge(t.action_type);
                const details = uiController.formatDetails(t);
                const user = uiController.escapeHtml(t.user_email || 'System');
                const amount = uiController.formatAmount(t);

                printHTML += `
            <tr>
                <td>${date}</td>
                <td>${badge}</td>
                <td>${details}</td>
                <td>${user}</td>
                <td>${amount}</td>
            </tr>`;
            });

            printHTML += `
        </tbody>
    </table>
    <div class="print-footer">
        <p>Total Transactions: ${transactions.length}</p>
        <p>Generated on ${new Date().toLocaleString('en-PH')}</p>
    </div>
</body>
</html>`;

            printWindow.document.write(printHTML);
            printWindow.document.close();
            
            // Wait for content to load, then print
            setTimeout(() => {
                printWindow.print();
            }, 250);
        } catch (error) {
            console.error('Error printing transactions:', error);
            alert('Failed to print transactions: ' + error.message);
        } finally {
            // Restore button
            if (printBtn) {
                printBtn.disabled = false;
                printBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                    </svg>
                    <span>Print</span>`;
            }
        }
    },

    /**
     * Get current filter values for print header
     * @param {Object} uiController - The TransactionsUI controller instance
     * @returns {string} Formatted filter string
     */
    getPrintFilters(uiController) {
        const filters = [];
        const action = uiController.elements.filterAction?.value;
        const month = uiController.elements.filterMonth?.value;
        const day = uiController.elements.filterDay?.value;
        const year = uiController.elements.filterYear?.value;

        if (action) {
            const actionMap = {
                'sale_complete': 'Sales',
                'inventory_add': 'Inventory Add',
                'inventory_edit': 'Inventory Edit',
                'inventory_delete': 'Inventory Delete'
            };
            filters.push(`Action: ${actionMap[action] || action}`);
        }

        if (month && day && year) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'];
            filters.push(`Date: ${monthNames[parseInt(month) - 1]} ${day}, ${year}`);
        }

        return filters.length > 0 ? `Filters: ${filters.join(' | ')}` : 'All Transactions';
    }
};

window.TransactionsPrint = TransactionsPrint;
