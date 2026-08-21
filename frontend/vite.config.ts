import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Open-core: `@ee` resolves to the extension bundle when present (private repo)
// and falls back to no-op stubs in the Community edition (where src/_ee is
// stripped). Same config in both editions — auto-detected, no env flag needed.
const eeDir = existsSync(fileURLToPath(new URL('./src/_ee', import.meta.url)))
  ? './src/_ee'
  : './src/_ee-stubs';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // manual registration in main.ts
      manifest: {
        name: 'ZaloCRM',
        short_name: 'ZaloCRM',
        description: 'Quản lý nhiều tài khoản Zalo cá nhân',
        theme_color: '#0A192F',
        background_color: '#0A192F',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/brand/logo02.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/brand/logo02.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Không precache index.html: nó phải luôn lấy mới từ network để
        // tham chiếu đúng tên JS/CSS chunk hiện có trên server, tránh tab
        // cũ bị kẹt gọi vào asset đã bị dọn (cleanupOutdatedCaches xoá).
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api/],
      }
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ee': fileURLToPath(new URL(eeDir, import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
