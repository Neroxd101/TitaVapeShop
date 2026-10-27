const CatalogNotifications = {
  userId: null, entries: [], unread: 0, hasMore: false, timer: null,
  version: 0, busy: false, saving: false, initialized: false,
  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.button = document.getElementById('catalogNotificationsBtn');
    this.panel = document.getElementById('catalogNotificationsPanel');
    this.list = document.getElementById('catalogNotificationsList');
    this.status = document.getElementById('catalogNotificationsStatus');
    this.more = document.getElementById('catalogNotificationsMore');
    this.readAll = document.getElementById('catalogNotificationsReadAll');
    this.button.addEventListener('click', () => this.panel.hidden ? this.open() : this.close());
    document.getElementById('catalogNotificationsClose').addEventListener('click', () => this.close(true));
    this.more.addEventListener('click', () => this.refresh(true));
    this.readAll.addEventListener('click', () => this.markRead({ through_id: this.entries[0]?.id }));
    document.addEventListener('click', event => {
      if (!this.panel.contains(event.target) && !this.button.contains(event.target)) this.close();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !this.panel.hidden) this.close(true); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.userId) this.refresh(); });
    window.addEventListener('resize', () => this.position());
  },
  setUser(user) {
    this.init();
    const id = user?.id || null;
    if (id === this.userId) return;
    this.version++;
    clearTimeout(this.timer);
    this.userId = id;
    this.entries = [];
    this.unread = 0;
    this.hasMore = false;
    this.busy = false;
    this.saving = false;
    this.more.disabled = false;
    this.close();
    this.button.hidden = !id;
    this.render();
    if (id) this.refresh();
  },
  async request(url, options = {}) {
    const userId = this.userId;
    const response = await fetch(url, { credentials: 'include', cache: 'no-store', ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const result = await response.json();
    if (response.status === 401) {
      if (userId === this.userId) this.setUser(null);
      throw new Error('Please sign in to view notifications.');
    }
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load notifications.');
    return result;
  },
  schedule() {
    clearTimeout(this.timer);
    if (this.userId) this.timer = setTimeout(() => this.refresh(), 15000);
  },
  async refresh(append = false) {
    if (!this.userId || this.busy || this.saving) return;
    if (document.visibilityState === 'hidden') { this.schedule(); return; }
    const version = this.version;
    this.busy = true;
    this.more.disabled = true;
    if (!this.entries.length) this.status.textContent = 'Loading…';
    try {
      const cursor = append && this.entries.at(-1)?.id;
      let result = await this.request('/api/customer/notifications' + (cursor ? '?before_id=' + encodeURIComponent(cursor) : ''));
      if (version !== this.version) return;
      // Keep the loaded range contiguous when new events arrive while reading older pages.
      if (!append && !this.panel.hidden) {
        const target = this.entries.length;
        const entries = [...result.notifications];
        while (entries.length < target && result.has_more && entries.length) {
          result = await this.request('/api/customer/notifications?before_id=' + encodeURIComponent(entries.at(-1).id));
          if (version !== this.version) return;
          if (!result.notifications.length) break;
          entries.push(...result.notifications);
        }
        result = { ...result, notifications: entries };
      }
      const seen = new Set(append ? this.entries.map(entry => entry.id) : []);
      const next = result.notifications.filter(entry => !seen.has(entry.id));
      this.entries = append ? [...this.entries, ...next] : next;
      this.unread = Number(result.unread_count) || 0;
      this.hasMore = result.has_more;
      this.status.textContent = '';
      this.render();
    } catch (error) {
      if (version === this.version) this.status.textContent = error.message;
    } finally {
      if (version === this.version) { this.busy = false; this.more.disabled = false; this.schedule(); }
    }
  },
  async markRead(body) {
    if (!this.userId || this.saving || (!body.id && !body.through_id)) return false;
    const userId = this.userId;
    const version = ++this.version;
    this.busy = false; // Ignore any older fetch that was already in flight.
    this.saving = true;
    this.readAll.disabled = true;
    try {
      const result = await this.request('/api/customer/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (userId !== this.userId || version !== this.version) return false;
      this.entries.forEach(entry => {
        if (body.id === entry.id || (body.through_id && BigInt(entry.id) <= BigInt(body.through_id))) entry.read_at ||= new Date().toISOString();
      });
      this.unread = Number(result.unread_count) || 0;
      this.status.textContent = '';
      this.render();
      return true;
    } catch (error) {
      if (version === this.version) this.status.textContent = error.message;
      return false;
    } finally {
      if (version === this.version) { this.saving = false; this.readAll.disabled = !this.unread; this.more.disabled = false; this.schedule(); }
    }
  },
  render() {
    const badge = document.getElementById('catalogNotificationsBadge');
    badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
    badge.hidden = !this.unread;
    badge.classList.toggle('has-items', this.unread > 0);
    this.button.setAttribute('aria-label', this.unread ? `Notifications, ${this.unread} unread` : 'Notifications');
    this.readAll.disabled = !this.unread || !this.entries.length || this.saving;
    this.more.hidden = !this.hasMore;
    this.list.replaceChildren();
    const titles = {
      confirmed: 'Order confirmed', completed: 'Order completed', cancelled: 'Order cancelled', voided: 'Order voided',
      chat: 'New message from the store', payment_confirmed: 'Payment confirmed', payment_rejected: 'Payment rejected'
    };
    this.entries.forEach(entry => {
      const link = document.createElement('a');
      link.className = 'catalog-notification' + (entry.read_at ? '' : ' is-unread');
      link.href = `/order-status?id=${encodeURIComponent(entry.order_id)}` + (entry.kind === 'chat' ? '&chat=1' : '');
      const title = document.createElement('strong');
      title.textContent = `${titles[entry.kind] || 'Order update'} · #${entry.order_id.slice(0, 8)}`;
      const body = document.createElement('p');
      body.textContent = entry.body;
      const date = document.createElement('time');
      date.dateTime = entry.created_at;
      date.textContent = new Date(entry.created_at).toLocaleString('en-PH');
      link.append(title, body, date);
      link.addEventListener('click', async event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const userId = this.userId;
        await this.markRead({ id: entry.id });
        if (userId && userId === this.userId) window.location.href = link.href;
      });
      this.list.appendChild(link);
    });
    if (!this.entries.length && !this.status.textContent) this.status.textContent = 'No notifications yet.';
  },
  position() {
    if (this.panel.hidden) return;
    this.panel.style.top = Math.min(this.button.getBoundingClientRect().bottom + 8, window.innerHeight - 160) + 'px';
  },
  open() {
    if (!this.userId) return;
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.position();
    this.refresh();
  },
  close(focus = false) {
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (focus) this.button.focus();
  }
};
window.CatalogNotifications = CatalogNotifications;
document.addEventListener('DOMContentLoaded', () => CatalogNotifications.init());
