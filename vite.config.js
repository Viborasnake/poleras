import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [{
    name: 'droska-catalog-pages',
    configureServer(server) {
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
