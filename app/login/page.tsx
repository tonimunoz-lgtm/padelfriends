'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Mail, Lock, Trophy } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      setError('No se pudo enviar el email de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="hero-gradient">
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 40px rgba(0,229,160,0.4)' }}>
          <Trophy size={36} color="#000" strokeWidth={2.5} />
        </div>
        <h1 className="font-display" style={{ fontSize: '2.8rem', color: 'var(--text)', lineHeight: 1 }}>PADEL FRIENDS</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Gestión profesional de campeonatos</p>
      </div>

      {/* Form Card */}
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        {!resetMode ? (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: 'var(--text)' }}>Iniciar sesión</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }} />
                  <input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ paddingLeft: 40 }} />
                </div>
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }} />
                  <input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingLeft: 40, paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '4px' }}>
                {loading ? <span className="loader" /> : 'Entrar'}
              </button>
            </form>
            <button onClick={() => { setResetMode(true); setError(''); }} style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px', width: '100%', textAlign: 'center' }}>
              ¿Olvidaste tu contraseña?
            </button>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>¿No tienes cuenta? <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Regístrate</Link></p>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setResetMode(false); setError(''); setResetSent(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Volver
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Recuperar contraseña</h2>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>Te enviaremos un email para resetear tu contraseña</p>
            {resetSent ? (
              <div style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 12, padding: 16, textAlign: 'center', color: 'var(--accent)' }}>
                ✓ Email enviado. Revisa tu bandeja de entrada.
              </div>
            ) : (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input className="input" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <span className="loader" /> : 'Enviar email'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
