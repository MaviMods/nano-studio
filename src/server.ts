/* --------------------------------------------------------------------------
 Safe send-to-telegram handler
-------------------------------------------------------------------------- */
import fetch, { AbortError } from 'node-fetch';
import FormData from 'form-data';
import { URL } from 'url';
import mime from 'mime-types'; // optional but handy; `npm i mime-types`

const TELEGRAM_TOKEN = '8473844398:AAEUF8g7YQGq6Rq8QEn0aO77NcTy3fAjF0k';
const TELEGRAM_CHAT_ID = '-1003113096788';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB max (tune as needed)
const DOWNLOAD_TIMEOUT_MS = 15_000; // 15s download timeout

app.post('/api/send-to-telegram', async (req: Request, res: Response): Promise<void> => {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    res.status(500).json({ error: 'Server misconfiguration: TELEGRAM_TOKEN or TELEGRAM_CHAT_ID missing' });
    return;
  }

  const { imageUrl, caption } = req.body as { imageUrl?: string; caption?: string };
  if (!imageUrl) {
    res.status(400).json({ error: 'Missing imageUrl in request body' });
    return;
  }

  // Create an AbortController we can use to cancel the remote fetch.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  // If client disconnects, abort the download to avoid dangling work.
  req.on('aborted', () => {
    controller.abort();
  });

  try {
    let buffer: Buffer;
    let contentType = 'application/octet-stream';
    let filename = 'image.png';

    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image')) {
      // data URI (base64)
      const base64 = imageUrl.split(',')[1] || '';
      buffer = Buffer.from(base64, 'base64');
      contentType = (imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)/) || [])[1] || 'image/png';
      const ext = mime.extension(contentType) || 'png';
      filename = `image.${ext}`;
    } else {
      // treat as remote URL
      let url: string;
      try {
        // validate URL properly; this will throw for invalid urls
        const u = new URL(imageUrl);
        url = u.href;
      } catch {
        throw new Error('Invalid image URL');
      }

      // Fetch the remote image, streaming into memory with size checks
      const resp = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          // some servers block default user agents; make it look like a browser
          'User-Agent': 'Mozilla/5.0 (compatible; NanoStudio/1.0)',
          Accept: 'image/*,*/*;q=0.8',
        },
      });

      if (!resp.ok) {
        throw new Error(`Failed to fetch image, status ${resp.status}`);
      }

      const ct = resp.headers.get('content-type') || '';
      contentType = ct.split(';')[0].trim() || '';

      // Reject obvious HTML responses (common when a link expired)
      if (!contentType.startsWith('image/')) {
        throw new Error(`Remote resource is not an image, content-type=${contentType}`);
      }

      // Check content-length header if present
      const contentLengthHeader = resp.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(contentLength) && contentLength > MAX_IMAGE_BYTES) {
          throw new Error(`Image too large (${contentLength} bytes). Max is ${MAX_IMAGE_BYTES}`);
        }
      }

      // Accumulate buffer safely
      const reader = resp.body;
      if (!reader) throw new Error('No response body');

      const chunks: Buffer[] = [];
      let total = 0;

      await new Promise<void>((resolve, reject) => {
        reader.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_IMAGE_BYTES) {
            // prevent OOM; destroy and reject
            controller.abort(); // stop fetch
            reject(new Error('Image exceeds maximum allowed size'));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        reader.on('end', () => {
          buffer = Buffer.concat(chunks);
          resolve();
        });
        reader.on('error', (err) => {
          reject(err);
        });
        // If the controller aborts, propagate that
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Download aborted'));
        });
      });

      // Derive filename from URL or content-type
      const ext = mime.extension(contentType) || 'png';
      const parsed = new URL(url);
      const base = parsed.pathname.split('/').pop() || `image.${ext}`;
      filename = base.includes('.') ? base : `${base}.${ext}`;
    }

    // Prepare form data for Telegram
    const telegramApi = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('caption', caption || '🖼️ Generated Image from Nano Studio');

    // For FormData from `form-data` lib, third param can be { filename, contentType }
    form.append('photo', buffer as Buffer, { filename, contentType });

    // Send to Telegram
    const tgResp = await fetch(telegramApi, {
      method: 'POST',
      body: form as any,
      headers: form.getHeaders ? form.getHeaders() : undefined,
      // no signal here; we already handled aborting the download. If you want to abort Telegram send
      // when client disconnects, you can pass controller.signal here as well.
    });

    const tgData = await tgResp.json().catch(() => ({ ok: false }));
    if (!tgResp.ok) {
      console.error('Telegram API error:', tgData);
      res.status(502).json({ error: 'Failed to send to Telegram', details: tgData });
      return;
    }

    clearTimeout(timeout);
    console.log('✅ Image successfully sent to Telegram!');
    res.json({ success: true, data: tgData });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish abort errors so logs are clearer
    if (err instanceof AbortError || /aborted|abort/i.test(message)) {
      console.warn('Request aborted:', message);
      // 499 is a common "client closed request" code, but many clients expect 400/408
      res.status(499).json({ error: 'Request aborted', message });
      return;
    }

    console.error('💥 Telegram send error:', message);
    res.status(400).json({ error: 'Failed to process image', message });
    return;
  }
});
