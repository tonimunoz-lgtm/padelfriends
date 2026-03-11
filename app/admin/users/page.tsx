'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { User } from '@/types';
import { Users, ChevronLeft, Shield, Trash2, RotateCcw, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function toggleAdmin(u: User) {
    const newRole = u.role === 'admin' ? 'player' : 'admin';
    await updateDoc(doc(db, 'users', u.uid), { role: newRole });
    setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, role: newRole } : x));
    showToast(`✓ ${u.email} ahora es ${newRole === 'admin' ? 'administrador' : 'jugador'}`);
  }

  async function resetPassword(u: User) {
    await sendPasswordResetEmail(auth, u.email);
    showToast(`✓ Email de reset enviado a ${u.email}`);
  }

  async function deleteUser(u: User) {
    if (!confirm(`¿Eliminar usuario ${u.email}?`)) return;
    await deleteDoc(doc(db, 'users', u.uid));
    setUsers(prev => prev.filter(x => x.uid !== u.uid));
    showToast(`✓ Usuario eliminado`);
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} color="var(--accent)" /> Usuarios</h1>
        </div>
        <span className="badge badge-gray">{users.length} usuarios</span>
      </div>

      <div style={{ padding: '16px' }}>
        <input className="input" placeholder="Buscar por email o nombre..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16 }} />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" style={{ width: 36, height: 36 }} /></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map((u, i) => (
              <div key={u.uid} style={{ padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: u.role === 'admin' ? 'rgba(124,58,237,0.2)' : 'rgba(0,229,160,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0, color: u.role === 'admin' ? 'var(--accent2)' : 'var(--accent)' }}>
                    {(u.displayName || u.email || 'U')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || 'Sin nombre'}</p>
                      <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-teal'}`}>{u.role === 'admin' ? '⚡ Admin' : '🎾 Jugador'}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                    {u.teamId && <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Team ID: {u.teamId}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => toggleAdmin(u)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {u.role === 'admin' ? <UserX size={13} /> : <UserCheck size={13} />}
                    {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                  </button>
                  <button onClick={() => resetPassword(u)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RotateCcw size={13} /> Reset contraseña
                  </button>
                  <button onClick={() => deleteUser(u)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
