'use client';
import Link from 'next/link';
import { Shield, Users, Trophy, Calendar, BarChart2, Bell, Settings, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllTeams, getChampionships, getActiveChampionship } from '@/lib/firestore';

export default function AdminPage() {
  const [stats, setStats] = useState({ teams: 0, championships: 0, active: false });

  useEffect(() => {
    Promise.all([getAllTeams(), getChampionships(), getActiveChampionship()]).then(([teams, champs, active]) => {
      setStats({ teams: teams.length, championships: champs.length, active: !!active });
    });
  }, []);

  const sections = [
    { href: '/admin/users', icon: Users, label: 'Usuarios', desc: 'Gestionar cuentas, roles y accesos', color: 'var(--accent)' },
    { href: '/admin/teams', icon: Shield, label: 'Equipos', desc: 'Crear, editar y gestionar equipos', color: 'var(--accent2)' },
    { href: '/admin/championships', icon: Trophy, label: 'Campeonatos', desc: 'Crear ligas y generar emparejamientos', color: 'var(--accent3)' },
    { href: '/admin/matches', icon: Calendar, label: 'Partidos', desc: 'Programar, editar y gestionar partidos', color: '#06b6d4' },
    { href: '/admin/notifications', icon: Bell, label: 'Notificaciones', desc: 'Enviar avisos y recordatorios', color: '#ec4899' },
  ];

  return (
    <div>
      <div className="page-header" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), transparent)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} color="var(--accent2)" /> Panel Admin
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Padel Friends — Control total</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Equipos', value: stats.teams, color: 'var(--accent)' },
            { label: 'Campeonatos', value: stats.championships, color: 'var(--accent2)' },
            { label: 'Estado', value: stats.active ? 'Activo' : 'Sin liga', color: stats.active ? 'var(--success)' : 'var(--text2)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Navigation sections */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sections.map((section, i) => (
            <Link
              key={section.href}
              href={section.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '18px 16px',
                borderBottom: i < sections.length - 1 ? '1px solid var(--border)' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${section.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <section.icon size={20} color={section.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{section.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{section.desc}</p>
              </div>
              <ChevronRight size={16} color="var(--text2)" />
            </Link>
          ))}
        </div>

        {/* Quick tip */}
        <div style={{ marginTop: 20, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            💡 <strong style={{ color: 'var(--text)' }}>Flujo recomendado:</strong> Crear equipos → Crear campeonato → Añadir equipos → Generar emparejamientos → Activar campeonato
          </p>
        </div>
      </div>
    </div>
  );
}
