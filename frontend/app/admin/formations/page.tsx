'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import AdminShell from '../_components/admin-shell';

type Formation = {
  id: string;
  name: string;
  description: string;
  level: string;
  targetHours: number;
  isActive: boolean;
};

const emptyForm = {
  name: '',
  description: '',
  level: 'Débutant',
  targetHours: 20,
  isActive: true,
};

export default function AdminFormationsPage() {
  const [items, setItems] = useState<Formation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/formations', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error('load_error');
      setItems(data.formations ?? []);
      setMessage('');
    } catch {
      setMessage('Impossible de charger les formations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      name: selected.name,
      description: selected.description,
      level: selected.level,
      targetHours: selected.targetHours,
      isActive: selected.isActive,
    });
  }, [selected]);

  async function createItem() {
    const res = await fetch('/api/admin/formations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Création impossible.');
      return;
    }
    setMessage('Formation créée.');
    setSelectedId(data.formation.id);
    await load();
  }

  async function updateItem() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/formations/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Mise à jour impossible.');
      return;
    }
    setMessage('Formation mise à jour.');
    await load();
  }

  async function deleteItem() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/formations/${selectedId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Suppression impossible.');
      return;
    }
    setMessage('Formation supprimée.');
    setSelectedId(null);
    setForm(emptyForm);
    await load();
  }

  return (
    <AdminShell>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Section Formations</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background p-3 max-h-[420px] overflow-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune formation.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${selectedId === item.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs opacity-80">{item.level} • {item.targetHours}h • {item.isActive ? 'active' : 'inactive'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background p-3 space-y-3">
            <label className="block text-sm space-y-1">
              <span>Nom formation</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="block text-sm space-y-1">
              <span>Description</span>
              <textarea className="w-full rounded-lg border px-3 py-2 bg-background min-h-24" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm space-y-1">
                <span>Niveau</span>
                <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))} />
              </label>
              <label className="block text-sm space-y-1">
                <span>Objectif heures</span>
                <input type="number" min={1} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.targetHours} onChange={(e) => setForm((p) => ({ ...p, targetHours: Number(e.target.value) || 1 }))} />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Formation active
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={createItem} className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm"><Plus className="h-4 w-4" /> Ajouter</button>
              <button onClick={updateItem} disabled={!selectedId} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-60"><Save className="h-4 w-4" /> Mettre à jour</button>
              <button onClick={deleteItem} disabled={!selectedId} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-60"><Trash2 className="h-4 w-4" /> Supprimer</button>
              <button onClick={() => { setSelectedId(null); setForm(emptyForm); }} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">Nouveau</button>
            </div>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
