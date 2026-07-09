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

/**
 * Достаёт токен из запроса (Authorization: Bearer — для мобильного
 * приложения, иначе httpOnly cookie — для веба) и проверяет, что это
 * админ (group_id === 1). Используется в /api/admin/* роутах — proxy.ts
 * проверяет только "залогинен ли", а не роль.
 */
export async function requireAdmin(request: Request): Promise<DecodedToken | null> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let token = bearerToken;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : null;
  }

  if (!token) return null;

  const decoded = await getUserFromToken(token);
  if (!decoded || decoded.groupId !== 1) return null;

  return decoded;
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