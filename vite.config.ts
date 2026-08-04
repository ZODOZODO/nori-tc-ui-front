import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 빌드 후 dist/stats.html 자동 생성 — 청크 구성 시각 분석 (treemap + gzip size).
    visualizer({
      filename: 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: false,
      open: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // three/r3f/drei 는 모듈 수가 많아 dev 첫 3D 진입 시 on-demand 변환이 느리다 → 서버 기동 시 사전 번들로 콜드스타트 제거.
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  build: {
    rollupOptions: {
      output: {
        // vendor 를 도메인별로 쪼개서 페이지 간 브라우저 캐시 공유.
        // 페이지 chunk 는 lazy() 가 이미 분할 — manualChunks 는 node_modules 만.
        // 함수 형식: scheduler(react-dom 상시 ↔ @react-three/fiber lazy 공유 의존)를 react-vendor 로 강제 고정해야
        // three-vendor 가 엔트리 정적 그래프로 끌려오지 않는다. 배열 형식은 이 전이 공유 의존을 매칭 못 해
        // scheduler 가 three-vendor 로 배치 → react-dom(엔트리)이 three(1.1MB)를 모든 페이지에 preload 했다.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // scheduler 는 three-vendor 규칙보다 먼저 — 공유 의존을 상시 로드 청크(react-vendor)에 못박는다.
          if (/[\\/]node_modules[\\/]scheduler[\\/]/.test(id)) return 'react-vendor'
          // konva 스택 — react-reconciler 는 react-konva(2D 뷰어 상시 배경) 와 @react-three/fiber(lazy 3D) 가
          // 공유한다. three 규칙보다 먼저 잡아 konva-vendor 로 보내야, 뷰어(konva) 가 three-vendor 를 정적
          // import 하지 않는다. react-reconciler 를 react-vendor 에 두면 live-map 외 페이지까지 끌려오므로 분리.
          if (/[\\/]node_modules[\\/](konva|react-konva|react-reconciler)[\\/]/.test(id)) return 'konva-vendor'
          if (/[\\/]node_modules[\\/](three|three-stdlib)[\\/]/.test(id)) return 'three-vendor'
          if (/[\\/]node_modules[\\/]@react-three[\\/]/.test(id)) return 'three-vendor'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return 'query-vendor'
          if (/[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/.test(id)) return 'form-vendor'
          if (/[\\/]node_modules[\\/]zustand[\\/]/.test(id)) return 'state-vendor'
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'net-vendor'
          return undefined
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
