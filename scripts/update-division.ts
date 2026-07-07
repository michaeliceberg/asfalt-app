// scripts/update-division.ts
import { db } from '../lib/db';
import { shipments, outgoingRequests, incomingMaterials } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function updateDivisions() {
  console.log('🔄 Обновление division в таблицах...');
  
  try {
    // Обновляем shipments
    console.log('📦 Обновление shipments...');
    await db.update(shipments)
      .set({ division: 'ЛХ' })
      .where(sql`division = 'Луховицы'`);
    
    await db.update(shipments)
      .set({ division: 'ЛЮ' })
      .where(sql`division = 'Люберцы'`);
    
    // Обновляем outgoing_requests
    console.log('📋 Обновление outgoing_requests...');
    await db.update(outgoingRequests)
      .set({ division: 'ЛХ' })
      .where(sql`number LIKE 'ЛХ%'`);
    
    await db.update(outgoingRequests)
      .set({ division: 'ЛЮ' })
      .where(sql`number LIKE 'ЛЮ%'`);
    
    // Обновляем incoming_materials (если есть колонка division)
    console.log('📥 Обновление incoming_materials...');
    await db.update(incomingMaterials)
      .set({ division: 'ЛХ' })
      .where(sql`number LIKE 'ЛХ%'`);
    
    await db.update(incomingMaterials)
      .set({ division: 'ЛЮ' })
      .where(sql`number LIKE 'ЛЮ%'`);
    
    console.log('✅ Готово!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

updateDivisions().catch(console.error);