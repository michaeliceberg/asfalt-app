// app/landing/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Module {
  id: string;
  name: string;
  icon: string;
  description: string;
  basePrice: number;
  category: string;
}

interface Tariff {
  name: string;
  price: number;
  color: string;
  modules: string[];
}

// Модули для выбора
const MODULES: Module[] = [
  { id: 'shipments', name: '🚛 Отгрузки', icon: '📦', description: 'План/факт, группировка по заводам', basePrice: 5000, category: 'basic' },
  { id: 'incoming', name: '📥 Поступления', icon: '🚚', description: 'Битум, щебень, песок', basePrice: 5000, category: 'basic' },
  { id: 'telegram', name: '🤖 Telegram бот', icon: '💬', description: 'Уведомления о новых заявках', basePrice: 7000, category: 'standard' },
  { id: 'activity', name: '📊 Активность за 24ч', icon: '📈', description: 'Гистограмма по часам', basePrice: 3000, category: 'standard' },
  { id: 'charts', name: '📉 Аналитика', icon: '📊', description: 'Графики, тренды, прогнозы', basePrice: 5000, category: 'business' },
  { id: 'forecast', name: '🔮 Прогноз', icon: '✨', description: 'ML-прогноз отгрузок', basePrice: 8000, category: 'business' },
  { id: 'alerts', name: '🔔 Крит. уведомления', icon: '⚠️', description: 'Опасные отклонения от плана', basePrice: 4000, category: 'premium' },
  { id: 'reports', name: '📋 Отчёты Excel', icon: '📎', description: 'Экспорт данных', basePrice: 3000, category: 'premium' },
  { id: 'multifactory', name: '🏭 Мультизавод', icon: '🏭', description: 'До 5 заводов', basePrice: 10000, category: 'enterprise' },
];

// Тарифы
const TARIFFS: Record<string, Tariff> = {
  basic: { name: 'Базовый', price: 10000, color: '#4caf50', modules: ['shipments', 'incoming'] },
  standard: { name: 'Стандарт', price: 25000, color: '#2196f3', modules: ['shipments', 'incoming', 'telegram', 'activity'] },
  business: { name: 'Бизнес', price: 50000, color: '#9c27b0', modules: ['shipments', 'incoming', 'telegram', 'activity', 'charts', 'forecast'] },
  premium: { name: 'Премиум', price: 80000, color: '#ff9800', modules: ['shipments', 'incoming', 'telegram', 'activity', 'charts', 'forecast', 'alerts', 'reports'] },
  enterprise: { name: 'Корпоративный', price: 150000, color: '#f44336', modules: ['shipments', 'incoming', 'telegram', 'activity', 'charts', 'forecast', 'alerts', 'reports', 'multifactory'] },
};

