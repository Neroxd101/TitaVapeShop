// Dedicated order conversation modal, independent of the order details view.
const OrdersChatModal = {
    chatPoll: null,
    open(order, onRead) {
        clearInterval(this.chatPoll);
        const modal = document.getElementById('adminChatDialog');
        document.getElementById('adminChatCustomer').textContent = order.customer_name || 'Customer';
        document.getElementById('adminChatContent').innerHTML = `
            <div id="adminOrderChatMessages" class="order-chat-history" aria-label="Order messages"></div>
            <form id="adminOrderChatForm" class="order-chat-form">
                <label for="adminOrderChatInput">Your message</label>
                <div class="order-chat-input-wrap">
                    <textarea id="adminOrderChatInput" class="form-control order-chat-input" rows="3" required maxlength="1000" aria-describedby="adminOrderChatHelp" placeholder="Type your message…" ${order.status !== 'confirmed' ? 'disabled' : ''}></textarea>
                </div>
                <div class="order-chat-compose-footer">
                    <small id="adminOrderChatHelp">${order.status === 'confirmed' ? 'Up to 1,000 characters per message.' : 'This order is completed. Messages are read-only.'}</small>
                    <button type="submit" class="btn btn-primary order-chat-send" ${order.status !== 'confirmed' ? 'hidden' : ''}>Send</button>
                </div>
                <p id="adminOrderChatMessage" class="order-chat-status" role="status" aria-live="polite"></p>
            </form>
        `;
        document.getElementById('closeAdminChatBtn').onclick = () => modal.close();
        modal.onclose = () => clearInterval(this.chatPoll);
        const chat = document.getElementById('adminOrderChatMessages');
        const markRead = async displayed => {
            if (!modal.open || !chat.isConnected || document.visibilityState === 'hidden') return;
            try {
                const result = await window.OrderChat.markRead(displayed, 'admin');
                if (chat.isConnected) onRead?.(result ? Number(result.unread_count) : window.OrderChat.unreadCount(displayed, 'admin'));
            } catch (_) { /* Leave unread messages counted until the receipt is saved. */ }
        };
        let chatVersion = 0;
        if (chat) {
            window.OrderChat.render(chat, order, 'admin');
            let refreshing = false;
            this.chatPoll = setInterval(async () => {
                if (!modal.open || !chat.isConnected) { clearInterval(this.chatPoll); return; }
                if (document.visibilityState === 'hidden' || refreshing || document.getElementById('adminOrderChatInput')?.disabled && order.status === 'confirmed') return;
                refreshing = true;
                const version = chatVersion;
                try {
                    const result = await window.OrdersGetAll.get({ search: order.id, limit: 1 });
                    const latest = result.orders?.find(item => item.id === order.id);
                    if (result.success && latest && chat.isConnected && version === chatVersion) {
                        order.chat_messages = latest.chat_messages;
                        order.status = latest.status;
                        window.OrderChat.render(chat, latest, 'admin');
                        markRead(latest);
                        const input = document.getElementById('adminOrderChatInput');
                        if (input) input.disabled = latest.status !== 'confirmed';
                        const send = document.getElementById('adminOrderChatForm')?.querySelector('button');
                        if (send) send.hidden = latest.status !== 'confirmed';
                        document.getElementById('adminOrderChatHelp').textContent = latest.status === 'confirmed'
                            ? 'Up to 1,000 characters per message.' : 'This order is completed. Messages are read-only.';
                    }
                } catch (_) { /* Keep messages and drafts visible during a temporary outage. */ }
                finally { refreshing = false; }
            }, 5000);
        }
        const chatForm = document.getElementById('adminOrderChatForm');
        chatForm.addEventListener('submit', async event => {
            event.preventDefault();
            const input = document.getElementById('adminOrderChatInput');
            const message = document.getElementById('adminOrderChatMessage');
            const button = chatForm.querySelector('button');
            if (!button || button.disabled || !input.value.trim()) return;
            ++chatVersion;
            button.disabled = true;
            input.disabled = true;
            message.textContent = 'Sending…';
            try {
                const response = await fetch('/api/orders/chat-send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ id: order.id, message: input.value })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send message.');
                const history = window.OrderChat.messages(order).slice();
                history.push(result.message);
                order.chat_messages = history;
                window.OrderChat.render(chat, order, 'admin');
                input.value = '';
                message.textContent = 'Message sent.';
            } catch (error) {
                message.textContent = error.message;
            } finally {
                button.disabled = false;
                input.disabled = false;
            }
        });
        if (!modal.open) modal.showModal();
        markRead(order);
    }
};
window.OrdersChatModal = OrdersChatModal;
