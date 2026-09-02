import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AttendancePage from './components/AttendancePage.tsx';
import './index.css';

// Check if current route is a standalone staff attendance portal link: /attend/<attendance_token>
const path = window.location.pathname;
const attendMatch = path.match(/^\/attend\/([^/?#]+)/i);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {attendMatch ? (
      <AttendancePage token={decodeURIComponent(attendMatch[1])} />
    ) : (
      <App />
    )}
  </StrictMode>,
);

