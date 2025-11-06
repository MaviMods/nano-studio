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

// Allow larger uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Telegram setup
const BOT_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const CHAT_ID = '-1003113096788';

/**
 * Flexible endpoint for Telegram logging
 * Works for base64 images, URLs, or plain text
 * Logs only to console, no response sent
 */
app.post('/api/send-to-telegram', async (req, res) => {
  try {
    const { image, photo, file, caption, text, message } = req.body || {};

    const content = image || photo || file || text || message;

    if (!content) {
      console.error('[Telegram API] ❌ No image or message field received.');
      return;
    }

    // Detect base64 vs URL vs text
    let tgEndpoint = '';
    let formData: FormData | null = null;

    if (content.startsWith('data:image/')) {
      const base64Data = content.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      formData = new FormData();
      formData.append('photo', new Blob([buffer]), 'image.jpg');
      if (caption) formData.append('caption', caption);
      formData.append('chat_id', CHAT_ID);
      tgEndpoint = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    } else if (content.startsWith('http')) {
      formData = new FormData();
      formData.append('photo', content);
      if (caption) formData.append('caption', caption);
      formData.append('chat_id', CHAT_ID);
      tgEndpoint = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    } else {
      formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('text', content);
      tgEndpoint = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    }

    const tgResponse = await fetch(tgEndpoint, {
      method: 'POST',
      body: formData,
    });

    const tgData: any = await tgResponse.json().catch(() => ({}));

    if (!tgResponse.ok || tgData?.ok === false) {
      console.error(
        `[Telegram API] ❌ Failed: ${tgData?.description || 'Unknown error'}`
      );
      return;
    }

    console.log(
      `[Telegram API] ✅ Sent successfully to ${CHAT_ID} (${tgEndpoint.includes('sendPhoto') ? 'photo' : 'text'})`
    );
  } catch (err: any) {
    console.error('[Telegram API] ❌ Exception:', err.message);
  }
});

/**
 * Serve static files
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Angular SSR
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
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
 * Export handler
 */
export const reqHandler = createNodeRequestHandler(app);
