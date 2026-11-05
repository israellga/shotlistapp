import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientView from './ClientView.jsx'
import PaymentView from './PaymentView.jsx'
import IntakeView from './IntakeView.jsx'

const params = new URLSearchParams(window.location.search)
const clientId = params.get('client')
const paymentId = params.get('payment')
const intakeToken = params.get('cadastro')

function Root() {
  if (clientId) return <ClientView id={clientId} />
  if (intakeToken) return <IntakeView token={intakeToken} />
  if (paymentId) return <PaymentView id={paymentId} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Offline support: only in production builds, never on public client pages' behalf of dev
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
