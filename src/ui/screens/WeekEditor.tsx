import { useState } from 'react';
import { Button, DecimalInput, DurationInput, Field, Screen, Section } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon, IconTrash } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast } from '../state';
import { copyWeekToWeeks, saveWeekTargets, type ActiveContext } from '../../data/usecases';
import type { CompletedActivity, WeekTargets, WeeklySportTarget } from '../../domain/schemas';
import { addDays, compareDates, formatDayMonthDe, formatWeekRangeDe, isoWeek, startOfWeek } from '../../domain/calendar';
import {
  FOCUSES_BY_SPORT,
  PHASE_LABEL,
  PHASE_TYPES,
  PLANNED_SPORTS,
  SESSION_FOCUS_LABEL,
  SPORT_LABEL,
  SPORT_SHORT,
  ZONES,
  ZONE_LABEL,
  isEnduranceSport,
  type PhaseType,
  type PlannedSport,
  type SessionFocus,
} from '../../domain/sports';
import { getSportTarget, scaleWeekTargets, setSportTarget } from '../../domain/plan';
import { sameTargets } from '../../domain/planEdit';
import { describeTarget } from '../components/WeekDiff';
import { computeWeekProgress } from '../../domain/progress';
import { newId } from '../../domain/ids';
import { formatDistance, formatDurationShort } from '../../domain/units';

/** Entfernt undefined-Felder, damit gespeicherte Objekte sauber bleiben. */
function clean(t: WeeklySportTarget): WeeklySportTarget {
  const out: WeeklySportTarget = { sport: t.sport };
  if (t.durationSec !== undefined) out.durationSec = t.durationSec;
  if (t.distanceM !== undefined) out.distanceM = t.distanceM;
  if (t.sessions !== undefined) out.sessions = t.sessions;
  if (t.zoneSec) {
    const z: NonNullable<WeeklySportTarget['zoneSec']> = {};
    for (const zone of ZONES) if (t.zoneSec[zone] !== undefined) z[zone] = t.zoneSec[zone];
    if (Object.keys(z).length > 0) out.zoneSec = z;
  }
  return out;
}

export function WeekEditor({ ctx, weekStart }: { ctx: ActiveContext; weekStart: string }) {
  const week = ctx.weeks.find((w) => w.weekStart === weekStart);
  if (!week) {
    return (
      <Screen title="Woche nicht gefunden" back>
        <p className="text-muted">Diese Woche gehört nicht zum aktuellen Trainingsplan.</p>
      </Screen>
    );
  }
  return <Editor ctx={ctx} weekId={week.id} />;
}

