/* Zeigt einen Hinweis, wenn eine neue App-Version bereitsteht. Daten bleiben bei Updates erhalten,
   weil sie in IndexedDB liegen – der Service Worker cached nur den Programmcode. */
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  // Die reine Info „offline nutzbar“ kommt beim ersten Start und lag über dem „Weiter“-Knopf
  // der Einrichtung – sie blendet sich deshalb selbst aus. Der Update-Hinweis bleibt stehen.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed inset-x-0 z-50 mx-4 flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg sm:mx-auto" style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
      <span className="flex-1">
        {needRefresh ? 'Eine neue Version ist verfügbar.' : 'Die App ist jetzt offline nutzbar.'}
      </span>
      {needRefresh && (
        <button type="button" className="font-semibold underline" onClick={() => void updateServiceWorker(true)}>
          Aktualisieren
        </button>
      )}
      <button
        type="button"
        className="font-semibold opacity-80"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        Schließen
      </button>
    </div>
  );
}
