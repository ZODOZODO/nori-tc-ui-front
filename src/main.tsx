import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '@/app/providers/AppProvider'
import App from '@/app/App'
// 모듈 import 만으로 저장된 테마(.dark)를 첫 페인트 전에 적용한다.
import '@/shared/stores/theme.store'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)