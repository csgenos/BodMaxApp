import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: { injectionPoint: 'self.__WB_MANIFEST' },
      manifest: {
        name: 'BodMax',
        short_name: 'BodMax',
        description: 'Track workouts, diet, and progress',
        theme_color: '#e0161e',
        background_color: '#080808',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
})
