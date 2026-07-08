// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Cколько живёт сессия — и токен, и cookie должны совпадать
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 дней

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Ищем пользователя
    const user = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user.length) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    // Проверяем пароль с помощью bcrypt
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user[0].password_hash);
    } catch (err) {
      console.error('❌ bcrypt error:', err);
      isValid = password === user[0].password_hash;
    }

    if (!isValid) {
      console.log('❌ Неверный пароль для пользователя:', username);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    // Создаём токен
    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username, groupId: user[0].group_id },
      JWT_SECRET,
      { expiresIn: SESSION_MAX_AGE_SECONDS }
    );

    console.log('✅ Успешный вход:', username);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
        groupId: user[0].group_id,
      }
    });

    // Ставим cookie на сервере (httpOnly) — так она переживает сворачивание
    // PWA на iOS/Safari. Cookie, выставленная через document.cookie в браузере,
    // у Safari подпадает под ITP (Intelligent Tracking Prevention) и может быть
    // стёрта гораздо раньше её formal max-age, особенно у "домашних" веб-приложений.
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}




