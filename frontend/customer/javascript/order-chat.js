/** Shared, text-only rendering for customer and admin order conversations. */
const OrderChat = {
    messages(order) {
        return Array.isArray(order.chat_messages) ? order.chat_messages : [];
    },

    readReceipts: new Map(),
    pendingReads: new Map(),
    unreadCount(order, viewer = 'customer') {
        const receipt = this.readReceipts.get(`${viewer}:${order.id}`);
        return this.messages(order).filter(message => message.sender !== viewer && !message.read_at
            && !(receipt && /^[1-9]\d*$/.test(String(message.id)) && BigInt(message.id) <= BigInt(receipt.through))).length;
    },
    badgeHtml(count) {
        count = Math.max(0, Math.floor(Number(count) || 0));
        return `<span class="order-chat-unread" ${count ? '' : 'hidden'} aria-label="${count} unread messages">${count > 99 ? '99+' : count || ''}</span>`;
    },
    setBadge(button, count) {
        if (!button) return;
        count = Math.max(0, Math.floor(Number(count) || 0));
        let badge = button.querySelector('.order-chat-unread');
        if (!badge) { badge = document.createElement('span'); badge.className = 'order-chat-unread'; button.appendChild(badge); }
        badge.hidden = count === 0;
        badge.textContent = count > 99 ? '99+' : count ? String(count) : '';
        badge.setAttribute('aria-label', `${count} unread messages`);
    },
    async markRead(order, viewer = 'customer', phone = null) {
        const incoming = this.messages(order).filter(message => message.sender !== viewer && !message.read_at
            && /^[1-9]\d*$/.test(String(message.id)));
        if (!incoming.length || !this.unreadCount(order, viewer)) return null;
        const key = `${viewer}:${order.id}`;
        if (this.pendingReads.has(key)) return this.pendingReads.get(key);
        const through = incoming.reduce((max, message) => BigInt(message.id) > BigInt(max) ? String(message.id) : max, '0');
        const request = (async () => {
            const response = await fetch(viewer === 'admin' ? '/api/orders/chat-read' : '/api/customer/orders/chat-read', {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ id: order.id, through_id: through, ...(viewer === 'customer' ? { phone } : {}) })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to mark messages as read.');
            const previous = this.readReceipts.get(key);
            if (!previous || BigInt(through) > BigInt(previous.through)) this.readReceipts.set(key, { through, at: result.read_at });
            for (const message of this.messages(order)) {
                if (message.sender !== viewer && /^[1-9]\d*$/.test(String(message.id)) && BigInt(message.id) <= BigInt(through)) message.read_at ||= result.read_at;
            }
            return result;
        })();
        this.pendingReads.set(key, request);
        try { return await request; } finally { this.pendingReads.delete(key); }
    },

    render(container, order, viewer = 'customer') {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 48;
        const messages = this.messages(order);
        const signature = JSON.stringify(messages);
        if (container.dataset.messages === signature) return;
        container.dataset.messages = signature;
        const previousTop = container.scrollTop;
        container.replaceChildren();
        if (!messages.length) {
            const empty = document.createElement('p');
            empty.className = 'order-chat-empty';
            empty.textContent = 'No messages yet. Start the conversation below.';
            container.appendChild(empty);
        }
        for (const message of messages) {
            const bubble = document.createElement('div');
            bubble.className = 'order-chat-bubble ' + (message.sender === viewer ? 'customer-note' : 'store-note');
            const author = document.createElement('strong');
            author.textContent = message.sender === 'admin' ? 'Tita’s Vape Shop' : 'Customer';
            if (message.sender === viewer) author.textContent += ' (You)';
            const body = document.createElement('p');
            body.textContent = message.body;
            const time = document.createElement('time');
            const date = message.created_at ? new Date(message.created_at) : null;
            if (date && !Number.isNaN(date.getTime())) {
                time.dateTime = date.toISOString();
                time.textContent = date.toLocaleString('en-PH', {
                    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                }) + ' (PH time)';
            } else {
                time.textContent = 'Date and time not recorded';
            }
            bubble.append(author, body, time);
            container.appendChild(bubble);
        }
        container.scrollTop = nearBottom ? container.scrollHeight : previousTop;
    }
};
window.OrderChat = OrderChat;
