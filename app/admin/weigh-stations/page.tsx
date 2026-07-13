// app/admin/weigh-stations/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Ban, ArrowLeft, Scale, RefreshCw, PlusCircle, Trash2,
  MapPin, Route as RouteIcon, CheckCircle2, PauseCircle, X, Undo2, Save,
} from 'lucide-react';
import RoadMapEditor, { type StationWithRoads, type LatLng } from '@/app/components/RoadMapEditor';

type Mode = 'idle' | 'addStation' | 'drawRoad';

export default function AdminWeighStationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stations, setStations] = useState<StationWithRoads[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [pendingStationCoords, setPendingStationCoords] = useState<LatLng | null>(null);
  const [newStationName, setNewStationName] = useState('');

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<LatLng[]>([]);
  const [newRoadName, setNewRoadName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/weigh-stations');
      if (res.status === 403) {
        setError('Доступ только для администратора');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStations(data.stations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      loadStations();
    }
  }, [authLoading, user, loadStations]);

  const startAddStation = () => {
    setMode('addStation');
    setPendingStationCoords(null);
    setNewStationName('');
    setFormError(null);
  };

  const cancelAddStation = () => {
    setMode('idle');
    setPendingStationCoords(null);
    setNewStationName('');
  };

  const saveStation = async () => {
    if (!pendingStationCoords) return;
    if (!newStationName.trim()) {
      setFormError('Введи название рамки');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/weigh-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStationName.trim(), lat: pendingStationCoords.lat, lng: pendingStationCoords.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Ошибка сохранения');
        return;
      }
      cancelAddStation();
      await loadStations();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const deleteStation = async (station: StationWithRoads) => {
    if (!confirm(`Удалить рамку «${station.name}» и все её дороги?`)) return;
    await fetch(`/api/admin/weigh-stations/${station.id}`, { method: 'DELETE' });
    if (selectedStationId === station.id) {
      setSelectedStationId(null);
      setMode('idle');
    }
    await loadStations();
  };

  const startDrawRoad = (stationId: number) => {
    setSelectedStationId(stationId);
    setMode('drawRoad');
    setDrawingPoints([]);
    setNewRoadName('');
    setFormError(null);
  };

  const cancelDrawRoad = () => {
    setMode('idle');
    setDrawingPoints([]);
    setNewRoadName('');
  };

  const undoLastPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  const saveRoad = async () => {
    if (!selectedStationId || drawingPoints.length < 2) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/weigh-stations/${selectedStationId}/roads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoadName.trim() || null, points: drawingPoints }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Ошибка сохранения');
        return;
      }
      cancelDrawRoad();
      await loadStations();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoadActive = async (roadId: number, isActive: boolean) => {
    await fetch(`/api/admin/roads/${roadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await loadStations();
  };

  const deleteRoad = async (roadId: number) => {
    if (!confirm('Удалить эту дорогу?')) return;
    await fetch(`/api/admin/roads/${roadId}`, { method: 'DELETE' });
    await loadStations();
  };

  const handleMapClick = (point: LatLng) => {
    if (mode === 'addStation') {
      setPendingStationCoords(point);
    } else if (mode === 'drawRoad') {
      setDrawingPoints((prev) => [...prev, point]);
    }
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

  const selectedStation = stations.find((s) => s.id === selectedStationId) || null;

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <button onClick={() => router.push('/')} style={backBtnStyle}><ArrowLeft size={13} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />Назад</button>
          <h1 style={{ margin: '8px 0 0', fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={20} strokeWidth={2.2} />Весовые рамки</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', maxWidth: 560 }}>
            Отметь рамку и нарисуй дороги, которые к ней ведут — если самосвал заедет
            на такую дорогу, логисту придёт push-тревога. Штраф за проезд — 200 тыс ₽.
          </p>
        </div>
        <button onClick={loadStations} style={refreshBtnStyle}><RefreshCw size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Обновить</button>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {mode === 'idle' && (
          <button onClick={startAddStation} style={saveBtnStyle}>
            <PlusCircle size={14} strokeWidth={2.2} style={{ marginRight: 6, verticalAlign: -2 }} />Добавить рамку
          </button>
        )}
        {mode === 'addStation' && (
          <div style={{ ...formStyle, flex: '1 1 100%' }}>
            <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} strokeWidth={2.2} />
              {pendingStationCoords ? 'Точка выбрана — введи название и сохрани' : 'Кликни на карте, где стоит рамка'}
            </div>
            {pendingStationCoords && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  placeholder="Название рамки (например «Пост на М-4»)"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  style={inputStyle}
                />
                <button onClick={saveStation} disabled={saving} style={saveBtnStyle}>
                  <Save size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button onClick={cancelAddStation} style={cancelBtnStyle}>Отмена</button>
              </div>
            )}
            {!pendingStationCoords && (
              <button onClick={cancelAddStation} style={cancelBtnStyle}>Отмена</button>
            )}
            {formError && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</div>}
          </div>
        )}
        {mode === 'drawRoad' && selectedStation && (
          <div style={{ ...formStyle, flex: '1 1 100%' }}>
            <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RouteIcon size={14} strokeWidth={2.2} />
              Рисуем дорогу к «{selectedStation.name}» — кликай по карте точки по порядку (нужно минимум 2). Точек: {drawingPoints.length}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Название подъезда (необязательно, напр. «с востока»)"
                value={newRoadName}
                onChange={(e) => setNewRoadName(e.target.value)}
                style={inputStyle}
              />
              <button onClick={undoLastPoint} disabled={drawingPoints.length === 0} style={cancelBtnStyle}>
                <Undo2 size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Отменить точку
              </button>
              <button onClick={saveRoad} disabled={drawingPoints.length < 2 || saving} style={saveBtnStyle}>
                <Save size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />{saving ? 'Сохранение...' : 'Сохранить дорогу'}
              </button>
              <button onClick={cancelDrawRoad} style={cancelBtnStyle}><X size={13} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />Отмена</button>
            </div>
            {formError && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</div>}
          </div>
        )}
      </div>

      <RoadMapEditor
        stations={stations}
        drawingPoints={drawingPoints}
        clickEnabled={mode !== 'idle'}
        onMapClick={handleMapClick}
        onStationClick={(id) => setSelectedStationId(id)}
        selectedStationId={selectedStationId}
      />

      {loading ? (
        <div style={{ marginTop: 16 }}>Загрузка...</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {stations.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13 }}>
              Рамок пока нет — нажми «Добавить рамку» и кликни точку на карте.
            </div>
          )}
          {stations.map((station) => (
            <div key={station.id} style={{ ...stationCardStyle, borderColor: station.id === selectedStationId ? '#8b5cf6' : '#e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div
                  onClick={() => setSelectedStationId(station.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}
                >
                  <MapPin size={15} strokeWidth={2.2} color={station.isActive ? '#3a56d4' : '#9ca3af'} />
                  {station.name}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startDrawRoad(station.id)} style={smallActionBtnStyle}>
                    <RouteIcon size={13} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />Нарисовать дорогу
                  </button>
                  <button onClick={() => deleteStation(station)} style={{ ...smallActionBtnStyle, color: '#dc2626' }}>
                    <Trash2 size={13} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {station.roads.length === 0 ? (
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>Дорог пока не нарисовано — тревога для этой рамки не сработает.</div>
              ) : (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {station.roads.map((road) => (
                    <div key={road.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: '#f8fafc', borderRadius: 6, padding: '6px 10px' }}>
                      <span>{road.name || 'Без названия'} · {road.points.length} точ.</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => toggleRoadActive(road.id, road.isActive)} style={{ ...toggleBtnStyle(road.isActive), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {road.isActive ? <><CheckCircle2 size={11} strokeWidth={2.4} />Активна</> : <><PauseCircle size={11} strokeWidth={2.4} />Отключена</>}
                        </button>
                        <button onClick={() => deleteRoad(road.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                          <Trash2 size={13} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14,
};
const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, flex: '1 1 220px', minWidth: 180,
};
const saveBtnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#333', cursor: 'pointer', fontSize: 13,
};
const stationCardStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10,
};
const smallActionBtnStyle: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center',
};
const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  background: active ? '#dcfce7' : '#f1f5f9', color: active ? '#166534' : '#64748b',
});
