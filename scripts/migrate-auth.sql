-- Добавляем новые таблицы
CREATE TABLE IF NOT EXISTS factories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  group_id INTEGER REFERENCES user_groups(id),
  telegram_chat_id TEXT,
  last_login_at INTEGER,
  login_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS group_factory_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES user_groups(id),
  factory_id TEXT REFERENCES factories(id)
);

CREATE TABLE IF NOT EXISTS user_login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  login_time INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  session_duration INTEGER
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Заполняем данными
INSERT OR IGNORE INTO factories (id, name, order_index) VALUES 
  ('ЛХ', 'Луховицы', 1),
  ('ЛЮ', 'Люберцы', 2),
  ('СП', 'Сергиев Посад', 3),
  ('Щ', 'Щелково', 4);

INSERT OR IGNORE INTO user_groups (id, name, description) VALUES 
  (1, 'Группа №1', 'Полный доступ ко всем заводам'),
  (2, 'Группа №2', 'Доступ только к ЛХ и ЛЮ');

INSERT OR IGNORE INTO group_factory_access (group_id, factory_id) VALUES 
  (1, 'ЛХ'), (1, 'ЛЮ'), (1, 'СП'), (1, 'Щ'),
  (2, 'ЛХ'), (2, 'ЛЮ');
