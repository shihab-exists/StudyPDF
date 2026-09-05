import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { sweepExpired } from './services/store';
import './index.css';

// 24-hour auto-delete promise: sweep expired local files on every app start.
void sweepExpired();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
