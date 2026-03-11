'use client';
import { useState, useEffect } from 'react';
import { getAllTeams, createTeam, updateTeam, deleteTeam } from '@/lib/firestore';
import { Team } from '@/types';
import { Shield, ChevronLeft, Plus, Edit3, Trash2, Copy, X } from 'lucide-react';
import Link from 'next/link';

interface FormData {
  name: string;
  player1Name: string;
  player1Email: string;
  player2Name: string;
  player2Email: string;
  clubName: string;
  preferredLocation: string;
}

// ✅ Componente fuera del padre para evitar re-render en cada tecla
function FormFields({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label className="label">Nombre del equipo *</label>
        <input className="input" value={data.name} onChange={e => onChange('name', e.target.value)} placeholder="Los Ases del Pádel" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="label">Jugador 1 *</label>
          <input className="input" value={data.player1Name} onChange={e => onChange('player1Name', e.target.value)} placeholder="Nombre" />
        </div>
        <div>
          <label className="label">Email J1</label>
          <input className="input" type="email" value={data.player1Email} onChange={e => onChange('player1Email', e.target.value)} placeholder="email" />
        </div>
        <div>
          <label className="label">Jugador 2</label>
          <input className="input" value={data.player2Name} onChange={e => onChange('player2Name', e.target.value)} placeholder="Nombre" />
        </div>
        <div>
          <label className="label">Email J2</label>
          <input className="input" type="email" value={data.player2Email} onChange={e => onChange('player2Email', e.target.value)} placeholder="email" />
        </div>
      </div>
      <div>
        <label className="label">Club / Instalación</label>
        <input className="input" value={data.clubName} onChange={e => onChange('clubName', e.target.value)} placeholder="Club Natación Sur" />
      </div>
      <div>
        <label className="label">Pista preferida (local)</label>
        <input className="input" value={data.preferredLocation} onChange={e => onChange('preferredLocation', e.target.value)} placeholder="Pista 3" />
      </div>
    </div>
  );
}

const emptyForm: FormData = {
  name: '', player1Name: '', player1Email: '',
  player2Name: '', player2Email: '', clubName: '', preferredLocation: ''
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [editForm, setEditForm] = useState<FormData>({ ...emptyForm });

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    const t = await getAllTeams();
    setTeams(t.sort((a, b) => (b.points || 0) - (a.points || 0)));
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function openEdit(team: Team) {
    setEditTeam(team);
    setEditForm({
      name: team.name || '',
      player1Name: team.player1Name || '',
      player1Email: team.player1Email || '',
      player2Name: team.player2Name || '',
      player2Email: team.player2Email || '',
      clubName: team.clubName || '',
      preferredLocation: team.preferredLocation || '',
    });
  }

  async function handleCreate() {
    if (!form.name || !form.player1Name) return showToast('Nombre del equipo y jugador 1 son obligatorios');
    setSaving(true);
    try {
      await createTeam({ ...form });
      showToast('✓ Equipo creado');
      setShowCreate(false);
      setForm({ ...emptyForm });
      loadTeams();
    } catch { showToast('Error al crear equipo'); } finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editTeam) return;
    setSaving(true);
    try {
      await updateTeam(editTeam.id, { ...editForm });
      showToast('✓ Equipo actualizado');
      setEditTeam(null);
      loadTeams();
    } catch { showToast('Error al actualizar'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar equipo "${name}"?`)) return;
    await deleteTeam(id);
    setTeams(prev => prev.filter(t => t.id !== id));
    showToast('✓ Equipo eliminado');
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    showToast('✓ Código copiado');
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} color="var(--accent2)" /> Equipos
          </h1>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
          <Plus size={15} /> Nuevo
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="loader" style={{ width: 36, height: 36 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teams.map(team => (
              <div key={team.id} className="card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{team.name}</p>
                    <button onClick={() => copyCode(team.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 14, padding: '4px 0' }}>
                      {team.code} <Copy size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(team)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text2)' }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(team.id, team.name)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>👤 {team.player1Name || '—'}</p>
                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>👤 {team.player2Name || '—'}</p>
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className="badge badge-gray">PJ: {team.matchesPlayed || 0}</span>
                  <span className="badge badge-teal">Pts: {team.points || 0}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>📍 {team.clubName || '—'}</span>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
                <Shield size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                <p>No hay equipos registrados</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo equipo</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <FormFields data={form} onChange={(k, v) => setForm(prev => ({ ...prev, [k]: v }))} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Crear equipo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTeam && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="card" style={{ width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Editar: {editTeam.name}</h3>
              <button onClick={() => setEditTeam(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>
            <FormFields data={editForm} onChange={(k, v) => setEditForm(prev => ({ ...prev, [k]: v }))} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditTeam(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleUpdate} disabled={saving}>
                {saving ? <span className="loader" /> : '✓ Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
