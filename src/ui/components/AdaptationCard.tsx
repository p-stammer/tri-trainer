/* Anpassungsvorschläge (M3.6) auf „Heute“: Gründe, „Plan aktualisieren“, „Diese Woche ausblenden“. */
import { Button } from './ui';
import { errorText, useLive, useNav, useRepo, useToast } from '../state';
import { commitWeekChanges, loadGeneratorInput, loadGeneratorSettings, type ActiveContext } from '../../data/usecases';
import { suggestPriorities } from '../../engine/generate';
import { ENDURANCE_SPORTS } from '../../domain/sports';
import type { AppSettings } from '../../domain/schemas';
import { addDays, formatDateDe, startOfWeek, type LocalDate } from '../../domain/calendar';
import { adaptationSuggestions, adaptationText, deloadCause, modelVersionFromDescription, quickDeloadChange } from '../../domain/adaptation';
import { MODEL_VERSION } from '../../engine/params';

export function AdaptationCard({ ctx, settings, today }: { ctx: ActiveContext; settings: AppSettings; today: LocalDate }) {
  const repo = useRepo();
  const { navigate } = useNav();
  const toast = useToast();
  const thisWeek = startOfWeek(today);
  const reasons = useLive(
    async (r) => {
      const [changes, activities, checkins, metrics, pauses, painIssues, painObservations] = await Promise.all([
        r.listPlanChanges(ctx.plan.id),
        r.listActivities(),
        r.listCheckins(),
        r.listMetrics(),
        r.listPauses(),
        r.listPainIssues(),
        r.listPainObservations(),
      ]);
      const undone = new Set(changes.filter((c) => c.kind === 'undo' && c.undoOf).map((c) => c.undoOf));
      const gen = changes.filter((c) => c.kind === 'generated' && !undone.has(c.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const lastGenerated = gen ? { at: gen.createdAt, ...(modelVersionFromDescription(gen.description) ? { modelVersion: modelVersionFromDescription(gen.description) as string } : {}) } : undefined;
      // Gewichtung neu bewerten (nur mit übernommenem Vorschlag, nicht im Modus „manuell“)
      let priorityChanges: { sport: (typeof ENDURANCE_SPORTS)[number]; from: number; to: number; reason: string }[] = [];
      if (lastGenerated) {
        const gs = await loadGeneratorSettings(r, ctx.plan.id);
        if (gs.priorityMode !== 'manual') {
          const now = suggestPriorities(await loadGeneratorInput(r, ctx, today, addDays(startOfWeek(today), 7), gs)) ?? [];
          priorityChanges = now.flatMap((p) => {
            const before = gs.priorities[p.sport]?.suggested;
            return before !== undefined && before !== p.suggested ? [{ sport: p.sport, from: before, to: p.suggested, reason: p.reason }] : [];
          });
        }
      }
      return adaptationSuggestions({
        today,
        weeks: ctx.weeks,
        activities,
        checkins,
        metrics,
        pauses,
        painIssues,
        painObservations,
        ...(lastGenerated ? { lastGenerated } : {}),
        currentModelVersion: MODEL_VERSION,
        priorityChanges,
      });
    },
    [ctx.plan.id, ctx.weeks, today],
  );
  if (!reasons || reasons.length === 0 || settings.adaptationDismissedWeek === thisWeek) return null;
  const tired = reasons.find((r) => (r.code === 'fatigue' || r.code === 'rpe') && r.deloadWeek);
  const deloadWeek = tired && (tired.code === 'fatigue' || tired.code === 'rpe') ? tired.deloadWeek : null;
  const cause = tired ? deloadCause(tired) : null;
  const pain = reasons.find((r) => r.code === 'pain');

  async function deload() {
    if (!deloadWeek || !cause) return;
    const week = ctx.weeks.find((w) => w.weekStart === deloadWeek);
    if (!week) return;
    try {
      await commitWeekChanges(repo, ctx.plan.id, [quickDeloadChange(week, cause)], 'bulk_scale', `Entlastung nach ${cause} (−30 %)`);
      toast(`Woche ab ${formatDateDe(deloadWeek, false)} entlastet – rückgängig im Änderungsverlauf`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  return (
    <section className="rounded-3xl border-2 border-ink/25 bg-surface p-4" aria-label="Plan überprüfen">
      <p className="font-semibold">Plan überprüfen?</p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
        {reasons.map((r, i) => (
          <li key={i}>{adaptationText(r)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Ein neuer Vorschlag zeigt dir vorher jede geänderte Woche. Vergangene Wochen und deine Einheiten bleiben unverändert.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {deloadWeek && <Button onClick={() => void deload()}>{deloadWeek === thisWeek ? 'Diese Woche entlasten' : 'Nächste Woche entlasten'}</Button>}
        {pain?.code === 'pain' && (
          <Button variant={deloadWeek ? 'secondary' : 'primary'} onClick={() => navigate({ name: 'pause', issueId: pain.issueId })}>
            Pause eintragen
          </Button>
        )}
        <Button variant={deloadWeek || pain ? 'secondary' : 'primary'} onClick={() => navigate({ name: 'planGenerate' })}>
          Plan aktualisieren
        </Button>
        <Button variant="ghost" onClick={() => void repo.updateSettings({ adaptationDismissedWeek: thisWeek })}>
          Später
        </Button>
      </div>
    </section>
  );
}
