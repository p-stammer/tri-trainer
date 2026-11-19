import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';
import { RepoProvider, ToastProvider } from './ui/state';
import { Repository } from './data/repository';
import { DexieBackend, requestPersistentStorage } from './data/dexieBackend';

const repo = new Repository(new DexieBackend());
void requestPersistentStorage();

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <RepoProvider repo={repo}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </RepoProvider>
  </StrictMode>,
);
