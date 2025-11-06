import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import fetch from 'node-fetch';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();

// Handle large payloads safely
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Telegram credentials
 */
const BOT_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const CHAT_ID = '-1003113096788';
/**
 * POST endpoint to send image or message to Telegram
 * Logs only to console, no response to client
 */
app.post('/api/send-to-telegram', async (req, res) => {
  try {
    if (!req.body) {
      console.error('[Telegram API] ❌ No request body received.');
      return;
    }

    const { image, caption } = req.body;
    if (!image) {
      console.error('[Telegram API] ❌ Missing image field.');
      return;
    }

    const formData = new FormData();

    // Handle base64 or direct URL
    if (image.startsWith('data:image/')) {
      const base64Data = image.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      formData.append('photo', new Blob([buffer]), 'image.jpg');
    } else {
      formData.append('photo', image);
    }

    if (caption) formData.append('caption', caption);
    formData.append('chat_id', CHAT_ID);

    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const tgData: any = await tgResponse.json().catch(() => ({}));

    if (!tgResponse.ok || tgData?.ok === false) {
      console.error(
        `[Telegram API] ❌ Failed to send. Reason: ${tgData?.description || 'Unknown error'}`
      );
      return;
    }

    console.log('[Telegram API] ✅ Sent image successfully.');
  } catch (err: any) {
    console.error('[Telegram API] ❌ Error:', err.message);
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle Angular SSR
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start server
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error?: any) => {
    if (error) throw error;
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}

/**
 * Export for Angular SSR
 */
export const reqHandler = createNodeRequestHandler(app);
