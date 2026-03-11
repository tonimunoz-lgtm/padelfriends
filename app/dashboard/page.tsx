'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveChampionship, getMatchesByTeam, getTeam, getStandings } from '@/lib/firestore';
import { Championship, Match, Team, Standings } from '@/types';
import { formatDayName, formatDate, toDate } from '@/lib/utils';
import { MapPin, Clock, Trophy, Zap, Target, Activity, User } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standings[]>([]);
  const [opponentTeams, setOpponentTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [userProfile]);

  async function loadData() {
    try {
      const champ = await getActiveChampionship();
      setChampionship(champ);

      if (userProfile?.teamId) {
        const [team, teamMatches] = await Promise.all([
          getTeam(userProfile.teamId),
          getMatchesByTeam(userProfile.teamId),
        ]);
        setMyTeam(team);
        setMatches(teamMatches);

        if (champ) {
          const s = await getStandings(champ.id);
          setStandings(s);
        }

        // Cargar datos de equipos rivales para los próximos partidos
        const now = new Date();
        const upcoming = teamMatches
          .filter(m => toDate(m.scheduledDate) > now && m.status === 'scheduled')
          .slice(0, 3);

        const opponentIds = upcoming.map(m =>
          m.homeTeamId === userProfile.teamId ? m.awayTeamId : m.homeTeamId
        );

        const opponentData: Record<string, Team> = {};
        await Promise.all(opponentIds.map(async id => {
          const t = await getTeam(id);
          if (t) opponentData[id] = t;
        }));
        setOpponentTeams(opponentData);
      }
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const upcomingMatches = matches
    .filter(m => toDate(m.scheduledDate) > now && m.status === 'scheduled')
    .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime())
    .slice(0, 3);

  const recentMatches = matches
    .filter(m => m.status === 'completed')
    .slice(-3)
    .reverse();

  const myStanding = standings.find(s => s.teamId === userProfile?.teamId);
  const myPos = myStanding?.position;
  const totalTeams = standings.length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '20px 16px 0', background: 'var(--bg)' }} className="hero-gradient">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{greeting()},</p>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>{myTeam?.name || userProfile?.email?.split('@')[0]}</h1>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={22} color="#000" />
          </div>
        </div>

        {/* Stats row */}
        {myStanding && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Posición', value: `${myPos}º/${totalTeams}`, color: myPos === 1 ? 'var(--accent3)' : 'var(--accent)' },
              { label: 'Puntos', value: myStanding.points, color: 'var(--accent)' },
              { label: 'V/E/D', value: `${myStanding.wins}/${myStanding.draws}/${myStanding.losses}`, color: 'var(--text)' },
              { label: 'Jugados', value: myStanding.matchesPlayed, color: 'var(--text2)' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {!userProfile?.teamId && !loading && (
          <div style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>👋 Aún no estás en un equipo. Regístrate en uno para participar.</p>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16 }}>

        {/* Próximos partidos */}
        {upcomingMatches.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color="var(--accent)" />Próximos partidos
              </h2>
              <Link href="/dashboard/schedule" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>Ver todos →</Link>
            </div>
            {upcomingMatches.map(match => {
              const isHome = match.homeTeamId === userProfile?.teamId;
              const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
              const opponentTeam = opponentTeams[opponentId];
              const opponent = isHome ? match.awayTeamName : match.homeTeamName;
              const matchDate = toDate(match.scheduledDate);
              const location = match.locationOverride || match.location;

              // Detectar si hay sustituto en el equipo rival
              const hasSubstitute = match.substituteTeamId === opponentId && match.substitutePlayer1Name;

              return (
                <div key={match.id} className="score-card" style={{ marginBottom: 10 }}>
                  {/* Cabecera */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className={`badge ${isHome ? 'badge-teal' : 'badge-purple'}`}>{isHome ? '🏠 Local' : '✈️ Visitante'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Jornada {match.round}</span>
                  </div>

                  {/* Nombre rival */}
                  <p style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>vs {opponent}</p>

                  {/* Jugadores rivales */}
                  {opponentTeam && (
                    <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        🎾 Jugadores/as
                      </p>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={12} color="var(--text2)" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{opponentTeam.player1Name || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={12} color="var(--text2)" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {hasSubstitute
                              ? <span style={{ color: 'var(--warning)' }}>⚠️ {match.substitutePlayer1Name} <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>(sustituto)</span></span>
                              : opponentTeam.player2Name || '—'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fecha y ubicación */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} />{formatDayName(matchDate)} · {formatDate(matchDate, 'HH:mm')}h
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={12} />{location}
                    </p>
                  </div>

                  <Link href="/dashboard/schedule" style={{ display: 'block', marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                    Ver detalles →
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Resultados recientes */}
        {recentMatches.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="var(--accent2)" />Últimos resultados
              </h2>
            </div>
            {recentMatches.map(match => {
              const isHome = match.homeTeamId === userProfile?.teamId;
              const opponent = isHome ? match.awayTeamName : match.homeTeamName;
              const r = match.result;
              if (!r) return null;
              const myScore = isHome ? r.homeScore : r.awayScore;
              const oppScore = isHome ? r.awayScore : r.homeScore;
              const won = myScore > oppScore;
              const drew = myScore === oppScore;
              const resultColor = won ? 'var(--success)' : drew ? 'var(--warning)' : 'var(--danger)';
              const resultLabel = won ? 'V' : drew ? 'E' : 'D';
              return (
                <div key={match.id} className="card-sm" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: resultColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: drew ? '#000' : 'white', flexShrink: 0 }}>
                    {resultLabel}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {opponent}</p>
                    <p style={{ fontSize: 12, color: 'var(--text2)' }}>J{match.round} · {formatDate(match.scheduledDate)}</p>
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 18, fontWeight: 700, color: resultColor }}>
                    {myScore}–{oppScore}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Clasificación mini */}
        {standings.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color="var(--accent3)" />Clasificación
              </h2>
              <Link href="/dashboard/standings" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>Completa →</Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {standings.slice(0, 5).map((s, i) => {
                const isMe = s.teamId === userProfile?.teamId;
                return (
                  <div key={s.teamId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', background: isMe ? 'rgba(0,229,160,0.06)' : 'transparent' }}>
                    <div style={{ width: 24, textAlign: 'center', fontWeight: 800, fontSize: 14, color: i === 0 ? 'var(--accent3)' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text2)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : s.position}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: isMe ? 700 : 500, fontSize: 14, color: isMe ? 'var(--accent)' : 'var(--text)' }}>{s.teamName}</span>
                    </div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text)' }}>{s.points}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No championship */}
        {!championship && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
            <Trophy size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 600, marginBottom: 8 }}>No hay campeonato activo</p>
            <p style={{ fontSize: 13 }}>El administrador activará el campeonato pronto</p>
          </div>
        )}
      </div>
    </div>
  );
}
