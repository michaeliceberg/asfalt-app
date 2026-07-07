// app/api/push/subscribe/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Проверяем, существует ли уже подписка
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Обновляем существующую
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: Date.now(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    } else {
      // Создаём новую с правильным user_id
      await db.insert(pushSubscriptions).values({
        user_id: user.userId,  // ✅ ПРАВИЛЬНО — реальный ID пользователя
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        created_at: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}






// // app/api/push/subscribe/route.ts

// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { pushSubscriptions } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import { getUserFromToken } from '@/lib/auth';

// export async function POST(request: Request) {
//   try {
//     // ⚠️ ВРЕМЕННО ДЛЯ ТЕСТА: пропускаем проверку авторизации
//     // const cookieStore = await cookies();
//     // const token = cookieStore.get('token')?.value;

//     // if (!token) {
//     //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     // }

//     // const user = await getUserFromToken(token);
//     // if (!user) {
//     //   return NextResponse.json({ error: 'User not found' }, { status: 401 });
//     // }

//     const { subscription } = await request.json();

//     if (!subscription || !subscription.endpoint) {
//       return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
//     }

//     // Проверяем, существует ли уже подписка
//     const existing = await db
//       .select()
//       .from(pushSubscriptions)
//       .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
//       .limit(1);

//     if (existing.length > 0) {
//       // Обновляем существующую
//       await db
//         .update(pushSubscriptions)
//         .set({
//           p256dh: subscription.keys.p256dh,
//           auth: subscription.keys.auth,
//           updated_at: Date.now(),
//         })
//         .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
//     } else {
//       // Создаём новую (временно используем user_id = 2 для теста)
//       await db.insert(pushSubscriptions).values({
//         user_id: 2, // ← ВРЕМЕННО для теста (потом заменить на user.userId)
//         endpoint: subscription.endpoint,
//         p256dh: subscription.keys.p256dh,
//         auth: subscription.keys.auth,
//         created_at: Date.now(),
//       });
//     }

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Subscribe error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }




// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { pushSubscriptions } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import { getUserFromToken } from '@/lib/auth';

// export async function POST(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;

//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const user = await getUserFromToken(token);
//     if (!user) {
//       return NextResponse.json({ error: 'User not found' }, { status: 401 });
//     }

//     const { subscription } = await request.json();

//     if (!subscription || !subscription.endpoint) {
//       return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
//     }

//     const existing = await db
//       .select()
//       .from(pushSubscriptions)
//       .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
//       .limit(1);

//     if (existing.length > 0) {
//       await db
//         .update(pushSubscriptions)
//         .set({
//           p256dh: subscription.keys.p256dh,
//           auth: subscription.keys.auth,
//           updated_at: Date.now(),
//         })
//         .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
//     } else {
//       await db.insert(pushSubscriptions).values({
//         user_id: user.userId,
//         endpoint: subscription.endpoint,
//         p256dh: subscription.keys.p256dh,
//         auth: subscription.keys.auth,
//         created_at: Date.now(),
//       });
//     }

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Subscribe error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }
