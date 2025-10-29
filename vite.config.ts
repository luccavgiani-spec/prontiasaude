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
          // Vendor splitting mais granular para reduzir bundle principal
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Radix UI components - separar por uso
            if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-select')) {
              return 'ui-vendor-critical';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-vendor-lazy';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }
            // Payment - lazy load
            if (id.includes('@mercadopago')) {
              return 'payment-vendor';
            }
            // Supabase
            if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
              return 'supabase-vendor';
            }
            // Lucide icons - separar
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            // Outros vendors
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
    minify: mode === 'production' ? 'terser' : 'esbuild',
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    } : undefined,
    target: 'es2015',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
}));