function Editor({ ctx, weekId }: { ctx: ActiveContext; weekId: string }) {
  const repo = useRepo();
  const toast = useToast();
  const { back } = useNav();
  const week = ctx.weeks.find((w) => w.id === weekId)!;
  const [draft, setDraft] = useState<WeekTargets>(() => structuredClone(week.current));
  const [copyCount, setCopyCount] = useState<number | undefined>(1);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  // Neuer Schwerpunkt
  const [newSport, setNewSport] = useState<PlannedSport>('bike');
  const [newFocus, setNewFocus] = useState<SessionFocus>('threshold');
  const [newNote, setNewNote] = useState('');

  const index = ctx.weeks.findIndex((w) => w.id === week.id) + 1;
  const raceWeek = startOfWeek(ctx.race.date);
  const following = ctx.weeks
    .filter((w) => compareDates(w.weekStart, week.weekStart) > 0 && compareDates(w.weekStart, raceWeek) <= 0)
    .map((w) => w.weekStart);
  const dirty = !sameTargets(draft, week.current);

  const update = (sport: PlannedSport, patch: Partial<WeeklySportTarget>) => {
    setDraft((d) => setSportTarget(d, clean({ ...(getSportTarget(d, sport) ?? { sport }), ...patch })));
  };

  async function save(): Promise<boolean> {
    setBusy(true);
    try {
      await saveWeekTargets(repo, week, draft);
      return true;
    } catch (e) {
      toast(errorText(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copyForward() {
    const n = Math.max(1, Math.min(copyCount ?? 1, following.length));
    const targets = following.slice(0, n);
    setBusy(true);
    try {
      const saved = await saveWeekTargets(repo, week, draft);
      const count = await copyWeekToWeeks(repo, saved, targets);
      toast(`Ziele in ${count} ${count === 1 ? 'Woche' : 'Wochen'} übernommen`);
      setConfirmCopy(false);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const { week: kw } = isoWeek(week.weekStart);
  const weekActs = useLive((r) => r.listActivitiesInWeek(week.weekStart), [week.weekStart]);
  const original = week.original;
  const originalDiffers = !!original && !sameTargets(original, week.current);

  return (
    <Screen title={`Woche ${index}`} subtitle={`KW ${kw}, ${formatWeekRangeDe(week.weekStart)}`} back>
      <Section title="Phase">
        <select
          aria-label="Trainingsphase"
          value={draft.phase ?? ''}
          onChange={(e) => {
            const v = e.target.value as PhaseType | '';
            setDraft((d) => {
              const next = { ...d };
              delete next.phase;
              if (v) next.phase = v;
              return next;
            });
          }}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3"
        >
          <option value="">Keine Phase festgelegt</option>
          {PHASE_TYPES.map((p) => (
            <option key={p} value={p}>
              {PHASE_LABEL[p]}
            </option>
          ))}
        </select>
      </Section>

      {PLANNED_SPORTS.map((sport) => {
        const t = getSportTarget(draft, sport);
        return (
          <Section
            key={sport}
            title={SPORT_LABEL[sport]}
            aside={
              <span className={SPORT_TEXT_CLASS[sport]}>
                <SportIcon sport={sport} />
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              {sport === 'strength' ? (
                <>
                  <Field label="Workouts">{(id) => <DecimalInput id={id} integer value={t?.sessions} onChange={(v) => update(sport, { sessions: v })} />}</Field>
                  <Field label="Gesamtdauer (optional)">{(id) => <DurationInput idPrefix={id} value={t?.durationSec} onChange={(v) => update(sport, { durationSec: v })} />}</Field>
                </>
              ) : (
                <>
                  <Field label="Dauer">{(id) => <DurationInput idPrefix={id} value={t?.durationSec} onChange={(v) => update(sport, { durationSec: v })} />}</Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Distanz">
                      {(id) => (
                        <DecimalInput
                          id={id}
                          value={t?.distanceM === undefined ? undefined : sport === 'swim' ? t.distanceM : t.distanceM / 1000}
                          suffix={sport === 'swim' ? 'm' : 'km'}
                          integer={sport === 'swim'}
                          onChange={(v) => update(sport, { distanceM: v === undefined ? undefined : sport === 'swim' ? Math.round(v) : Math.round(v * 1000) })}
                        />
                      )}
                    </Field>
                    <Field label="Einheiten">{(id) => <DecimalInput id={id} integer value={t?.sessions} onChange={(v) => update(sport, { sessions: v })} />}</Field>
                  </div>
                </>
              )}
              {isEnduranceSport(sport) && (
                <details className="rounded-2xl bg-surface-2 px-3 py-2" open={!!t?.zoneSec}>
                  <summary className="cursor-pointer py-1 text-sm font-medium">Zonenzeit-Ziele (Minuten)</summary>
                  <div className="mt-2 flex flex-col gap-2 pb-1">
                    {ZONES.map((z) => (
                      <div key={z} className="grid grid-cols-[1fr_120px] items-center gap-3">
                        <label htmlFor={`${sport}-${z}`} className="text-[15px]">
                          {ZONE_LABEL[z]}
                        </label>
                        <DecimalInput
                          id={`${sport}-${z}`}
                          value={t?.zoneSec?.[z] === undefined ? undefined : t.zoneSec[z]! / 60}
                          suffix="min"
                          onChange={(v) => update(sport, { zoneSec: { ...(t?.zoneSec ?? {}), [z]: v === undefined ? undefined : Math.round(v * 60) } })}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Section>
        );
      })}

      <Section title="Trainingsschwerpunkte">
        {draft.focuses.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {draft.focuses.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className={SPORT_TEXT_CLASS[f.sport]}>
                  <SportIcon sport={f.sport} title={SPORT_LABEL[f.sport]} />
                </span>
                <span className="flex-1">
                  {f.count > 1 ? `${f.count}× ` : ''}
                  {SESSION_FOCUS_LABEL[f.focus]}
                  {f.note && <span className="text-muted"> – {f.note}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`${SESSION_FOCUS_LABEL[f.focus]} entfernen`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted"
                  onClick={() => setDraft((d) => ({ ...d, focuses: d.focuses.filter((x) => x.id !== f.id) }))}
                >
                  <IconTrash className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Sportart des Schwerpunkts"
            value={newSport}
            onChange={(e) => {
              const s = e.target.value as PlannedSport;
              setNewSport(s);
              if (!FOCUSES_BY_SPORT[s].includes(newFocus)) setNewFocus(FOCUSES_BY_SPORT[s][0] ?? 'other');
            }}
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-3"
          >
            {PLANNED_SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Art des Schwerpunkts"
            value={newFocus}
            onChange={(e) => setNewFocus(e.target.value as SessionFocus)}
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-3"
          >
            {FOCUSES_BY_SPORT[newSport].map((f) => (
              <option key={f} value={f}>
                {SESSION_FOCUS_LABEL[f]}
              </option>
            ))}
          </select>
          <input
            aria-label="Hinweis zum Schwerpunkt"
            placeholder="Hinweis, z. B. 3×12 min"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="col-span-2 min-h-12 rounded-xl border border-line bg-surface-2 px-3"
          />
        </div>
        <div className="mt-2">
          <Button
            variant="secondary"
            full
            onClick={() => {
              setDraft((d) => ({
                ...d,
                focuses: [...d.focuses, { id: newId(), sport: newSport, focus: newFocus, count: 1, ...(newNote.trim() ? { note: newNote.trim() } : {}) }],
              }));
              setNewNote('');
            }}
          >
            Schwerpunkt hinzufügen
          </Button>
        </div>
      </Section>

      <Section title="Gewünschte Frische">
        <p className="mb-3 text-sm text-muted">Bereich auf der Skala 1–10, den du in dieser Woche anstrebst (z. B. 4–6 in Belastungswochen, 6–8 in Entlastungswochen).</p>
        <div className="grid grid-cols-2 gap-2">
          {(['min', 'max'] as const).map((k) => (
            <select
              key={k}
              aria-label={k === 'min' ? 'Frische mindestens' : 'Frische höchstens'}
              value={draft.freshnessTarget?.[k] ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                setDraft((d) => {
                  const next = { ...d };
                  const cur = d.freshnessTarget;
                  delete next.freshnessTarget;
                  if (v === undefined) return next;
                  const other = k === 'min' ? (cur?.max ?? Math.max(v, 8)) : (cur?.min ?? Math.min(v, 5));
                  const min = k === 'min' ? v : Math.min(other, v);
                  const max = k === 'max' ? v : Math.max(other, v);
                  next.freshnessTarget = { min, max };
                  return next;
                });
              }}
              className="min-h-12 rounded-xl border border-line bg-surface-2 px-3"
            >
              <option value="">{k === 'min' ? 'von –' : 'bis –'}</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {k === 'min' ? `von ${n}` : `bis ${n}`}
                </option>
              ))}
            </select>
          ))}
        </div>
        {draft.freshnessTarget && (
          <div className="mt-2">
            <Button
              variant="ghost"
              onClick={() =>
                setDraft((d) => {
                  const next = { ...d };
                  delete next.freshnessTarget;
                  return next;
                })
              }
            >
              Zielbereich entfernen
            </Button>
          </div>
        )}
      </Section>

      <Section title="Notizen">
        <textarea
          aria-label="Notizen zur Woche"
          value={draft.notes ?? ''}
          rows={3}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((d) => {
              const next = { ...d };
              delete next.notes;
              if (v) next.notes = v;
              return next;
            });
          }}
          className="w-full rounded-xl border border-line bg-surface-2 p-3"
        />
      </Section>

      <Section title="Umfang anpassen">
        <p className="mb-3 text-sm text-muted">Skaliert Dauer, Distanz und Zonenziele dieser Woche. Wird erst beim Speichern übernommen.</p>
        <div className="grid grid-cols-4 gap-2">
          {[0.8, 0.9, 1.1, 1.2].map((f) => (
            <Button key={f} variant="secondary" onClick={() => setDraft((d) => scaleWeekTargets(d, f))}>
              {f < 1 ? `−${Math.round((1 - f) * 100)} %` : `+${Math.round((f - 1) * 100)} %`}
            </Button>
          ))}
        </div>
      </Section>

      <ComparisonSection original={original} current={week.current} acts={weekActs} weekStart={week.weekStart} originalDiffers={originalDiffers} />

      <div className="flex flex-col gap-2">
        <Button
          full
          disabled={!dirty || busy}
          onClick={() =>
            void save().then((ok) => {
              if (ok) {
                toast('Wochenziele gespeichert');
                back();
              }
            })
          }
        >
          Wochenziele speichern
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(structuredClone(week.current))}>
            Änderungen verwerfen
          </Button>
        )}
      </div>

      {following.length > 0 && (
        <Section title="In Folgewochen übernehmen">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={`Anzahl Wochen (max. ${following.length})`}>
                {(id) => <DecimalInput id={id} integer value={copyCount} onChange={setCopyCount} />}
              </Field>
            </div>
            <Button variant="secondary" onClick={() => setConfirmCopy(true)} disabled={busy || !copyCount}>
              Übernehmen
            </Button>
          </div>
          {confirmCopy && copyCount && (
            <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm">
              <p>
                Die Ziele von {Math.min(copyCount, following.length)} {Math.min(copyCount, following.length) === 1 ? 'Woche' : 'Wochen'} ab dem{' '}
                {formatDayMonthDe(addDays(week.weekStart, 7))} werden mit dieser Woche überschrieben. Absolvierte Einheiten bleiben unverändert.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => void copyForward()} disabled={busy}>
                  Überschreiben
                </Button>
                <Button variant="ghost" onClick={() => setConfirmCopy(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </Section>
      )}
    </Screen>
  );
}

/** Ursprünglicher Plan, aktuell gültiger Plan und tatsächlich absolvierte Einheiten nebeneinander. */
function ComparisonSection({
  original,
  current,
  acts,
  weekStart,
  originalDiffers,
}: {
  original: WeekTargets | undefined;
  current: WeekTargets;
  acts: CompletedActivity[] | undefined;
  weekStart: string;
  originalDiffers: boolean;
}) {
  const p = acts ? computeWeekProgress(weekStart, current, acts) : null;
  const rows = PLANNED_SPORTS.filter((s) => getSportTarget(current, s) || (original && getSportTarget(original, s)) || (p && p.sports[s].duration.done > 0));
  if (rows.length === 0) return null;
  return (
    <Section title="Vergleich">
      <table className="num w-full text-left text-[13px]">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 pr-2 font-medium">Sport</th>
            {originalDiffers && <th className="py-1 pr-2 font-medium">Urspr.</th>}
            <th className="py-1 pr-2 font-medium">Aktuell</th>
            <th className="py-1 font-medium">Absolviert</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const done = p?.sports[s];
            const doneText = !done
              ? '…'
              : s === 'strength'
                ? `${done.sessions.done}×${done.duration.done ? `, ${formatDurationShort(done.duration.done)}` : ''}`
                : [done.duration.done ? formatDurationShort(done.duration.done) : null, done.distance.done ? formatDistance(done.distance.done, s === 'swim' ? 'auto-swim' : 'km') : null]
                    .filter(Boolean)
                    .join(', ') || '–';
            return (
              <tr key={s} className="border-t border-line align-top">
                <td className="py-1.5 pr-2">{SPORT_SHORT[s]}</td>
                {originalDiffers && <td className="py-1.5 pr-2 text-muted">{describeTarget(original ? getSportTarget(original, s) : undefined)}</td>}
                <td className="py-1.5 pr-2">{describeTarget(getSportTarget(current, s))}</td>
                <td className="py-1.5 font-semibold">{doneText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        {originalDiffers ? 'Ursprünglich = erste gespeicherte Fassung dieser Woche. ' : ''}Absolvierte Einheiten werden von Planänderungen nie verändert.
      </p>
    </Section>
  );
}
