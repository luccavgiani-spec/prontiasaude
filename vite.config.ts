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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-accordion', '@radix-ui/react-select'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
        }
      }
    },
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      }
    },
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
}));
