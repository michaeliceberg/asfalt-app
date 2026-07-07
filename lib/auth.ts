// lib/auth.ts
import jwt from 'jsonwebtoken';
import { db } from './db';
import { users, groupFactoryAccess } from './db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface DecodedToken {
  userId: number;
  username: string;
  groupId: number;
}

export async function getUserFromToken(token: string): Promise<DecodedToken | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getUserAccessibleFactories(token: string): Promise<string[]> {
  try {
    const decoded = await getUserFromToken(token);
    if (!decoded) return [];
    
    // Если группа №1 (админ) — возвращаем все заводы
    if (decoded.groupId === 1) {
      return ['ЛХ', 'ЛЮ', 'СП', 'Щ'];
    }
    
    // Для остальных групп — получаем доступ из БД
    const access = await db.select()
      .from(groupFactoryAccess)
      .where(eq(groupFactoryAccess.group_id, decoded.groupId));
    
    // Фильтруем null значения и преобразуем в массив строк
    return access
      .map(a => a.factory_id)
      .filter((id): id is string => id !== null);
  } catch (error) {
    console.error('Error getting user factories:', error);
    return [];
  }
}