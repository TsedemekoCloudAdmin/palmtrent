import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('socket.io-client')) return 'vendor-socket'
            return 'vendor'
          }

          if (id.includes('/src/pages/PalmTrentAdmin')) return 'page-admin'
          if (id.includes('/src/pages/ShipperDashboard')) return 'page-shipper'
          if (id.includes('/src/pages/CorporateDashboard')) return 'page-corporate'
          if (id.includes('/src/pages/TrailerOwnerDashboard')) return 'page-fleet'
          if (id.includes('/src/services/')) return 'app-services'

          return undefined
        },
      },
    },
  },
})
