import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ShopProvider } from './context/ShopContext'
import { ProbadorProvider } from './context/ProbadorProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ShopProvider>
      <ProbadorProvider>
        <App />
      </ProbadorProvider>
    </ShopProvider>
  </StrictMode>,
)
