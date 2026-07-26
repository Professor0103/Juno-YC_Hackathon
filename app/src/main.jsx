import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/home.css';
import './styles/onboarding.css';
import App from './App.jsx';
import Onboarding from './Onboarding.jsx';

function Root() {
  const [consented, setConsented] = useState(() => Boolean(localStorage.getItem('mango_consent')));
  return consented ? <App /> : <Onboarding onComplete={() => setConsented(true)} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
