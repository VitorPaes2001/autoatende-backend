import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  /* __AUTOATENDE_V4_R22B_B_R2_VITE_MANUAL_CHUNKS_VENDOR_SPLIT_NO_MISC__ */
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('/@supabase/')) {
            return 'vendor-supabase';
          }

          if (
            id.includes('/lucide-react/') ||
            id.includes('/framer-motion/')
          ) {
            return 'vendor-ui';
          }

          if (id.includes('/recharts/')) {
            return 'vendor-charts';
          }

          return undefined;
        },
      },
    },
  },
  /* END __AUTOATENDE_V4_R22B_B_R2_VITE_MANUAL_CHUNKS_VENDOR_SPLIT_NO_MISC__ */
})
