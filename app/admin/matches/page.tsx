'use client';
import { useState, useEffect } from 'react';
import { getActiveChampionship, getMatchesByChampionship, updateMatch } from '@/lib/firestore';
import { Match } from '@/types';
import { Calendar, ChevronLeft, Edit3, X } from 'lucide-react';
import Link from 'next/link';
import { formatDatetime, toDate } from '@/lib/utils';

interface EditForm {
  homeTeamName: string;
  awayTeamName: string;
  scheduledDate: string;
  location: string;
  status: Match['status'];
}

// ✅ Fuera del componente principal
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
  const [loading, setLoading] = useState(true);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ ...emptyEditForm });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filterRound, setFilterRound] = useState<number | 'all'>('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const champ = await getActiveChampionship();
    if (champ) {
      const ms = await getMatchesByChampionship(champ.id);
      setMatches(ms);
    }
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function openEdit(match: Match) {
    setEditMatch(match);
    let dateStr = '';
    try {
      const d = toDate(match.scheduledDate);
      dateStr = d.toISOString().slice(0, 16);
    } catch { dateStr = ''; }
    setEditForm({
      homeTeamName: match.homeTeamName || '',
      awayTeamName: match.awayTeamName || '',
      scheduledDate: dateStr,
      location: match.location || '',
      status: match.status || 'scheduled',
    });
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

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const filtered = filterRound === 'all' ? matches : matches.filter(m => m.round === filterRound);

  const statusColors: Record<string, string> = {
    scheduled: 'badge-yellow',
    completed: 'badge-green',
    in_progress: 'badge-teal',
    postponed: 'badge-red',
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Programado',
    completed: 'Finalizado',
    in_progress: 'En curso',
    postponed: 'Aplazado',
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
        <span className="badge badge-gray">{matches.length} partidos</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Round filter */}
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
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="loader" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(match => (
              <div key={match.id} className="card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', fontFamily: 'Space Mono, monospace' }}>J{match.round}</span>
                      <span className={`badge ${statusColors[match.status]}`}>{statusLabels[match.status]}</span>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{match.homeTeamName} vs {match.awayTeamName}</p>
                    {match.result && (
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                        {match.result.homeScore}–{match.result.awayScore}
                      </p>
                    )}
                  </div>
                  <button onClick={() => openEdit(match)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text2)' }}>
                    <Edit3 size={14} />
                  </button>
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

      {/* Edit Modal */}
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

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
