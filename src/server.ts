import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response } from 'express';
import { join } from 'node:path';
import fetch from 'node-fetch';
import FormData from 'form-data';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON bodies safely
app.use(express.json({ limit: '50mb' }));

/* --------------------------------------------------------------------------
 🧩 TELEGRAM CONFIG
-------------------------------------------------------------------------- */
const TELEGRAM_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const TELEGRAM_CHAT_ID = '-1003113096788';

/* --------------------------------------------------------------------------
 📤 SEND IMAGE TO TELEGRAM
-------------------------------------------------------------------------- */
app.post('/api/send-to-telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, caption } = req.body as { imageUrl?: string; caption?: string };

    if (!imageUrl) {
      res.status(400).json({ error: 'Missing imageUrl in request body' });
      return;
    }

    const telegramApi = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    const formData = new FormData();

    // Detect base64 vs normal URL
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      formData.append('photo', buffer, 'image.png');
    } else {
      formData.append('photo', imageUrl);
    }

    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', caption || '🖼️ Generated Image from Nano Studio');

    const telegramResponse = await fetch(telegramApi, {
      method: 'POST',
      body: formData as any,
    });

    const data = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('❌ Telegram API error:', data);
      res.status(500).json({ error: 'Failed to send to Telegram', data });
      return;
    }

    console.log('✅ Image successfully sent to Telegram!');
    res.json({ success: true, data });
    return;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('💥 Telegram send error:', message);
    res.status(500).json({ error: 'Server error', message });
    return;
  }
});

/* --------------------------------------------------------------------------
 📦 STATIC + SSR HANDLING
-------------------------------------------------------------------------- */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req: Request, res: Response, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (response) writeResponseToNodeResponse(response, res);
      else next();
    })
    .catch(next);
});

/* --------------------------------------------------------------------------
 🚀 START SERVER
-------------------------------------------------------------------------- */
if (isMainModule(import.meta.url)) {
  const port = 4200;
  const host = '0.0.0.0';
  app.listen(port, (error?: unknown) => {
    if (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(msg);
    }
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
