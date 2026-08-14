import './boot/globalShellVisualBridge';
import "./operationalOnboardingBridge.js"; // __AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_ENTRY__
import "./platformOwnerOnlyGuard.js"; // __AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_FRONTEND_ENTRY__
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './adminProvisioningActivationBridge.js'; // __AUTOATENDE_STRIPE_PHASE2R_D5D_C_ADMIN_PROVISIONING_ACTIVATION_MAIN_IMPORT__
import './adminOwnerAccessBridge.js'; // __AUTOATENDE_STRIPE_PHASE2R_D5E_C_OWNER_ACCESS_MAIN_IMPORT__
import './compat/inboxUnsupportedMessageDisplayBridge.js'; // __AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
