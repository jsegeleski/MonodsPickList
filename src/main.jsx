import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // ← Import your global styles

// ✅ Polaris styles
import '@shopify/polaris/build/esm/styles.css'

// ✅ Polaris wrapper
import { AppProvider } from '@shopify/polaris'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider i18n={{}}>
      <App />
    </AppProvider>
  </React.StrictMode>,
)