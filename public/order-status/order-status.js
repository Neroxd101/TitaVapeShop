/**
 * Order Status Page Logic
 * Handles token/ID parsing, API tracking, QR generation, and live polling
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  let currentToken = urlParams.get('token');
  let currentOrderId = urlParams.get('id');

  // DOM elements
  const loadingState = document.getElementById('loadingState');
  const verifyPhoneState = document.getElementById('verifyPhoneState');
  const errorState = document.getElementById('errorState');
  const orderContent = document.getElementById('orderContent');

  const orderIdText = document.getElementById('orderIdText');
  const orderCreatedAtText = document.getElementById('orderCreatedAtText');
  const orderTypeBadge = document.getElementById('orderTypeBadge');
  const orderStatusBadge = document.getElementById('orderStatusBadge');
  const copyOrderIdBtn = document.getElementById('copyOrderIdBtn');
  const cancelOrderBtn = document.getElementById('cancelOrderBtn');
  const cancelOrderMessage = document.getElementById('cancelOrderMessage');
  const cancelOrderDialog = document.getElementById('cancelOrderDialog');
  const keepOrderBtn = document.getElementById('keepOrderBtn');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const cancelDialogError = document.getElementById('cancelDialogError');
  let isCancelling = false;
  let orderRequestVersion = 0;

  const pickupQrCard = document.getElementById('pickupQrCard');
  const deliveryNoticeCard = document.getElementById('deliveryNoticeCard');
  const orderQrDisplay = document.getElementById('orderQrDisplay');
  const saveQrBtn = document.getElementById('saveQrBtn');

  const custNameText = document.getElementById('custNameText');
  const custPhoneText = document.getElementById('custPhoneText');
  const custSocialText = document.getElementById('custSocialText');
  const custEmailText = document.getElementById('custEmailText');
  const socialMediaRow = document.getElementById('socialMediaRow');
  const customerEmailRow = document.getElementById('customerEmailRow');

  const itemsList = document.getElementById('itemsList');
  const itemsCountBadge = document.getElementById('itemsCountBadge');
  const orderSubtotalText = document.getElementById('orderSubtotalText');
  const orderGrandTotalText = document.getElementById('orderGrandTotalText');

  const verifyPhoneForm = document.getElementById('verifyPhoneForm');
  const contactNumberInput = document.getElementById('contactNumberInput');
  const verifyPhoneError = document.getElementById('verifyPhoneError');
  const verifyPhoneErrorText = document.getElementById('verifyPhoneErrorText');
  const verifyPhoneBtn = document.getElementById('verifyPhoneBtn');

  let currentOrder = null;
  let pollInterval = null;



  /**
   * Initialize and fetch order
   */
  async function init() {
    setupEventListeners();
    await fetchOrder();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    cancelOrderBtn.addEventListener('click', () => {
      if (isCancelling || currentOrder?.status !== 'pending') return;
      cancelDialogError.hidden = true;
      cancelOrderDialog.showModal();
    });
    keepOrderBtn.addEventListener('click', () => cancelOrderDialog.close());
    confirmCancelBtn.addEventListener('click', cancelOrder);
    cancelOrderDialog.addEventListener('cancel', event => {
      if (isCancelling) event.preventDefault();
    });
    if (copyOrderIdBtn) {
      copyOrderIdBtn.addEventListener('click', () => {
        if (!currentOrder || !currentOrder.id) return;
        navigator.clipboard.writeText(currentOrder.id).then(() => {
          const originalHTML = copyOrderIdBtn.innerHTML;
          copyOrderIdBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          `;
          copyOrderIdBtn.style.color = 'var(--accent)';
          setTimeout(() => {
            copyOrderIdBtn.innerHTML = originalHTML;
            copyOrderIdBtn.style.color = '';
          }, 2000);
        });
      });
    }

    if (saveQrBtn) {
      saveQrBtn.addEventListener('click', () => {
        if (!currentOrder || !currentOrder.id) return;
        saveQRCodeImage(currentOrder.id);
      });
    }

    if (verifyPhoneForm) {
      verifyPhoneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = contactNumberInput.value.trim();
        if (!phone) return;

        verifyPhoneError.style.display = 'none';
        verifyPhoneBtn.disabled = true;
        verifyPhoneBtn.textContent = 'Verifying...';

        await fetchOrder(phone);

        verifyPhoneBtn.disabled = false;
        verifyPhoneBtn.textContent = 'Verify & View Order';
      });
    }

  }

  /**
   * Fetch order from backend API
   */
  async function cancelOrder() {
    if (isCancelling || currentOrder?.status !== 'pending') return;
    isCancelling = true;
    confirmCancelBtn.disabled = true;
    keepOrderBtn.disabled = true;
    confirmCancelBtn.textContent = 'Cancelling...';
    cancelDialogError.hidden = true;
    orderRequestVersion++;
    setupPolling('cancelled');
    cancelOrderBtn.disabled = true;
    cancelOrderBtn.textContent = 'Cancelling...';
    cancelOrderMessage.hidden = true;
    try {
      let result = null;
      if (window.CustomerCancelOrder && typeof window.CustomerCancelOrder.cancelOrder === 'function') {
        result = await window.CustomerCancelOrder.cancelOrder(currentOrder.id, contactNumberInput?.value?.trim());
      } else {
        const response = await fetch('/api/orders/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentOrder.id, phone: contactNumberInput?.value?.trim() })
        });
        if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Cancellation is unavailable. The app server may need restarting to load the latest update.');
        }
        const data = await response.json();
        result = data;
      }

      if (!result || !result.success || !result.order) {
        throw new Error(result?.error || 'Unable to cancel your order. Please try again.');
      }
      currentOrder = result.order;
      saveOrderToLocalStorage(currentOrder);
      renderOrder(currentOrder);
      cancelOrderMessage.textContent = 'Your order has been cancelled.';
      cancelOrderDialog.close();
    } catch (error) {
      cancelOrderMessage.textContent = error.message || 'Unable to cancel your order. Please try again.';
      cancelDialogError.textContent = cancelOrderMessage.textContent;
      cancelDialogError.hidden = false;
    } finally {
      isCancelling = false;
      confirmCancelBtn.disabled = false;
      keepOrderBtn.disabled = false;
      confirmCancelBtn.textContent = 'Yes, Cancel Order';
      cancelOrderBtn.disabled = false;
      cancelOrderBtn.textContent = 'Cancel Order';
      cancelOrderMessage.hidden = false;
      await fetchOrder(null, true);
    }
  }

  async function fetchOrder(phoneInput = null, isSilentRefresh = false) {
    if (isCancelling) return;
    const requestVersion = ++orderRequestVersion;
    if (!isSilentRefresh && !phoneInput) {
      showState('loading');
    }

    const targetId = currentOrderId || currentToken;
    if (!targetId) {
      showError('Missing Information', 'No Order ID was provided in the link.');
      return;
    }

    try {
      let result = null;
      if (window.CustomerTrackOrder && typeof window.CustomerTrackOrder.trackOrder === 'function') {
        result = await window.CustomerTrackOrder.trackOrder(targetId, phoneInput || '');
      } else {
        let url = `/api/orders/track?id=${encodeURIComponent(targetId)}`;
        if (phoneInput) {
          url += `&phone=${encodeURIComponent(phoneInput)}`;
        }
        const response = await fetch(url);
        const data = await response.json().catch(() => null);
        result = {
          success: response.ok && data?.success,
          order: data?.order,
          requiresPhone: response.status === 401 && data?.requiresPhone,
          status: response.status,
          error: data?.error
        };
      }

      if (requestVersion !== orderRequestVersion) return;

      if (result && result.success && result.order) {
        currentOrder = result.order;

        // Save order to localStorage for recent orders modal
        saveOrderToLocalStorage(currentOrder);

        renderOrder(currentOrder);
        showState('content');

        // Setup polling if pending/confirmed
        setupPolling(currentOrder.status);
      } else if (result?.requiresPhone || result?.status === 401) {
        showState('verifyPhone');
        if (phoneInput) {
          showPhoneError(result?.error || 'Contact number does not match.');
        }
      } else if (result?.status === 403) {
        showPhoneError(result?.error || 'Contact number does not match this order.');
      } else {
        showError('Order Not Found', result?.error || 'We could not find the order matching this request.');
      }
    } catch (err) {
      if (requestVersion !== orderRequestVersion) return;
      console.error('Failed to fetch order:', err);
      if (!isSilentRefresh) {
        showError('Connection Error', 'Unable to retrieve order. Please check your internet connection.');
      }
    }
  }

  /**
   * Save order to localStorage for quick customer retrieval
   */
  function saveOrderToLocalStorage(order) {
    if (!order || !order.id) return;
    try {
      let orders = JSON.parse(localStorage.getItem('tita_recent_orders') || '[]');
      if (!Array.isArray(orders)) orders = [];

      const existingIndex = orders.findIndex(o => o.id === order.id);
      const orderEntry = {
        id: order.id,
        order_type: order.order_type,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        customer_name: order.customer_name,
        updated_at: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...orderEntry };
      } else {
        orders.unshift(orderEntry);
      }

      // Keep latest 15 orders
      orders = orders.slice(0, 15);
      localStorage.setItem('tita_recent_orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  /**
   * Render order content
   */
  function renderOrder(order) {
    currentOrderId = order.id;
    orderIdText.textContent = order.id;

    // Placed date
    if (order.created_at) {
      const date = new Date(order.created_at);
      orderCreatedAtText.textContent = 'Placed on ' + date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    // Type Badge
    const isPickup = (order.order_type || 'pickup') === 'pickup';
    orderTypeBadge.textContent = isPickup ? 'PICKUP ORDER' : 'DELIVERY (3RD PARTY)';
    orderTypeBadge.style.color = isPickup ? 'var(--accent)' : '#3b82f6';
    orderTypeBadge.style.borderColor = isPickup ? 'rgba(0, 212, 170, 0.3)' : 'rgba(59, 130, 246, 0.3)';
    orderTypeBadge.style.background = isPickup ? 'rgba(0, 212, 170, 0.12)' : 'rgba(59, 130, 246, 0.12)';

    // Status Badge & Stepper
    renderStatus(order.status, isPickup);
    cancelOrderBtn.hidden = order.status !== 'pending';
    document.querySelector('.order-layout-grid').classList.toggle('is-cancelled', ['cancelled', 'voided'].includes(order.status));

    // QR Code / Delivery Notice
    if (['cancelled', 'voided'].includes(order.status)) {
      pickupQrCard.style.display = 'none';
      deliveryNoticeCard.style.display = 'none';
    } else if (isPickup) {
      pickupQrCard.style.display = 'block';
      deliveryNoticeCard.style.display = 'none';
      renderQRCode(order.id);
    } else {
      pickupQrCard.style.display = 'none';
      deliveryNoticeCard.style.display = 'flex';
    }

    // Customer details
    custNameText.textContent = order.customer_name || 'Guest';
    custPhoneText.textContent = order.contact_number || '-';

    if (order.social_media) {
      custSocialText.textContent = order.social_media;
      socialMediaRow.style.display = 'flex';
    } else {
      socialMediaRow.style.display = 'none';
    }

    if (order.customer_email) {
      custEmailText.textContent = order.customer_email;
      customerEmailRow.style.display = 'flex';
    } else {
      customerEmailRow.style.display = 'none';
    }

    // Items List
    renderItems(order.items, order.total_amount);
  }

  /**
   * Render Status Badge and Step Progress
   */
  function renderStatus(status, isPickup) {
    status = (status || 'pending').toLowerCase();

    // Badges
    orderStatusBadge.className = 'badge';
    if (status === 'pending') {
      orderStatusBadge.classList.add('badge-warning');
      orderStatusBadge.textContent = 'Pending';
    } else if (status === 'confirmed') {
      orderStatusBadge.classList.add('badge-info');
      orderStatusBadge.textContent = 'Confirmed';
    } else if (status === 'completed') {
      orderStatusBadge.classList.add('badge-success');
      orderStatusBadge.textContent = 'Completed';
    } else {
      orderStatusBadge.classList.add('badge-danger');
      orderStatusBadge.textContent = status.toUpperCase();
    }

    // Step elements
    const stepPending = document.getElementById('step-pending');
    const stepConfirmed = document.getElementById('step-confirmed');
    const stepCompleted = document.getElementById('step-completed');
    const line1 = document.getElementById('line-1');
    const line2 = document.getElementById('line-2');
    const finalStepLabel = document.getElementById('finalStepLabel');
    const finalStepSub = document.getElementById('finalStepSub');

    finalStepLabel.textContent = isPickup ? 'Claimed' : 'Delivered';
    finalStepSub.textContent = isPickup ? 'Picked up in store' : 'Order received';

    // Reset steps
    [stepPending, stepConfirmed, stepCompleted].forEach(s => {
      s.classList.remove('active', 'completed');
    });
    [line1, line2].forEach(l => l.classList.remove('active'));

    if (status === 'pending') {
      stepPending.classList.add('active');
    } else if (status === 'confirmed') {
      stepPending.classList.add('completed');
      line1.classList.add('active');
      stepConfirmed.classList.add('active');
    } else if (status === 'completed') {
      stepPending.classList.add('completed');
      line1.classList.add('active');
      stepConfirmed.classList.add('completed');
      line2.classList.add('active');
      stepCompleted.classList.add('completed');
    }
  }

  /**
   * Render QR code
   */
  function renderQRCode(orderId) {
    if (!orderQrDisplay || typeof QRCode === 'undefined') return;

    orderQrDisplay.innerHTML = '';
    try {
      new QRCode(orderQrDisplay, {
        text: orderId,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (e) {
      console.error('QR Code error:', e);
      orderQrDisplay.innerHTML = '<p class="text-secondary">Failed to generate QR</p>';
    }
  }

  /**
   * Save QR code to phone/computer
   */
  function saveQRCodeImage(orderId) {
    if (!orderQrDisplay) return;

    const canvas = orderQrDisplay.querySelector('canvas');
    if (canvas) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `TitaVape_Pickup_QR_${orderId}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
      return;
    }

    const img = orderQrDisplay.querySelector('img');
    if (img && img.src) {
      const link = document.createElement('a');
      link.download = `TitaVape_Pickup_QR_${orderId}.png`;
      link.href = img.src;
      link.click();
    }
  }

  /**
   * Format money to Philippine Peso with comma separators and 2 decimal places
   */
  function formatMoney(amount) {
    const num = parseFloat(amount) || 0;
    return '₱' + num.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Render Items list
   */
  function renderItems(items, totalAmount) {
    itemsList.innerHTML = '';
    const itemsArr = Array.isArray(items) ? items : [];

    let totalQty = 0;
    let computedSubtotal = 0;

    itemsArr.forEach(item => {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const subtotal = qty * price;
      totalQty += qty;
      computedSubtotal += subtotal;

      const row = document.createElement('div');
      row.className = 'order-item-row';

      // Resolve image
      let imgSrc = null;
      if (item.imageUrl) {
        imgSrc = item.imageUrl;
      } else if (item.images) {
        if (Array.isArray(item.images) && item.images.length > 0) imgSrc = item.images[0];
        else if (typeof item.images === 'string') {
          try {
            const p = JSON.parse(item.images);
            if (Array.isArray(p) && p.length > 0) imgSrc = p[0];
            else imgSrc = item.images;
          } catch (e) {
            imgSrc = item.images;
          }
        }
      }

      const imgHtml = imgSrc
        ? `<div class="item-thumb"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.name || 'Product')}" onerror="this.parentElement.innerHTML='📦'"></div>`
        : `<div class="item-thumb">📦</div>`;

      row.innerHTML = `
        <div class="item-left">
          ${imgHtml}
          <div class="item-meta">
            <span class="item-name">${escapeHtml(item.name || 'Item')}</span>
            <span class="item-qty-price">${qty} × ${formatMoney(price)}</span>
          </div>
        </div>
        <div class="item-subtotal">${formatMoney(subtotal)}</div>
      `;

      itemsList.appendChild(row);
    });

    itemsCountBadge.textContent = `${totalQty} Item${totalQty === 1 ? '' : 's'}`;
    const finalTotal = parseFloat(totalAmount) || computedSubtotal;
    orderSubtotalText.textContent = formatMoney(computedSubtotal);
    orderGrandTotalText.textContent = formatMoney(finalTotal);
  }

  /**
   * Manage polling for status updates
   */
  function setupPolling(status) {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    // Only poll if order is not completed or cancelled
    if (status === 'pending' || status === 'confirmed') {
      pollInterval = setInterval(() => {
        fetchOrder(null, true);
      }, 25000); // Check every 25 seconds
    }
  }

  /**
   * Helper: Show active state view
   */
  function showState(state) {
    loadingState.style.display = state === 'loading' ? 'block' : 'none';
    verifyPhoneState.style.display = state === 'verifyPhone' ? 'block' : 'none';
    errorState.style.display = state === 'error' ? 'block' : 'none';
    orderContent.style.display = state === 'content' ? 'block' : 'none';
  }

  function showError(title, msg) {
    showState('error');
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessageText').textContent = msg;
  }

  function showPhoneError(msg) {
    verifyPhoneErrorText.textContent = msg;
    verifyPhoneError.style.display = 'flex';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start initialization
  init();
})();
