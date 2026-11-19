import { useState } from 'react';
import { Button, Chip, DecimalInput, DurationInput, Field, Loading, Screen, Section, TextInput } from '../components/ui';
import { SPORT_BG_CLASS, SportIcon } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { deleteActivityWithLinks, logActivity, logQuickWorkout, updateActivity, type ActiveContext, type ActivityInput } from '../../data/usecases';
import type { AppSettings, CompletedActivity } from '../../domain/schemas';
import { OTHER_ACTIVITY_PRESETS,
  FOCUSES_BY_SPORT,
  SESSION_FOCUS_LABEL,
  SPORTS,
  SPORT_SHORT,
  ZONES,
  ZONE_LABEL,
  isEnduranceSport,
  type SessionFocus,
  type Sport,
  type ZoneSeconds,
} from '../../domain/sports';
import { formatDateDe, isLocalDate, isoWeek, startOfWeek } from '../../domain/calendar';
import { formatDurationShort, formatPace, kmToMeters } from '../../domain/units';
import { averagePaceZone, sumZoneSeconds } from '../../domain/zones';
import { isSportPaused } from '../../domain/health';

export function ActivityForm({
  ctx,
  settings,
  activityId,
  initialDate,
}: {
  ctx: ActiveContext;
  settings: AppSettings;
  activityId?: string | undefined;
  initialDate?: string | undefined;
}) {
  const existing = useLive(async (repo) => (activityId ? ((await repo.getActivity(activityId)) ?? null) : null), [activityId]);
  if (activityId && existing === undefined) return <Loading />;
  if (activityId && existing === null) {
    return (
      <Screen title="Einheit nicht gefunden" back>
        <p className="text-muted">Diese Einheit existiert nicht mehr.</p>
      </Screen>
    );
  }
  return <Form ctx={ctx} settings={settings} existing={existing ?? null} initialDate={initialDate} />;
}

