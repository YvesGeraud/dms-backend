// dotenv debe cargarse PRIMERO — antes de cualquier import que lea process.env
import 'dotenv/config';

import app from './app';
import { config } from '@/config/servidor.config';
import { prisma } from '@/config/database.config';

// ── Iniciar servidor ──────────────────────────────────────────────────────────

const servidor = app.listen(config.puerto, () => {
  console.log(
    `\n    ╔════════════════════════════════════════════╗` +
      `\n    ║  🍽️  RESTAURANTE API                        ║` +
      `\n    ║  🚀 http://localhost:${config.puerto}                  ║` +
      `\n    ║  🌍 Entorno: ${config.nodeEnv.toUpperCase().padEnd(30)}║` +
      `\n    ╚════════════════════════════════════════════╝\n`,
  );
});

// ── Cierre limpio ─────────────────────────────────────────────────────────────

// El ciclo de vida del proceso pertenece al punto de entrada, no a app.ts,
// para que los tests puedan importar app sin arrancar ni cerrar servidores.
const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n[${signal}] Cerrando servidor...`);
  servidor.close(async () => {
    await prisma.$disconnect();
    console.log('Conexiones cerradas. Proceso terminado.');
    process.exit(0);
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
