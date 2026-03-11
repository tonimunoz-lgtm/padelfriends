'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { createTeam, getTeamByCode } from '@/lib/firestore';
import { Trophy, Users, MapPin, Hash } from 'lucide-react';

type Step = 'credentials' | 'team-choice' | 'new-team' | 'join-team' | 'done';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  // New team
  const [teamName, setTeamName] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [player2Email, setPlayer2Email] = useState('');
  const [clubName, setClubName] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');

  // Join team
  const [teamCode, setTeamCode] = useState('');
  const [teamInfo, setTeamInfo] = useState<{ id: string; name: string; player1Name: string } | null>(null);
  const [playerName, setPlayerName] = useState('');

  const { signUp } = useAuth();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    setError('');
    try {
      const user = await signUp(email, password);
      setUserId(user.uid);
      setStep('team-choice');
    } catch {
      setError('Error al registrarse. El email ya puede estar en uso.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const teamId = await createTeam({
        name: teamName,
        player1Id: userId,
        player1Name,
        player1Email: email,
        player2Name,
        player2Email,
        clubName,
        preferredLocation,
      });
      await updateDoc(doc(db, 'users', userId), {
        teamId,
        displayName: player1Name,
      });
      // Send invite to partner (in production this would trigger an email via API)
      setStep('done');
    } catch {
      setError('Error al crear el equipo');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupCode = async () => {
    if (!teamCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const team = await getTeamByCode(teamCode.trim());
      if (!team) return setError('Código no encontrado. Verifica e inténtalo de nuevo.');
      setTeamInfo({ id: team.id, name: team.name, player1Name: team.player1Name });
    } catch {
      setError('Error buscando el equipo');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamInfo) return;
    setLoading(true);
    try {
      const { updateDoc: ud, doc: d } = await import('firebase/firestore');
      await ud(d(db, 'teams', teamInfo.id), {
        player2Id: userId,
        player2Email: email,
        player2Name: playerName,
      });
      await updateDoc(doc(db, 'users', userId), {
        teamId: teamInfo.id,
        displayName: playerName,
      });
      setStep('done');
    } catch {
      setError('Error al unirse al equipo');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }} className="hero-gradient">
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🏆</div>
          <h2 className="font-display" style={{ fontSize: '2rem', marginBottom: 12 }}>¡BIENVENIDO!</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 32 }}>Tu cuenta está lista. Ya puedes empezar a jugar con Padel Friends.</p>
          <button className="btn-primary" onClick={() => router.push('/dashboard')}>Ir al Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }} className="hero-gradient">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 0 30px rgba(0,229,160,0.4)' }}>
          <Trophy size={28} color="#000" />
        </div>
        <h1 className="font-display" style={{ fontSize: '2.2rem' }}>PADEL FRIENDS</h1>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        {step === 'credentials' && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Crear cuenta</h2>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirmar contraseña</label>
                <input className="input" type="password" placeholder="Repite la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="loader" /> : 'Crear cuenta'}
              </button>
            </form>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</Link></p>
            </div>
          </>
        )}

        {step === 'team-choice' && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Configurar equipo</h2>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>¿Tienes un código de equipo o vas a crear uno nuevo?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-primary" onClick={() => setStep('new-team')} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', justifyContent: 'flex-start', paddingLeft: 20 }}>
                <Users size={22} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Crear nuevo equipo</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Soy el primer jugador del equipo</div>
                </div>
              </button>
              <button className="btn-secondary" onClick={() => setStep('join-team')} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', justifyContent: 'flex-start', paddingLeft: 20 }}>
                <Hash size={22} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Tengo un código de equipo</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Mi compañero ya creó el equipo</div>
                </div>
              </button>
            </div>
          </>
        )}

        {step === 'new-team' && (
          <>
            <button onClick={() => setStep('team-choice')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px', marginBottom: 16 }}>← Volver</button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Nuevo equipo</h2>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>Configura los datos de tu equipo</p>
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Nombre del equipo</label>
                <input className="input" placeholder="Los Ases del Pádel" value={teamName} onChange={e => setTeamName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Tu nombre completo</label>
                <input className="input" placeholder="Juan García" value={player1Name} onChange={e => setPlayer1Name(e.target.value)} required />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label className="label" style={{ color: 'var(--accent)' }}>Datos de tu compañero/a</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <input className="input" placeholder="Nombre completo del compañero" value={player2Name} onChange={e => setPlayer2Name(e.target.value)} required />
                  <input className="input" type="email" placeholder="Email del compañero (para invitarle)" value={player2Email} onChange={e => setPlayer2Email(e.target.value)} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label className="label" style={{ color: 'var(--accent)' }}><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />Pista habitual</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <input className="input" placeholder="Nombre del club (ej: Club Natación)" value={clubName} onChange={e => setClubName(e.target.value)} required />
                  <input className="input" placeholder="Pista preferida (ej: Pista 3)" value={preferredLocation} onChange={e => setPreferredLocation(e.target.value)} required />
                </div>
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="loader" /> : '✓ Crear equipo'}
              </button>
            </form>
          </>
        )}

        {step === 'join-team' && (
          <>
            <button onClick={() => setStep('team-choice')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px', marginBottom: 16 }}>← Volver</button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Unirse a equipo</h2>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>Introduce el código de equipo que te ha dado tu compañero</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input className="input" placeholder="CÓDIGO (6 chars)" value={teamCode} onChange={e => setTeamCode(e.target.value.toUpperCase())} style={{ letterSpacing: '0.2em', fontWeight: 700, fontSize: 18, textAlign: 'center' }} maxLength={6} />
              <button onClick={handleLookupCode} className="btn-secondary" disabled={loading} style={{ width: 'auto', minWidth: 80 }}>
                {loading ? <span className="loader" /> : 'Buscar'}
              </button>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: 12 }}>{error}</p>}
            {teamInfo && (
              <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Equipo encontrado</p>
                  <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent)' }}>{teamInfo.name}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Compañero: {teamInfo.player1Name}</p>
                </div>
                <div>
                  <label className="label">Tu nombre completo</label>
                  <input className="input" placeholder="Tu nombre" value={playerName} onChange={e => setPlayerName(e.target.value)} required />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <span className="loader" /> : 'Unirse al equipo'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
