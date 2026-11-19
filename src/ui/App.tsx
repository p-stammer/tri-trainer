import { useEffect, type ReactNode } from 'react';
import { IconCalendar, IconChart, IconHeart, IconHome, IconPlus } from './components/icons';
import { Loading } from './components/ui';
import { NavProvider, useHashRoute, useLive, type Route } from './state';
import { loadActiveContext, type ActiveContext } from '../data/usecases';
import type { AppSettings } from '../domain/schemas';
import { Onboarding } from './screens/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { PlanOverview } from './screens/PlanOverview';
import { WeekEditor } from './screens/WeekEditor';
import { PlanImport } from './screens/PlanImport';
import { PlanGenerator } from './screens/PlanGenerator';
import { ActivityForm } from './screens/ActivityForm';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { PerformanceTests } from './screens/PerformanceTests';
import { Prognosis } from './screens/Prognosis';
import { Analysis } from './screens/Analysis';
import { Health } from './screens/Health';
import { CheckinForm } from './screens/CheckinForm';
import { PainScreen } from './screens/Pain';
import { PauseForm } from './screens/PauseForm';
import { StrengthLibrary, TemplateEditor, WorkoutScreen } from './screens/Strength';
import { UpdatePrompt } from './UpdatePrompt';

export function App() {
  const [route, navigate, back, replace] = useHashRoute();
  const data = useLive(async (repo) => ({ settings: await repo.getSettings(), ctx: await loadActiveContext(repo) }), []);

  const theme = data?.settings.theme ?? 'system';
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  if (!data) return <Loading />;

  return (
    <NavProvider value={{ navigate, back, replace }}>
      <UpdatePrompt />
      {!data.ctx ? (
        <Onboarding settings={data.settings} />
      ) : (
        <>
          <main>{renderRoute(route, data.ctx, data.settings)}</main>
          <TabBar route={route} navigate={navigate} />
        </>
      )}
    </NavProvider>
  );
}

function renderRoute(route: Route, ctx: ActiveContext, settings: AppSettings) {
  switch (route.name) {
    case 'dashboard':
      return <Dashboard ctx={ctx} settings={settings} />;
    case 'plan':
      return <PlanOverview ctx={ctx} settings={settings} />;
    case 'planImport':
      return <PlanImport ctx={ctx} />;
    case 'planGenerate':
      return <PlanGenerator ctx={ctx} settings={settings} />;
    case 'week':
      return <WeekEditor key={route.weekStart} ctx={ctx} weekStart={route.weekStart} />;
    case 'log':
      return <ActivityForm key={route.activityId ?? `neu-${route.date ?? ''}`} ctx={ctx} settings={settings} activityId={route.activityId} initialDate={route.date} />;
    case 'history':
      return <History />;
    case 'analysis':
      return <Analysis ctx={ctx} settings={settings} />;
    case 'settings':
      return <Settings ctx={ctx} settings={settings} />;
    case 'tests':
      return <PerformanceTests settings={settings} />;
    case 'prognosis':
      return <Prognosis ctx={ctx} settings={settings} />;
    case 'health':
      return <Health ctx={ctx} settings={settings} />;
    case 'checkin':
      return <CheckinForm key={route.date ?? 'heute'} ctx={ctx} settings={settings} initialDate={route.date} />;
    case 'strength':
      return <StrengthLibrary settings={settings} />;
    case 'template':
      return <TemplateEditor key={route.templateId ?? 'neu'} templateId={route.templateId} />;
    case 'workout':
      return <WorkoutScreen key={route.logId} logId={route.logId} />;
    case 'pain':
      return <PainScreen key={route.issueId ?? 'neu'} settings={settings} issueId={route.issueId} />;
    case 'pause':
      return <PauseForm key={`${route.pauseId ?? ''}-${route.issueId ?? ''}`} ctx={ctx} settings={settings} pauseId={route.pauseId} issueId={route.issueId} />;
  }
}

function TabBar({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const active = (names: Route['name'][]) => names.includes(route.name);
  const Tab = ({ label, r, names, icon }: { label: string; r: Route; names: Route['name'][]; icon: ReactNode }) => (
    <button
      type="button"
      onClick={() => navigate(r)}
      aria-current={active(names) ? 'page' : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active(names) ? 'text-ink' : 'text-muted'}`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur" aria-label="Hauptnavigation">
      <div className="mx-auto flex max-w-xl items-end px-2">
        <Tab label="Heute" r={{ name: 'dashboard' }} names={['dashboard']} icon={<IconHome />} />
        <Tab label="Plan" r={{ name: 'plan' }} names={['plan', 'week', 'planImport', 'planGenerate']} icon={<IconCalendar />} />
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => navigate({ name: 'log' })}
            className="-mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-ink text-bg shadow-lg ring-4 ring-bg active:scale-95"
            aria-label="Training erfassen"
          >
            <IconPlus className="h-8 w-8" />
          </button>
        </div>
        <Tab label="Analysen" r={{ name: 'analysis' }} names={['analysis', 'history']} icon={<IconChart />} />
        <Tab label="Gesundheit" r={{ name: 'health' }} names={['health', 'checkin', 'pain', 'pause']} icon={<IconHeart />} />
      </div>
    </nav>
  );
}
