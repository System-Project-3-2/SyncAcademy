import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Restore deep-link route when static hosts bounce unknown paths to '/'.
if (typeof window !== 'undefined') {
  const pendingPath = sessionStorage.getItem('spa-redirect-path');
  if (pendingPath) {
    sessionStorage.removeItem('spa-redirect-path');
    window.history.replaceState(null, '', pendingPath);
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
