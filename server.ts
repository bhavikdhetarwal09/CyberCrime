import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createApiApp } from './src/server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = await createApiApp();

  // --- VITE / STATIC SERVING ---
  // Only serve static dist/ in explicit production mode when dist/index.html exists.
  // In dev mode (or while dist/ is absent/rebuilding), always mount Vite middleware so ENOENT never occurs.
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && fs.existsSync(distIndexPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (!fs.existsSync(distIndexPath)) {
        res.status(503).send('Application bundle is rebuilding. Please refresh shortly.');
        return;
      }
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TRACE INTEL server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TRACE INTEL server:', err);
  process.exit(1);
});
