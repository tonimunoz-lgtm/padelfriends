'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from '@/types';
import { Bell, ChevronLeft, Send, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'admins' | 'players'>('all');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    });
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleSend() {
    if (!title || !message) return showToast('Título y mensaje son obligatorios');
    setSending(true);
    try {
      const targetUsers = users.filter(u => {
        if (target === 'all') return true;
        if (target === 'admins') return u.role === 'admin';
        return u.role === 'player';
      });

      await Promise.all(targetUsers.map(u =>
        addDoc(collection(db, 'notifications'), {
          userId: u.uid,
          type: 'general',
          title,
          message,
          read: false,
          createdAt: serverTimestamp(),
        })
      ));

      showToast(`✓ Notificación enviada a ${targetUsers.length} usuario(s)`);
      setTitle('');
      setMessage('');
    } catch { showToast('Error al enviar'); } finally { setSending(false); }
  }

  const targetCount = target === 'all' ? users.length : target === 'admins' ? users.filter(u => u.role === 'admin').length : users.filter(u => u.role === 'player').length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={20} color="#ec4899" /> Notificaciones</h1>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Enviar notificación</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">Destinatarios</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'players', 'admins'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: target === t ? 'var(--accent)' : 'var(--surface2)', color: target === t ? '#000' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {t === 'all' ? 'Todos' : t === 'players' ? 'Jugadores' : 'Admins'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                {targetCount} destinatario(s)
              </p>
            </div>

            <div>
              <label className="label">Título</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Recordatorio de partido..." />
            </div>

            <div>
              <label className="label">Mensaje</label>
              <textarea className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Escribe el mensaje..." rows={4} style={{ resize: 'vertical' }} />
            </div>

            <button className="btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? <span className="loader" /> : <><Send size={15} /> Enviar notificación</>}
            </button>
          </div>
        </div>

        {/* Reminder info */}
        <div className="card-sm" style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#ec4899' }}>⏰ Recordatorios automáticos</h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Los recordatorios de partido se envían automáticamente 24 horas antes de cada partido programado. 
            Para configurar emails automáticos, activa la Cloud Function en Firebase o usa el cron job en Vercel.
          </p>
        </div>
      </div>

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
