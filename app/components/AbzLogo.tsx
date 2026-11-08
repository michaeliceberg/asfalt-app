// app/components/AbzLogo.tsx
// Знак «АБЗ Контроль»: башня смесителя на ногах, транспортёр, труба с дымом,
// дорога с разметкой. Тот же рисунок — иконка вкладки (app/icon.svg).
export default function AbzLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="64" height="64" rx="14" fill="#1E2A33" />
      <circle cx="49" cy="8.5" r="3.4" fill="#C9D3DC" opacity=".5" />
      <circle cx="53.5" cy="5" r="2.3" fill="#C9D3DC" opacity=".3" />
      <rect x="45.5" y="13" width="7" height="31" rx="1.5" fill="#C9D3DC" />
      <path d="M7 41 L23 15" stroke="#F6B93B" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="22" y="7" width="18" height="22" rx="2" fill="#F6B93B" />
      <rect x="22" y="14" width="18" height="2.5" fill="#1E2A33" />
      <rect x="23" y="29" width="3.5" height="15" fill="#F6B93B" />
      <rect x="35.5" y="29" width="3.5" height="15" fill="#F6B93B" />
      <rect x="6" y="44" width="52" height="12" rx="3" fill="#3A4853" />
      <rect x="10" y="48.75" width="9" height="2.5" rx="1.25" fill="#F6B93B" />
      <rect x="27.5" y="48.75" width="9" height="2.5" rx="1.25" fill="#F6B93B" />
      <rect x="45" y="48.75" width="9" height="2.5" rx="1.25" fill="#F6B93B" />
    </svg>
  );
}
