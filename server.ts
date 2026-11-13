import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db/database';
import { seedDatabaseIfEmpty, syncDariDemoDatabase } from './server/db/seed';
import { attachAuth } from './server/middleware/auth';
import authRoutes from './server/routes/auth';
import publicRoutes from './server/routes/public';
import academicsRoutes from './server/routes/academics';
import operationsRoutes from './server/routes/operations';
import financeRoutes from './server/routes/finance';
import credentialsRoutes from './server/routes/credentials';
import commsRoutes from './server/routes/comms';
import adminRoutes, { executeRemindersEngine } from './server/routes/admin';

async function startServer() {
  // Initialize SQLite schema & idempotent initial data
  getDb();
  seedDatabaseIfEmpty();
  syncDariDemoDatabase();

  const app = express();
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT || 3000);

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(attachAuth);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/academics', academicsRoutes);
  app.use('/api/operations', operationsRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/credentials', credentialsRoutes);
  app.use('/api/comms', commsRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Never expose /storage publicly; return 403 if requested directly
  app.use('/storage', (_req, res) => {
    res.status(403).json({ error: 'Direct access to private storage is forbidden.' });
  });

  // Periodic background reminder check (every 6 hours, idempotent per day)
  setInterval(() => {
    try {
      executeRemindersEngine(null);
    } catch (err) {
      console.error('Scheduled reminder check error:', err);
    }
  }, 6 * 60 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Danesh Academy EMS server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
