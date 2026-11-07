// lib/importAuth.ts
// Откуда принимаем выгрузку Айсберга: сервер завода (Python-скрипт) и сам
// сервер. Список можно дополнить через EXCEL_IMPORT_IPS в .env (через запятую).
const ALLOWED_IPS = [
    '89.31.82.106', // сервер завода Айсберг
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    ...(process.env.EXCEL_IMPORT_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
];

// X-Real-IP ставит nginx ($remote_addr) — его клиент подделать не может,
// в отличие от левой части X-Forwarded-For.
export function getClientIp(request: Request): string {
    return request.headers.get('x-real-ip')
        || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim()
        || 'unknown';
}

export function isImportIpAllowed(ip: string): boolean {
    return ALLOWED_IPS.includes(ip);
}
