async function dashboard_recent_activity() {
  const response = await fetch('/api/dashboard/dashboard_recent_activity', {
    headers: { Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard data');
  return result.data;
}

// Load recent activity (limited to 14 items)
function render_dashboard_recent_activity(result) {
  try {

    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (!result.transactions || result.transactions.length === 0) {
      activityList.innerHTML = `
        <div class="activity-empty">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h4>No recent transactions</h4>
          <p>Transactions from the POS register and catalog will appear here in real time.</p>
        </div>
      `;
      return;
    }

    // Clear existing content
    activityList.innerHTML = '';

    // Render at most 14 activity items to fill the desktop activity panel
    const recentTransactions = (result.transactions || []).slice(0, 14);
    recentTransactions.forEach(transaction => {
      const activityItem = createActivityItem(transaction);
      activityList.appendChild(activityItem);
    });
  } catch (error) {
    console.error('Error loading recent activity:', error);
    const activityList = document.getElementById('activityList');
    if (activityList) {
      activityList.innerHTML = '<div class="activity-empty"><p>Error loading activity records.</p></div>';
    }
  }
}

// Create activity item element with clean retail ledger tags
function createActivityItem(transaction) {
  const item = document.createElement('div');
  item.className = 'activity-item';

  const actionType = normalizeActionType(transaction.action_type);
  const title = getActivityTitle(transaction);
  const meta = getActivityMeta(transaction);
  const time = formatActivityTime(transaction.created_at);

  const actionBadges = {
    sale_complete: ['SALE', 'tag-sale'],
    sale_void: ['VOID', 'tag-void'],
    inventory_add: ['ADD', 'tag-add'],
    inventory_edit: ['EDIT', 'tag-edit'],
    inventory_delete: ['DELETE', 'tag-delete'],
    category_add: ['CATEGORY ADDED', 'tag-add'],
    category_delete: ['CATEGORY DELETED', 'tag-delete'],
    order_confirm: ['CONFIRM', 'tag-confirm'],
    order_cancel: ['CANCEL', 'tag-cancel']
  };
  const [badgeTag, badgeClass] = actionBadges[actionType] || ['LOG', 'tag-inventory'];

  item.innerHTML = `
    <span class="activity-badge-tag ${badgeClass}">${badgeTag}</span>
    <div class="activity-details">
      <div class="activity-top-row">
        <span class="activity-title">${title}</span>
        <span class="activity-time">${time}</span>
      </div>
      ${meta ? `<div class="activity-meta">${meta}</div>` : ''}
    </div>
  `;

  return item;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Get activity title text
function getActivityTitle(transaction) {
  const actionType = normalizeActionType(transaction.action_type);
  const d = transaction.details || {};

  if (actionType === 'sale_complete') {
    const items = transaction.sale_items || [];
    const itemCount = items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const customerName = escapeHtml(transaction.customer_name || 'Walk-in');
    const amount = transaction.sale_total ? formatCurrency(transaction.sale_total) : '';
    return `Sold ${itemCount} items to ${customerName}${amount ? ` - ${amount}` : ''}`;
  }

  if (actionType === 'inventory_add') {
    const name = escapeHtml(d.name || 'Item');
    const quantity = d.quantity || 0;
    return `Added "${name}" (${quantity} qty)`;
  }

  if (actionType === 'inventory_edit') {
    if (transaction.entity_type === 'order' && d.cancelled_by === 'variation_deletion') {
      return `Unavailable variations removed from order ${escapeHtml(String(d.order_id || transaction.entity_id).substring(0, 8))}`;
    }
    const itemName = escapeHtml(d.new?.name || d.old?.name || 'Item');
    return `Edited "${itemName}"`;
  }

  if (actionType === 'inventory_delete') {
    const name = escapeHtml(d.name || 'Item');
    return `Deleted "${name}"`;
  }

  if (actionType === 'category_add') {
    return `Added category "${escapeHtml(d.category_name || 'Category')}"`;
  }

  if (actionType === 'category_delete') {
    return `Deleted category "${escapeHtml(d.category_name || 'Category')}"`;
  }

  if (actionType === 'sale_void') {
    const reason = escapeHtml(d.reason || 'No reason provided');
    return `Voided sale (${reason})`;
  }

  if (actionType === 'order_confirm') {
    const orderId = escapeHtml(String(d.order_id || transaction.entity_id || 'N/A').substring(0, 8));
    return `Confirmed order ${orderId}`;
  }

  if (actionType === 'order_cancel') {
    const orderId = escapeHtml(String(d.order_id || transaction.entity_id || 'N/A').substring(0, 8));
    const action = ['product_deletion', 'variation_deletion'].includes(d.cancelled_by) ? 'Automatically cancelled order'
      : d.cancelled_by === 'customer' ? 'Customer cancelled order' : 'Cancelled order';
    return `${action} ${orderId}`;
  }

  return humanizeActionType(actionType);
}

function getActivityMeta(transaction) {
  const actionType = normalizeActionType(transaction.action_type);
  const d = transaction.details || {};

  if (actionType === 'sale_void' && Array.isArray(d.restock_skipped_items) && d.restock_skipped_items.length) {
    const skipped = d.restock_skipped_items.length;
    return `Restocking skipped for ${skipped} deleted item${skipped === 1 ? '' : 's'}`;
  }

  if (actionType === 'order_cancel') {
    const parts = [];
    const itemsCount = d.items_count ?? (Array.isArray(transaction.sale_items) ? transaction.sale_items.length : null);
    if (itemsCount !== null) parts.push(`${escapeHtml(String(itemsCount))} ${Number(itemsCount) === 1 ? 'item' : 'items'}`);
    if (d.order_type) parts.push(escapeHtml(String(d.order_type)));
    if (d.reason) parts.push(escapeHtml(String(d.reason)));
    return parts.join(' · ');
  }

  if (actionType === 'sale_complete') {
    const items = transaction.sale_items || [];
    const topItem = items[0]?.name ? escapeHtml(items[0].name) : '';
    const moreItemsCount = items.length > 1 ? items.length - 1 : 0;
    const amount = transaction.sale_total ? formatCurrency(transaction.sale_total) : '';
    const cash = d.cash ? formatCurrency(d.cash) : '';
    const change = d.change ? formatCurrency(d.change) : '';

    const parts = [];
    if (amount) parts.push(`Total: ${amount}`);
    if (topItem) {
      parts.push(
        `Items: ${topItem}${moreItemsCount > 0 ? ` +${moreItemsCount} more` : ''}`
      );
    }
    if (cash) parts.push(`Cash: ${cash}`);
    if (change) parts.push(`Change: ${change}`);

    return parts.join(' · ');
  }

  if (actionType === 'inventory_add') {
    const name = escapeHtml(d.name || 'Item');
    const category = escapeHtml(d.category || 'Uncategorized');
    const quantity = d.quantity || 0;
    const salePrice = d.sale_price ? formatCurrency(d.sale_price) : '';
    return `${name} · ${category} · Qty: ${quantity}${salePrice ? ` · Price: ${salePrice}` : ''}`;
  }

  if (actionType === 'inventory_edit') {
    const changes = d.changes || {};
    const changedFields = Object.keys(changes).filter(
      (field) => !['updated_at', 'images', 'qr_image_url'].includes(field)
    );
    if (!changedFields.length) return '';

    return `Updated: ${changedFields
      .slice(0, 3)
      .map(formatFieldName)
      .join(', ')}${changedFields.length > 3 ? ' +more' : ''}`;
  }

  if (actionType === 'inventory_delete') {
    const category = escapeHtml(d.category || 'Uncategorized');
    const quantity = d.quantity || 0;
    return `${category} · Last qty: ${quantity}`;
  }

  return '';
}

function normalizeActionType(actionType) {
  return String(actionType || '').trim().toLowerCase();
}

function humanizeActionType(actionType) {
  if (!actionType) return 'Activity';
  return actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldName(field) {
  return String(field)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Format activity time
function formatActivityTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  // For older items, show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}


function dashboard_recent_activity_unavailable() {
  const activityList = document.getElementById('activityList');
  if (activityList) activityList.textContent = 'Unable to load recent activity.';
}
