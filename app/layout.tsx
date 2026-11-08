// app/layout.tsx
import './globals.css'
import './theme.css'
import type { Metadata, Viewport } from 'next'

// ============================================
// METADATA (все настройки здесь)
// ============================================
export const metadata: Metadata = {
  title: 'АБЗ Контроль',
  description: 'Контроль отгрузок асфальтобетонного завода',
  manifest: '/manifest.webmanifest',
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
      <body suppressHydrationWarning>
        {/* Тёмная тема главного экрана (ТАС и Айсберг) ставится до первой отрисовки главного экрана —
            иначе при загрузке мелькает светлый фон (класс потом держит page.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(location.pathname==='/'){document.body.classList.add('iceberg-mode');if(localStorage.getItem('appMode')!=='iceberg')document.body.classList.add('tas-mode')}}catch(e){}",
          }}
        />
        {children}
      </body>
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
//   manifest: '/manifest.webmanifest',
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