// Vercel function: /api/health, /api/chat, /api/transcribe, /api/tts
import { routes } from '../server/handlers.js';

export async function POST(request) {
  const route = new URL(request.url).pathname.split('/').pop();
  const fn = routes[route];
  if (!fn) return new Response('not found', { status: 404 });
  try {
    return await fn(request);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', detail: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
