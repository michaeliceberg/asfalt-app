// app/admin/places/page.tsx
'use client';
// Места для навигации машин: заводы, объекты, карьеры. Объекты и карьеры
// система находит сама по долгим остановкам машин (lib/nav.ts, «авто»), здесь
// их можно поправить: подвинуть точку, переименовать, сменить радиус, добавить
// названия получателей/поставщиков, которые туда ездят. Ниже — получатели за
// 30 дней, для которых место ещё неизвестно: нажми и поставь точку на карте.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Ban, MapPin, RefreshCw, Trash2, Factory, Mountain, Building2 } from 'lucide-react';
import type { YandexMap } from '@/lib/yandex-maps-types';

interface Place {
  id: number;
  name: string;
  kind: 'factory' | 'object' | 'quarry';
  lat: number;
  lng: number;
  radiusM: number;
  aliases: string;
  source: string;
  visits: number;
  lastVisitAt: number | null;
  trips: number;
  avgTripMin: number | null;
}
interface Unknown { name: string; count: number; factories: string[] }

type Draft = { id: number | null; name: string; kind: Place['kind']; lat: number | null; lng: number | null; radiusM: number; aliases: string };

const KIND_LABEL: Record<Place['kind'], string> = { factory: 'Завод', object: 'Объект', quarry: 'Карьер' };
const KIND_COLOR: Record<Place['kind'], string> = { factory: '#2563eb', object: '#16a34a', quarry: '#b45309' };

interface ClickEvent { get: (key: 'coords') => [number, number] }

