const requestBuckets = new Map();
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 12;
const AI_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-free';

function replyError(res, status, message) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json({error: message});
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = requestBuckets.get(ip);
  if (current && current.expiresAt > now) {
    if (current.count >= REQUESTS_PER_WINDOW) return true;
    current.count += 1;
    return false;
  }
  requestBuckets.set(ip, {count: 1, expiresAt: now + WINDOW_MS});
  if (requestBuckets.size > 1000) {
    for (const [key, value] of requestBuckets) {
      if (value.expiresAt <= now) requestBuckets.delete(key);
    }
  }
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return replyError(res, 405, 'Method not allowed.');
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim() || process.env.AI_GATEWAY_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN;
  if (!apiKey) {
    return replyError(res, 503, 'AI chat is not connected yet. Add AI_GATEWAY_API_KEY (or the existing AI_GATEWAY_KEY) to the SakuraSound project in Vercel, then redeploy.');
  }

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return replyError(res, 429, 'You have sent several messages recently. Please wait a minute and try again.');
  }

  const submitted = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-8)
    : (typeof req.body?.message === 'string' ? [{role: 'user', content: req.body.message}] : []);
  if (!submitted.length) return replyError(res, 400, 'Send a message to start the chat.');

  const messages = [];
  for (const item of submitted) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') continue;
    const content = item.content.trim().slice(0, 500);
    if (content) messages.push({role: item.role, content});
  }
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return replyError(res, 400, 'The latest chat message is invalid.');
  }

  const prompt = [
    'You are SakuraSound’s friendly anime music and website support assistant.',
    'Help people discover anime opening and ending songs, find albums and artists, use search suggestions, favorites, the player, and account features.',
    'Be concise, warm, and practical. Do not claim that a song or album is available unless the user can check it in the catalog.',
    'SakuraSound may offer short theme previews and eligible theme video downloads; direct users to official music services for full recordings.',
    'For account, billing, privacy, or technical issues, give safe troubleshooting steps and be clear when owner follow-up is needed. Do not claim that a support ticket was created.',
    'Never ask users to send passwords, Clerk keys, or other secrets.'
  ].join(' ');

  try {
    const upstream = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_MODEL,
        messages: [{role: 'system', content: prompt}, ...messages],
        stream: true,
        temperature: 0.6,
        max_tokens: 640,
        reasoning: {effort: 'none'}
      }),
      signal: AbortSignal.timeout(25_000)
    });

    if (!upstream.ok) {
      const detail = await upstream.json().catch(() => ({}));
      console.error('AI Gateway request failed:', upstream.status, detail?.error?.code || 'request_error');
      res.setHeader('X-AI-Upstream-Status', String(upstream.status));
      const safeCode = String(detail?.error?.code || detail?.error?.type || '').slice(0, 64);
      if (/^[a-zA-Z0-9_-]+$/.test(safeCode)) res.setHeader('X-AI-Error-Code', safeCode);
      const code = String(detail?.error?.code || detail?.error?.type || '');
      if (upstream.status === 401) return replyError(res, 503, 'The AI connection needs an updated server credential. Please contact the site owner.');
      if (upstream.status === 402 || code === 'customer_verification_required') {
        return replyError(res, 503, 'The AI provider requires account or credit setup by the site owner.');
      }
      if (upstream.status === 429) {
        res.setHeader('Retry-After', upstream.headers.get('retry-after') || '60');
        return replyError(res, 429, 'The AI service is busy. Please wait a minute and try again.');
      }
      if (upstream.status === 404 || code === 'model_not_found') return replyError(res, 503, 'The configured AI model is unavailable. Please contact the site owner.');
      return replyError(res, 502, 'AI chat is temporarily unavailable. Please try again shortly.');
    }

    if (!upstream.body) return replyError(res, 502, 'The AI returned no response. Please try again.');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const {pipeline} = require('node:stream/promises');
    const {Readable} = require('node:stream');
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    console.error('AI Gateway request failed:', error?.name || 'request_error', error?.cause?.code || '');
    if (!res.headersSent) {
      res.setHeader('X-AI-Error-Code', String(error?.cause?.code || error?.name || 'request_error').replace(/[^a-zA-Z0-9_-]/g, '').slice(0,64));
    }
    if (res.headersSent) { res.destroy(error); return; }
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return replyError(res, 504, 'The AI took too long to respond. Please try again.');
    }
    if (!res.headersSent) return replyError(res, 502, 'AI chat is temporarily unavailable. Please try again shortly.');
    res.destroy(error);
  }
};
