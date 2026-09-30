// Shared display rules for order lines removed by inventory deletion.
window.OrderAvailability = (() => {
  const isUnavailable = item => item?.unavailable === true;
  const lineTotal = item => isUnavailable(item) ? 0 : (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
  const money = amount => '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function notice(order, { includeRefundInstructions = true } = {}) {
    const messages = [];
    if (order.cancellation_reason) messages.push(order.cancellation_reason);
    else if (Array.isArray(order.items) && order.items.some(isUnavailable)) {
      messages.push('Unavailable products have been removed from your total.');
    }
    if (Number(order.refunded_amount) > 0) {
      messages.push(`Refunded: ${money(order.refunded_amount)}.`);
    }
    if (Number(order.refund_due_amount) > 0) {
      messages.push(`Refund due: ${money(order.refund_due_amount)}.`);
      if (includeRefundInstructions) messages.push('Please contact the store to arrange your refund.');
    } else if (order.payment_status === 'pending_verification' && Number(order.payment_amount) > Number(order.total_amount)) {
      messages.push('Your total changed after payment was submitted. The store will review your payment and any refund owed.');
    }
    return messages.join(' ');
  }

  return { isUnavailable, lineTotal, notice };
})();
