import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Cache Headers Plugin para otimização PageSpeed
function cacheHeadersPlugin(): Plugin {
  return {
    name: 'cache-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        
        // Assets com hash (imutáveis) - cache de 1 ano
        if (/\.(js|css|jpg|jpeg|png|svg|webp|woff2|woff)$/.test(url)) {
          const hash = url.match(/[a-f0-9]{8,}/)?.[0] || Date.now().toString();
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('ETag', `"${hash}"`);
          res.setHeader('Vary', 'Accept-Encoding');
        }
        // HTML (sempre revalidar)
        else if (url.endsWith('.html') || url === '/') {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
        
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    cacheHeadersPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {},
    chunkSizeWarningLimit: 500,
    minify: 'esbuild',
    target: 'esnext',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
}));
