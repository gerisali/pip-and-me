import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Local development: the same API handlers that run on Vercel are mounted on the Vite dev server,
// so `npm run dev` gives a complete app (keys come from a local .env file).
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const { routes } = await server.ssrLoadModule('/server/handlers.js');
        const route = req.url.split('?')[0].replace(/^\//, '');
        const fn = routes[route];
        if (!fn || req.method !== 'POST') {
          res.statusCode = 404;
          return res.end('not found');
        }
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(`http://localhost/api/${route}`, {
          method: 'POST',
          headers: req.headers,
          body: Buffer.concat(chunks),
        });
        try {
          const response = await fn(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), localApi()] };
});
