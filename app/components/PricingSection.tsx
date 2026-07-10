// app/components/PricingSection.tsx
'use client';

import type { CSSProperties } from 'react';
import {
  Send,
  Phone,
  Check,
  X,
  Crown,
  Smartphone,
  Satellite,
  Bell,
  Lock,
  FileSpreadsheet,
  RefreshCw,
  Headphones,
} from 'lucide-react';

type Feature =
  | { kind: 'icon'; Icon: typeof Smartphone; text: string; premium?: boolean }
  | { kind: 'sync' };

const FEATURES: Feature[] = [
  { kind: 'icon', Icon: Smartphone, text: 'Ваша 1С в телефоне' },
  { kind: 'sync' },
  { kind: 'icon', Icon: Satellite, text: 'GPS-навигация машин' },
  { kind: 'icon', Icon: Bell, text: 'Push-уведомления', premium: true },
  { kind: 'icon', Icon: Lock, text: 'Доступ по ролям' },
  { kind: 'icon', Icon: FileSpreadsheet, text: 'Excel отчеты', premium: true },
];

function PremiumBadge() {
  return (
    <span
      title="Премиум-опция — доступна в расширенном тарифе"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        marginLeft: 2,
        padding: '1px 5px',
        borderRadius: 6,
        background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
        color: '#1a1a2e',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.2px',
        flexShrink: 0,
      }}
    >
      <Crown size={9} strokeWidth={2.6} />
      PRO
    </span>
  );
}

