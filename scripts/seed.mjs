// scripts/seed.mjs
import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '../data/sqlite.db'));

async function seed() {
  console.log('🌱 Заполнение базы данных...');
  
  try {
    // Заводы
    console.log('📦 Добавление заводов...');
    db.exec(`
      INSERT OR IGNORE INTO factories (id, name, order_index) VALUES 
        ('ЛХ', 'Луховицы', 1),
        ('ЛЮ', 'Люберцы', 2),
        ('СП', 'Сергиев Посад', 3),
        ('Щ', 'Щелково', 4);
    `);
    
    // Группы
    console.log('👥 Добавление групп...');
    db.exec(`
      INSERT OR IGNORE INTO user_groups (id, name, description) VALUES 
        (1, 'Группа №1', 'Полный доступ ко всем заводам'),
        (2, 'Группа №2', 'Доступ только к ЛХ и ЛЮ');
    `);
    
    // Доступ групп к заводам
    console.log('🔐 Настройка доступа...');
    db.exec(`
      INSERT OR IGNORE INTO group_factory_access (group_id, factory_id) VALUES 
        (1, 'ЛХ'), (1, 'ЛЮ'), (1, 'СП'), (1, 'Щ'),
        (2, 'ЛХ'), (2, 'ЛЮ');
    `);
    
    // Создание администратора
    console.log('👤 Создание пользователей...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, password_hash, group_id, is_active, login_count) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run('admin', adminPassword, 1, 1, 0);
    
    console.log('✅ База данных успешно заполнена!');
    console.log('📋 Пользователи: admin / admin123');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

seed().catch(console.error);