import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/theme.css';

// ── Scroll-Reveal: all .reveal* variants ───────────────────────
const REVEAL_SEL = '.reveal, .reveal-left, .reveal-right, .reveal-scale';

const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      observer.unobserve(e.target);
    }
  }),
  { threshold: 0.1 }
);

// Re-scan on each React navigation (SPA-safe)
const bodyObserver = new MutationObserver(() => {
  document.querySelectorAll(`${REVEAL_SEL}:not(.is-visible)`).forEach((el) => observer.observe(el));
});
bodyObserver.observe(document.body, { childList: true, subtree: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
