'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveChampionship, getStandings, getTeam } from '@/lib/firestore';
import { Standings, Team, Championship } from '@/types';
import { Trophy, User, X, MapPin } from 'lucide-react';

export default function StandingsPage() {
  const { userProfile } = useAuth();
  const [standings, setStandings] = useState<Standings[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [champ, setChamp] = useState<Championship | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const c = await getActiveChampionship();
      if (!c) return;
      setChamp(c);
      const s = await getStandings(c.id);
      setStandings(s);

      // Load all team details for player names
      const teamData: Record<string, Team> = {};
      await Promise.all(s.map(async st => {
        const t = await getTeam(st.teamId);
        if (t) teamData[st.teamId] = t;
      }));
      setTeams(teamData);
    } finally {
      setLoading(false);
    }
  }

  const selectedTeam = selectedTeamId ? teams[selectedTeamId] : null;
  const selectedStanding = selectedTeamId ? standings.find(s => s.teamId === selectedTeamId) : null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="loader" style={{ width: 36, height: 36 }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} color="var(--accent3)" />Clasificación
        </h1>
        {champ && <span className="badge badge-teal">{champ.name}</span>}
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
            const isSelected = s.teamId === selectedTeamId;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div
                key={s.teamId}
                onClick={() => setSelectedTeamId(isSelected ? null : s.teamId)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 36px 36px 36px 36px 44px',
                  gap: 4,
                  padding: '14px 12px',
                  borderBottom: i < standings.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isSelected ? 'rgba(124,58,237,0.08)' : isMe ? 'rgba(0,229,160,0.07)' : 'transparent',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderLeft: isSelected ? '3px solid var(--accent2)' : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 15, textAlign: 'center' }}>{medal || <span style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 13 }}>{s.position}</span>}</div>
                <div>
                  <p style={{ fontWeight: isMe ? 700 : 500, fontSize: 14, color: isSelected ? 'var(--accent2)' : isMe ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>{s.teamName}</p>
                  <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                    {s.form.slice(-5).map((f, fi) => (
                      <span key={fi} className={`form-${f}`}>{f}</span>
                    ))}
                  </div>
                </div>
                {[s.matchesPlayed, s.wins, s.draws, s.losses].map((v, vi) => (
                  <div key={vi} style={{ textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>{v}</div>
                ))}
                <div style={{ textAlign: 'center', fontFamily: 'Space Mono, monospace', fontSize: 17, fontWeight: 800, color: isSelected ? 'var(--accent2)' : isMe ? 'var(--accent)' : 'var(--text)' }}>{s.points}</div>
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
            { color: 'var(--success)', label: `Victoria · ${champ?.pointsWin ?? 4} pts` },
            { color: 'var(--warning)', label: `Empate · ${champ?.pointsDraw ?? 2} pts` },
            { color: 'var(--danger)', label: `Derrota · ${champ?.pointsLoss ?? 1} pt` },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Team detail modal */}
      {selectedTeam && selectedStanding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelectedTeamId(null)}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '70vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>
                    {selectedStanding.position === 1 ? '🥇' : selectedStanding.position === 2 ? '🥈' : selectedStanding.position === 3 ? '🥉' : `${selectedStanding.position}º`}
                  </span>
                  <h3 style={{ fontSize: 20, fontWeight: 800 }}>{selectedTeam.name}</h3>
                  {selectedTeam.id === userProfile?.teamId && (
                    <span className="badge badge-teal" style={{ fontSize: 10 }}>Mi equipo</span>
                  )}
                </div>
                {selectedTeam.clubName && (
                  <p style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} /> {selectedTeam.clubName}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedTeamId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Players */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>🎾 Jugadores</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: selectedTeam.player1Name, email: selectedTeam.player1Email },
                  { name: selectedTeam.player2Name, email: selectedTeam.player2Email },
                ].filter(p => p.name).map((player, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: i === 0 ? 'rgba(0,229,160,0.15)' : 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={18} color={i === 0 ? 'var(--accent)' : 'var(--accent2)'} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{player.name}</p>
                      {player.email && <p style={{ fontSize: 12, color: 'var(--text2)' }}>{player.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📊 Estadísticas</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Puntos', value: selectedStanding.points, color: 'var(--accent)' },
                { label: 'Victorias', value: selectedStanding.wins, color: 'var(--success)' },
                { label: 'Empates', value: selectedStanding.draws, color: 'var(--warning)' },
                { label: 'Derrotas', value: selectedStanding.losses, color: 'var(--danger)' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: 'Space Mono, monospace' }}>{stat.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{stat.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Jugados', value: selectedStanding.matchesPlayed },
                { label: 'Sets ganados', value: selectedStanding.setsWon },
                { label: 'Dif. sets', value: selectedStanding.setsDiff > 0 ? `+${selectedStanding.setsDiff}` : selectedStanding.setsDiff },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'Space Mono, monospace' }}>{stat.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
