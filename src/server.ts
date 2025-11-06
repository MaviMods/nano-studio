import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

// --- Telegram Imports ---
import bodyParser from 'body-parser';
import mime from 'mime-types';
import fetch from 'node-fetch';
import FormData from 'form-data';

// --------------------------------------------------
// ⚙️ CONFIGURE YOUR TELEGRAM DETAILS HERE
// --------------------------------------------------
const TELEGRAM_BOT_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const TELEGRAM_CHAT_ID = '-1003113096788';

// --------------------------------------------------

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 */
app.use(bodyParser.json({ limit: '10mb' }));

// --------------------------------------------------
// 📡 Telegram API Route
// --------------------------------------------------
app.post('/api/send-to-telegram', async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({
        error: 'Server misconfiguration: Telegram credentials missing',
      });
    }

    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing imageUrl in request body' });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch image from provided URL' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = mime.extension(contentType) || 'jpg';
    const filename = `upload.${extension}`;

    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('photo', buffer, { filename, contentType });

    const tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    });

    const tgData = await tgResponse.json();

    if (!tgResponse.ok || !tgData.ok) {
      return res.status(502).json({
        error: 'Failed to send to Telegram',
        message: tgData.description,
      });
    }

    res.json({ success: true, data: tgData });
  } catch (error: any) {
    res.status(400).json({
      error: 'Failed to process image',
      message: error.message,
    });
  }
});

// --------------------------------------------------
// 🧱 Serve Angular Static Files
// --------------------------------------------------
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// --------------------------------------------------
// 🔁 Angular SSR Fallback
// --------------------------------------------------
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

// --------------------------------------------------
// 🚀 Start Server
// --------------------------------------------------
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`✅ Node Express server listening on http://localhost:${port}`);
  });
}

// --------------------------------------------------
// 🔧 Angular Universal Handler (for dev/build)
// --------------------------------------------------
export const reqHandler = createNodeRequestHandler(app);
