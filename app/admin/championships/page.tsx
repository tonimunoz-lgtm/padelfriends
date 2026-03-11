'use client';
import { useState, useEffect } from 'react';
import { getAllTeams, getChampionships, createChampionship, updateChampionship, generateRoundRobin, createMatch } from '@/lib/firestore';
import { Team, Championship } from '@/types';
import { Trophy, ChevronLeft, Plus, Play, Pause, CheckCircle, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

export default function AdminChampionshipsPage() {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedChamp, setSelectedChamp] = useState<Championship | null>(null);

  const [form, setForm] = useState({ name: '', season: '', startDate: '', description: '' });
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [matchDay, setMatchDay] = useState(6); // Saturday
  const [matchTime, setMatchTime] = useState('10:00');

  useEffect(() => {
    Promise.all([getChampionships(), getAllTeams()]).then(([champs, ts]) => {
      setChampionships(champs);
      setTeams(ts);
      setLoading(false);
    });
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleCreate() {
    if (!form.name || !form.season) return showToast('Nombre y temporada son obligatorios');
    try {
      const id = await createChampionship({
        name: form.name,
        season: form.season,
        startDate: form.startDate ? new Date(form.startDate) as unknown as Date : new Date() as unknown as Date,
        status: 'draft',
        teamIds: [],
        currentRound: 0,
        totalRounds: 0,
        description: form.description,
      });
      showToast('✓ Campeonato creado en borrador');
      setShowCreate(false);
      const updated = await getChampionships();
      setChampionships(updated);
    } catch { showToast('Error al crear'); }
  }

  async function handleGeneratePairings(champ: Championship) {
    if (selectedTeams.length < 2) return showToast('Selecciona al menos 2 equipos');
    if (!confirm(`Generar emparejamientos para ${selectedTeams.length} equipos. ¿Continuar?`)) return;
    setGenerating(true);
    try {
      const champTeams = teams.filter(t => selectedTeams.includes(t.id));
      const pairings = generateRoundRobin(champTeams);
      const startDate = champ.startDate instanceof Timestamp ? champ.startDate.toDate() : new Date(champ.startDate || Date.now());

      // Create all matches
      for (const pairing of pairings) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + (pairing.round - 1) * 7);
        // Set to selected day of week
        const currentDay = matchDate.getDay();
        const diff = (matchDay - currentDay + 7) % 7;
        matchDate.setDate(matchDate.getDate() + diff);
        const [h, m] = matchTime.split(':');
        matchDate.setHours(parseInt(h), parseInt(m), 0, 0);

        const homeTeam = champTeams.find(t => t.id === pairing.homeTeamId);
        const awayTeam = champTeams.find(t => t.id === pairing.awayTeamId);
        if (!homeTeam || !awayTeam) continue;

        await createMatch({
          championshipId: champ.id,
          round: pairing.round,
          homeTeamId: homeTeam.id,
          homeTeamName: homeTeam.name,
          awayTeamId: awayTeam.id,
          awayTeamName: awayTeam.name,
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
      const updated = await getChampionships();
      setChampionships(updated);
    } catch (e) {
      showToast('Error al generar emparejamientos');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(champ: Championship, status: Championship['status']) {
    await updateChampionship(champ.id, { status });
    setChampionships(prev => prev.map(c => c.id === champ.id ? { ...c, status } : c));
    showToast(`✓ Estado actualizado: ${status}`);
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
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={20} color="var(--accent3)" /> Campeonatos</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
          <Plus size={15} /> Nuevo
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" style={{ width: 36, height: 36 }} /></div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Liga Primavera 2025" /></div>
              <div><label className="label">Temporada</label><input className="input" value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} placeholder="2025" /></div>
              <div><label className="label">Fecha de inicio</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div><label className="label">Descripción (opcional)</label><textarea className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            </div>
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
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>{selectedChamp.name} — Selecciona los equipos participantes</p>

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
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeams(prev => isSelected ? prev.filter(id => id !== team.id) : [...prev, team.id])}
                    style={{ padding: '12px 16px', background: isSelected ? 'rgba(0,229,160,0.1)' : 'var(--surface2)', border: `1px solid ${isSelected ? 'rgba(0,229,160,0.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: isSelected ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
