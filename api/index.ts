import type { Request, Response } from 'express';
import { createApiApp } from '../src/server/app.ts';

let appPromise: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApiApp();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
