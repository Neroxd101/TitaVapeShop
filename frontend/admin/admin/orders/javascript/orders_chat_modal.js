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
                    <textarea id="adminOrderChatInput" class="form-control order-chat-input" rows="3" maxlength="1000" aria-describedby="adminOrderChatHelp" placeholder="Type your message…" ${order.status !== 'confirmed' ? 'disabled' : ''}></textarea>
                </div>
                <div class="order-chat-compose-footer">
                    <label class="order-chat-attach" title="Attach photo"><input type="file" aria-label="Attach photo" id="adminOrderChatPhoto" accept="image/jpeg,image/png,image/webp,image/gif" ${order.status !== 'confirmed' ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.5-8.49"/></svg></label>
                    <small id="adminOrderChatHelp">${window.OrderChat.composerHelp(order.status)}</small>
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
                        document.getElementById('adminOrderChatPhoto').disabled = latest.status !== 'confirmed';
                        const send = document.getElementById('adminOrderChatForm')?.querySelector('button');
                        if (send) send.hidden = latest.status !== 'confirmed';
                        document.getElementById('adminOrderChatHelp').textContent = window.OrderChat.composerHelp(latest.status);
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
            const attachment = chatForm.querySelector('#adminOrderChatPhoto');
            const photo = attachment.files[0];
            const button = chatForm.querySelector('button');
            if (!button || button.disabled || order.status !== 'confirmed' || (!input.value.trim() && !photo)) return;
            ++chatVersion;
            button.disabled = true;
            input.disabled = true;
            attachment.disabled = true;
            message.textContent = 'Sending…';
            try {
                const body = await window.OrderChat.composeMessage(input.value, photo);
                const response = await fetch('/api/orders/chat-send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ id: order.id, message: body })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send message.');
                const history = window.OrderChat.messages(order).slice();
                history.push(result.message);
                order.chat_messages = history;
                window.OrderChat.render(chat, order, 'admin');
                chatForm.reset();
                message.textContent = 'Message sent.';
            } catch (error) {
                message.textContent = error.message;
            } finally {
                button.disabled = false;
                input.disabled = order.status !== 'confirmed';
                attachment.disabled = input.disabled;
            }
        });
        if (!modal.open) modal.showModal();
        markRead(order);
    }
};
window.OrdersChatModal = OrdersChatModal;
