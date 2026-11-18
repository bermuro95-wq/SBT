// ============================================================
// Team Memos — shared replies via existing memos table
// Replies stored as memo rows: body = "__REPLY__:<parentId>__" + text
// Works for ALL users without requiring memo_replies table.
// ============================================================

class MemosFeature {
    constructor() {
        this.items = [];
        this.replies = {};
        this.reactions = {};
        this.init();
    }

    static REPLY_PREFIX = '__REPLY__:';

    async init() {
        const host = document.getElementById('team-memos-card');
        if (!host) return;
        await this.load();
        this.bind();
        this.render();
        this._poll = setInterval(async () => {
            try { await this.load(); this.render(); } catch (e) {}
        }, 12000);
    }

    profile() {
        return (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
    }

    parseReplyBody(body) {
        const b = String(body || '');
        if (!b.startsWith(MemosFeature.REPLY_PREFIX)) return null;
        const rest = b.slice(MemosFeature.REPLY_PREFIX.length);
        const sep = rest.indexOf('__');
        if (sep < 0) return null;
        return { parentId: rest.slice(0, sep), text: rest.slice(sep + 2) };
    }

    encodeReply(parentId, text) {
        return MemosFeature.REPLY_PREFIX + String(parentId) + '__' + text;
    }

    async load() {
        try {
            const { data, error } = await supabase
                .from('memos')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            const all = data || [];
            this.items = [];
            this.replies = {};
            all.forEach(row => {
                const parsed = this.parseReplyBody(row.body);
                if (parsed) {
                    const mid = String(parsed.parentId);
                    if (!this.replies[mid]) this.replies[mid] = [];
                    this.replies[mid].push({
                        ...row,
                        body: parsed.text,
                        _isReply: true,
                        parent_id: mid
                    });
                } else {
                    this.items.push(row);
                }
            });
            Object.keys(this.replies).forEach(k => {
                this.replies[k].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
        } catch (e) {
            console.warn('Memos load:', e);
            this.items = JSON.parse(localStorage.getItem('sbt_memos') || '[]');
            this.replies = JSON.parse(localStorage.getItem('sbt_memo_replies') || '{}');
        }
        try {
            const ids = this.items.map(m => m.id).filter(Boolean);
            if (!ids.length) return;
            const { data: reacts, error } = await supabase.from('memo_reactions').select('*').in('memo_id', ids);
            if (error) return;
            this.reactions = {};
            (reacts || []).forEach(r => {
                const mid = String(r.memo_id);
                if (!this.reactions[mid]) this.reactions[mid] = [];
                this.reactions[mid].push(r);
            });
        } catch (e) {}
    }

    bind() {
        document.getElementById('memo-save-btn')?.addEventListener('click', () => this.save());
        document.getElementById('memo-text')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.save();
        });
        document.getElementById('memo-list')?.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action]');
            if (!t) return;
            const action = t.getAttribute('data-action');
            const memoId = t.getAttribute('data-memo-id');
            const replyId = t.getAttribute('data-reply-id');
            if (action === 'delete-memo') this.remove(memoId);
            if (action === 'reply') this.showReplyBox(memoId);
            if (action === 'send-reply') this.sendReply(memoId);
            if (action === 'delete-reply') this.deleteReply(memoId, replyId);
            if (action === 'react') this.react(memoId, t.getAttribute('data-emoji') || 'like');
        });
    }

    async save() {
        const input = document.getElementById('memo-text');
        const text = (input?.value || '').trim();
        if (!text) {
            if (typeof showAppMessage === 'function') showAppMessage('Notice', 'Write a memo first.', 'info');
            return;
        }
        const profile = this.profile();
        try {
            const { data, error } = await supabase.from('memos').insert({
                body: text,
                author_id: profile?.id || null,
                author_name: profile?.full_name || profile?.email || 'User'
            }).select();
            if (error) throw error;
            this.items = [...(data || []), ...this.items];
            try {
                const { data: users } = await supabase.from('profiles').select('id').eq('status', 'active').neq('id', profile?.id || '');
                for (const u of (users || []).slice(0, 40)) {
                    await supabase.from('notifications').insert({
                        user_id: u.id,
                        title: 'New team memo',
                        message: (profile?.full_name || 'Someone') + ': ' + text.slice(0, 120),
                        type: 'info',
                        is_read: false
                    });
                }
            } catch (e) {}
        } catch (e) {
            const row = {
                id: 'local-' + Date.now(), body: text,
                author_id: profile?.id || null,
                author_name: profile?.full_name || profile?.email || 'User',
                created_at: new Date().toISOString()
            };
            this.items.unshift(row);
            localStorage.setItem('sbt_memos', JSON.stringify(this.items.slice(0, 50)));
        }
        if (input) input.value = '';
        await this.load();
        this.render();
        if (typeof showAppMessage === 'function') showAppMessage('Saved', 'Memo posted.', 'success');
    }

    canDeleteMemo(m) {
        const profile = this.profile();
        if (!profile || !m) return false;
        return m.author_id && profile.id && String(m.author_id) === String(profile.id);
    }

    async remove(id) {
        const memo = this.items.find(m => String(m.id) === String(id));
        if (!memo || !this.canDeleteMemo(memo)) {
            if (typeof showAppMessage === 'function') showAppMessage('Notice', 'You can only delete your own memos.', 'info');
            return;
        }
        if (!confirm('Delete this memo and its replies?')) return;
        try {
            const kids = this.replies[String(id)] || [];
            for (const r of kids) {
                try { await supabase.from('memos').delete().eq('id', r.id); } catch (e) {}
            }
            await supabase.from('memos').delete().eq('id', id);
        } catch (e) {
            if (typeof showAppMessage === 'function') showAppMessage('Error', 'Could not delete memo.', 'error');
            return;
        }
        await this.load();
        this.render();
    }

    showReplyBox(memoId) {
        document.getElementById('reply-box-' + memoId)?.classList.toggle('d-none');
    }

    async sendReply(memoId) {
        const input = document.getElementById('reply-input-' + memoId);
        const text = (input?.value || '').trim();
        if (!text) return;
        if (String(memoId).startsWith('local-')) {
            if (typeof showAppMessage === 'function') {
                showAppMessage('Not shared', 'This memo is only local. Post a new memo first so replies can be shared.', 'warning');
            }
            return;
        }
        const profile = this.profile();
        const encoded = this.encodeReply(memoId, text);
        try {
            const { data, error } = await supabase.from('memos').insert({
                body: encoded,
                author_id: profile?.id || null,
                author_name: profile?.full_name || profile?.email || 'User'
            }).select();
            if (error) throw error;
            const memo = this.items.find(m => String(m.id) === String(memoId));
            if (memo?.author_id && profile?.id && String(memo.author_id) !== String(profile.id)) {
                try {
                    await supabase.from('notifications').insert({
                        user_id: memo.author_id,
                        title: 'Memo reply',
                        message: (profile.full_name || 'Someone') + ' replied: ' + text.slice(0, 100),
                        type: 'info',
                        is_read: false
                    });
                } catch (e) {}
            }
            if (input) input.value = '';
            await this.load();
            this.render();
            if (typeof showAppMessage === 'function') showAppMessage('Reply sent', 'Your reply is visible to the team.', 'success');
        } catch (e) {
            console.error(e);
            if (typeof showAppMessage === 'function') {
                showAppMessage('Reply failed', (e.message || 'Could not save reply.'), 'error');
            }
        }
    }

    async deleteReply(memoId, replyId) {
        const profile = this.profile();
        const list = this.replies[String(memoId)] || [];
        const reply = list.find(r => String(r.id) === String(replyId));
        if (!reply || String(reply.author_id) !== String(profile?.id)) {
            if (typeof showAppMessage === 'function') showAppMessage('Notice', 'You can only delete your own replies.', 'info');
            return;
        }
        try { await supabase.from('memos').delete().eq('id', replyId); } catch (e) {}
        await this.load();
        this.render();
    }

    async react(memoId, emoji) {
        const profile = this.profile();
        if (!profile?.id) return;
        const mid = String(memoId);
        const existing = (this.reactions[mid] || []).find(
            r => String(r.user_id) === String(profile.id) && r.emoji === emoji
        );
        try {
            if (existing && existing.id) {
                await supabase.from('memo_reactions').delete().eq('id', existing.id);
            } else {
                await supabase.from('memo_reactions').insert({ memo_id: memoId, user_id: profile.id, emoji });
            }
            await this.load();
            this.render();
        } catch (e) {
            if (!this.reactions[mid]) this.reactions[mid] = [];
            if (existing) this.reactions[mid] = this.reactions[mid].filter(r => r !== existing);
            else this.reactions[mid].push({ user_id: profile.id, emoji, id: 'lr-' + Date.now() });
            this.render();
        }
    }

    reactionCount(memoId, emoji) {
        return (this.reactions[String(memoId)] || []).filter(r => r.emoji === emoji).length;
    }

    formatWhen(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
    }

    esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    render() {
        const list = document.getElementById('memo-list');
        if (!list) return;
        if (!this.items.length) {
            list.innerHTML = '<div class="text-muted small p-2">No memos yet. Post the first one.</div>';
            return;
        }
        const profile = this.profile();
        list.innerHTML = this.items.map(m => {
            const mid = String(m.id);
            const reps = this.replies[mid] || [];
            const canDel = this.canDeleteMemo(m);
            const likes = this.reactionCount(mid, 'like');
            return `
            <div class="border rounded p-2 mb-2 bg-white">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong class="small">${this.esc(m.author_name || 'User')}</strong>
                        <span class="text-muted small ms-2">${this.formatWhen(m.created_at)}</span>
                    </div>
                    ${canDel ? `<button type="button" class="btn btn-sm btn-link text-danger p-0" data-action="delete-memo" data-memo-id="${mid}">Delete</button>` : ''}
                </div>
                <div class="mt-1">${this.esc(m.body || '')}</div>
                <div class="mt-2 d-flex gap-2 flex-wrap align-items-center">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="react" data-memo-id="${mid}" data-emoji="like">👍 ${likes || ''}</button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="reply" data-memo-id="${mid}">Reply</button>
                </div>
                <div id="reply-box-${mid}" class="d-none mt-2">
                    <div class="input-group input-group-sm">
                        <input type="text" class="form-control" id="reply-input-${mid}" placeholder="Write a reply...">
                        <button class="btn btn-primary" type="button" data-action="send-reply" data-memo-id="${mid}">Send</button>
                    </div>
                </div>
                ${reps.length ? `<div class="ms-3 mt-2 border-start ps-2">
                    ${reps.map(r => `
                        <div class="small mb-1">
                            <strong>${this.esc(r.author_name || 'User')}</strong>
                            <span class="text-muted">${this.formatWhen(r.created_at)}</span>
                            ${String(r.author_id) === String(profile?.id) ? `<button type="button" class="btn btn-link btn-sm text-danger p-0 ms-1" data-action="delete-reply" data-memo-id="${mid}" data-reply-id="${r.id}">Delete</button>` : ''}
                            <div>${this.esc(r.body)}</div>
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>`;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('team-memos-card')) {
        window.memosFeature = new MemosFeature();
    }
});
