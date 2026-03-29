import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Cal-Count/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Cal Count',
        short_name: 'CalCount',
        description: 'A Progressive Web App for calorie and fitness tracking',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        id: '/Cal-Count/',         // FIX 1: Changed to absolute path
        start_url: '/Cal-Count/',  // FIX 2: Changed to absolute path
        icons: [
          {
            src: 'scale.png',      // FIX 3: Removed 'public/'
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: 'screenshot.png',
            sizes: '540x720',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ]
      }
    })
  ]
})