import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
  seed: {
    // Esto permite que 'prisma bootstrap' o 'prisma db seed'
    // sepan exactamente qué comando usar sin configuración extra en package.json
    run: 'tsx prisma/seed.ts',
  },
});
