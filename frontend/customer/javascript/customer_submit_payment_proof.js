/**
 * Customer Submit Payment Proof Module
 * Frontend client module matching customer_submit_payment_proof RPC and backend route
 */

const CustomerSubmitPaymentProof = {
  /**
   * Submit payment proof (reference number + uploaded receipt URL) for an order
   * @param {{order_id: string, reference: string, receipt_url: string, phone?: string}} paymentData
   * @returns {Promise<{success: boolean, order_id?: string, payment_status?: string, payment_reference?: string, payment_receipt_url?: string, error?: string}>}
   */
  async submit(paymentData) {
    try {
      let response = await fetch('/api/customer/orders/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(paymentData)
      });

      if (!response.ok && response.status === 404) {
        // Fallback to alias if needed
        response = await fetch('/api/orders/submit-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(paymentData)
        });
      }

      const result = await response.json().catch(() => ({ success: false, error: 'Network error parsing response' }));

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to record payment proof.'
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (err) {
      console.error('[CustomerSubmitPaymentProof] Error:', err);
      return {
        success: false,
        error: err.message || 'Unable to submit payment proof. Please try again.'
      };
    }
  }
};

// Export to window
if (typeof window !== 'undefined') {
  window.CustomerSubmitPaymentProof = CustomerSubmitPaymentProof;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomerSubmitPaymentProof;
}
