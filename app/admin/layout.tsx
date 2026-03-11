'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (!isAdmin) router.push('/dashboard');
    }
  }, [user, loading, isAdmin, router]);

  if (loading || !isAdmin) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="loader" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="page">
      {children}
      <BottomNav />
    </div>
  );
}
