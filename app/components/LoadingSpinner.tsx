'use client';

// Загрузка в виде асфальтобетонного завода (2026-11-08): по транспортёру
// едут камни в башню смесителя, из трубы идёт дым, под башню заезжает
// самосвал, грузится и уезжает. Анимация только transform/opacity (CSS
// в theme.css, классы abz-load-*). Пропсы прежние — вызовы не менялись.

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const WIDTH = { small: 150, medium: 190, large: 230 };

export default function LoadingSpinner({
  message = 'Загрузка данных...',
  size = 'medium',
  fullScreen = false,
}: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner-wrapper ${fullScreen ? 'fullscreen' : ''}`}>
      <svg className="abz-load" width={WIDTH[size]} viewBox="0 -8 200 132" role="img" aria-label="Загрузка">
        {/* дым из трубы */}
        <g className="abz-load-smoke">
          <circle className="abz-load-puff" cx="160" cy="26" r="6" />
          <circle className="abz-load-puff" cx="160" cy="26" r="6" style={{ animationDelay: '-0.8s' }} />
          <circle className="abz-load-puff" cx="160" cy="26" r="6" style={{ animationDelay: '-1.6s' }} />
        </g>
        {/* труба */}
        <rect className="abz-load-steel" x="153" y="30" width="14" height="70" rx="2" />
        {/* сушильный барабан */}
        <g>
          <rect className="abz-load-steel" x="108" y="78" width="40" height="16" rx="8" />
          <clipPath id="abz-drum-clip"><rect x="108" y="78" width="40" height="16" rx="8" /></clipPath>
          <g clipPath="url(#abz-drum-clip)">
            <g className="abz-load-drum">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <rect key={i} className="abz-load-dark" x={100 + i * 8} y="78" width="3" height="16" />
              ))}
            </g>
          </g>
        </g>
        {/* транспортёр и камни */}
        <path className="abz-load-belt" d="M14 98 L66 40" />
        <g className="abz-load-stones">
          {[0, 1, 2, 3].map(i => (
            <circle key={i} className="abz-load-stone" cx="14" cy="94" r="3" style={{ animationDelay: `${-i * 0.45}s` }} />
          ))}
        </g>
        {/* башня смесителя на ногах */}
        <rect className="abz-load-yellow" x="62" y="22" width="40" height="44" rx="3" />
        <rect className="abz-load-dark" x="62" y="34" width="40" height="4" />
        <rect className="abz-load-dark" x="74" y="44" width="16" height="10" rx="2" />
        <path className="abz-load-yellow" d="M60 22 L82 10 L104 22 Z" />
        <rect className="abz-load-yellow" x="64" y="66" width="6" height="34" />
        <rect className="abz-load-yellow" x="94" y="66" width="6" height="34" />
        {/* смесь сыплется в кузов */}
        <rect className="abz-load-pour" x="79" y="66" width="6" height="16" rx="3" />
        {/* дорога с разметкой */}
        <rect className="abz-load-road" x="0" y="100" width="200" height="16" rx="4" />
        <clipPath id="abz-road-clip"><rect x="0" y="100" width="200" height="16" rx="4" /></clipPath>
        <g clipPath="url(#abz-road-clip)"><g className="abz-load-marks">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <rect key={i} className="abz-load-yellow" x={i * 40} y="106.5" width="20" height="3" rx="1.5" />
          ))}
        </g></g>
        {/* самосвал */}
        <g className="abz-load-truck">
          <rect className="abz-load-body" x="-2" y="80" width="30" height="14" rx="2" />
          <rect className="abz-load-load" x="1" y="76" width="24" height="6" rx="3" />
          <rect className="abz-load-cab" x="28" y="84" width="14" height="10" rx="2" />
          <rect className="abz-load-glass" x="33" y="86" width="7" height="4" rx="1" />
          <circle className="abz-load-wheel" cx="6" cy="96" r="4" />
          <circle className="abz-load-wheel" cx="34" cy="96" r="4" />
        </g>
      </svg>
      {message && <p className="loading-text">{message}</p>}
    </div>
  );
}
