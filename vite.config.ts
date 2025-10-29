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
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('ETag', `"${Date.now()}"`);
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Supabase (usado em muitas páginas)
            if (id.includes('@supabase') || id.includes('@tanstack')) {
              return 'supabase-vendor';
            }
            // Radix UI (componentes)
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            // Ícones (lucide-react)
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
    minify: 'esbuild',
    target: 'esnext',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
}));
