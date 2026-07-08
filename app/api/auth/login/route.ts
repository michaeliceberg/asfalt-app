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

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function POST(request: Request) {
  // Два формата входа:
  // 1) application/json — используется мобильным (React Native) приложением,
  //    отвечаем JSON с токеном, как раньше.
  // 2) form (x-www-form-urlencoded) — обычная веб-страница входа, отвечаем
  //    редиректом (303). Это принципиально: Safari на iOS в PWA-режиме
  //    (добавлено на домашний экран) ненадёжно сохраняет cookie, если она
  //    приходит в ответ на fetch()-запрос из JS — а если cookie приходит
  //    как часть настоящей навигации браузера (редирект после сабмита формы),
  //    сохраняется гораздо надёжнее. Именно это и было причиной "требует
  //    логин при каждом открытии" именно на телефоне (на Mac работало, там
  //    fetch-cookie Safari не режет).
  const contentType = request.headers.get('content-type') || '';
  const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  try {
    let username: string;
    let password: string;

    if (isFormSubmit) {
      const form = await request.formData();
      username = String(form.get('username') || '');
      password = String(form.get('password') || '');
    } else {
      const body = await request.json();
      username = body.username;
      password = body.password;
    }

    const fail = (message: string) => {
      if (isFormSubmit) {
        const url = new URL('/login', request.url);
        url.searchParams.set('error', message);
        return NextResponse.redirect(url, 303);
      }
      return NextResponse.json({ error: message }, { status: 401 });
    };

    // Ищем пользователя
    const user = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user.length) {
      return fail('Неверный логин или пароль');
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
      return fail('Неверный логин или пароль');
    }

    // Создаём токен
    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username, groupId: user[0].group_id },
      JWT_SECRET,
      { expiresIn: SESSION_MAX_AGE_SECONDS }
    );

    console.log('✅ Успешный вход:', username);

    if (isFormSubmit) {
      const response = NextResponse.redirect(new URL('/', request.url), 303);
      setSessionCookie(response, token);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
        groupId: user[0].group_id,
      }
    });
    setSessionCookie(response, token);
    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    if (isFormSubmit) {
      const url = new URL('/login', request.url);
      url.searchParams.set('error', 'Ошибка сервера');
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}




