import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { EngineProvider } from '@/engine/EngineContext';

// basename для GitHub Pages (base '/cryptobot-pwa/'); на платформе base './' -> undefined
const base = import.meta.env.BASE_URL;
const routerBasename = base.startsWith('/') ? base.replace(/\/+$/, '') : undefined;

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={routerBasename}>
    <EngineProvider>
      <App />
    </EngineProvider>
  </BrowserRouter>,
);

// Регистрация service worker — только в production-сборке
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', window.location.href)).catch(() => {
      /* SW недоступен — приложение работает и без него */
    });
  });
}
