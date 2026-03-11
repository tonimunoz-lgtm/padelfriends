'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Calendar, User, Shield, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { getUserNotifications } from '@/lib/firestore';

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin, user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUserNotifications(user.uid).then(notifs => {
      setUnread(notifs.filter(n => !n.read).length);
    });
  }, [user]);

  const items = [
    { href: '/dashboard', icon: Home, label: 'Inicio' },
    { href: '/dashboard/standings', icon: Trophy, label: 'Liga' },
    { href: '/dashboard/schedule', icon: Calendar, label: 'Agenda' },
    { href: '/dashboard/notifications', icon: Bell, label: 'Avisos', badge: unread },
    { href: '/dashboard/profile', icon: User, label: 'Perfil' },
    ...(isAdmin ? [{ href: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav className="bottom-nav">
      {items.map(({ href, icon: Icon, label, badge }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {badge && badge > 0 ? (
                <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--danger)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </div>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
