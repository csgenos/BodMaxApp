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
        scope: '/',
        id: 'https://getbodmax.com/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
        shortcuts: [
          { name: 'Start Session', short_name: 'Train', description: 'Log a workout', url: '/session', icons: [{ src: '/icon.svg', sizes: 'any' }] },
          { name: 'Log Meal', short_name: 'Nutrition', description: 'Track your nutrition', url: '/diet', icons: [{ src: '/icon.svg', sizes: 'any' }] },
          { name: 'Progress', short_name: 'Progress', description: 'View your stats', url: '/progress', icons: [{ src: '/icon.svg', sizes: 'any' }] },
          { name: 'Social', short_name: 'Social', description: 'Friends & leaderboard', url: '/social', icons: [{ src: '/icon.svg', sizes: 'any' }] },
        ],
      },
    }),
  ],
})
