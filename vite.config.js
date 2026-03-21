import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      treeshake: {
        /**
         * 로컬 빌드 시 VITE_SAFEMAP_SERVICE_KEY가 비어도 evPipeline 계측 모듈이 통째로 제거되지 않게 함
         * (?evPipeline=1 프로덕 실측·콘솔 문자열 보존)
         */
        moduleSideEffects(id) {
          if (id.includes('node_modules')) return null
          if (
            /[/\\]src[/\\]dev[/\\]evPipelinePerfLog\.js$/.test(id) ||
            /[/\\]src[/\\]dev[/\\]evPipelineDebugStore\.js$/.test(id) ||
            /[/\\]src[/\\]dev[/\\]EvPipelineDebugPanel\.jsx$/.test(id) ||
            /[/\\]src[/\\]utils[/\\]evPipelineUrl\.js$/.test(id)
          ) {
            return true
          }
          return null
        },
      },
    },
  },
  server: {
    proxy: {
      '/safemap-api': {
        target: 'https://www.safemap.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/safemap-api/, '/openapi2'),
      },
    },
  },
})
