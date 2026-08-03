import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'
import { readFileSync } from 'fs'

/**
 * Lumina dev config proxy:
 * 将桌面端 Lumina 的真实配置文件内容作为虚拟模块注入，
 * 供浏览器端 dev mock 使用，避免在浏览器里重新走 onboarding / 数据库连接等流程。
 * 仅在 dev 环境下生效（import.meta.env.DEV 守卫）。
 */
const luminaConfigPlugin = () => {
  const configPath = 'C:/Users/MarkCKB/AppData/Roaming/Lumina/Lumina-config.json'
  return {
    name: 'lumina-config-proxy',
    resolveId(id: string) {
      if (id === 'virtual:lumina-config') return '\0virtual:lumina-config'
      return null
    },
    load(id: string) {
      if (id !== '\0virtual:lumina-config') return null
      if (!import.meta.env?.DEV) return 'export default {}'
      try {
        const content = readFileSync(configPath, 'utf-8')
        return `export default ${content}`
      } catch {
        return 'export default {}'
      }
    },
    configureServer(server: any) {
      server.watcher.add(configPath)
      server.watcher.on('change', (file: string) => {
        if (file === configPath) {
          const mod = server.moduleGraph.getModuleById('\0virtual:lumina-config')
          if (mod) server.reloadModule(mod)
        }
      })
    }
  }
}

const handleElectronOnStart = (options: { reload: () => void }) => {
  options.reload()
}

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    strictPort: false
  },
  build: {
    chunkSizeWarningLimit: 900,
    commonjsOptions: {
      ignoreDynamicRequires: true
    }
  },
  optimizeDeps: {
    exclude: []
  },
  plugins: [
    react(),
    luminaConfigPlugin(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart: handleElectronOnStart,
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'better-sqlite3',
                'koffi',
                'fsevents',
                'whisper-node',
                'shelljs',
                'exceljs',
                'node-llama-cpp',
                '@vscode/sudo-prompt',
                'silk-wasm',
                '@markckb/electron-liquid-glass'
              ]
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart: handleElectronOnStart,
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      {
        entry: 'electron/wcdbWorker.ts',
        onstart: () => {},
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'better-sqlite3',
                'koffi',
                'fsevents',
                'whisper-node',
                'shelljs',
                'exceljs',
                'node-llama-cpp',
                '@vscode/sudo-prompt',
                'silk-wasm'
              ]
            }
          }
        }
      }
    ])
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
