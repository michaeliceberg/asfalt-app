// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    console.log('🔐 Login attempt:', { username, password });
    
    // Ищем пользователя
    const user = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    console.log('📋 Found user:', user[0]?.username);
    
    if (!user.length) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }
    
    console.log('🔑 Password hash from DB:', user[0].password_hash);
    console.log('🔑 Hash length:', user[0].password_hash?.length);
    
    // Проверяем пароль с помощью bcrypt
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user[0].password_hash);
      console.log('✅ bcrypt.compare result:', isValid);
    } catch (err) {
      console.error('❌ bcrypt error:', err);
      // Если bcrypt не работает, пробуем простое сравнение (для теста)
      isValid = password === user[0].password_hash;
      console.log('📋 Simple compare result:', isValid);
    }
    
    if (!isValid) {
      console.log('❌ Password invalid for user:', username);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }
    
    // Создаём токен
    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username, groupId: user[0].group_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login successful for:', username);
    
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
        groupId: user[0].group_id,
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}






// // app/api/auth/login/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { users } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs';

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// export async function POST(request: Request) {
//   try {
//     const { username, password } = await request.json();
    
//     console.log('🔐 Login attempt:', { username, password });
    
//     // Ищем пользователя
//     const user = await db.select()
//       .from(users)
//       .where(eq(users.username, username))
//       .limit(1);
    
//     console.log('📋 Found user:', user[0]?.username);
    
//     if (!user.length) {
//       return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
//     }
    
//     // Проверяем пароль с помощью bcrypt
//     let isValid = false;
//     try {
//       isValid = await bcrypt.compare(password, user[0].password_hash);
//     } catch (err) {
//       console.error('bcrypt error:', err);
//       // Если bcrypt не работает, пробуем простое сравнение (для теста)
//       isValid = password === user[0].password_hash;
//     }
    
//     console.log('✅ Password valid:', isValid);
    
//     if (!isValid) {
//       return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
//     }
    
//     // Создаём токен
//     const token = jwt.sign(
//       { userId: user[0].id, username: user[0].username, groupId: user[0].group_id },
//       JWT_SECRET,
//       { expiresIn: '7d' }
//     );
    
//     return NextResponse.json({
//       success: true,
//       token,
//       user: {
//         id: user[0].id,
//         username: user[0].username,
//         groupId: user[0].group_id,
//       }
//     });
    
//   } catch (error) {
//     console.error('❌ Login error:', error);
//     return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
//   }
// }
















// // app/api/auth/login/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { users } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// export async function POST(request: Request) {
//   try {
//     const { username, password } = await request.json();
    
//     // Ищем пользователя
//     const user = await db.select()
//       .from(users)
//       .where(eq(users.username, username))
//       .limit(1);
    
//     if (!user.length) {
//       return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
//     }
    
//     // Проверяем пароль
//     const isValid = await bcrypt.compare(password, user[0].password_hash);
//     if (!isValid) {
//       return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
//     }
    
//     // Создаём токен
//     const token = jwt.sign(
//       { userId: user[0].id, username: user[0].username },
//       JWT_SECRET,
//       { expiresIn: '7d' }
//     );
    
//     return NextResponse.json({
//       success: true,
//       token,
//       user: {
//         id: user[0].id,
//         username: user[0].username,
//         groupId: user[0].group_id,
//       }
//     });
    
//   } catch (error) {
//     console.error('Login error:', error);
//     return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
//   }
// }