function Form({
  ctx,
  settings,
  existing,
  initialDate,
}: {
  ctx: ActiveContext;
  settings: AppSettings;
  existing: CompletedActivity | null;
  initialDate?: string | undefined;
}) {
  const repo = useRepo();
  const toast = useToast();
  const { back, navigate } = useNav();
  const today = useToday(settings.timeZone);

  const initialSport: Sport = existing?.sport ?? settings.lastSport ?? 'run';
  const [sport, setSport] = useState<Sport>(initialSport);
  const [date, setDate] = useState(existing?.date ?? (initialDate && isLocalDate(initialDate) ? initialDate : today));
  const [durationSec, setDurationSec] = useState<number | undefined>(existing?.durationSec);
  const [focus, setFocus] = useState<SessionFocus>(existing?.focus ?? FOCUSES_BY_SPORT[initialSport][0] ?? 'other');
  // Distanz: Schwimmen in Metern, sonst Kilometer (nur Eingabe; intern immer Meter)
  const [distanceInput, setDistanceInput] = useState<number | undefined>(
    existing?.distanceM === undefined ? undefined : existing.sport === 'swim' ? existing.distanceM : existing.distanceM / 1000,
  );
  const [zoneMin, setZoneMin] = useState<Partial<Record<(typeof ZONES)[number], number>>>(() => {
    const z: Partial<Record<(typeof ZONES)[number], number>> = {};
    for (const zone of ZONES) {
      const v = existing?.zoneSec?.[zone];
      if (v !== undefined) z[zone] = Math.round((v / 60) * 10) / 10;
    }
    return z;
  });
  const [rpe, setRpe] = useState<number | undefined>(existing?.rpe);
  const [note, setNote] = useState(existing?.note ?? '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [plannedFocusId, setPlannedFocusId] = useState<string | undefined>(existing?.plannedFocusId);
  const [showDetails, setShowDetails] = useState(
    !!existing && (existing.rpe !== undefined || !!existing.note || existing.zoneSec !== undefined || !!existing.plannedFocusId),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const endurance = isEnduranceSport(sport);
  const zoneSec: ZoneSeconds = {};
  for (const zone of ZONES) {
    const m = zoneMin[zone];
    if (m !== undefined) zoneSec[zone] = Math.round(m * 60);
  }
  const zoneSum = sumZoneSeconds(zoneSec);
  const zoneError = durationSec !== undefined && zoneSum > durationSec ? 'Die Zonenzeiten sind länger als die Trainingsdauer.' : null;
  const dateValid = isLocalDate(date);
  const canSave = dateValid && durationSec !== undefined && durationSec > 0 && !zoneError && !busy;

  const zoneConfigs = useLive((r) => r.listZoneConfigs(), []);
  const distanceMInput =
    distanceInput === undefined || sport === 'strength' ? undefined : sport === 'swim' ? Math.round(distanceInput) : kmToMeters(distanceInput);
  const paceHint =
    sport === 'run' || sport === 'swim' ? averagePaceZone(sport, durationSec, distanceMInput, zoneConfigs?.find((c) => c.sport === sport)) : null;

  const pauses = useLive((r) => r.listPauses(), []);
  const templates = useLive((r) => r.listStrengthTemplates(), []);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const chosenTemplate = sport === 'strength' && !existing ? (templates?.find((t) => t.id === templateId) ?? null) : null;
  const linkedLog = useLive(async (r) => (existing ? ((await r.findStrengthLogByActivity(existing.id)) ?? null) : null), [existing?.id]);
  const pausedBy = dateValid && pauses ? isSportPaused(pauses, sport, date) : null;
  const weekOfDate = dateValid ? ctx.weeks.find((w) => w.weekStart === startOfWeek(date)) : undefined;
  const plannedFocuses = weekOfDate?.current.focuses.filter((f) => f.sport === sport) ?? [];

  function changeSport(s: Sport) {
    setSport(s);
    if (!FOCUSES_BY_SPORT[s].includes(focus)) setFocus(FOCUSES_BY_SPORT[s][0] ?? 'other');
    if (s !== sport) {
      setDistanceInput(undefined);
      setPlannedFocusId(undefined);
    }
  }

  async function save() {
    if (!canSave || durationSec === undefined) return;
    setBusy(true);
    const distanceM =
      distanceInput === undefined || sport === 'strength' ? undefined : sport === 'swim' ? Math.round(distanceInput) : kmToMeters(distanceInput);
    const input: ActivityInput = {
      sport,
      date,
      durationSec,
      focus,
      ...(distanceM !== undefined ? { distanceM } : {}),
      ...(endurance && Object.keys(zoneSec).length > 0 ? { zoneSec } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(sport === 'other' && label.trim() ? { label: label.trim().slice(0, 60) } : {}),
      ...(plannedFocusId && plannedFocuses.some((f) => f.id === plannedFocusId) ? { plannedFocusId } : {}),
    };
    try {
      if (existing) await updateActivity(repo, existing, input);
      else if (chosenTemplate) await logQuickWorkout(repo, chosenTemplate, { date, durationSec, rpe, note: note.trim() || undefined });
      else await logActivity(repo, input);
      const { week } = isoWeek(date);
      toast(existing ? 'Änderungen gespeichert' : `Einheit gespeichert (KW ${week})`);
      back();
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await deleteActivityWithLinks(repo, existing.id);
      toast('Einheit gelöscht');
      back();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Screen title={existing ? 'Einheit bearbeiten' : 'Training erfassen'} back>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div role="radiogroup" aria-label="Sportart" className="grid grid-cols-5 gap-2">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === sport}
              onClick={() => changeSport(s)}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold ${
                s === sport ? `${SPORT_BG_CLASS[s]} border-transparent text-white` : 'border-line bg-surface text-ink'
              }`}
            >
              <SportIcon sport={s} className="h-6 w-6" />
              {SPORT_SHORT[s]}
            </button>
          ))}
        </div>

        {sport === 'other' && (
          <Section title="Was hast du gemacht?">
            <div className="mb-3 flex flex-wrap gap-2">
              {OTHER_ACTIVITY_PRESETS.map((p) => (
                <Chip key={p} active={label === p} onClick={() => setLabel(label === p ? '' : p)}>
                  {p}
                </Chip>
              ))}
            </div>
            <Field label="Bezeichnung (optional)">{(id) => <TextInput id={id} value={label} onChange={setLabel} placeholder="z. B. Bergwanderung" />}</Field>
            <p className="mt-2 text-xs text-muted">Zählt zur Gesamtzeit der Woche und – mit RPE – zur Belastung, aber nicht zu den Zielen für Schwimmen, Rad oder Laufen.</p>
          </Section>
        )}

        {sport === 'strength' && !existing && (
          <Section title="Welches Workout?">
            {templates && templates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <Chip
                    key={t.id}
                    active={templateId === t.id}
                    onClick={() => {
                      const next = templateId === t.id ? null : t.id;
                      setTemplateId(next);
                      if (next && durationSec === undefined && t.plannedDurationSec) setDurationSec(t.plannedDurationSec);
                    }}
                  >
                    {t.name}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Noch keine Vorlagen. Du kannst die Einheit auch ohne Vorlage speichern.</p>
            )}
            <button type="button" onClick={() => navigate({ name: 'strength' })} className="mt-3 text-sm font-medium underline underline-offset-4">
              {templates && templates.length > 0 ? 'Lieber live mit Sätzen erfassen' : 'Vorlagen anlegen'}
            </button>
          </Section>
        )}
        {linkedLog && (
          <button
            type="button"
            onClick={() => navigate({ name: 'workout', logId: linkedLog.id })}
            className="rounded-3xl border border-line bg-surface p-4 text-left"
          >
            <span className="block font-semibold">Workout-Protokoll öffnen</span>
            <span className="block text-sm text-muted">{linkedLog.name}: Übungen, Sätze und Gewichte. Löschen dieser Einheit löscht auch das Protokoll.</span>
          </button>
        )}
        {pausedBy && (
          <p className="rounded-2xl border border-warn/50 bg-surface p-3 text-sm" role="status">
            Für diesen Tag ist eine Trainingspause eingetragen{pausedBy.reason ? ` (${pausedBy.reason})` : ''}. Du kannst die Einheit trotzdem speichern.
          </p>
        )}
        <Section>
          <div className="flex flex-col gap-4">
            <Field label="Dauer">{(id) => <DurationInput idPrefix={id} value={durationSec} onChange={setDurationSec} />}</Field>
            <Field label="Datum" hint={dateValid ? `${formatDateDe(date)}, KW ${isoWeek(date).week}` : undefined} error={dateValid ? null : 'Bitte ein Datum wählen.'}>
              {(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted">Fokus der Einheit</span>
              <div className="flex flex-wrap gap-2">
                {FOCUSES_BY_SPORT[sport].map((f) => (
                  <Chip key={f} active={f === focus} onClick={() => setFocus(f)}>
                    {SESSION_FOCUS_LABEL[f]}
                  </Chip>
                ))}
              </div>
            </div>
            {sport !== 'strength' && (
              <Field label="Distanz (optional)">
                {(id) => (
                  <DecimalInput id={id} value={distanceInput} onChange={setDistanceInput} suffix={sport === 'swim' ? 'm' : 'km'} integer={sport === 'swim'} />
                )}
              </Field>
            )}
            {paceHint && (
              <p className="text-sm" data-testid="pace-zone-hint">
                <span className="num font-semibold">
                  Ø {formatPace(paceHint.pace)} {sport === 'run' ? '/km' : '/100 m'}
                </span>
                {paceHint.zone ? (
                  <>
                    {' '}
                    – liegt in <span className="font-semibold">{ZONE_LABEL[paceHint.zone]}</span>
                    <span className="block text-xs text-muted">Durchschnitt der ganzen Einheit; bei Intervallen verteilt sich die Zeit anders.</span>
                  </>
                ) : (
                  <span className="block text-xs text-muted">Mit {sport === 'run' ? 'Laufzonen' : 'Schwimmzonen'} im Profil zeigt die App hier die Zone.</span>
                )}
              </p>
            )}
          </div>
        </Section>

        {!showDetails ? (
          <Button variant="secondary" onClick={() => setShowDetails(true)}>
            Zonen, RPE und Notiz hinzufügen
          </Button>
        ) : (
          <Section title="Details">
            <div className="flex flex-col gap-5">
              {endurance && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted">Tatsächliche Zeit in Zonen (Minuten, optional)</span>
                  {ZONES.map((z) => (
                    <div key={z} className="grid grid-cols-[1fr_120px] items-center gap-3">
                      <label htmlFor={`zone-${z}`} className="text-[15px]">
                        {ZONE_LABEL[z]}
                      </label>
                      <DecimalInput id={`zone-${z}`} value={zoneMin[z]} suffix="min" onChange={(v) => setZoneMin({ ...zoneMin, [z]: v })} />
                    </div>
                  ))}
                  {paceHint?.zone && zoneSum === 0 && durationSec !== undefined && (
                    <Button variant="ghost" onClick={() => setZoneMin({ [paceHint.zone!]: Math.round((durationSec / 60) * 10) / 10 })}>
                      Gleichmäßig {sport === 'run' ? 'gelaufen' : 'geschwommen'}? Ganze Dauer als {ZONE_LABEL[paceHint.zone].split(' ')[0]} eintragen
                    </Button>
                  )}
                  {zoneError ? (
                    <p className="text-sm text-danger">{zoneError}</p>
                  ) : (
                    durationSec !== undefined && (
                      <p className="text-xs text-muted">
                        Ohne Zonenangabe: {formatDurationShort(Math.max(0, durationSec - zoneSum))} – bleibt als unbekannt gespeichert.
                      </p>
                    )
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted">Anstrengung (Session-RPE 1–10, optional)</span>
                <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Session-RPE">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rpe === n}
                      onClick={() => setRpe(rpe === n ? undefined : n)}
                      className={`num min-h-11 rounded-xl text-[15px] font-semibold ${rpe === n ? 'bg-ink text-bg' : 'bg-surface-2'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">1 = sehr leicht, 10 = maximal. Nochmal tippen entfernt den Wert.</p>
              </div>

              {plannedFocuses.length > 0 && (
                <Field label="Geplantem Schwerpunkt zuordnen">
                  {(id) => (
                    <select
                      id={id}
                      value={plannedFocusId ?? ''}
                      onChange={(e) => setPlannedFocusId(e.target.value || undefined)}
                      className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3"
                    >
                      <option value="">Keine Zuordnung</option>
                      {plannedFocuses.map((f) => (
                        <option key={f.id} value={f.id}>
                          {SESSION_FOCUS_LABEL[f.focus]}
                          {f.note ? ` – ${f.note}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}

              <Field label="Notiz">
                {(id) => (
                  <textarea
                    id={id}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-line bg-surface-2 p-3"
                  />
                )}
              </Field>
            </div>
          </Section>
        )}

        <Button type="submit" full disabled={!canSave}>
          {busy ? 'Speichere …' : existing ? 'Änderungen speichern' : 'Einheit speichern'}
        </Button>

        {existing &&
          (confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="danger" full onClick={() => void remove()}>
                Endgültig löschen
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <span className="text-danger">Einheit löschen</span>
            </Button>
          ))}
      </form>
    </Screen>
  );
}