function FeatureChips() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 20,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 8,
      }}>
        {FEATURES.map((feature, i) => {
          const chipStyle: CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#c0c0d8',
            fontSize: 11.5,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          };

          if (feature.kind === 'sync') {
            return (
              <span key={i} style={chipStyle}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>24/7</span>
                <RefreshCw size={12} strokeWidth={2.2} style={{ flexShrink: 0, color: '#ffd93d' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>2 мин</span>
              </span>
            );
          }

          const { Icon, text, premium } = feature;
          return (
            <span key={i} style={chipStyle}>
              <Icon size={13} strokeWidth={2.2} style={{ flexShrink: 0, color: '#ffd93d' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
              {premium && <PremiumBadge />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface Tariff {
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  description: string;
}

// Единый термин для "продвинутых" функций — везде PRO (и в чипах-фичах,
// и в названии тарифа, и в таблице сравнения), чтобы не путать
// "Премиум"/"PRO" как два разных слова для одного и того же.
const TARIFFS: Tariff[] = [
  { name: 'Базовый', price: 'от 15 000 ₽', period: '/мес', description: 'Контроль отгрузок в реальном времени' },
  { name: 'Стандарт', price: 'от 25 000 ₽', period: '/мес', highlight: true, description: 'Всё для полноценной работы завода' },
  { name: 'PRO', price: 'от 40 000 ₽', period: '/мес', description: 'Максимум возможностей и приоритетная поддержка' },
];

interface FeatureRow {
  Icon: typeof Smartphone;
  label: string;
  values: [boolean, boolean, boolean];
}

const FEATURE_ROWS: FeatureRow[] = [
  { Icon: Smartphone, label: '1С на телефоне', values: [true, true, true] },
  { Icon: RefreshCw, label: 'Обновление каждые 2 мин', values: [true, true, true] },
  { Icon: Satellite, label: 'GPS-навигация машин', values: [true, true, true] },
  { Icon: Lock, label: 'Доступ по ролям', values: [false, true, true] },
  { Icon: Bell, label: 'Push-уведомления', values: [false, false, true] },
  { Icon: FileSpreadsheet, label: 'Excel отчеты', values: [false, false, true] },
  { Icon: Headphones, label: 'Приоритетная поддержка 24/7', values: [false, false, true] },
];

export default function PricingSection() {
  return (
    <div
      id="pricing-section"
      style={{
        marginTop: 28,
        scrollMarginTop: 16,
      }}
    >
      <FeatureChips />

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#1a1a2e',
          margin: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Crown size={18} strokeWidth={2.2} color="#f6b93b" />
          Тарифы
        </h2>
        <p style={{ fontSize: 12.5, color: '#888', margin: '4px 0 0' }}>
          Выберите вариант под масштаб вашего завода
        </p>
      </div>

      {/* Карточки тарифов.
          Раньше тут стояло repeat(auto-fit, minmax(140px, 1fr)) — на узких
          экранах карточки "вылезали" друг на друга, потому что у grid-items
          по умолчанию min-width:auto (по содержимому), и нередоносимый
          текст цены/бейджа "ПОПУЛЯРНЫЙ" не давал колонке сжаться до
          честной 1/3 ширины, из-за чего соседние карточки перекрывались.
          Фикс: всегда ровно 3 колонки (тарифов и не бывает больше/меньше)
          + minWidth:0 на самих карточках, чтобы контент внутри переносился
          по словам, а не раздвигал сетку. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 18,
      }}>
        {TARIFFS.map((t) => (
          <div
            key={t.name}
            style={{
              minWidth: 0,
              borderRadius: 14,
              padding: '16px 8px',
              textAlign: 'center',
              background: t.highlight
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                : '#fff',
              border: t.highlight ? '1px solid rgba(255,217,61,0.4)' : '1px solid #e9ecef',
              boxShadow: t.highlight ? '0 8px 24px rgba(15,52,96,0.25)' : '0 1px 4px rgba(0,0,0,0.04)',
              position: 'relative',
            }}
          >
            {t.highlight && (
              <span style={{
                position: 'absolute',
                top: -9,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
                color: '#1a1a2e',
                fontSize: 9.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 6,
                letterSpacing: '0.3px',
              }}>
                ПОПУЛЯРНЫЙ
              </span>
            )}
            <div style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: t.highlight ? '#ffd93d' : '#1a1a2e',
              marginBottom: 6,
            }}>
              {t.name}
            </div>
            <div style={{ color: t.highlight ? '#fff' : '#1a1a2e' }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{t.price}</span>
              <span style={{ fontSize: 11, color: t.highlight ? '#9090b0' : '#888' }}>{t.period}</span>
            </div>
            <div style={{
              fontSize: 10.5,
              color: t.highlight ? '#9090b0' : '#888',
              marginTop: 6,
              lineHeight: 1.4,
            }}>
              {t.description}
            </div>
          </div>
        ))}
      </div>

      {/* Сетка сравнения функций */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #e9ecef',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 34px 34px 34px',
          padding: '8px 12px',
          background: '#f8f9fb',
          borderBottom: '1px solid #e9ecef',
          fontSize: 10.5,
          fontWeight: 700,
          color: '#666',
        }}>
          <span>Возможность</span>
          <span style={{ textAlign: 'center' }}>Баз.</span>
          <span style={{ textAlign: 'center' }}>Станд.</span>
          <span style={{ textAlign: 'center' }}>PRO</span>
        </div>

        {FEATURE_ROWS.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 34px 34px 34px',
              alignItems: 'center',
              padding: '9px 12px',
              borderBottom: i < FEATURE_ROWS.length - 1 ? '1px solid #f1f3f5' : 'none',
              fontSize: 11.5,
              color: '#1a1a2e',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <row.Icon size={13} strokeWidth={2.2} style={{ flexShrink: 0, color: '#667eea' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
            </span>
            {row.values.map((included, idx) => (
              <span key={idx} style={{ display: 'flex', justifyContent: 'center' }}>
                {included ? (
                  <Check size={15} strokeWidth={2.6} color="#28a745" />
                ) : (
                  <X size={13} strokeWidth={2.4} color="#ced4da" />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Повторные кнопки связи */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <a
          href="https://t.me/michaeldeve"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '11px 10px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
            color: '#1a1a2e',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxShadow: '0 4px 16px rgba(255, 217, 61, 0.28)',
          }}
        >
          <Send size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Написать в Telegram</span>
        </a>

        <a
          href="tel:+79160991997"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '11px 10px',
            borderRadius: 10,
            background: '#fff',
            color: '#1a1a2e',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            border: '1px solid #e9ecef',
          }}
        >
          <Phone size={15} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>+7 (916) 099-19-97</span>
        </a>
      </div>

      <p style={{
        fontSize: 10.5,
        color: '#aaa',
        textAlign: 'center',
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}>
        Push-уведомления и Excel-отчёты входят в тариф «PRO»
        <Crown size={10} strokeWidth={2.6} color="#f6b93b" />
      </p>
    </div>
  );
}
