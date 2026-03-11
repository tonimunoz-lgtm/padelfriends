'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ width: 40, height: 40 }} />
          <p style={{ color: 'var(--text2)', marginTop: 16, fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="page">
      {children}
      <BottomNav />
    </div>
  );
}
