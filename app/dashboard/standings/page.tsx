'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveChampionship, getStandings, getMatchesByChampionship } from '@/lib/firestore';
import { Standings, Match } from '@/types';
import { Trophy } from 'lucide-react';

export default function StandingsPage() {
  const { userProfile } = useAuth();
  const [standings, setStandings] = useState<Standings[]>([]);
  const [champName, setChampName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const champ = await getActiveChampionship();
      if (!champ) return;
      setChampName(champ.name);
      const s = await getStandings(champ.id);
      setStandings(s);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="loader" style={{ width: 36, height: 36 }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} color="var(--accent3)" />
          Clasificación
        </h1>
        {champName && <span className="badge badge-teal">{champName}</span>}
      </div>

      <div style={{ padding: '16px' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 36px 36px 36px 36px 44px', gap: 4, padding: '8px 12px', marginBottom: 4 }}>
          {['#', 'Equipo', 'PJ', 'V', 'E', 'D', 'Pts'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textAlign: h === 'Equipo' ? 'left' : 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {standings.map((s, i) => {
            const isMe = s.teamId === userProfile?.teamId;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div
                key={s.teamId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 36px 36px 36px 36px 44px',
                  gap: 4,
                  padding: '14px 12px',
                  borderBottom: i < standings.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isMe ? 'rgba(0,229,160,0.07)' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 15, textAlign: 'center' }}>{medal || <span style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 13 }}>{s.position}</span>}</div>
                <div>
                  <p style={{ fontWeight: isMe ? 700 : 500, fontSize: 14, color: isMe ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>{s.teamName}</p>
                  <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                    {s.form.slice(-5).map((f, fi) => (
                      <span key={fi} className={`form-${f}`}>{f}</span>
                    ))}
                  </div>
                </div>
                {[s.matchesPlayed, s.wins, s.draws, s.losses].map((v, vi) => (
                  <div key={vi} style={{ textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>{v}</div>
                ))}
                <div style={{ textAlign: 'center', fontFamily: 'Space Mono, monospace', fontSize: 17, fontWeight: 800, color: isMe ? 'var(--accent)' : 'var(--text)' }}>{s.points}</div>
              </div>
            );
          })}
        </div>

        {standings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
            <Trophy size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
            <p>Aún no hay clasificación disponible</p>
          </div>
        )}

        {/* Legend */}
        <div className="card-sm" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
          {[
            { color: 'var(--success)', label: 'Victoria · 4 pts' },
            { color: 'var(--warning)', label: 'Empate · 2 pts' },
            { color: 'var(--danger)', label: 'Derrota · 1 pt' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
