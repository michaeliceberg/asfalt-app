// app/admin/trucks/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Ban, ArrowLeft, Truck as TruckIcon, RefreshCw, Pencil, PlusCircle, Search, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react';

interface Truck {
  id: number;
  uid: string;
  licensePlate: string;
  vehicleType: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number | null;
}

const VEHICLE_TYPE_OPTIONS = [
  { value: '', label: '— не указан' },
  { value: 'С', label: 'С — самосвал' },
  { value: 'Т', label: 'Т — тонар' },
  { value: 'М', label: 'М — миксер' },
];

const emptyForm = { uid: '', licensePlate: '', vehicleType: '' };

export default function AdminTrucksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/trucks');
      if (res.status === 403) {
        setError('Доступ только для администратора');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrucks(data.trucks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      loadTrucks();
    }
  }, [authLoading, user, loadTrucks]);

  const startEdit = (truck: Truck) => {
    setEditingId(truck.id);
    setForm({
      uid: truck.uid,
      licensePlate: truck.licensePlate,
      vehicleType: truck.vehicleType || '',
    });
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.uid.trim() || !form.licensePlate.trim()) {
      setFormError('Заполни uid и госномер');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId ? `/api/admin/trucks/${editingId}` : '/api/admin/trucks';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: form.uid.trim(),
          licensePlate: form.licensePlate.trim(),
          vehicleType: form.vehicleType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Ошибка сохранения');
        return;
      }
      cancelEdit();
      await loadTrucks();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (truck: Truck) => {
    await fetch(`/api/admin/trucks/${truck.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !truck.isActive }),
    });
    await loadTrucks();
  };

  const handleDelete = async (truck: Truck) => {
    if (!confirm(`Удалить машину ${truck.licensePlate}?`)) return;
    await fetch(`/api/admin/trucks/${truck.id}`, { method: 'DELETE' });
    await loadTrucks();
  };

  if (authLoading) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  if (user && user.groupId !== 1) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ban size={20} strokeWidth={2.2} />Доступ только для администратора</h2>
        <button onClick={() => router.push('/')} style={backBtnStyle}><ArrowLeft size={13} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />На главную</button>
      </div>
    );
  }

  const filteredTrucks = trucks.filter((t) => {
    const q = search.trim().toUpperCase();
    if (!q) return true;
    return t.licensePlate.toUpperCase().includes(q) || t.uid.includes(q);
  });

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <button onClick={() => router.push('/')} style={backBtnStyle}><ArrowLeft size={13} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />Назад</button>
          <h1 style={{ margin: '8px 0 0', fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}><TruckIcon size={20} strokeWidth={2.2} />Машины (GPS-отслеживание)</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
            Добавляй/редактируй машины здесь — крон подхватит их на следующем цикле, без деплоя.
          </p>
        </div>
        <button onClick={loadTrucks} style={refreshBtnStyle}><RefreshCw size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Обновить</button>
      </div>

      {/* Форма добавления/редактирования */}
      <form onSubmit={handleSubmit} style={formStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          {editingId ? <><Pencil size={14} strokeWidth={2.2} />Редактировать машину</> : <><PlusCircle size={14} strokeWidth={2.2} />Добавить машину</>}
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="uid трекера (geoinformer)"
            value={form.uid}
            onChange={(e) => setForm({ ...form, uid: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Госномер (например Е054ВК250)"
            value={form.licensePlate}
            onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
            style={inputStyle}
          />
          <select
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            style={inputStyle}
          >
            {VEHICLE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {formError && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="submit" disabled={submitting} style={saveBtnStyle}>
            {submitting ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={cancelBtnStyle}>Отмена</button>
          )}
        </div>
      </form>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} strokeWidth={2.2} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          placeholder="Поиск по госномеру или uid..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', paddingLeft: 30 }}
        />
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>Госномер</th>
                <th style={thStyle}>Тип</th>
                <th style={thStyle}>uid</th>
                <th style={thStyle}>Статус</th>
                <th style={thStyle}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.map((truck) => (
                <tr key={truck.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: truck.isActive ? 1 : 0.5 }}>
                  <td style={tdStyle}><strong>{truck.licensePlate}</strong></td>
                  <td style={tdStyle}>{truck.vehicleType || '—'}</td>
                  <td style={tdStyle}>{truck.uid}</td>
                  <td style={tdStyle}>
                    <button onClick={() => toggleActive(truck)} style={{ ...toggleBtnStyle(truck.isActive), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {truck.isActive ? <><CheckCircle2 size={12} strokeWidth={2.4} />Активна</> : <><PauseCircle size={12} strokeWidth={2.4} />Отключена</>}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => startEdit(truck)} style={smallBtnStyle}><Pencil size={14} strokeWidth={2.2} /></button>
                    <button onClick={() => handleDelete(truck)} style={{ ...smallBtnStyle, color: '#dc2626' }}><Trash2 size={14} strokeWidth={2.2} /></button>
                  </td>
                </tr>
              ))}
              {filteredTrucks.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#888' }}>Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
        Всего: {trucks.length} · активных: {trucks.filter(t => t.isActive).length}
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8, border: 'none', background: '#333', color: '#fff', cursor: 'pointer', fontSize: 13,
};
const refreshBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontWeight: 500,
};
const formStyle: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16,
};
const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, flex: '1 1 160px', minWidth: 140,
};
const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600,
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#333', cursor: 'pointer',
};
const thStyle: React.CSSProperties = { padding: '8px 6px', color: '#666', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 6px' };
const smallBtnStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, marginRight: 6,
};
const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  background: active ? '#dcfce7' : '#f1f5f9', color: active ? '#166534' : '#64748b',
});
