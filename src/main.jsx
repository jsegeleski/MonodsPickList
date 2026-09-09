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
const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY
const host = urlParams.get('host')

const config = {
  apiKey,
  host,
  forceRedirect: true,
}

const app = (
  <AppProvider i18n={{}}>
    <App />
  </AppProvider>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {apiKey && host ? <AppBridgeProvider config={config}>{app}</AppBridgeProvider> : app}
    </BrowserRouter>
  </React.StrictMode>,
)
