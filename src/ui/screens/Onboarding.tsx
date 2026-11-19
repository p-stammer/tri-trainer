/* Einrichtung beim ersten Start in vier Schritten. Nur der Wettkampf ist Pflicht. */
import { useState, type ReactNode } from 'react';
import { Button, DecimalInput, DurationInput, Field, PaceInput, Section, TextInput } from '../components/ui';
import { BaselineEditor } from '../components/BaselineEditor';
import { SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { errorText, useRepo, useToast, useToday } from '../state';
import { saveReferenceMetric, setupRaceAndPlan, type ReferenceSport } from '../../data/usecases';
import { RACE_PRESETS } from '../../domain/race';
import { diffDays, isLocalDate, startOfWeek } from '../../domain/calendar';
import type { AppSettings, AthleteProfile, RaceDistancePreset, TrainingBaseline } from '../../domain/schemas';
import { nowIso } from '../../domain/ids';
import { kmToMeters } from '../../domain/units';
import { cleanBaseline } from '../../domain/baseline';
import { RestoreBackup } from './DataSettings';

const STEPS = ['Wettkampf', 'Über dich', 'Trainingsumfang', 'Leistungswerte'] as const;

type RefInput = { value?: number | undefined; date: string; method: string };

export function Onboarding({ settings }: { settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const today = useToday(settings.timeZone);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Schritt 1: Wettkampf
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<RaceDistancePreset>('full');
  const [date, setDate] = useState('');
  const [prepStart, setPrepStart] = useState(startOfWeek(today));
  const [custom, setCustom] = useState<{ swimKm?: number | undefined; bikeKm?: number | undefined; runKm?: number | undefined }>({});
  const [goalSec, setGoalSec] = useState<number | undefined>(undefined);

  // Schritt 2: Über dich
  const [athleteName, setAthleteName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<AthleteProfile['sex'] | ''>('');
  const [heightCm, setHeightCm] = useState<number | undefined>(undefined);
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);

  // Schritt 3: Umfang
  const [baseline, setBaseline] = useState<TrainingBaseline | undefined>(undefined);
  const [weeklyHours, setWeeklyHours] = useState<number | undefined>(undefined);

  // Schritt 4: Leistungswerte
  const [refs, setRefs] = useState<Record<ReferenceSport, RefInput>>({
    bike: { date: today, method: '' },
    run: { date: today, method: '' },
    swim: { date: today, method: '' },
  });
  const setRef = (s: ReferenceSport, patch: Partial<RefInput>) => setRefs((r) => ({ ...r, [s]: { ...r[s], ...patch } }));

  const dateError = date && !isLocalDate(date) ? 'Bitte ein gültiges Datum wählen.' : null;
  const prepError = isLocalDate(date) && isLocalDate(prepStart) && diffDays(prepStart, date) < 0 ? 'Der Beginn muss vor dem Wettkampf liegen.' : null;
  const pastWarning = isLocalDate(date) && diffDays(today, date) < 0 ? 'Das Datum liegt in der Vergangenheit.' : null;
  const customMissing = preset === 'custom' && (custom.swimKm === undefined || custom.bikeKm === undefined || custom.runKm === undefined);
  const raceValid = name.trim() !== '' && isLocalDate(date) && isLocalDate(prepStart) && !prepError && !customMissing;
  const birthError = birthDate && !isLocalDate(birthDate) ? 'Bitte ein gültiges Datum wählen.' : null;
  const refsValid = (Object.values(refs) as RefInput[]).every((r) => r.value === undefined || isLocalDate(r.date));

  async function finish() {
    if (!raceValid || !refsValid || busy) return;
    setBusy(true);
    try {
      const dist =
        preset === 'custom'
          ? { swimM: kmToMeters(custom.swimKm ?? 0), bikeM: kmToMeters(custom.bikeKm ?? 0), runM: kmToMeters(custom.runKm ?? 0) }
          : RACE_PRESETS[preset];
      await setupRaceAndPlan(repo, {
        name: name.trim(),
        date,
        preset,
        swimM: dist.swimM,
        bikeM: dist.bikeM,
        runM: dist.runM,
        prepStartDate: prepStart,
        ...(goalSec ? { goalTimeSec: goalSec } : {}),
      });
      const bl = cleanBaseline(baseline);
      const profile: AthleteProfile = {
        id: 'me',
        ...(athleteName.trim() ? { name: athleteName.trim() } : {}),
        ...(isLocalDate(birthDate) ? { birthDate } : {}),
        ...(sex ? { sex } : {}),
        ...(heightCm !== undefined ? { heightCm } : {}),
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(weeklyHours !== undefined ? { availableWeeklySec: Math.round(weeklyHours * 3600) } : {}),
        ...(bl ? { baseline: bl } : {}),
        updatedAt: nowIso(),
      };
      if (Object.keys(profile).length > 2) await repo.saveProfile(profile);
      for (const s of ['bike', 'run', 'swim'] as const) {
        const r = refs[s];
        if (r.value !== undefined) await saveReferenceMetric(repo, s, r.value, r.date, r.method);
      }
      toast('Eingerichtet. Du kannst jetzt deine Wochenziele planen.');
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  const last = step === STEPS.length - 1;
  const canNext = step === 0 ? raceValid : step === 1 ? !birthError : step === 3 ? refsValid : true;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="pt-safe pb-5">
        <div className="flex gap-1.5 pt-4" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Schritt {step + 1} von {STEPS.length}: {STEPS[step]}
          {step > 0 ? ' (optional)' : ''}
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">
          {step === 0 ? 'Worauf trainierst du hin?' : step === 1 ? 'Über dich' : step === 2 ? 'Wie viel trainierst du gerade?' : 'Deine Leistungswerte'}
        </h1>
        <p className="mt-2 text-muted">
          {step === 0
            ? 'Aus Wettkampfdatum und Vorbereitungsbeginn entstehen deine Trainingswochen.'
            : step === 1
              ? 'Alle Angaben sind freiwillig und bleiben auf diesem Gerät.'
              : step === 2
                ? 'Dein aktueller Umfang ist der Ausgangspunkt für die spätere Planung. Leer lassen, was du nicht weißt.'
                : 'Damit lassen sich Zonen einordnen. Fehlende Werte kannst du später im Profil ergänzen.'}
        </p>
      </header>

      {step === 0 && (
        <details className="mb-5 rounded-2xl bg-surface p-4">
          <summary className="cursor-pointer font-semibold">Schon ein Backup? Daten übernehmen</summary>
          <p className="mb-3 mt-2 text-sm text-muted">Beim Umzug auf ein neues Gerät oder eine neue Adresse: Backup-Datei (JSON) wählen, prüfen, übernehmen.</p>
          <RestoreBackup timeZone={settings.timeZone} firstStart />
        </details>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canNext) return;
          if (last) void finish();
          else setStep(step + 1);
        }}
      >
        {step === 0 && (
          <Section>
            <div className="flex flex-col gap-4">
              <Field label="Name des Wettkampfs">{(id) => <TextInput id={id} value={name} onChange={setName} placeholder="z. B. Ironman Frankfurt" />}</Field>
              <Field label="Distanz">
                {(id) => (
                  <select id={id} value={preset} onChange={(e) => setPreset(e.target.value as RaceDistancePreset)} className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3">
                    {Object.entries(RACE_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>
                        {p.label}
                      </option>
                    ))}
                    <option value="custom">Eigene Distanz</option>
                  </select>
                )}
              </Field>
              {preset === 'custom' && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Schwimmen">{(id) => <DecimalInput id={id} value={custom.swimKm} suffix="km" onChange={(v) => setCustom({ ...custom, swimKm: v })} />}</Field>
                  <Field label="Rad">{(id) => <DecimalInput id={id} value={custom.bikeKm} suffix="km" onChange={(v) => setCustom({ ...custom, bikeKm: v })} />}</Field>
                  <Field label="Laufen">{(id) => <DecimalInput id={id} value={custom.runKm} suffix="km" onChange={(v) => setCustom({ ...custom, runKm: v })} />}</Field>
                </div>
              )}
              <Field label="Wettkampfdatum" error={dateError} hint={pastWarning ?? undefined}>
                {(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}
              </Field>
              <Field label="Beginn der Vorbereitung" error={prepError} hint="Standard: Montag dieser Woche">
                {(id) => <TextInput id={id} type="date" value={prepStart} onChange={setPrepStart} />}
              </Field>
              <Field label="Zielzeit (optional)">{(id) => <DurationInput idPrefix={id} value={goalSec} onChange={setGoalSec} />}</Field>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section>
            <div className="flex flex-col gap-4">
              <Field label="Dein Name">{(id) => <TextInput id={id} value={athleteName} onChange={setAthleteName} />}</Field>
              <Field label="Geburtsdatum" error={birthError}>
                {(id) => <TextInput id={id} type="date" value={birthDate} onChange={setBirthDate} />}
              </Field>
              <Field label="Geschlecht">
                {(id) => (
                  <select
                    id={id}
                    value={sex ?? ''}
                    onChange={(e) => setSex(e.target.value as AthleteProfile['sex'] | '')}
                    className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3"
                  >
                    <option value="">Keine Angabe</option>
                    <option value="female">weiblich</option>
                    <option value="male">männlich</option>
                    <option value="diverse">divers</option>
                  </select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Größe">{(id) => <DecimalInput id={id} value={heightCm} suffix="cm" onChange={setHeightCm} />}</Field>
                <Field label="Gewicht">{(id) => <DecimalInput id={id} value={weightKg} suffix="kg" onChange={setWeightKg} />}</Field>
              </div>
            </div>
          </Section>
        )}

        {step === 2 && (
          <>
            <Section>
              <BaselineEditor value={baseline} onChange={setBaseline} />
            </Section>
            <Section>
              <Field label="Zeitbudget pro Woche" hint="Wie viel Zeit du künftig höchstens fürs Training hast – Obergrenze für spätere Planvorschläge.">
                {(id) => <DecimalInput id={id} value={weeklyHours} suffix="h" onChange={setWeeklyHours} />}
              </Field>
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <RefBlock sport="bike" title="Radfahren: FTP" hint="Rad-Zonen werden daraus automatisch abgeleitet.">
              <DecimalInput ariaLabel="FTP" integer value={refs.bike.value} suffix="W" onChange={(v) => setRef('bike', { value: v })} />
            </RefBlock>
            <RefBlock sport="run" title="Laufen: Schwellenpace">
              <PaceInput label="Schwellenpace" value={refs.run.value} onChange={(v) => setRef('run', { value: v })} unit="/km" />
            </RefBlock>
            <RefBlock sport="swim" title="Schwimmen: CSS">
              <PaceInput label="CSS" value={refs.swim.value} onChange={(v) => setRef('swim', { value: v })} unit="/100 m" />
            </RefBlock>
            {(['bike', 'run', 'swim'] as const).some((s) => refs[s].value !== undefined) && (
              <Section title="Wann und wie gemessen?">
                <div className="flex flex-col gap-4">
                  {(['bike', 'run', 'swim'] as const)
                    .filter((s) => refs[s].value !== undefined)
                    .map((s) => (
                      <div key={s} className="grid grid-cols-2 gap-2">
                        <Field label={`${s === 'bike' ? 'FTP' : s === 'run' ? 'Schwellenpace' : 'CSS'}: Datum`}>
                          {(id) => <TextInput id={id} type="date" value={refs[s].date} onChange={(v) => setRef(s, { date: v })} />}
                        </Field>
                        <Field label="Methode">
                          {(id) => <TextInput id={id} value={refs[s].method} onChange={(v) => setRef(s, { method: v })} placeholder="z. B. Test" />}
                        </Field>
                      </div>
                    ))}
                </div>
              </Section>
            )}
          </>
        )}

        <Button type="submit" full disabled={!canNext || busy}>
          {busy ? 'Speichere …' : last ? 'Fertig' : 'Weiter'}
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Zurück
            </Button>
          )}
          {step > 0 && !last && (
            <Button variant="ghost" onClick={() => setStep(step + 1)}>
              Überspringen
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function RefBlock({ sport, title, hint, children }: { sport: 'bike' | 'run' | 'swim'; title: string; hint?: string; children: ReactNode }) {
  return (
    <Section>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className={SPORT_TEXT_CLASS[sport]}>
          <SportIcon sport={sport} />
        </span>
        {title}
      </div>
      {children}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Section>
  );
}
