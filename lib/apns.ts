// lib/apns.ts
//
// Отправка push-уведомлений в нативное iOS-приложение через Apple Push
// Notification service (APNs), HTTP/2 provider API.
//
// Специально не добавляем отдельную npm-библиотеку (node-apn и т.п.) —
// у нас уже есть всё нужное: 'http2' встроен в Node, 'jsonwebtoken' уже
// в зависимостях и умеет подписывать ES256 (это ровно то, что требует APNs
// для provider-токена).
//
// Что нужно в .env (см. .env.example):
//   APNS_TEAM_ID     — Team ID из Apple Developer аккаунта
//   APNS_KEY_ID      — Key ID ключа, созданного в Keys → APNs
//   APNS_PRIVATE_KEY — содержимое .p8-файла (см. .env.example про формат)
//   APNS_BUNDLE_ID   — bundleId приложения, ru.abziceberg.abzcontrol
//   APNS_PRODUCTION  — 'true' для прод-сборки из App Store/TestFlight,
//                      'false' для сборки прямо из Xcode на подключённый телефон
import http2 from 'http2';
import jwt from 'jsonwebtoken';

const TEAM_ID = process.env.APNS_TEAM_ID || '';
const KEY_ID = process.env.APNS_KEY_ID || '';
const PRIVATE_KEY = (process.env.APNS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'ru.abziceberg.abzcontrol';
const PRODUCTION = process.env.APNS_PRODUCTION !== 'false';

export const apnsConfigured = Boolean(TEAM_ID && KEY_ID && PRIVATE_KEY);

if (!apnsConfigured) {
  console.warn('⚠️ APNs не настроен (APNS_TEAM_ID/APNS_KEY_ID/APNS_PRIVATE_KEY) — нативные push отключены');
}

// Apple просит переиспользовать provider-токен, а не подписывать новый на
// каждый запрос (иначе можно словить рейт-лимит). Держим кэш ~50 минут.
let cachedJwt: { token: string; issuedAt: number } | null = null;

function getProviderToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) {
    return cachedJwt.token;
  }
  const token = jwt.sign({ iss: TEAM_ID, iat: now }, PRIVATE_KEY, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID },
  });
  cachedJwt = { token, issuedAt: now };
  return token;
}

export interface ApnsNotification {
  title: string;
  body: string;
  url?: string;
}

export interface ApnsSendResult {
  ok: boolean;
  status?: number;
  reason?: string; // тело ответа Apple при ошибке, например {"reason":"BadDeviceToken"}
}

// Токен считается мёртвым навсегда — приложение удалено, либо APNs не
// узнаёт токен. Смысл повторять отправку нет, чистим из БД.
export function isDeadApnsToken(result: ApnsSendResult): boolean {
  if (!result.reason) return false;
  return /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(result.reason);
}

export async function sendApnsNotification(
  deviceToken: string,
  notification: ApnsNotification
): Promise<ApnsSendResult> {
  if (!apnsConfigured) {
    return { ok: false, reason: 'APNs не настроен' };
  }

  const host = PRODUCTION ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const payload = JSON.stringify({
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: 'default',
    },
    url: notification.url || '/',
  });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: ApnsSendResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const client = http2.connect(`https://${host}`);
    client.on('error', (err) => {
      settle({ ok: false, reason: String(err) });
    });

    let providerToken: string;
    try {
      providerToken = getProviderToken();
    } catch (err) {
      client.close();
      settle({ ok: false, reason: `Не удалось подписать APNs JWT: ${String(err)}` });
      return;
    }

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status: number | undefined;
    let body = '';

    req.on('response', (headers) => {
      status = headers[':status'] as number;
    });
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      client.close();
      settle({ ok: status === 200, status, reason: status === 200 ? undefined : body });
    });
    req.on('error', (err) => {
      client.close();
      settle({ ok: false, reason: String(err) });
    });

    req.write(payload);
    req.end();
  });
}
