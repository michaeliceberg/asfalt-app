// app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'

// ============================================
// METADATA (все настройки здесь)
// ============================================
export const metadata: Metadata = {
  title: 'АБЗ Контроль',
  description: 'Контроль отгрузок асфальтобетонного завода',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'АБЗ Контроль',
  },
}

// ============================================
// VIEWPORT (вынесен отдельно, как требует Next.js 15+)
// ============================================
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// ============================================
// ROOT LAYOUT
// ============================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}



// // app/layout.tsx
// import './globals.css'
// import type { Metadata, Viewport } from 'next'

// // export const metadata: Metadata = {
// //   title: 'Асфальтовый завод - Поступление материалов',
// //   description: 'Мониторинг поступления материалов на асфальтный завод',
// // }

// export const viewport: Viewport = {
//   width: 'device-width',
//   initialScale: 1,
//   maximumScale: 1,
// }

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   return (
//     <html lang="ru">
//       <body>{children}</body>
//     </html>
//   )
// }




// // app/layout.tsx
// export const metadata: Metadata = {
//   title: 'АБЗ Контроль',
//   description: 'Контроль отгрузок асфальтобетонного завода',
//   manifest: '/manifest.json',
//   appleWebApp: {
//     capable: true,
//     statusBarStyle: 'default',
//     title: 'АБЗ Контроль',
//   },
//   viewport: {
//     width: 'device-width',
//     initialScale: 1,
//     maximumScale: 1,
//     userScalable: false,
//   },
// }