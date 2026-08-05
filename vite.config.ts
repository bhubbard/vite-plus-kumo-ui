import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { kumoUiPlugin, loadKumoConfig } from 'vite-plus-kumo'

// Rule severities live in kumo-lint.config.json so that the Vite plugin, the
// standalone CLI (`npm run lint:kumo:cli`) and the drift check
// (`npm run lint:kumo`) all enforce the same configuration.
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    kumoUiPlugin(loadKumoConfig()),
  ],
})
