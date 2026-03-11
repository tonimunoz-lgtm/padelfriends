'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveChampionship, getMatchesByChampionship, getMatchesByTeam, updateMatch, submitMatchResult, getTeam } from '@/lib/firestore';
import { Match, Team } from '@/types';
import { formatDayName, formatDate, toDate } from '@/lib/utils';
import { Calendar, MapPin, Clock, Edit3, CheckCircle, User } from 'lucide-react';

export default function SchedulePage() {
  const { userProfile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [view, setView] = useState<'my' | 'all'>('my');
  const [loading, setLoading] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<Match | null>(null);
  const [locationModal, setLocationModal] = useState<Match | null>(null);
  const [sets, setSets] = useState([{ h: '', a: '' }, { h: '', a: '' }]);
  const [newLocation, setNewLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadData(); }, [userProfile, view]);

  async function loadData() {
    setLoading(true);
    try {
      let ms: Match[] = [];
      if (view === 'my' && userProfile?.teamId) {
        ms = await getMatchesByTeam(userProfile.teamId);
      } else {
        const champ = await getActiveChampionship();
        if (champ) ms = await getMatchesByChampionship(champ.id);
      }
      setMatches(ms);

      // Encontrar el próximo partido sin jugar y expandirlo automáticamente
      const now = new Date();
      const next = ms
        .filter(m => m.status === 'scheduled' && toDate(m.scheduledDate) >= now)
        .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime())[0];

      if (next) {
        setNextMatchId(next.id);
        setExpandedMatch(next.id);
      }

      // Cargar datos de equipos para mostrar jugadores
      const teamIds = new Set<string>();
      ms.forEach(m => { teamIds.add(m.homeTeamId); teamIds.add(m.awayTeamId); });
      const teamData: Record<string, Team> = {};
      await Promise.all([...teamIds].map(async id => {
        const t = await getTeam(id);
        if (t) teamData[id] = t;
      }));
      setTeams(teamData);

    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleSubmitResult() {
    if (!resultModal || !userProfile) return;
    const validSets = sets.filter(s => s.h !== '' && s.a !== '');
    if (validSets.length < 1) return showToast('Introduce al menos un set');
    setSaving(true);
    try {
      const setsData = validSets.map(s => ({ homeGames: parseInt(s.h), awayGames: parseInt(s.a) }));
      const homeScore = setsData.filter(s => s.homeGames > s.awayGames).length;
      const awayScore = setsData.filter(s => s.awayGames > s.homeGames).length;
      await submitMatchResult(
        resultModal.id, homeScore, awayScore, setsData,
        userProfile.uid, resultModal.championshipId,
        resultModal.homeTeamId, resultModal.awayTeamId
      );
      showToast('✓ Resultado guardado');
      setResultModal(null);
      loadData();
    } catch {
      showToast('Error al guardar el resultado');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeLocation() {
    if (!locationModal || !newLocation.trim()) return;
    setSaving(true);
    try {
      await updateMatch(locationModal.id, { locationOverride: newLocation.trim() });
      showToast('✓ Ubicación actualizada');
      setLocationModal(null);
      loadData();
    } catch {
      showToast('Error al cambiar la ubicación');
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const upcoming = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
  const past = matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => toDate(b.scheduledDate).getTime() - toDate(a.scheduledDate).getTime());

  const canSubmitResult = (match: Match) => {
    const isParticipant = match.homeTeamId === userProfile?.teamId || match.awayTeamId === userProfile?.teamId;
    return isParticipant && match.status === 'scheduled';
  };

  const canChangeLocation = (match: Match) => {
    return match.homeTeamId === userProfile?.teamId && match.status === 'scheduled';
  };

  // Sección de jugadores expandida
  function renderPlayers(match: Match) {
    const homeTeam = teams[match.homeTeamId];
    const awayTeam = teams[match.awayTeamId];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {/* Local */}
        <div style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🏠 Local</p>
          {homeTeam ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <User size={11} color="var(--text2)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{homeTeam.player1Name || '—'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={11} color="var(--text2)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {match.substituteTeamId === match.homeTeamId && match.substitutePlayer1Name
                    ? <span style={{ color: 'var(--warning)' }}>⚠️ {match.substitutePlayer1Name} <span style={{ fontSize: 10, color: 'var(--text2)' }}>(sustituto)</span></span>
                    : homeTeam.player2Name || '—'
                  }
                </p>
              </div>
            </>
          ) : <p style={{ fontSize: 12, color: 'var(--text2)' }}>—</p>}
        </div>

        {/* Visitante */}
        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>✈️ Visitante</p>
          {awayTeam ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <User size={11} color="var(--text2)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{awayTeam.player1Name || '—'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={11} color="var(--text2)" />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {match.substituteTeamId === match.awayTeamId && match.substitutePlayer1Name
                    ? <span style={{ color: 'var(--warning)' }}>⚠️ {match.substitutePlayer1Name} <span style={{ fontSize: 10, color: 'var(--text2)' }}>(sustituto)</span></span>
                    : awayTeam.player2Name || '—'
                  }
                </p>
              </div>
            </>
          ) : <p style={{ fontSize: 12, color: 'var(--text2)' }}>—</p>}
        </div>
      </div>
    );
  }

  const renderMatch = (match: Match, isNextMatch = false) => {
    const isHome = match.homeTeamId === userProfile?.teamId;
    const isAway = match.awayTeamId === userProfile?.teamId;
    const isMyMatch = isHome || isAway;
    const location = match.locationOverride || match.location;
    const matchDate = toDate(match.scheduledDate);
    const r = match.result;
    const isExpanded = expandedMatch === match.id;

    return (
      <div key={match.id} style={{ marginBottom: 10 }}>
        {/* Etiqueta "Próximo partido" */}
        {isNextMatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próximo partido</span>
          </div>
        )}

        <div
          className={match.status === 'completed' ? 'card-sm' : 'score-card'}
          style={{
            border: isNextMatch
              ? '1px solid rgba(0,229,160,0.5)'
              : isMyMatch ? '1px solid rgba(0,229,160,0.3)' : '1px solid var(--border)',
            boxShadow: isNextMatch ? '0 0 20px rgba(0,229,160,0.1)' : 'none',
          }}
        >
          {/* Cabecera clickable */}
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', fontFamily: 'Space Mono, monospace' }}>J{match.round}</span>
              {isHome && <span className="badge badge-teal">🏠 Local</span>}
              {isAway && <span className="badge badge-purple">✈️ Visitante</span>}
              <span className={`badge ${match.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                {match.status === 'completed' ? '✓ Finalizado' : 'Programado'}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 12 }}>
                {isExpanded ? '▲' : '▼'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{match.homeTeamName}</p>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 60 }}>
                {r ? (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 800 }}>{r.homeScore}–{r.awayScore}</span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'Space Mono, monospace' }}>{formatDate(matchDate, 'HH:mm')}</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{match.awayTeamName}</p>
              </div>
            </div>
          </div>

          {/* Contenido expandido */}
          {isExpanded && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>

              {/* Jugadores */}
              {renderPlayers(match)}

              {/* Fecha y ubicación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                  <Clock size={14} color="var(--accent)" />
                  <p style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong>{formatDayName(matchDate)}</strong> · {formatDate(matchDate, 'HH:mm')}h
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                  <MapPin size={14} color="var(--accent)" />
                  <p style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{location}</p>
                  {match.locationOverride && (
                    <span className="badge badge-yellow" style={{ fontSize: 9 }}>Modificado</span>
                  )}
                </div>
              </div>

              {/* Sets resultado */}
              {r && r.sets && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginRight: 4 }}>Sets:</p>
                  {r.sets.map((set, si) => (
                    <div key={si} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '4px 10px', fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
                      {set.homeGames}–{set.awayGames}
                    </div>
                  ))}
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: 8 }}>
                {canSubmitResult(match) && (
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '10px 16px' }}
                    onClick={e => { e.stopPropagation(); setResultModal(match); setSets([{ h: '', a: '' }, { h: '', a: '' }]); }}
                  >
                    <CheckCircle size={14} /> Resultado
                  </button>
                )}
                {canChangeLocation(match) && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 13, padding: '10px 16px' }}
                    onClick={e => { e.stopPropagation(); setLocationModal(match); setNewLocation(location); }}
                  >
                    <Edit3 size={14} /> Ubicación
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={20} color="var(--accent)" />Agenda
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['my', 'all'].map(v => (
            <button
              key={v}
              onClick={() => setView(v as 'my' | 'all')}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: view === v ? 'var(--accent)' : 'var(--surface2)', color: view === v ? '#000' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {v === 'my' ? 'Mis partidos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="loader" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Próximos partidos
                </h2>
                {upcoming.map((m, i) =>
                  renderMatch(m, m.id === nextMatchId)
                )}
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Resultados
                </h2>
                {past.map(m => renderMatch(m, false))}
              </div>
            )}
            {matches.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
                <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                <p>No hay partidos programados</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Introducir resultado</h3>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>{resultModal.homeTeamName} vs {resultModal.awayTeamName}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{resultModal.homeTeamName}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Sets</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{resultModal.awayTeamName}</span>
            </div>
            {sets.map((set, si) => (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <input className="input" type="number" min="0" max="7" placeholder="0" value={set.h} onChange={e => { const ns = [...sets]; ns[si] = { ...ns[si], h: e.target.value }; setSets(ns); }} style={{ textAlign: 'center', fontSize: 22, fontFamily: 'Space Mono, monospace', fontWeight: 700 }} />
                <span style={{ color: 'var(--text2)', fontWeight: 700 }}>—</span>
                <input className="input" type="number" min="0" max="7" placeholder="0" value={set.a} onChange={e => { const ns = [...sets]; ns[si] = { ...ns[si], a: e.target.value }; setSets(ns); }} style={{ textAlign: 'center', fontSize: 22, fontFamily: 'Space Mono, monospace', fontWeight: 700 }} />
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>Set {si + 1}</span>
              </div>
            ))}
            {sets.length < 3 && (
              <button onClick={() => setSets([...sets, { h: '', a: '' }])} className="btn-secondary" style={{ marginBottom: 16, fontSize: 13 }}>+ Añadir set</button>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setResultModal(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSubmitResult} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Guardar resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {locationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cambiar ubicación</h3>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Solo para este partido. La próxima jornada se usará la ubicación habitual.</p>
            <label className="label">Nueva ubicación</label>
            <input className="input" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Ej: Club Tenis Norte, Pista 2" style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setLocationModal(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleChangeLocation} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
