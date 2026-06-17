// // app/api/telegram-start/route.ts
// import { NextResponse } from 'next/server';
// import { telegramPolling } from '@/lib/telegram-polling';
// import { logger } from '@/lib/db/logger';
// // import { logger } from '@/db/logger';

// let isPollingStarted = false;

// export async function GET() {
//     try {
//         if (!isPollingStarted) {
//             await telegramPolling.startPolling();
//             isPollingStarted = true;
//             logger.info('Telegram polling started via API');
//             return NextResponse.json({ 
//                 success: true, 
//                 message: 'Telegram polling started',
//                 status: 'running'
//             });
//         } else {
//             return NextResponse.json({ 
//                 success: true, 
//                 message: 'Telegram polling already running',
//                 status: 'running'
//             });
//         }
//     } catch (error) {
//         logger.error('Failed to start polling:', error);
//         return NextResponse.json({ 
//             success: false, 
//             error: 'Failed to start polling' 
//         }, { status: 500 });
//     }
// }

// export async function DELETE() {
//     try {
//         telegramPolling.stopPolling();
//         isPollingStarted = false;
//         logger.info('Telegram polling stopped');
//         return NextResponse.json({ 
//             success: true, 
//             message: 'Telegram polling stopped' 
//         });
//     } catch (error) {
//         logger.error('Failed to stop polling:', error);
//         return NextResponse.json({ 
//             success: false, 
//             error: 'Failed to stop polling' 
//         }, { status: 500 });
//     }
// }