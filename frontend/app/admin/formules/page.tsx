'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import AdminShell from '../_components/admin-shell';

type Formule = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  seatsIncluded: number;
  coachingIncluded: boolean;
  isActive: boolean;
};

const emptyForm = {
  name: '',
  monthlyPrice: 49,
  yearlyPrice: 490,
  seatsIncluded: 1,
  coachingIncluded: false,
  isActive: true,
};

export default function AdminFormulesPage() {
  const [items, setItems] = useState<Formule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/formules', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error('load_error');
      setItems(data.formules ?? []);
      setMessage('');
    } catch {
      setMessage('Impossible de charger les formules.');
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
      monthlyPrice: selected.monthlyPrice,
      yearlyPrice: selected.yearlyPrice,
      seatsIncluded: selected.seatsIncluded,
      coachingIncluded: selected.coachingIncluded,
      isActive: selected.isActive,
    });
  }, [selected]);

  async function createItem() {
    const res = await fetch('/api/admin/formules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Création impossible.');
      return;
    }
    setMessage('Formule créée.');
    setSelectedId(data.formule.id);
    await load();
  }

  async function updateItem() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/formules/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Mise à jour impossible.');
      return;
    }
    setMessage('Formule mise à jour.');
    await load();
  }

  async function deleteItem() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/formules/${selectedId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setMessage('Suppression impossible.');
      return;
    }
    setMessage('Formule supprimée.');
    setSelectedId(null);
    setForm(emptyForm);
    await load();
  }

  return (
    <AdminShell>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Section Formules</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background p-3 max-h-[420px] overflow-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune formule.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${selectedId === item.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs opacity-80">{item.monthlyPrice}€/mois • {item.yearlyPrice}€/an • {item.isActive ? 'active' : 'inactive'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background p-3 space-y-3">
            <label className="block text-sm space-y-1">
              <span>Nom formule</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm space-y-1">
                <span>Prix mensuel (€)</span>
                <input type="number" min={0} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.monthlyPrice} onChange={(e) => setForm((p) => ({ ...p, monthlyPrice: Number(e.target.value) || 0 }))} />
              </label>
              <label className="block text-sm space-y-1">
                <span>Prix annuel (€)</span>
                <input type="number" min={0} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.yearlyPrice} onChange={(e) => setForm((p) => ({ ...p, yearlyPrice: Number(e.target.value) || 0 }))} />
              </label>
            </div>
            <label className="block text-sm space-y-1">
              <span>Sièges inclus</span>
              <input type="number" min={1} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.seatsIncluded} onChange={(e) => setForm((p) => ({ ...p, seatsIncluded: Number(e.target.value) || 1 }))} />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.coachingIncluded} onChange={(e) => setForm((p) => ({ ...p, coachingIncluded: e.target.checked }))} />
              Coaching inclus
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Formule active
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
