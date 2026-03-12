'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveChampionship, getMatchesByChampionship, getMatchesByTeam, updateMatch, submitMatchResult, getTeam, createNotification } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Match, Team } from '@/types';
import { formatDayName, formatDate, toDate } from '@/lib/utils';
import { Calendar, MapPin, Clock, Edit3, CheckCircle, User, AlertTriangle, X } from 'lucide-react';

export default function SchedulePage() {
  const { userProfile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [view, setView] = useState<'my' | 'all'>('my');
  const [loading, setLoading] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);

  // Modals
  const [resultModal, setResultModal] = useState<Match | null>(null);
  const [locationModal, setLocationModal] = useState<Match | null>(null);
  const [postponeModal, setPostponeModal] = useState<Match | null>(null);

  const [sets, setSets] = useState([{ h: '', a: '' }, { h: '', a: '' }]);
  const [newLocation, setNewLocation] = useState('');
  const [postponeType, setPostponeType] = useState<'no-date' | 'reschedule'>('no-date');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'ok' | 'warn'>('ok');

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

      const now = new Date();
      const next = ms
        .filter(m => m.status === 'scheduled' && toDate(m.scheduledDate) >= now)
        .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime())[0];
      if (next) { setNextMatchId(next.id); setExpandedMatch(next.id); }

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

  function showToast(msg: string, type: 'ok' | 'warn' = 'ok') {
    setToastType(type);
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

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
    } catch { showToast('Error al guardar el resultado'); }
    finally { setSaving(false); }
  }

  async function handleChangeLocation() {
    if (!locationModal || !newLocation.trim()) return;
    setSaving(true);
    try {
      await updateMatch(locationModal.id, { locationOverride: newLocation.trim() });
      showToast('✓ Ubicación actualizada');
      setLocationModal(null);
      loadData();
    } catch { showToast('Error al cambiar la ubicación'); }
    finally { setSaving(false); }
  }

  async function handlePostpone() {
    if (!postponeModal || !userProfile) return;
    setSaving(true);
    try {
      // Calcular nueva fecha si se reprograma
      let newScheduledDate = null;
      if (postponeType === 'reschedule') {
        if (!newDate || !newTime) return showToast('Indica la nueva fecha y hora');
        newScheduledDate = new Date(`${newDate}T${newTime}`);
      }

      // Actualizar partido
      const updateData: any = { status: postponeType === 'reschedule' ? 'scheduled' : 'postponed' };
      if (newScheduledDate) updateData.scheduledDate = newScheduledDate;
      await updateMatch(postponeModal.id, updateData);

      // Notificar a los jugadores del equipo rival
      const opponentTeamId = postponeModal.homeTeamId === userProfile.teamId
        ? postponeModal.awayTeamId : postponeModal.homeTeamId;
      const opponentTeam = teams[opponentTeamId];

      if (opponentTeam) {
        // Buscar usuarios del equipo rival y notificarles
        const emails = [opponentTeam.player1Email, opponentTeam.player2Email].filter(Boolean);
        for (const email of emails) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
          if (!userSnap.empty) {
            await createNotification({
              userId: userSnap.docs[0].id,
              type: 'general',
              title: '⚠️ Partido aplazado',
              message: postponeType === 'reschedule' && newScheduledDate
                ? `El partido ${postponeModal.homeTeamName} vs ${postponeModal.awayTeamName} ha sido aplazado al ${formatDate(newScheduledDate, 'dd/MM/yyyy')} a las ${formatDate(newScheduledDate, 'HH:mm')}h`
                : `El partido ${postponeModal.homeTeamName} vs ${postponeModal.awayTeamName} ha sido aplazado sin nueva fecha`,
              matchId: postponeModal.id,
            });
          }
        }

        // Intentar enviar email via API (si está configurado Resend)
        try {
          await fetch('/api/notify-postpone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: postponeModal.id,
              homeTeam: postponeModal.homeTeamName,
              awayTeam: postponeModal.awayTeamName,
              opponentTeam,
              postponeType,
              newDate: newScheduledDate?.toISOString(),
            }),
          });
        } catch { /* Email es opcional, no bloqueante */ }
      }

      setPostponeModal(null);
      showToast(
        postponeType === 'reschedule'
          ? '✓ Partido reprogramado. Rivales notificados.'
          : '✓ Partido aplazado. Rivales notificados.',
        'ok'
      );
      loadData();
    } catch (e) {
      showToast('Error al aplazar el partido');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const upcoming = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
  const postponed = matches.filter(m => m.status === 'postponed');
  const past = matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => toDate(b.scheduledDate).getTime() - toDate(a.scheduledDate).getTime());

  const canSubmitResult = (m: Match) =>
    (m.homeTeamId === userProfile?.teamId || m.awayTeamId === userProfile?.teamId) && m.status === 'scheduled';

  const canChangeLocation = (m: Match) =>
    m.homeTeamId === userProfile?.teamId && m.status === 'scheduled';

  const canPostpone = (m: Match) =>
    (m.homeTeamId === userProfile?.teamId || m.awayTeamId === userProfile?.teamId) && m.status === 'scheduled';

  const canReschedule = (m: Match) =>
    (m.homeTeamId === userProfile?.teamId || m.awayTeamId === userProfile?.teamId) && m.status === 'postponed';

  function renderPlayers(match: Match) {
    const homeTeam = teams[match.homeTeamId];
    const awayTeam = teams[match.awayTeamId];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🏠 Local</p>
          {homeTeam ? (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <User size={11} color="var(--text2)" />
              <p style={{ fontSize: 13, fontWeight: 600 }}>{homeTeam.player1Name || '—'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={11} color="var(--text2)" />
              <p style={{ fontSize: 13, fontWeight: 600 }}>
                {match.substituteTeamId === match.homeTeamId && match.substitutePlayer1Name
                  ? <span style={{ color: 'var(--warning)' }}>⚠️ {match.substitutePlayer1Name} <span style={{ fontSize: 10, color: 'var(--text2)' }}>(sust.)</span></span>
                  : homeTeam.player2Name || '—'}
              </p>
            </div>
          </>) : <p style={{ fontSize: 12, color: 'var(--text2)' }}>—</p>}
        </div>
        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>✈️ Visitante</p>
          {awayTeam ? (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <User size={11} color="var(--text2)" />
              <p style={{ fontSize: 13, fontWeight: 600 }}>{awayTeam.player1Name || '—'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={11} color="var(--text2)" />
              <p style={{ fontSize: 13, fontWeight: 600 }}>
                {match.substituteTeamId === match.awayTeamId && match.substitutePlayer1Name
                  ? <span style={{ color: 'var(--warning)' }}>⚠️ {match.substitutePlayer1Name} <span style={{ fontSize: 10, color: 'var(--text2)' }}>(sust.)</span></span>
                  : awayTeam.player2Name || '—'}
              </p>
            </div>
          </>) : <p style={{ fontSize: 12, color: 'var(--text2)' }}>—</p>}
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
    const isPostponed = match.status === 'postponed';

    return (
      <div key={match.id} style={{ marginBottom: 10 }}>
        {isNextMatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próximo partido</span>
          </div>
        )}
        <div
          className={match.status === 'completed' ? 'card-sm' : 'score-card'}
          style={{
            border: isNextMatch ? '1px solid rgba(0,229,160,0.5)'
              : isPostponed ? '1px solid rgba(245,158,11,0.4)'
              : isMyMatch ? '1px solid rgba(0,229,160,0.3)' : '1px solid var(--border)',
            boxShadow: isNextMatch ? '0 0 20px rgba(0,229,160,0.1)' : 'none',
          }}
        >
          {/* Cabecera clickable */}
          <div style={{ cursor: 'pointer' }} onClick={() => setExpandedMatch(isExpanded ? null : match.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', fontFamily: 'Space Mono, monospace' }}>J{match.round}</span>
              {isHome && <span className="badge badge-teal">🏠 Local</span>}
              {isAway && <span className="badge badge-purple">✈️ Visitante</span>}
              <span className={`badge ${match.status === 'completed' ? 'badge-green' : isPostponed ? 'badge-yellow' : 'badge-yellow'}`}>
                {match.status === 'completed' ? '✓ Finalizado' : isPostponed ? '⏸ Aplazado' : 'Programado'}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{match.homeTeamName}</p>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 60 }}>
                {r ? (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 800 }}>{r.homeScore}–{r.awayScore}</span>
                ) : isPostponed ? (
                  <span style={{ fontSize: 18 }}>⏸</span>
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
              {renderPlayers(match)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {!isPostponed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                    <Clock size={14} color="var(--accent)" />
                    <p style={{ fontSize: 13 }}><strong>{formatDayName(matchDate)}</strong> · {formatDate(matchDate, 'HH:mm')}h</p>
                  </div>
                )}
                {isPostponed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <AlertTriangle size={14} color="var(--warning)" />
                    <p style={{ fontSize: 13, color: 'var(--warning)' }}>Partido aplazado — pendiente de nueva fecha</p>
                  </div>
                )}
                {!isPostponed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                    <MapPin size={14} color="var(--accent)" />
                    <p style={{ fontSize: 13, flex: 1 }}>{location}</p>
                    {match.locationOverride && <span className="badge badge-yellow" style={{ fontSize: 9 }}>Modificado</span>}
                  </div>
                )}
              </div>

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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canSubmitResult(match) && (
                  <button className="btn-primary" style={{ fontSize: 13, padding: '10px 16px', flex: 1 }}
                    onClick={e => { e.stopPropagation(); setResultModal(match); setSets([{ h: '', a: '' }, { h: '', a: '' }]); }}>
                    <CheckCircle size={14} /> Resultado
                  </button>
                )}
                {canChangeLocation(match) && (
                  <button className="btn-secondary" style={{ fontSize: 13, padding: '10px 16px', flex: 1 }}
                    onClick={e => { e.stopPropagation(); setLocationModal(match); setNewLocation(location); }}>
                    <Edit3 size={14} /> Ubicación
                  </button>
                )}
                {canReschedule(match) && (
                  <button
                    onClick={e => { e.stopPropagation(); setPostponeModal(match); setPostponeType('reschedule'); setNewDate(''); setNewTime(''); }}
                    style={{ fontSize: 13, padding: '10px 16px', flex: 1, background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 12, cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                  >
                    <Calendar size={14} /> Reprogramar
                  </button>
                )}
                {canPostpone(match) && (
                  <button
                    onClick={e => { e.stopPropagation(); setPostponeModal(match); setPostponeType('no-date'); setNewDate(''); setNewTime(''); }}
                    style={{ fontSize: 13, padding: '10px 16px', flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, cursor: 'pointer', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                  >
                    <AlertTriangle size={14} /> Aplazar
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
            <button key={v} onClick={() => setView(v as 'my' | 'all')}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: view === v ? 'var(--accent)' : 'var(--surface2)', color: view === v ? '#000' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {v === 'my' ? 'Mis partidos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" style={{ width: 36, height: 36 }} /></div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Próximos partidos</h2>
                {upcoming.map(m => renderMatch(m, m.id === nextMatchId))}
              </div>
            )}
            {postponed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>⏸ Aplazados</h2>
                {postponed.map(m => renderMatch(m, false))}
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Resultados</h2>
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

      {/* ===== MODAL RESULTADO ===== */}
      {resultModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Introducir resultado</h3>
              <button onClick={() => setResultModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
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

      {/* ===== MODAL UBICACIÓN ===== */}
      {locationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Cambiar ubicación</h3>
              <button onClick={() => setLocationModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
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

      {/* ===== MODAL APLAZAR ===== */}
      {postponeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Aplazar partido</h3>
              <button onClick={() => setPostponeModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
              {postponeModal.homeTeamName} vs {postponeModal.awayTeamName}
            </p>

            {/* Aviso importante */}
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12 }}>
              <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--warning)', marginBottom: 4 }}>Recuerda avisar a tus rivales</p>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Al confirmar, se enviará una notificación automática a los jugadores del equipo rival. Asegúrate también de contactarles directamente si es posible.
                </p>
              </div>
            </div>

            {/* Opciones */}
            <label className="label" style={{ marginBottom: 10 }}>¿Qué quieres hacer?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div
                onClick={() => setPostponeType('no-date')}
                style={{ padding: '14px 16px', background: postponeType === 'no-date' ? 'rgba(245,158,11,0.1)' : 'var(--surface2)', border: `1px solid ${postponeType === 'no-date' ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${postponeType === 'no-date' ? 'var(--warning)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {postponeType === 'no-date' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>Aplazar sin nueva fecha</p>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>El partido queda pendiente de reprogramar</p>
                </div>
              </div>

              <div
                onClick={() => setPostponeType('reschedule')}
                style={{ padding: '14px 16px', background: postponeType === 'reschedule' ? 'rgba(0,229,160,0.08)' : 'var(--surface2)', border: `1px solid ${postponeType === 'reschedule' ? 'rgba(0,229,160,0.3)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${postponeType === 'reschedule' ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {postponeType === 'reschedule' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>Reprogramar con nueva fecha</p>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Elige ya la nueva fecha y hora</p>
                </div>
              </div>
            </div>

            {/* Nueva fecha si reprogramar */}
            {postponeType === 'reschedule' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div>
                  <label className="label">Nueva fecha</label>
                  <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Nueva hora</label>
                  <input className="input" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPostponeModal(null)}>Cancelar</button>
              <button
                onClick={handlePostpone}
                disabled={saving || (postponeType === 'reschedule' && (!newDate || !newTime))}
                style={{ flex: 2, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 12, padding: '14px', cursor: 'pointer', color: 'var(--warning)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <span className="loader" /> : <><AlertTriangle size={15} /> {postponeType === 'reschedule' ? 'Reprogramar y notificar' : 'Aplazar y notificar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-msg" style={{ borderColor: toastType === 'warn' ? 'rgba(245,158,11,0.4)' : 'var(--border)', color: toastType === 'warn' ? 'var(--warning)' : 'var(--text)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
