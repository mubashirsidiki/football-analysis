import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Ensure dark theme is applied
document.documentElement.classList.add('dark')

console.log('🚀 Football Video Analysis App initializing...')
console.log('📡 API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log('✅ App rendered successfully')

