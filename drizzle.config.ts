// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations', // ← ИСПРАВЛЯЕМ! было './drizzle'
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/sqlite.db',
  },
} satisfies Config;


// // drizzle.fonfig.ts
// //
// import type { Config } from 'drizzle-kit';

// export default {
//   schema: './lib/db/schema.ts',
//   out: './drizzle',
//   dialect: 'sqlite',
//   dbCredentials: {
//     url: './data/sqlite.db',
//   },
// } satisfies Config;
