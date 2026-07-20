import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { reloadForNewVersion } from './lib/chunkReload'
import { getInitialTheme, applyTheme } from './hooks/useDarkMode'

// Áp theme TRƯỚC khi render để không bị chớp trắng khi người dùng chọn dark
applyTheme(getInitialTheme())

// Vite bắn 'vite:preloadError' khi import động 1 chunk bị lỗi (thường do deploy mới
// đổi hash file). Tự reload 1 lần để nạp index.html mới thay vì kẹt màn hình lỗi.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForNewVersion()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
