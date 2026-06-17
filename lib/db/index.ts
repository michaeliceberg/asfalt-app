// lib/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Создаём папку для БД если её нет
const dataDir = path.join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Определяем, какая БД используется
function getDatabasePath(): string {
  // Проверяем, запущено ли приложение в демо-режиме
  // Переменная окружения или глобальный флаг
  if (process.env.DEMO_MODE === 'true') {
    return path.join(dataDir, 'demo.db');
  }
  return path.join(dataDir, 'sqlite.db');
}

const dbPath = getDatabasePath();
console.log(`📁 Используется БД: ${dbPath}`);

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });




// // lib/db/index.ts
// import { drizzle } from 'drizzle-orm/better-sqlite3';
// import Database from 'better-sqlite3';
// import * as schema from './schema';
// import { existsSync, mkdirSync } from 'fs';
// import path from 'path';

// // Создаём папку для БД если её нет
// const dataDir = path.join(process.cwd(), 'data');
// if (!existsSync(dataDir)) {
//   mkdirSync(dataDir, { recursive: true });
// }

// const sqlite = new Database(path.join(dataDir, 'sqlite.db'));
// export const db = drizzle(sqlite, { schema });