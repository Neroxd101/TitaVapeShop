/** Shared, text-only rendering for customer and admin order conversations. */
const OrderChat = {
    messages(order) {
        return Array.isArray(order.chat_messages) ? order.chat_messages : [];
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