export default function AdminPlacesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [unknown, setUnknown] = useState<Unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Place['kind']>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const objectsRef = useRef<unknown[]>([]);
  const draftRef = useRef<Draft | null>(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/admin/places');
    if (res.status === 403) { setError('Доступ только для администратора'); return; }
    if (!res.ok) { setError(`Ошибка ${res.status}`); return; }
    const data = await res.json();
    setPlaces(data.places || []);
    setUnknown(data.unknown || []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка данных при входе, как в остальных админ-страницах
  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  // Карта — тот же способ загрузки Яндекс Карт, что в RoadMapEditor.tsx
  useEffect(() => {
    const init = () => {
      if (!containerRef.current || mapRef.current || !window.ymaps) return;
      const map = new window.ymaps.Map(containerRef.current, {
        center: [55.85, 38.2], zoom: 8, controls: ['zoomControl', 'typeSelector'],
      }) as YandexMap;
      (map as unknown as { events: { add: (e: string, h: (ev: ClickEvent) => void) => void } })
        .events.add('click', (ev: ClickEvent) => {
          if (!draftRef.current) return;
          const [lat, lng] = ev.get('coords');
          setDraft(d => (d ? { ...d, lat, lng } : d));
        });
      mapRef.current = map;
      setMapReady(true);
    };
    if (window.ymaps) { window.ymaps.ready(init); return; }
    const existing = document.querySelector('script[data-yandex-maps]');
    if (existing) { existing.addEventListener('load', () => window.ymaps?.ready(init)); return; }
    const script = document.createElement('script');
    script.dataset.yandexMaps = 'true';
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || ''}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps?.ready(init);
    document.body.appendChild(script);
  }, []);

  const visible = places.filter(p => filter === 'all' || p.kind === filter);

  // Перерисовка меток и кругов
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.ymaps) return;
    const map = mapRef.current;
    const ymaps = window.ymaps as unknown as {
      Placemark: new (c: [number, number], p: object, o: object) => { events: { add: (e: string, h: () => void) => void } };
      Circle: new (g: [[number, number], number], p: object, o: object) => unknown;
    };
    objectsRef.current.forEach(o => map.geoObjects.remove(o));
    objectsRef.current = [];
    const add = (o: unknown) => { map.geoObjects.add(o); objectsRef.current.push(o); };

    visible.forEach(p => {
      const color = KIND_COLOR[p.kind];
      add(new ymaps.Circle([[p.lat, p.lng], p.radiusM], {}, { fillColor: color + '22', strokeColor: color, strokeWidth: 1 }));
      const mark = new ymaps.Placemark([p.lat, p.lng], { hintContent: `${KIND_LABEL[p.kind]}: ${p.name}` }, { preset: 'islands#dotIcon', iconColor: color });
      mark.events.add('click', () => startEdit(p));
      add(mark);
    });
    if (draft?.lat != null && draft.lng != null) {
      add(new ymaps.Circle([[draft.lat, draft.lng], draft.radiusM], {}, { fillColor: '#f9731633', strokeColor: '#f97316', strokeWidth: 2 }));
      add(new ymaps.Placemark([draft.lat, draft.lng], { hintContent: draft.name || 'Новое место' }, { preset: 'islands#orangeStarIcon' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, places, filter, draft]);

  const focus = (lat: number, lng: number) => mapRef.current?.setCenter([lat, lng], 14);

  function startEdit(p: Place) {
    setDraft({ id: p.id, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, radiusM: p.radiusM, aliases: p.aliases });
    focus(p.lat, p.lng);
  }
  const startNew = (name = '', kind: Place['kind'] = 'object') =>
    setDraft({ id: null, name, kind, lat: null, lng: null, radiusM: kind === 'quarry' ? 500 : 400, aliases: '' });

  const save = async () => {
    if (!draft || draft.lat == null || draft.lng == null || !draft.name.trim()) return;
    setSaving(true);
    const body = JSON.stringify(draft);
    const res = draft.id
      ? await fetch(`/api/admin/places/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
      : await fetch('/api/admin/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Ошибка сохранения'); return; }
    setDraft(null);
    load();
  };

  const remove = async (p: Place) => {
    if (!confirm(`Удалить «${p.name}»? Рейсы останутся, но без привязки к месту.`)) return;
    await fetch(`/api/admin/places/${p.id}`, { method: 'DELETE' });
    if (draft?.id === p.id) setDraft(null);
    load();
  };

  if (authLoading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error === 'Доступ только для администратора') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ban size={20} />{error}</h2>
        <button onClick={() => router.push('/')} style={btn('#333')}>На главную</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={() => router.push('/')} style={btn('#333')}><ArrowLeft size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Назад</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', margin: '8px 0 12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={20} />Места для навигации</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', maxWidth: 640 }}>
            Объекты и карьеры система находит сама: где машина после загрузки надолго остановилась — там объект
            получателя; где стояла перед тем, как привезти песок или щебень на завод — там карьер. По прошлым рейсам
            считается время в пути и рисуется дорога. Здесь можно поправить точку или добавить место заранее.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => startNew()} style={btn('#16a34a')}>+ Место</button>
          <button onClick={load} style={btn('#4a90d9')}><RefreshCw size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Обновить</button>
        </div>
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}

      <div ref={containerRef} style={{ width: '100%', height: 460, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }} />

      {draft && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{draft.id ? 'Правка места' : 'Новое место'} — нажми на карту, чтобы поставить точку</b>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Название" style={input} />
            <select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as Place['kind'] })} style={{ ...input, flex: '0 0 130px', minWidth: 0 }}>
              <option value="object">Объект</option>
              <option value="quarry">Карьер</option>
              <option value="factory">Завод</option>
            </select>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              Радиус, м
              <input type="number" value={draft.radiusM} onChange={e => setDraft({ ...draft, radiusM: Number(e.target.value) })} style={{ ...input, flex: '0 0 90px', minWidth: 0 }} />
            </label>
          </div>
          <textarea value={draft.aliases} onChange={e => setDraft({ ...draft, aliases: e.target.value })} rows={3}
            placeholder="Кто туда ездит: названия получателей или поставщиков, по одному в строке (как в 1С)" style={{ ...input, fontFamily: 'inherit' }} />
          <div style={{ fontSize: 12, color: '#666' }}>
            Точка: {draft.lat != null ? `${draft.lat.toFixed(5)}, ${draft.lng!.toFixed(5)}` : 'не выбрана'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving || draft.lat == null || !draft.name.trim()} style={btn('#22c55e')}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
            <button onClick={() => setDraft(null)} style={{ ...btn('#fff'), color: '#333', border: '1px solid #cbd5e1' }}>Отмена</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 14 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {(['all', 'object', 'quarry', 'factory'] as const).map(k => (
              <button key={k} onClick={() => setFilter(k)} style={chip(filter === k)}>
                {k === 'all' ? `Все (${places.length})` : `${KIND_LABEL[k]} (${places.filter(p => p.kind === k).length})`}
              </button>
            ))}
          </div>
          {visible.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Пока пусто. Места появятся сами после первых рейсов.</p>}
          {visible.sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0)).map(p => {
            const Icon = p.kind === 'factory' ? Factory : p.kind === 'quarry' ? Mountain : Building2;
            return (
              <div key={p.id} style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Icon size={15} color={KIND_COLOR[p.kind]} />{p.name}
                  </button>
                  {p.kind !== 'factory' && <button onClick={() => remove(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {KIND_LABEL[p.kind]} · {p.source === 'auto' ? 'найдено автоматически' : 'задано вручную'} · рейсов {p.trips}
                  {p.avgTripMin ? ` · в среднем ${p.avgTripMin} мин` : ''}
                  {p.lastVisitAt ? ` · был ${new Date(p.lastVisitAt * 1000).toLocaleDateString('ru-RU')}` : ''}
                </div>
                {p.aliases && <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Ездят: {p.aliases.split('\n').join(', ')}</div>}
              </div>
            );
          })}
        </div>

        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Получатели без места (30 дней)</h3>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666' }}>
            У Айсберга в выгрузке нет координат. Эти места выучатся сами после рейса с GPS,
            но можно поставить точку заранее — тогда время в пути и маршрут появятся сразу.
          </p>
          {unknown.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Всех знаем 👍</p>}
          {unknown.slice(0, 60).map(u => (
            <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span>{u.name} <span style={{ color: '#94a3b8' }}>· {u.count} отгр. · {u.factories.join(', ')}</span></span>
              <button onClick={() => { startNew(u.name); }} style={{ ...chip(false), whiteSpace: 'nowrap' }}>Поставить точку</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btn = (bg: string): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 8, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 12, border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: 12,
  background: active ? '#1e293b' : '#fff', color: active ? '#fff' : '#334155',
});
const input: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, flex: '1 1 220px', minWidth: 180,
};
