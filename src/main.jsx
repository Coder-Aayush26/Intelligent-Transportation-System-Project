import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LocationProvider } from './context/LocationContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import 'leaflet/dist/leaflet.css';
import './styles/theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <RealtimeProvider>
            <App />
          </RealtimeProvider>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
