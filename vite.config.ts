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
        
        // Assets com hash (imutáveis) - cache de 1 ano com compressão
        if (/\.(js|css|webp|woff2)$/.test(url) && /[a-f0-9]{8}/.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Vary', 'Accept-Encoding');
        }
        // Imagens sem hash (30 dias)
        else if (/\.(jpg|jpeg|png|svg|webp)$/.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000');
          res.setHeader('Vary', 'Accept-Encoding');
        }
        // Fontes (1 ano)
        else if (/\.(woff|woff2|ttf|eot)$/.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML (sem cache)
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
  logLevel: 'info',
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
          // Core (always needed)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // UI - Critical (used in home - Dialog for modals)
          'vendor-ui-critical': ['@radix-ui/react-dialog', '@radix-ui/react-toast'],
          
          // UI - Lazy (used in lazy sections or internal pages)
          'vendor-ui-lazy': [
            '@radix-ui/react-accordion', 
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group'
          ],
          
          // Backend
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          
          // Forms (lazy - used in signup/login)
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Icons (common, but can be optimized)
          'vendor-icons': ['lucide-react'],
          
          // Motion (pesado - lazy load)
          'vendor-motion': ['motion'],
          
          // Charts (admin-only) - mantido para code-split do AdminDashboard
          'vendor-charts': ['recharts'],
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|ttf|eot/i.test(ext || '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      }
    },
    // Evitar preload de chunks pesados não usados na landing page pública
    modulePreload: {
      resolveDependencies: (_url, deps) =>
        deps.filter(dep => !dep.includes('vendor-charts') && !dep.includes('vendor-mp')),
    },
    chunkSizeWarningLimit: 600,
    minify: true,
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    cssCodeSplit: true,
    cssMinify: true,
    reportCompressedSize: false,
    sourcemap: false,
  },
}));
