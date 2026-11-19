/* Zentrale React-Anbindung: Repository-Kontext, Live-Abfragen, Routing, "heute", Hinweise. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../data/repository';
import { today as todayIn, type LocalDate } from '../domain/calendar';

// ───────── Repository ─────────
const RepoContext = createContext<Repository | null>(null);

export function RepoProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('RepoProvider fehlt');
  return repo;
}

/**
 * Führt eine lesende Abfrage aus und wiederholt sie automatisch nach jeder Datenänderung.
 * Liefert `undefined`, solange noch nichts geladen ist.
 */
export function useLive<T>(query: (repo: Repository) => Promise<T>, deps: readonly unknown[]): T | undefined {
  const repo = useRepo();
  const [value, setValue] = useState<T | undefined>(undefined);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    let active = true;
    let run = 0;
    const load = () => {
      const id = ++run;
      queryRef
        .current(repo)
        .then((v) => {
          if (active && id === run) setValue(v);
        })
        .catch((e: unknown) => console.error('Abfrage fehlgeschlagen', e));
    };
    load();
    const off = repo.subscribe(load);
    return () => {
      active = false;
      off();
    };
  }, [repo, ...deps]);

  return value;
}

// ───────── Heute (Zeitzone) ─────────
/** Aktueller Kalendertag; aktualisiert sich nach Mitternacht und beim Zurückkehren in die App. */
export function useToday(timeZone: string): LocalDate {
  const [day, setDay] = useState(() => todayIn(timeZone));
  useEffect(() => {
    const refresh = () => setDay(todayIn(timeZone));
    refresh();
    const t = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [timeZone]);
  return day;
}

// ───────── Routing (Hash-basiert, funktioniert offline und auf statischem Hosting) ─────────
export type Route =
  | { name: 'dashboard' }
  | { name: 'plan' }
  | { name: 'week'; weekStart: LocalDate }
  | { name: 'planImport' }
  | { name: 'planGenerate' }
  | { name: 'log'; activityId?: string; date?: LocalDate }
  | { name: 'history' }
  | { name: 'analysis' }
  | { name: 'health' }
  | { name: 'checkin'; date?: LocalDate }
  | { name: 'pain'; issueId?: string }
  | { name: 'pause'; pauseId?: string; issueId?: string }
  | { name: 'strength' }
  | { name: 'template'; templateId?: string }
  | { name: 'workout'; logId: string }
  | { name: 'settings' }
  | { name: 'tests' }
  | { name: 'prognosis' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  switch (a) {
    case 'plan':
      if (b === 'import') return { name: 'planImport' };
      if (b === 'vorschlag') return { name: 'planGenerate' };
      return b ? { name: 'week', weekStart: b } : { name: 'plan' };
    case 'log':
      if (b === 'neu') return parts[2] ? { name: 'log', date: parts[2] } : { name: 'log' };
      return b ? { name: 'log', activityId: b } : { name: 'log' };
    case 'verlauf':
      return { name: 'history' };
    case 'analysen':
      return { name: 'analysis' };
    case 'profil':
      return { name: 'settings' };
    case 'tests':
      return { name: 'tests' };
    case 'prognose':
      return { name: 'prognosis' };
    case 'gesundheit':
      return { name: 'health' };
    case 'frische':
      return b ? { name: 'checkin', date: b } : { name: 'checkin' };
    case 'beschwerde':
      return b && b !== 'neu' ? { name: 'pain', issueId: b } : { name: 'pain' };
    case 'kraft':
      if (b === 'vorlage') return parts[2] && parts[2] !== 'neu' ? { name: 'template', templateId: parts[2] } : { name: 'template' };
      if (b === 'workout' && parts[2]) return { name: 'workout', logId: parts[2] };
      return { name: 'strength' };
    case 'pause':
      if (b === 'neu') return parts[2] ? { name: 'pause', issueId: parts[2] } : { name: 'pause' };
      return b ? { name: 'pause', pauseId: b } : { name: 'pause' };
    default:
      return { name: 'dashboard' };
  }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'dashboard':
      return '#/';
    case 'plan':
      return '#/plan';
    case 'week':
      return `#/plan/${r.weekStart}`;
    case 'planImport':
      return '#/plan/import';
    case 'planGenerate':
      return '#/plan/vorschlag';
    case 'log':
      return r.activityId ? `#/log/${r.activityId}` : r.date ? `#/log/neu/${r.date}` : '#/log/neu';
    case 'history':
      return '#/verlauf';
    case 'analysis':
      return '#/analysen';
    case 'settings':
      return '#/profil';
    case 'tests':
      return '#/tests';
    case 'prognosis':
      return '#/prognose';
    case 'health':
      return '#/gesundheit';
    case 'checkin':
      return r.date ? `#/frische/${r.date}` : '#/frische';
    case 'strength':
      return '#/kraft';
    case 'template':
      return r.templateId ? `#/kraft/vorlage/${r.templateId}` : '#/kraft/vorlage/neu';
    case 'workout':
      return `#/kraft/workout/${r.logId}`;
    case 'pain':
      return r.issueId ? `#/beschwerde/${r.issueId}` : '#/beschwerde/neu';
    case 'pause':
      return r.pauseId ? `#/pause/${r.pauseId}` : r.issueId ? `#/pause/neu/${r.issueId}` : '#/pause/neu';
  }
}

export function useHashRoute(): [Route, (r: Route) => void, () => void, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);
  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/';
  }, []);
  /** Ersetzt den aktuellen Verlaufseintrag (z. B. nach dem Anlegen: Formular → Detailansicht). */
  const replace = useCallback((r: Route) => {
    window.location.replace(routeToHash(r));
  }, []);
  return [route, navigate, back, replace];
}

const NavContext = createContext<{ navigate: (r: Route) => void; back: () => void; replace: (r: Route) => void } | null>(null);
export const NavProvider = NavContext.Provider;
export function useNav() {
  const n = useContext(NavContext);
  if (!n) throw new Error('NavProvider fehlt');
  return n;
}

// ───────── Hinweise (Toast) ─────────
type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 0.5rem) + 84px)' }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Fehlermeldung in Klartext (Validierungsfehler des Repositories enthalten bereits deutschen Text). */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Unbekannter Fehler beim Speichern.';
}
