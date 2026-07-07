// scripts/seed.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../lib/db/schema';
import bcrypt from 'bcryptjs';
import path from 'path';

const sqlite = new Database(path.join(process.cwd(), 'data', 'sqlite.db'));
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log('🌱 Заполнение базы данных...');
  
  try {
    // Заводы
    console.log('📦 Добавление заводов...');
    await db.insert(schema.factories).values([
      { id: 'ЛХ', name: 'Луховицы', order_index: 1 },
      { id: 'ЛЮ', name: 'Люберцы', order_index: 2 },
      { id: 'СП', name: 'Сергиев Посад', order_index: 3 },
      { id: 'Щ', name: 'Щелково', order_index: 4 },
    ]);
    
    // Группы
    console.log('👥 Добавление групп...');
    await db.insert(schema.userGroups).values([
      { id: 1, name: 'Группа №1', description: 'Полный доступ ко всем заводам' },
      { id: 2, name: 'Группа №2', description: 'Доступ только к ЛХ и ЛЮ' },
    ]);
    
    // Доступ групп к заводам
    console.log('🔐 Настройка доступа...');
    await db.insert(schema.groupFactoryAccess).values([
      { group_id: 1, factory_id: 'ЛХ' },
      { group_id: 1, factory_id: 'ЛЮ' },
      { group_id: 1, factory_id: 'СП' },
      { group_id: 1, factory_id: 'Щ' },
      { group_id: 2, factory_id: 'ЛХ' },
      { group_id: 2, factory_id: 'ЛЮ' },
    ]);
    
    // Создание администратора
    console.log('👤 Создание пользователей...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    await db.insert(schema.users).values({
      username: 'admin',
      password_hash: adminPassword,
      group_id: 1,
      is_active: true,  // ← boolean, не number
      login_count: 0,
    });
    
    console.log('✅ База данных успешно заполнена!');
    console.log('📋 Пользователи: admin / admin123');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

seed().catch(console.error);