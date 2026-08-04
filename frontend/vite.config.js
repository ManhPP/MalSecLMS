import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'


const required = (env, name) => {
  const value = env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}


export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const env = { ...fileEnv, ...process.env }
  const port = Number(required(env, 'VITE_DEV_PORT'))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_DEV_PORT must be a valid TCP port')
  }

  return {
    plugins: [react()],
    server: {
      port,
      host: required(env, 'VITE_DEV_HOST'),
      proxy: {
        '/api': {
          target: required(env, 'VITE_API_PROXY_TARGET'),
          changeOrigin: true,
          secure: required(env, 'VITE_API_PROXY_SECURE') === 'true',
        }
      }
    }
  }
})
