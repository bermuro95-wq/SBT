// ============================================================
// SELAM BERTU TESFA - Notifications Module
// ============================================================

class NotificationsModule {
    constructor() {
        this.userId = null;
        this.notifications = [];
        this.unreadCount = 0;
        this.panelOpen = false;
        this.init();
    }
    
    async init() {
        let profile = typeof AUTH !== 'undefined' && AUTH.getCurrentProfile ? AUTH.getCurrentProfile() : null;
        if (!profile) {
            try { if (AUTH.init) await AUTH.init(); } catch (e) {}
            profile = AUTH.getCurrentProfile ? AUTH.getCurrentProfile() : null;
        }
        if (!profile) {
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        this.userId = profile.id;
        
        // Load notifications
        await this.loadNotifications();
        
        // Setup UI
        this.setupUI();
        
        // Setup realtime
        this.setupRealtime();
    }
    
    async loadNotifications() {
        if (!this.userId) return;
        
        let data = null, error = null;
        try {
            const res = await supabase.from('notifications').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(50);
            data = res.data; error = res.error;
        } catch (e) { error = e; }
        if (error) {
            console.warn('Load notifications:', error.message || error);
            this.notifications = [];
            this.unreadCount = 0;
            this.updateBadge();
            return;
        }
        
        this.notifications = data || [];
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.updateBadge();
        this.renderList();
    }
    
    setupUI() {
        // Notification button
        const btn = document.getElementById('notifications-btn');
        if (btn) {
            btn.addEventListener('click', () => this.togglePanel());
        }
        
        // Mark all read button
        const markAllBtn = document.getElementById('mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllRead());
        }
        
        // Close panel on outside click
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notification-panel');
            const btn = document.getElementById('notifications-btn');
            if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
                this.closePanel();
            }
        });
    }
    
    setupRealtime() {
        if (!this.userId) return;
        try {
            // Single channel subscribe (avoid "callbacks after subscribe" error)
            const channel = supabase
                .channel('notifications-' + this.userId + '-' + Date.now())
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: 'user_id=eq.' + this.userId
                }, (payload) => {
                    const notification = payload.new;
                    // Only for this user (receiver) — filter already user_id=eq
                    if (String(notification.user_id) !== String(this.userId)) return;
                    this.notifications.unshift(notification);
                    if (!notification.is_read) {
                        this.unreadCount++;
                        this.updateBadge();
                        // Sound only for the receiver of the notification
                        playNotificationSound();
                    }
                    this.renderList();
                    // Optional toast for receiver only
                    if (typeof showAppMessage === 'function' && notification.title) {
                        showAppMessage(notification.title, notification.message || '', notification.type === 'warning' ? 'warning' : (notification.type === 'success' ? 'success' : 'info'));
                    }
                })
                .subscribe();
            this._channel = channel;
        } catch (e) {
            console.warn('Notifications realtime disabled', e);
        }
    }
    
    togglePanel() {
        if (this.panelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    openPanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.remove('d-none');
            this.panelOpen = true;
        }
    }
    
    closePanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.add('d-none');
            this.panelOpen = false;
        }
    }
    
    renderList() {
        const list = document.getElementById('notification-list');
        if (!list) return;
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="bi bi-bell fs-3 d-block mb-2"></i>
                    <span>No notifications</span>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.notifications.slice(0, 30).map(n => {
            const typ = String(n.type || '').toLowerCase();
            const title = String(n.title || '').toLowerCase();
            const msg = String(n.message || '').toLowerCase();
            let colorClass = 'notif-info'; // blue general
            if (typ === 'error' || typ === 'danger' || title.includes('reject') || msg.includes('reject')) {
                colorClass = 'notif-reject'; // red
            } else if (typ === 'success' || title.includes('approv') || msg.includes('approv')) {
                colorClass = 'notif-approve'; // green
            } else if (typ === 'warning') {
                colorClass = 'notif-warning';
            }
            return `
            <div class="notification-item ${!n.is_read ? 'unread' : ''} ${colorClass}" 
                 data-id="${n.id}"
                 onclick="window.notifications?.markRead('${n.id}')">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="notification-title">${this.escapeHtml(n.title)}</div>
                    ${!n.is_read ? '<span class="badge bg-danger rounded-pill">' + (this.unreadCount > 0 ? 'New' : '') + '</span>' : ''}
                </div>
                <div class="notification-message">${this.escapeHtml(n.message)}</div>
                <div class="notification-time">${this.formatTime(n.created_at)}</div>
            </div>`;
        }).join('');
    }
    
    updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const n = Number(this.unreadCount) || 0;
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.classList.toggle('d-none', n === 0);
            badge.setAttribute('aria-label', n + ' unread notifications');
            badge.style.display = n === 0 ? 'none' : '';
        }
        // Also update any counter spans
        document.querySelectorAll('.notification-count-badge, #notification-count').forEach(el => {
            el.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount || 0);
            el.classList.toggle('d-none', !this.unreadCount);
        });
    }
    
    async markRead(id) {
        const { data, error } = await DB.notifications.markRead(id);
        if (error) {
            console.error('Mark read error:', error);
            return;
        }
        
        // Update local state
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.is_read) {
            notification.is_read = true;
            this.unreadCount--;
            this.updateBadge();
            this.renderList();
        }
    }
    
    async markAllRead() {
        if (!this.userId) return;
        
        const { data, error } = await DB.notifications.markAllRead(this.userId);
        if (error) {
            console.error('Mark all read error:', error);
            return;
        }
        
        // Update local state
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
        this.updateBadge();
        this.renderList();
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        
        return date.toLocaleDateString('en-ET', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Create notification from system event
    static async createNotification(userId, type, title, message, link = null) {
        const { data, error } = await DB.notifications.create({
            user_id: userId,
            type: type,
            title: title,
            message: message,
            link: link,
            is_read: false
        });
        
        return { data, error };
    }
}

// ============================================================
// Notification sound — only plays for the RECEIVER of a notification
// Soft, short chime via Web Audio (no external file needed)
// ============================================================
function playNotificationSound() {
    try {
        // Respect user preference if stored
        const muted = localStorage.getItem('sbt_notify_sound') === 'off';
        if (muted) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        // Soft two-tone chime
        const notes = [880, 1174.66]; // A5, D6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02 + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + i * 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.09);
            osc.stop(now + 0.35 + i * 0.12);
        });
        // Close context after chime
        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 600);
    } catch (e) {
        /* ignore autoplay restrictions */
    }
}
window.playNotificationSound = playNotificationSound;

// ============================================================
// Initialize Notifications
// ============================================================

let notifications;

document.addEventListener('DOMContentLoaded', function() {
    notifications = new NotificationsModule();
    window.notifications = notifications;
});
// Keep red count badge in sync
(function () {
    const sync = () => {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        const n = parseInt(String(badge.textContent || '0').replace('+', ''), 10) || 0;
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge(n);
        else {
            if (n > 0) { badge.classList.remove('d-none'); badge.style.display = 'inline-flex'; }
            else { badge.classList.add('d-none'); }
        }
    };
    setInterval(sync, 1500);
    document.addEventListener('DOMContentLoaded', sync);
})();
