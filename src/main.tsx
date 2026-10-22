import '@fontsource/albert-sans/latin-400.css';
import '@fontsource/albert-sans/latin-600.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-400-italic.css';
import './ui/style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { director } from './director';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void director.boot(document.getElementById('stage')!);
