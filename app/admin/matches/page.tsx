'use client';
import { useState, useEffect } from 'react';
import { getActiveChampionship, getMatchesByChampionship, updateMatch, updateChampionship, updateMatchResult } from '@/lib/firestore';
import { Match, Championship } from '@/types';
import { Calendar, ChevronLeft, Edit3, X, Settings, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { formatDatetime, toDate } from '@/lib/utils';

interface EditForm {
  homeTeamName: string;
  awayTeamName: string;
  scheduledDate: string;
  location: string;
  status: Match['status'];
}

interface ResultForm {
  sets: { h: string; a: string }[];
}

// ✅ Fuera del componente — evita re-renders
function EditMatchForm({ data, onChange }: { data: EditForm; onChange: (k: keyof EditForm, v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="label">Equipo Local</label>
        <input className="input" value={data.homeTeamName} onChange={e => onChange('homeTeamName', e.target.value)} />
      </div>
      <div>
        <label className="label">Equipo Visitante</label>
        <input className="input" value={data.awayTeamName} onChange={e => onChange('awayTeamName', e.target.value)} />
      </div>
      <div>
        <label className="label">Fecha y hora</label>
        <input className="input" type="datetime-local" value={data.scheduledDate} onChange={e => onChange('scheduledDate', e.target.value)} />
      </div>
      <div>
        <label className="label">Ubicación</label>
        <input className="input" value={data.location} onChange={e => onChange('location', e.target.value)} />
      </div>
      <div>
        <label className="label">Estado</label>
        <select className="input" value={data.status} onChange={e => onChange('status', e.target.value)}>
          <option value="scheduled">Programado</option>
          <option value="in_progress">En curso</option>
          <option value="completed">Completado</option>
          <option value="postponed">Aplazado</option>
        </select>
      </div>
    </div>
  );
}

const emptyEditForm: EditForm = {
  homeTeamName: '', awayTeamName: '', scheduledDate: '', location: '', status: 'scheduled'
};

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ ...emptyEditForm });
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [resultSets, setResultSets] = useState<{ h: string; a: string }[]>([{ h: '', a: '' }, { h: '', a: '' }]);
  const [showPoints, setShowPoints] = useState(false);
  const [ptsWin, setPtsWin] = useState('4');
  const [ptsDraw, setPtsDraw] = useState('2');
  const [ptsLoss, setPtsLoss] = useState('1');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filterRound, setFilterRound] = useState<number | 'all'>('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const champ = await getActiveChampionship();
    if (champ) {
      setChampionship(champ);
      setPtsWin(String(champ.pointsWin ?? 4));
      setPtsDraw(String(champ.pointsDraw ?? 2));
      setPtsLoss(String(champ.pointsLoss ?? 1));
      const ms = await getMatchesByChampionship(champ.id);
      setMatches(ms);
    }
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function openEdit(match: Match) {
    setEditMatch(match);
    let dateStr = '';
    try { dateStr = toDate(match.scheduledDate).toISOString().slice(0, 16); } catch { dateStr = ''; }
    setEditForm({
      homeTeamName: match.homeTeamName || '',
      awayTeamName: match.awayTeamName || '',
      scheduledDate: dateStr,
      location: match.location || '',
      status: match.status || 'scheduled',
    });
  }

  function openEditResult(match: Match) {
    setResultMatch(match);
    if (match.result?.sets?.length) {
      setResultSets(match.result.sets.map(s => ({ h: String(s.homeGames), a: String(s.awayGames) })));
    } else {
      setResultSets([{ h: '', a: '' }, { h: '', a: '' }]);
    }
  }

  async function handleUpdate() {
    if (!editMatch) return;
    setSaving(true);
    try {
      await updateMatch(editMatch.id, {
        homeTeamName: editForm.homeTeamName,
        awayTeamName: editForm.awayTeamName,
        scheduledDate: editForm.scheduledDate ? new Date(editForm.scheduledDate) as unknown as Date : editMatch.scheduledDate,
        location: editForm.location,
        status: editForm.status,
      });
      showToast('✓ Partido actualizado');
      setEditMatch(null);
      loadData();
    } catch { showToast('Error'); } finally { setSaving(false); }
  }

  async function handleSaveResult() {
    if (!resultMatch) return;
    const validSets = resultSets.filter(s => s.h !== '' && s.a !== '');
    if (validSets.length < 1) return showToast('Introduce al menos un set');
    setSaving(true);
    try {
      const setsData = validSets.map(s => ({ homeGames: parseInt(s.h) || 0, awayGames: parseInt(s.a) || 0 }));
      const homeScore = setsData.filter(s => s.homeGames > s.awayGames).length;
      const awayScore = setsData.filter(s => s.awayGames > s.homeGames).length;
      await updateMatchResult(resultMatch.id, homeScore, awayScore, setsData, 'admin');
      showToast('✓ Resultado actualizado y clasificación recalculada');
      setResultMatch(null);
      loadData();
    } catch (e) {
      console.error(e);
      showToast('Error al actualizar resultado');
    } finally { setSaving(false); }
  }

  async function handleSavePoints() {
    if (!championship) return;
    setSaving(true);
    try {
      await updateChampionship(championship.id, {
        pointsWin: parseInt(ptsWin) || 3,
        pointsDraw: parseInt(ptsDraw) || 1,
        pointsLoss: parseInt(ptsLoss) || 0,
      });
      showToast('✓ Puntuación actualizada. Se aplicará en los próximos partidos.');
      setShowPoints(false);
      loadData();
    } catch { showToast('Error'); } finally { setSaving(false); }
  }

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const filtered = filterRound === 'all' ? matches : matches.filter(m => m.round === filterRound);

  const statusColors: Record<string, string> = {
    scheduled: 'badge-yellow', completed: 'badge-green',
    in_progress: 'badge-teal', postponed: 'badge-red',
  };
  const statusLabels: Record<string, string> = {
    scheduled: 'Programado', completed: 'Finalizado',
    in_progress: 'En curso', postponed: 'Aplazado',
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={20} color="#06b6d4" /> Partidos
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowPoints(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Settings size={14} /> Puntos
          </button>
          <span className="badge badge-gray">{matches.length} partidos</span>
        </div>
      </div>

      {/* Points summary */}
      {championship && (
        <div style={{ margin: '0 16px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Puntos actuales:</span>
          <span style={{ fontSize: 12 }}>🏆 Victoria = <strong style={{ color: 'var(--accent)' }}>{championship.pointsWin ?? 4}</strong></span>
          <span style={{ fontSize: 12 }}>🤝 Empate = <strong style={{ color: 'var(--warning)' }}>{championship.pointsDraw ?? 2}</strong></span>
          <span style={{ fontSize: 12 }}>❌ Derrota = <strong style={{ color: 'var(--text2)' }}>{championship.pointsLoss ?? 1}</strong></span>
        </div>
      )}

      <div style={{ padding: '16px' }}>
        {rounds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
            <button onClick={() => setFilterRound('all')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: filterRound === 'all' ? 'var(--accent)' : 'var(--surface2)', color: filterRound === 'all' ? '#000' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Todas
            </button>
            {rounds.map(r => (
              <button key={r} onClick={() => setFilterRound(r)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: filterRound === r ? 'var(--accent)' : 'var(--surface2)', color: filterRound === r ? '#000' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                J{r}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" style={{ width: 36, height: 36 }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(match => (
              <div key={match.id} className="card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', fontFamily: 'Space Mono, monospace' }}>J{match.round}</span>
                      <span className={`badge ${statusColors[match.status]}`}>{statusLabels[match.status]}</span>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{match.homeTeamName} vs {match.awayTeamName}</p>
                    {match.result && (
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                        {match.result.homeScore}–{match.result.awayScore}
                        {match.result.sets?.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 8 }}>
                            ({match.result.sets.map(s => `${s.homeGames}-${s.awayGames}`).join(', ')})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {match.status === 'completed' && (
                      <button onClick={() => openEditResult(match)} title="Editar resultado" style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--accent)' }}>
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => openEdit(match)} title="Editar partido" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text2)' }}>
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  📅 {formatDatetime(match.scheduledDate)} · 📍 {match.locationOverride || match.location}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
                <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                <p>No hay partidos{filterRound !== 'all' ? ` en la jornada ${filterRound}` : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit match modal */}
      {editMatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Editar partido J{editMatch.round}</h3>
              <button onClick={() => setEditMatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <EditMatchForm data={editForm} onChange={(k, v) => setEditForm(prev => ({ ...prev, [k]: v }))} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditMatch(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleUpdate} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit result modal */}
      {resultMatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Editar resultado</h3>
              <button onClick={() => setResultMatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 6 }}>{resultMatch.homeTeamName} vs {resultMatch.awayTeamName}</p>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--warning)' }}>
              ⚠️ Al guardar, la clasificación se recalculará automáticamente.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{resultMatch.homeTeamName}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Sets</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{resultMatch.awayTeamName}</span>
            </div>
            {resultSets.map((set, si) => (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <input className="input" type="number" min="0" max="99" placeholder="0" value={set.h}
                  onChange={e => { const ns = [...resultSets]; ns[si] = { ...ns[si], h: e.target.value }; setResultSets(ns); }}
                  style={{ textAlign: 'center', fontSize: 22, fontFamily: 'Space Mono, monospace', fontWeight: 700 }} />
                <span style={{ color: 'var(--text2)', fontWeight: 700 }}>—</span>
                <input className="input" type="number" min="0" max="99" placeholder="0" value={set.a}
                  onChange={e => { const ns = [...resultSets]; ns[si] = { ...ns[si], a: e.target.value }; setResultSets(ns); }}
                  style={{ textAlign: 'center', fontSize: 22, fontFamily: 'Space Mono, monospace', fontWeight: 700 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>Set {si + 1}</span>
                  {resultSets.length > 1 && (
                    <button onClick={() => setResultSets(resultSets.filter((_, i) => i !== si))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 10, padding: 0 }}>✕</button>
                  )}
                </div>
              </div>
            ))}
            {resultSets.length < 5 && (
              <button onClick={() => setResultSets([...resultSets, { h: '', a: '' }])} className="btn-secondary" style={{ marginBottom: 16, fontSize: 13 }}>+ Añadir set</button>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setResultMatch(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveResult} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Guardar resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Points config modal */}
      {showPoints && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Configurar puntos</h3>
              <button onClick={() => setShowPoints(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
              Cambia el sistema de puntuación. Solo afecta a los partidos que se jueguen a partir de ahora.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <label className="label" style={{ textAlign: 'center', display: 'block' }}>🏆 Victoria</label>
                <input className="input" type="number" min="0" max="99" value={ptsWin} onChange={e => setPtsWin(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 28, fontFamily: 'Space Mono, monospace', fontWeight: 800, color: 'var(--accent)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <label className="label" style={{ textAlign: 'center', display: 'block' }}>🤝 Empate</label>
                <input className="input" type="number" min="0" max="99" value={ptsDraw} onChange={e => setPtsDraw(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 28, fontFamily: 'Space Mono, monospace', fontWeight: 800, color: 'var(--warning)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <label className="label" style={{ textAlign: 'center', display: 'block' }}>❌ Derrota</label>
                <input className="input" type="number" min="0" max="99" value={ptsLoss} onChange={e => setPtsLoss(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 28, fontFamily: 'Space Mono, monospace', fontWeight: 800, color: 'var(--text2)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPoints(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSavePoints} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Guardar puntuación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
