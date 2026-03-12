'use client';
import { useState, useEffect } from 'react';
import { getAllTeams, getChampionships, createChampionship, updateChampionship, generateRoundRobin, createMatch, deleteMatchesByChampionship, resetTeamStats } from '@/lib/firestore';
import { Team, Championship } from '@/types';
import { Trophy, ChevronLeft, Plus, Play, CheckCircle, X, Zap, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

interface ChampForm {
  name: string;
  season: string;
  startDate: string;
  description: string;
}

// ✅ Fuera del componente para evitar re-renders
function ChampFormFields({ data, onChange }: { data: ChampForm; onChange: (k: keyof ChampForm, v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="label">Nombre</label>
        <input className="input" value={data.name} onChange={e => onChange('name', e.target.value)} placeholder="Liga Primavera 2025" />
      </div>
      <div>
        <label className="label">Temporada</label>
        <input className="input" value={data.season} onChange={e => onChange('season', e.target.value)} placeholder="2025" />
      </div>
      <div>
        <label className="label">Fecha de inicio</label>
        <input className="input" type="date" value={data.startDate} onChange={e => onChange('startDate', e.target.value)} />
      </div>
      <div>
        <label className="label">Descripción (opcional)</label>
        <textarea className="input" value={data.description} onChange={e => onChange('description', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
      </div>
    </div>
  );
}

const emptyChampForm: ChampForm = { name: '', season: '', startDate: '', description: '' };

export default function AdminChampionshipsPage() {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedChamp, setSelectedChamp] = useState<Championship | null>(null);
  const [resetChamp, setResetChamp] = useState<Championship | null>(null);
  const [resetStep, setResetStep] = useState<'info' | 'teams' | 'confirm'>('info');
  const [form, setForm] = useState<ChampForm>({ ...emptyChampForm });
  const [resetForm, setResetForm] = useState<ChampForm>({ ...emptyChampForm });
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [matchDay, setMatchDay] = useState(6);
  const [matchTime, setMatchTime] = useState('10:00');

  useEffect(() => {
    Promise.all([getChampionships(), getAllTeams()]).then(([champs, ts]) => {
      setChampionships(champs);
      setTeams(ts);
      setLoading(false);
    });
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  async function handleCreate() {
    if (!form.name || !form.season) return showToast('Nombre y temporada son obligatorios');
    try {
      await createChampionship({
        name: form.name, season: form.season,
        startDate: form.startDate ? new Date(form.startDate) as unknown as Date : new Date() as unknown as Date,
        status: 'draft', teamIds: [], currentRound: 0, totalRounds: 0,
        description: form.description, pointsWin: 4, pointsDraw: 2, pointsLoss: 1,
      });
      showToast('✓ Campeonato creado');
      setShowCreate(false);
      setForm({ ...emptyChampForm });
      setChampionships(await getChampionships());
    } catch { showToast('Error al crear'); }
  }

  function openReset(champ: Championship) {
    setResetChamp(champ);
    setResetForm({
      name: champ.name,
      season: champ.season,
      startDate: '',
      description: champ.description || '',
    });
    setSelectedTeams(champ.teamIds || []);
    setResetStep('info');
  }

  async function handleReset() {
    if (!resetChamp) return;
    if (selectedTeams.length < 2) return showToast('Selecciona al menos 2 equipos');
    setGenerating(true);
    try {
      // 1. Borrar todos los partidos del campeonato
      const deleted = await deleteMatchesByChampionship(resetChamp.id);

      // 2. Resetear stats de TODOS los equipos que participaban (los anteriores + los nuevos)
      const allInvolvedTeams = [...new Set([...(resetChamp.teamIds || []), ...selectedTeams])];
      await resetTeamStats(allInvolvedTeams);

      // 3. Actualizar datos del campeonato
      await updateChampionship(resetChamp.id, {
        name: resetForm.name,
        season: resetForm.season,
        startDate: resetForm.startDate ? new Date(resetForm.startDate) as unknown as Date : resetChamp.startDate,
        description: resetForm.description,
        status: 'draft',
        teamIds: selectedTeams,
        currentRound: 0,
        totalRounds: 0,
      });

      // 4. Regenerar emparejamientos con equipos actualizados (nombres frescos)
      const freshTeams = await getAllTeams();
      const champTeams = freshTeams.filter(t => selectedTeams.includes(t.id));
      const pairings = generateRoundRobin(champTeams);

      const startDate = resetForm.startDate
        ? new Date(resetForm.startDate)
        : (resetChamp.startDate instanceof Timestamp ? resetChamp.startDate.toDate() : new Date(resetChamp.startDate || Date.now()));

      for (const pairing of pairings) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + (pairing.round - 1) * 7);
        const currentDay = matchDate.getDay();
        const diff = (matchDay - currentDay + 7) % 7;
        matchDate.setDate(matchDate.getDate() + diff);
        const [h, m] = matchTime.split(':');
        matchDate.setHours(parseInt(h), parseInt(m), 0, 0);

        const homeTeam = champTeams.find(t => t.id === pairing.homeTeamId);
        const awayTeam = champTeams.find(t => t.id === pairing.awayTeamId);
        if (!homeTeam || !awayTeam) continue;

        await createMatch({
          championshipId: resetChamp.id,
          round: pairing.round,
          homeTeamId: homeTeam.id,
          homeTeamName: homeTeam.name,
          awayTeamId: awayTeam.id,
          awayTeamName: awayTeam.name,
          scheduledDate: matchDate as unknown as Date,
          location: `${homeTeam.clubName || 'Por confirmar'}, ${homeTeam.preferredLocation || 'Pista 1'}`,
          status: 'scheduled',
          reminderSent: false,
        });
      }

      await updateChampionship(resetChamp.id, {
        teamIds: selectedTeams,
        totalRounds: Math.max(...pairings.map(p => p.round)),
        status: 'active',
      });

      showToast(`✓ Campeonato reiniciado. ${deleted} partidos anteriores eliminados. ${pairings.length} nuevos generados.`);
      setResetChamp(null);
      setTeams(freshTeams);
      setChampionships(await getChampionships());
    } catch (e) {
      showToast('Error al reiniciar campeonato');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGeneratePairings(champ: Championship) {
    if (selectedTeams.length < 2) return showToast('Selecciona al menos 2 equipos');
    if (!confirm(`Generar emparejamientos para ${selectedTeams.length} equipos. ¿Continuar?`)) return;
    setGenerating(true);
    try {
      const champTeams = teams.filter(t => selectedTeams.includes(t.id));
      const pairings = generateRoundRobin(champTeams);
      const startDate = champ.startDate instanceof Timestamp
        ? champ.startDate.toDate()
        : new Date(champ.startDate || Date.now());

      for (const pairing of pairings) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + (pairing.round - 1) * 7);
        const currentDay = matchDate.getDay();
        const diff = (matchDay - currentDay + 7) % 7;
        matchDate.setDate(matchDate.getDate() + diff);
        const [h, m] = matchTime.split(':');
        matchDate.setHours(parseInt(h), parseInt(m), 0, 0);

        const homeTeam = champTeams.find(t => t.id === pairing.homeTeamId);
        const awayTeam = champTeams.find(t => t.id === pairing.awayTeamId);
        if (!homeTeam || !awayTeam) continue;

        await createMatch({
          championshipId: champ.id, round: pairing.round,
          homeTeamId: homeTeam.id, homeTeamName: homeTeam.name,
          awayTeamId: awayTeam.id, awayTeamName: awayTeam.name,
          scheduledDate: matchDate as unknown as Date,
          location: `${homeTeam.clubName || 'Por confirmar'}, ${homeTeam.preferredLocation || 'Pista 1'}`,
          status: 'scheduled',
        });
      }

      await updateChampionship(champ.id, {
        teamIds: selectedTeams,
        totalRounds: Math.max(...pairings.map(p => p.round)),
      });

      showToast(`✓ ${pairings.length} partidos generados`);
      setSelectedChamp(null);
      setChampionships(await getChampionships());
    } catch (e) {
      showToast('Error al generar emparejamientos');
      console.error(e);
    } finally { setGenerating(false); }
  }

  async function handleStatusChange(champ: Championship, status: Championship['status']) {
    await updateChampionship(champ.id, { status });
    setChampionships(prev => prev.map(c => c.id === champ.id ? { ...c, status } : c));
    showToast(`✓ Estado actualizado`);
  }

  const statusConfig = {
    draft: { label: 'Borrador', color: 'badge-gray' },
    active: { label: 'Activo', color: 'badge-green' },
    finished: { label: 'Finalizado', color: 'badge-purple' },
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={20} color="var(--accent3)" /> Campeonatos
          </h1>
        </div>
        <button onClick={() => { setForm({ ...emptyChampForm }); setShowCreate(true); }} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
          <Plus size={15} /> Nuevo
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="loader" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {championships.map(champ => {
              const cfg = statusConfig[champ.status];
              return (
                <div key={champ.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{champ.name}</p>
                      <p style={{ fontSize: 13, color: 'var(--text2)' }}>Temporada: {champ.season}</p>
                    </div>
                    <span className={`badge ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <span className="badge badge-gray">Equipos: {champ.teamIds?.length || 0}</span>
                    <span className="badge badge-gray">Jornadas: {champ.totalRounds || 0}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {champ.status === 'draft' && (
                      <>
                        <button onClick={() => { setSelectedChamp(champ); setSelectedTeams(champ.teamIds || []); }} className="btn-secondary" style={{ flex: 1, fontSize: 13, padding: '10px' }}>
                          <Zap size={14} /> Generar emparejamientos
                        </button>
                        <button onClick={() => handleStatusChange(champ, 'active')} className="btn-primary" style={{ flex: 1, fontSize: 13, padding: '10px' }}>
                          <Play size={14} /> Activar
                        </button>
                      </>
                    )}
                    {champ.status === 'active' && (
                      <button onClick={() => handleStatusChange(champ, 'finished')} className="btn-secondary" style={{ flex: 1, fontSize: 13, padding: '10px', color: 'var(--success)' }}>
                        <CheckCircle size={14} /> Finalizar liga
                      </button>
                    )}
                    {(champ.status === 'active' || champ.status === 'finished') && (
                      <button
                        onClick={() => openReset(champ)}
                        style={{ flex: 1, fontSize: 13, padding: '10px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 12, cursor: 'pointer', color: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                      >
                        <RefreshCw size={14} /> Reiniciar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {championships.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
                <Trophy size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                <p>No hay campeonatos creados</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo campeonato</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <ChampFormFields data={form} onChange={(k, v) => setForm(prev => ({ ...prev, [k]: v }))} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreate}>✓ Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Pairings Modal */}
      {selectedChamp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Generar emparejamientos</h3>
              <button onClick={() => setSelectedChamp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>{selectedChamp.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label className="label">Día de partidos</label>
                <select className="input" value={matchDay} onChange={e => setMatchDay(parseInt(e.target.value))}>
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Hora</label>
                <input className="input" type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} />
              </div>
            </div>
            <label className="label" style={{ marginBottom: 10 }}>Equipos ({selectedTeams.length} seleccionados)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {teams.map(team => {
                const isSelected = selectedTeams.includes(team.id);
                return (
                  <div key={team.id} onClick={() => setSelectedTeams(prev => isSelected ? prev.filter(id => id !== team.id) : [...prev, team.id])}
                    style={{ padding: '12px 16px', background: isSelected ? 'rgba(0,229,160,0.1)' : 'var(--surface2)', border: `1px solid ${isSelected ? 'rgba(0,229,160,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: isSelected ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <CheckCircle size={14} color="#000" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{team.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{team.player1Name} / {team.player2Name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedTeams.length >= 2 && (
              <div className="card-sm" style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                  Se generarán <strong style={{ color: 'var(--accent)' }}>{generateRoundRobin(teams.filter(t => selectedTeams.includes(t.id))).length} partidos</strong> en <strong style={{ color: 'var(--accent)' }}>{selectedTeams.length % 2 === 0 ? selectedTeams.length - 1 : selectedTeams.length} jornadas</strong>
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedChamp(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => handleGeneratePairings(selectedChamp)} disabled={generating || selectedTeams.length < 2}>
                {generating ? <span className="loader" /> : '⚡ Generar partidos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RESET MODAL ===== */}
      {resetChamp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={18} color="var(--accent2)" /> Reiniciar campeonato
              </h3>
              <button onClick={() => setResetChamp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>{resetChamp.name}</p>

            {/* Aviso */}
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 4 }}>⚠️ Esto eliminará todos los partidos y resultados actuales</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                Se borrarán todos los partidos del campeonato, se resetearán las estadísticas de los equipos y se generará un nuevo calendario con los equipos y nombres actualizados.
              </p>
            </div>

            {/* Paso 1: Datos del campeonato */}
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>1. Actualiza los datos si es necesario</p>
            <ChampFormFields data={resetForm} onChange={(k, v) => setResetForm(prev => ({ ...prev, [k]: v }))} />

            {/* Paso 2: Día y hora */}
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 12px' }}>2. Día y hora de los partidos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label className="label">Día de partidos</label>
                <select className="input" value={matchDay} onChange={e => setMatchDay(parseInt(e.target.value))}>
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Hora</label>
                <input className="input" type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} />
              </div>
            </div>

            {/* Paso 3: Equipos */}
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>3. Confirma los equipos participantes ({selectedTeams.length} seleccionados)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {teams.map(team => {
                const isSelected = selectedTeams.includes(team.id);
                const wasIn = resetChamp.teamIds?.includes(team.id);
                return (
                  <div key={team.id} onClick={() => setSelectedTeams(prev => isSelected ? prev.filter(id => id !== team.id) : [...prev, team.id])}
                    style={{ padding: '12px 16px', background: isSelected ? 'rgba(0,229,160,0.1)' : 'var(--surface2)', border: `1px solid ${isSelected ? 'rgba(0,229,160,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: isSelected ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <CheckCircle size={14} color="#000" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{team.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text2)' }}>{team.player1Name} / {team.player2Name}</p>
                    </div>
                    {!wasIn && isSelected && <span style={{ fontSize: 10, background: 'rgba(0,229,160,0.2)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>NUEVO</span>}
                    {wasIn && !isSelected && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>BAJA</span>}
                  </div>
                );
              })}
            </div>

            {selectedTeams.length >= 2 && (
              <div className="card-sm" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                  Se generarán <strong style={{ color: 'var(--accent2)' }}>{generateRoundRobin(teams.filter(t => selectedTeams.includes(t.id))).length} partidos</strong> en <strong style={{ color: 'var(--accent2)' }}>{selectedTeams.length % 2 === 0 ? selectedTeams.length - 1 : selectedTeams.length} jornadas</strong>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setResetChamp(null)}>Cancelar</button>
              <button
                onClick={handleReset}
                disabled={generating || selectedTeams.length < 2}
                style={{ flex: 2, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12, padding: '14px', cursor: 'pointer', color: 'var(--accent2)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {generating ? <span className="loader" /> : <><RefreshCw size={15} /> Reiniciar campeonato</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
