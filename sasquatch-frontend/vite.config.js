import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // écoute sur 0.0.0.0 -- nécessaire pour l'accès depuis un téléphone sur le même Wi-Fi
  },
})