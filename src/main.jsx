import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import '@shopify/polaris/build/esm/styles.css'
import { AppProvider } from '@shopify/polaris'

// 👉 Add Shopify App Bridge
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react'
import { BrowserRouter } from 'react-router-dom'

// Get required params from the URL
const urlParams = new URLSearchParams(window.location.search)
const config = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
  host: urlParams.get('host'),
  forceRedirect: true,
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppBridgeProvider config={config}>
        <AppProvider i18n={{}}>
          <App />
        </AppProvider>
      </AppBridgeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
