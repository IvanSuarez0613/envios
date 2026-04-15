// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/authContext'; 

import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

import Modal from 'react-modal';
Modal.setAppElement('#root');


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>  
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
