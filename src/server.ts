import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import fetch from 'node-fetch';
import FormData from 'form-data';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON bodies
app.use(express.json());

/* ----------------------------- TELEGRAM CONFIG ----------------------------- */

// 🧩 Replace with your actual bot token and channel ID
const TELEGRAM_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const TELEGRAM_CHAT_ID = '-1003113096788';

/* ----------------------------- SEND TO TELEGRAM ----------------------------- */

app.post('/api/send-to-telegram', async (req, res) => {
  try {
    const { imageUrl, caption } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing imageUrl' });
    }

    console.log('⬇️ Downloading image from:', imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', caption || 'Generated Image');
    formData.append('photo', Buffer.from(imageBuffer), 'image.png');

    console.log('📤 Uploading to Telegram...');
    const telegramApi = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    const telegramResponse = await fetch(telegramApi, {
      method: 'POST',
      body: formData,
    });

    const data = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram error:', data);
      return res.status(500).json({ error: 'Failed to send to Telegram', data });
    }

    console.log('✅ Image successfully sent to Telegram');
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Telegram send error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

/* ----------------------------- STATIC + SSR ----------------------------- */

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/* ----------------------------- START SERVER ----------------------------- */

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
