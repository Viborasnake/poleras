import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const catalogImageOrigin = 'https://images.frontbook.cl/';

async function serveCatalogImage(request, response, next) {
  const url = new URL(String(request.url || '/'), 'http://localhost');
  if (url.pathname !== '/api/catalog-image') return next();
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET, HEAD');
    return response.end();
  }
  const source = url.searchParams.get('url') || '';
  if (!source.startsWith(catalogImageOrigin)) {
    response.statusCode = 400;
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ error: 'Origen de imagen no permitido.' }));
  }
  try {
    const upstream = await fetch(source);
    response.statusCode = upstream.status;
    if (!upstream.ok) return response.end();
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/webp');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'HEAD') return response.end();
    return response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('No se pudo leer la imagen pública del catálogo.', error);
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ error: 'No se pudo leer la imagen del catálogo.' }));
  }
}

export default defineConfig({
  plugins: [{
    name: 'droska-catalog-pages',
    configureServer(server) {
      server.middlewares.use(serveCatalogImage);
      server.middlewares.use((request, _response, next) => {
        const [pathname, query = ''] = String(request.url || '').split('?');
        if (/^\/productos\/[^/]+(?:\/[^/]+)?(?:\/[^/]+)?\/?$/.test(pathname)) {
          request.url = `/catalog-page.html${query ? `?${query}` : ''}`;
        }
        next();
      });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        designSystem: resolve(import.meta.dirname, 'design-system.html'),
        catalogPage: resolve(import.meta.dirname, 'catalog-page.html'),
      },
    },
  },
});
