// Logic for Sending POS Email Receipts
const SalesReceiptEmail = {
    async sendReceipt({ receiptUrl = '/pos/email_send_receipt', customerEmail, customerName, items, total, cash, change }) {
        if (!customerEmail) {
            return { emailSent: false, emailError: false };
        }

        try {
            const emailResponse = await fetch(receiptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerEmail,
                    customerName,
                    items,
                    total,
                    cash,
                    change,
                    saleDate: new Date().toLocaleString('en-PH', {
                        timeZone: 'Asia/Manila',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })
                })
            });

            await emailResponse.json();
            return {
                emailSent: emailResponse.ok,
                emailError: !emailResponse.ok
            };
        } catch (error) {
            console.error('Error sending receipt email:', error);
            return {
                emailSent: false,
                emailError: true
            };
        }
    }
};

window.SalesReceiptEmail = SalesReceiptEmail;
