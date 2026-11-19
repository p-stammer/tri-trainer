/* Ersatz für virtual:pwa-register/react in der Vorschau: kein Service Worker, also nie ein Update- oder Offline-Hinweis. */
import { useState } from 'react';

export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async (_reload?: boolean) => {} };
}
