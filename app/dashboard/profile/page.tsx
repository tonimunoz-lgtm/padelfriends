'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getTeam, updateTeam } from '@/lib/firestore';
import { updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Team } from '@/types';
import { User, Lock, Mail, MapPin, Users, LogOut, ChevronRight, Copy } from 'lucide-react';

export default function ProfilePage() {
  const { userProfile, signOut, refreshProfile, user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Forms
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [teamName, setTeamName] = useState('');
  const [clubName, setClubName] = useState('');
  const [location, setLocation] = useState('');
  const [substituteName, setSubstituteName] = useState('');
  const [substituteEmail, setSubstituteEmail] = useState('');

  useEffect(() => {
    if (userProfile?.teamId) {
      getTeam(userProfile.teamId).then(t => {
        setTeam(t);
        if (t) {
          setTeamName(t.name);
          setClubName(t.clubName);
          setLocation(t.preferredLocation);
        }
      });
    }
    if (userProfile?.displayName) setDisplayName(userProfile.displayName);
    if (userProfile?.email) setNewEmail(userProfile.email);
  }, [userProfile]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleUpdateName() {
    if (!userProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { displayName });
      await refreshProfile();
      showToast('✓ Nombre actualizado');
      setActiveSection(null);
    } catch { showToast('Error al actualizar'); } finally { setSaving(false); }
  }

  async function handleUpdateEmail() {
    if (!user || !userProfile) return;
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(userProfile.email, currentPw);
      await reauthenticateWithCredential(user, cred);
      await updateEmail(user, newEmail);
      await updateDoc(doc(db, 'users', userProfile.uid), { email: newEmail });
      await refreshProfile();
      showToast('✓ Email actualizado');
      setActiveSection(null);
      setCurrentPw('');
    } catch { showToast('Error: contraseña incorrecta o email inválido'); } finally { setSaving(false); }
  }

  async function handleUpdatePassword() {
    if (!user || !userProfile) return;
    if (newPw.length < 6) return showToast('Mínimo 6 caracteres');
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(userProfile.email, currentPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      showToast('✓ Contraseña actualizada');
      setActiveSection(null);
      setCurrentPw(''); setNewPw('');
    } catch { showToast('Error: contraseña actual incorrecta'); } finally { setSaving(false); }
  }

  async function handleUpdateTeam() {
    if (!team) return;
    setSaving(true);
    try {
      await updateTeam(team.id, { name: teamName, clubName, preferredLocation: location });
      setTeam({ ...team, name: teamName, clubName, preferredLocation: location });
      showToast('✓ Equipo actualizado');
      setActiveSection(null);
    } catch { showToast('Error al actualizar el equipo'); } finally { setSaving(false); }
  }

  function copyCode() {
    if (team?.code) {
      navigator.clipboard.writeText(team.code);
      showToast('✓ Código copiado');
    }
  }

  const sections = [
    {
      id: 'name', icon: '👤', title: 'Mi nombre',
      subtitle: userProfile?.displayName || 'Sin nombre',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">Nombre completo</label>
          <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Tu nombre" />
          <button className="btn-primary" onClick={handleUpdateName} disabled={saving}>{saving ? <span className="loader" /> : 'Guardar'}</button>
        </div>
      )
    },
    {
      id: 'email', icon: '📧', title: 'Cambiar email',
      subtitle: userProfile?.email || '',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">Nuevo email</label>
          <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <label className="label">Contraseña actual (para confirmar)</label>
          <input className="input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••" />
          <button className="btn-primary" onClick={handleUpdateEmail} disabled={saving}>{saving ? <span className="loader" /> : 'Actualizar email'}</button>
        </div>
      )
    },
    {
      id: 'password', icon: '🔒', title: 'Cambiar contraseña',
      subtitle: '••••••••',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">Contraseña actual</label>
          <input className="input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••" />
          <label className="label">Nueva contraseña</label>
          <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 6 caracteres" />
          <button className="btn-primary" onClick={handleUpdatePassword} disabled={saving}>{saving ? <span className="loader" /> : 'Cambiar contraseña'}</button>
        </div>
      )
    },
    ...(team ? [
      {
        id: 'team', icon: '🎾', title: 'Mi equipo',
        subtitle: team.name,
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Código de equipo</p>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--accent)' }}>{team.code}</p>
              </div>
              <button onClick={copyCode} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Copy size={14} /> Copiar
              </button>
            </div>
            <label className="label">Nombre del equipo</label>
            <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <label className="label">Club</label>
            <input className="input" value={clubName} onChange={e => setClubName(e.target.value)} />
            <label className="label">Pista preferida (local)</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} />
            <button className="btn-primary" onClick={handleUpdateTeam} disabled={saving}>{saving ? <span className="loader" /> : 'Guardar cambios'}</button>
          </div>
        )
      },
      {
        id: 'substitute', icon: '🔄', title: 'Sustituto para próximo partido',
        subtitle: 'Gestionar sustituto',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Si necesitas un sustituto para un partido, introduce sus datos. Se mostrará en la agenda pública.</p>
            <label className="label">Nombre del sustituto</label>
            <input className="input" value={substituteName} onChange={e => setSubstituteName(e.target.value)} placeholder="Nombre completo" />
            <label className="label">Email (opcional)</label>
            <input className="input" type="email" value={substituteEmail} onChange={e => setSubstituteEmail(e.target.value)} placeholder="email@ejemplo.com" />
            <button className="btn-primary" onClick={async () => {
              if (!team) return;
              await updateTeam(team.id, { player2Name: substituteName } as any);
              showToast('✓ Sustituto registrado');
              setActiveSection(null);
            }}>Confirmar sustituto</button>
          </div>
        )
      }
    ] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Mi Perfil</h1>
        <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <LogOut size={16} /> Salir
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '0 4px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: 'white' }}>
            {(userProfile?.displayName || userProfile?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 18 }}>{userProfile?.displayName || 'Jugador'}</p>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{userProfile?.email}</p>
            <span className={`badge ${userProfile?.role === 'admin' ? 'badge-purple' : 'badge-teal'}`} style={{ marginTop: 6 }}>
              {userProfile?.role === 'admin' ? '⚡ Admin' : '🎾 Jugador'}
            </span>
          </div>
        </div>

        {/* Team code quick view */}
        {team && (
          <div className="card-sm" style={{ marginBottom: 20, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Código de equipo</p>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--accent)', marginTop: 2 }}>{team.code}</p>
              </div>
              <button onClick={copyCode} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
                📋 Copiar
              </button>
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sections.map((section, i) => (
            <div key={section.id}>
              <div
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: activeSection === section.id ? '1px solid var(--border)' : i < sections.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <span style={{ fontSize: 20 }}>{section.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{section.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{section.subtitle}</p>
                </div>
                <ChevronRight size={16} color="var(--text2)" style={{ transform: activeSection === section.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {activeSection === section.id && (
                <div style={{ padding: '16px', background: 'var(--surface2)', borderBottom: i < sections.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
