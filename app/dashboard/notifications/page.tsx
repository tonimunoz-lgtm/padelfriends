'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserNotifications, markNotificationRead } from '@/lib/firestore';
import { Notification } from '@/types';
import { formatRelative } from '@/lib/utils';
import { Bell, CheckCheck } from 'lucide-react';

const ICONS: Record<string, string> = {
  match_reminder: '⏰',
  result_submitted: '📊',
  result_confirmed: '✅',
  team_invite: '🤝',
  general: '📢',
  location_changed: '📍',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    try {
      const n = await getUserNotifications(user.uid);
      setNotifications(n);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={20} color="var(--accent)" />
          Notificaciones
          {unreadCount > 0 && (
            <span style={{ background: 'var(--danger)', color: 'white', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCheck size={14} /> Todas leídas
          </button>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" style={{ width: 36, height: 36 }} /></div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
            <Bell size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
            <p>Sin notificaciones</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {notifications.map((n, i) => (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                style={{
                  padding: '16px',
                  borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                  background: n.read ? 'transparent' : 'rgba(0,229,160,0.04)',
                  cursor: n.read ? 'default' : 'pointer',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{ICONS[n.type] || '📢'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, lineHeight: 1.4 }}>{n.title}</p>
                    {!n.read && <div className="pulse-dot" style={{ flexShrink: 0, marginTop: 4 }} />}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{n.message}</p>
                  <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, opacity: 0.7 }}>{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