export default function LandingPage() {
  const [activeModules, setActiveModules] = useState<string[]>(['shipments', 'incoming']);
  const [selectedTariff, setSelectedTariff] = useState<string | null>('standard');
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  const addModule = (moduleId: string): void => {
    if (!activeModules.includes(moduleId)) {
      setActiveModules([...activeModules, moduleId]);
      setSelectedTariff(null);
    }
  };

  const removeModule = (moduleId: string): void => {
    setActiveModules(activeModules.filter((id: string) => id !== moduleId));
    setSelectedTariff(null);
  };

  const selectTariff = (tariffKey: string): void => {
    setSelectedTariff(tariffKey);
    setActiveModules(TARIFFS[tariffKey].modules);
  };

  const calculatePrice = (): number => {
    if (selectedTariff && TARIFFS[selectedTariff]) {
      return TARIFFS[selectedTariff].price;
    }
    return activeModules.reduce((sum: number, id: string) => {
      const foundModule = MODULES.find((m: Module) => m.id === id);
      return sum + (foundModule?.basePrice || 0);
    }, 0);
  };

  const getModulePrice = (moduleId: string): string => {
    if (selectedTariff && TARIFFS[selectedTariff]?.modules.includes(moduleId)) {
      return 'в тарифе';
    }
    const foundModule = MODULES.find((m: Module) => m.id === moduleId);
    return `${foundModule?.basePrice} ₽`;
  };

  const formatPrice = (price: number): string => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="combinator-landing">
      {/* Hero секция */}
      <section className="hero">
        <div className="hero-content">
          <div className="logo">
  <span className="logo-icon">🏭</span>
  <h1>
    <span className="logo-name">АБЗ Контроль</span>
  </h1>
</div>
          <p className="tagline">Контроль отгрузок и поступлений в реальном времени</p>
          <p className="description">
            Соберите идеальное приложение для контроля отгрузок, 
            поступлений и аналитики. Добавляйте модули как конструктор.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' })}>
              🎨 Собрать приложение
            </button>
            <button className="btn-secondary">📹 Смотреть видео</button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-number">3+</span>
            <span className="stat-label">года на рынке</span>
          </div>
          <div className="stat">
            <span className="stat-number">50+</span>
            <span className="stat-label">заводов</span>
          </div>
          <div className="stat">
            <span className="stat-number">10K+</span>
            <span className="stat-label">отгрузок в день</span>
          </div>
        </div>
      </section>

      {/* Конструктор */}
      <section id="builder" className="builder">
        <h2 className="section-title">🎨 Соберите своё приложение</h2>
        <p className="section-subtitle">Добавляйте модули и смотрите, как меняется телефон</p>

        <div className="builder-layout">
          {/* Левая панель - модули */}
          <div className="modules-panel">
            <h3>📦 Модули</h3>
            <div className="modules-list">
              {MODULES.map((module: Module) => {
                const isActive = activeModules.includes(module.id);
                return (
                  <motion.div
                    key={module.id}
                    className={`module-item ${isActive ? 'active' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    onHoverStart={() => setHoveredModule(module.id)}
                    onHoverEnd={() => setHoveredModule(null)}
                  >
                    <div className="module-icon">{module.icon}</div>
                    <div className="module-info">
                      <div className="module-name">{module.name}</div>
                      <div className="module-desc">{module.description}</div>
                    </div>
                    <div className="module-price">{getModulePrice(module.id)}</div>
                    {!isActive ? (
                      <button className="add-btn" onClick={() => addModule(module.id)}>+</button>
                    ) : (
                      <button className="remove-btn" onClick={() => removeModule(module.id)}>✓</button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Центр - телефон */}
          <div className="phone-container">
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="phone-header">
                  <span className="time">09:41</span>
                  <span className="signal">📶</span>
                  <span className="battery">🔋 100%</span>
                </div>
                <div className="phone-app">
                  <div className="app-header">АБЗ КОНТРОЛЬ</div>
                  <div className="app-content">
                    {activeModules.includes('shipments') && (
                      <div className="demo-card">
                        <div className="demo-header">
                          <span>🚛 Отгрузки сегодня</span>
                          <span className="demo-badge">план/факт</span>
                        </div>
                        <div className="demo-stats">
                          <div><span className="stat-label">Вып</span> <strong>446.7</strong></div>
                          <div><span className="stat-label">Заяв</span> <strong>500</strong></div>
                          <div><span className="stat-label success">89%</span></div>
                        </div>
                        <div className="demo-progress"><div className="progress-fill" style={{width: '89%'}}></div></div>
                        <div className="demo-row">ПК 25 Луховицкий <span>509.3/500 т 🟢</span></div>
                        <div className="demo-row">ПК 26 Серебряно-Прудский <span>429.3/550 т 🟠</span></div>
                      </div>
                    )}
                    {activeModules.includes('incoming') && (
                      <div className="demo-card">
                        <div className="demo-header">📥 Поступления</div>
                        <div className="demo-row">Битум БНД 70/100 <span>48.5 т</span></div>
                        <div className="demo-row">Щебень фр. 5-20 <span>120.3 т</span></div>
                      </div>
                    )}
                    {activeModules.includes('telegram') && (
                      <div className="demo-card telegram-demo">
                        <div className="demo-header">🤖 Telegram бот</div>
                        <div className="demo-message">📨 Новые заявки на отгрузку!</div>
                        <div className="demo-message-small">ПК 25 Каширский - 400 т</div>
                      </div>
                    )}
                    {activeModules.includes('activity') && (
                      <div className="demo-card">
                        <div className="demo-header">📊 Активность за 24ч</div>
                        <div className="activity-bars">
                          <div className="bar" style={{height: '24px'}}></div>
                          <div className="bar" style={{height: '16px'}}></div>
                          <div className="bar" style={{height: '32px'}}></div>
                          <div className="bar" style={{height: '8px'}}></div>
                        </div>
                      </div>
                    )}
                    {!activeModules.some(m => ['shipments', 'incoming', 'telegram', 'activity'].includes(m)) && (
                      <div className="demo-placeholder">
                        <p>✨ Добавьте модули слева</p>
                        <p className="placeholder-small">Нажмите + на любом модуле</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="phone-home"></div>
            </div>
          </div>

          {/* Правая панель - итоги */}
         {/* Правая панель - итоги */}
<div className="summary-panel">
  <h3>💰 Ваша сборка</h3>
  <div className="active-modules-list">
    {activeModules.map((id: string) => {
      const foundModule = MODULES.find((m: Module) => m.id === id);
      if (!foundModule) return null;
      return (
        <div key={id} className="active-module">
          <span>{foundModule.icon} {foundModule.name}</span>
          <span suppressHydrationWarning>
            {foundModule.basePrice.toLocaleString()} ₽
          </span>
        </div>
      );
    })}
  </div>
  <div className="total-price">
    <span>Итого в месяц:</span>
    <strong suppressHydrationWarning>
      {formatPrice(calculatePrice())} ₽
    </strong>
  </div>
  <button className="order-btn">🚀 Заказать демо</button>
  
  <div className="tariffs">
    <h4>🔥 Готовые тарифы</h4>
    <div className="tariff-buttons">
      {Object.entries(TARIFFS).map(([key, tariff]) => (
        <button
          key={key}
          className={`tariff-btn ${selectedTariff === key ? 'active' : ''}`}
          style={{ borderColor: tariff.color }}
          onClick={() => selectTariff(key)}
        >
          <span className="tariff-name">{tariff.name}</span>
          <span className="tariff-price" suppressHydrationWarning>
            {tariff.price.toLocaleString()} ₽
          </span>
        </button>
      ))}
    </div>
  </div>
</div>
        </div>






        
      </section>

      {/* Преимущества */}
      <section className="features">
        <h2 className="section-title">✨ Почему АБЗ Контроль?</h2>
        <div className="features-grid">
          <div className="feature">
            <div className="feature-icon">⚡</div>
            <h3>Реальное время</h3>
            <p>Данные обновляются каждые 10 минут из вашей 1С</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🤖</div>
            <h3>Telegram бот</h3>
            <p>Уведомления о новых заявках и критических отклонениях</p>
          </div>
          <div className="feature">
            <div className="feature-icon">📊</div>
            <h3>Аналитика и прогнозы</h3>
            <p>Тренды, графики, ML-прогноз отгрузок</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🔧</div>
            <h3>Интеграция с 1С</h3>
            <p>Подключаем вашу 1С за 1 день</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🏭</div>
            <h3>Мультизавод</h3>
            <p>Контролируйте несколько заводов в одном окне</p>
          </div>
          <div className="feature">
            <div className="feature-icon">💬</div>
            <h3>Поддержка 24/7</h3>
            <p>Техническая поддержка в Telegram</p>
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section className="testimonials">
        <h2 className="section-title">Отзывы клиентов</h2>
        <div className="testimonials-grid">
          <div className="testimonial">
            <p>За месяц использования сократили время диспетчера на 40%. Отличное решение для контроля отгрузок!</p>
            <div className="author">— Директор АБЗ, г. Щёлково</div>
          </div>
          <div className="testimonial">
            <p>Telegram бот — гениально просто! Теперь всегда знаю, когда появляются новые заявки.</p>
            <div className="author">— Начальник ПДО, г. Люберцы</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">АБЗ КОНТРОЛЬ</div>
          <div className="footer-links">
            <a href="#">О нас</a>
            <a href="#">Тарифы</a>
            <a href="#">Документация</a>
            <a href="mailto:abziceberg@gmail.com">Контакты</a>
          </div>
          <div className="footer-contacts">
            <span>📧 abziceberg@gmail.com</span>
            <span>📞 <a href="tel:+79160991997" style={{ color: 'inherit', textDecoration: 'none' }}>+7 (916) 099-19-97</a></span>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 АБЗ Контроль. Все права защищены.
        </div>
      </footer>
    </div>
  );
}