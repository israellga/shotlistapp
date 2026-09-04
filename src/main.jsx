import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientView from './ClientView.jsx'
import PaymentView from './PaymentView.jsx'

const params = new URLSearchParams(window.location.search)
const clientId = params.get('client')
const paymentId = params.get('payment')

function Root() {
  if (clientId) return <ClientView id={clientId} />
  if (paymentId) return <PaymentView id={paymentId} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
