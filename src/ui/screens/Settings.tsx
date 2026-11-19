import { useState } from 'react';
import { Button, DecimalInput, DurationInput, Field, Screen, Section, Segmented, TextInput } from '../components/ui';
import { errorText, useLive, useRepo, useToast, useToday } from '../state';
import { updateRace, type ActiveContext } from '../../data/usecases';
import type { AppSettings, AthleteProfile, RaceDistancePreset, TargetRace } from '../../domain/schemas';
import { RACE_PRESETS } from '../../domain/race';
import { diffDays, isLocalDate } from '../../domain/calendar';
import { ENDURANCE_SPORTS, SPORT_LABEL, type PrimaryMetric } from '../../domain/sports';
import { formatDistance, kmToMeters } from '../../domain/units';
import { nowIso } from '../../domain/ids';
import { ZoneSettings } from './ZoneSettings';
import { BaselineEditor } from '../components/BaselineEditor';
import { PrepRaceSettings } from '../components/PrepRaces';
import { TrainingCampSettings } from '../components/TrainingCamps';
import { RaceSetupSettings } from '../components/RaceSetup';
import { cleanBaseline } from '../../domain/baseline';
import { APP_VERSION, DataSettings } from './DataSettings';

export function Settings({ ctx, settings }: { ctx: ActiveContext; settings: AppSettings }) {
  const profile = useLive(async (repo) => (await repo.getProfile()) ?? null, []);
  const today = useToday(settings.timeZone);
  return (
    <Screen title="Profil und Einstellungen" back>
      <RaceSettings key={ctx.race.updatedAt} race={ctx.race} />
      <PrepRaceSettings planId={ctx.plan.id} mainRaceDate={ctx.race.date} today={today} />
      <TrainingCampSettings planId={ctx.plan.id} mainRaceDate={ctx.race.date} today={today} />
      {profile !== undefined && <ProfileSettings key={profile?.updatedAt ?? 'neu'} profile={profile} />}
      {profile !== undefined && <RaceSetupSettings key={`setup-${profile?.updatedAt ?? 'neu'}`} profile={profile} {...(settings.prognosis ? { legacy: settings.prognosis } : {})} />}
      <ZoneSettings settings={settings} />
      <DisplaySettings settings={settings} />
      <DataSettings settings={settings} />
      <p className="px-2 text-center text-xs text-muted">Ironman Planner {APP_VERSION}. Alle Daten bleiben auf diesem Gerät.</p>
    </Screen>
  );
}

function RaceSettings({ race }: { race: TargetRace }) {
  const repo = useRepo();
  const toast = useToast();
  const [draft, setDraft] = useState(race);
  const dirty = JSON.stringify(draft) !== JSON.stringify(race);
  const valid =
    draft.name.trim() !== '' && isLocalDate(draft.date) && isLocalDate(draft.prepStartDate) && diffDays(draft.prepStartDate, draft.date) >= 0;

  function setPreset(p: RaceDistancePreset) {
    if (p === 'custom') setDraft({ ...draft, preset: p });
    else setDraft({ ...draft, preset: p, swimM: RACE_PRESETS[p].swimM, bikeM: RACE_PRESETS[p].bikeM, runM: RACE_PRESETS[p].runM });
  }

  async function save() {
    try {
      const r = await updateRace(repo, { ...draft, name: draft.name.trim() });
      const parts = ['Wettkampf gespeichert'];
      if (r.added.length) parts.push(`${r.added.length} Wochen ergänzt`);
      if (r.outside.length) parts.push(`${r.outside.length} Wochen liegen jetzt außerhalb des Plans (bleiben gespeichert)`);
      toast(parts.join('. '));
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Section title="Wettkampf">
      <div className="flex flex-col gap-4">
        <Field label="Name">{(id) => <TextInput id={id} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />}</Field>
        <Field label="Distanz">
          {(id) => (
            <select id={id} value={draft.preset} onChange={(e) => setPreset(e.target.value as RaceDistancePreset)} className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3">
              {Object.entries(RACE_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Eigene Distanz</option>
            </select>
          )}
        </Field>
        {draft.preset === 'custom' ? (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Schwimmen">{(id) => <DecimalInput id={id} value={draft.swimM / 1000} suffix="km" onChange={(v) => setDraft({ ...draft, swimM: kmToMeters(v ?? 0) })} />}</Field>
            <Field label="Rad">{(id) => <DecimalInput id={id} value={draft.bikeM / 1000} suffix="km" onChange={(v) => setDraft({ ...draft, bikeM: kmToMeters(v ?? 0) })} />}</Field>
            <Field label="Laufen">{(id) => <DecimalInput id={id} value={draft.runM / 1000} suffix="km" onChange={(v) => setDraft({ ...draft, runM: kmToMeters(v ?? 0) })} />}</Field>
          </div>
        ) : (
          <p className="num text-sm text-muted">
            {formatDistance(draft.swimM)} Schwimmen, {formatDistance(draft.bikeM)} Rad, {formatDistance(draft.runM)} Laufen
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Wettkampfdatum">{(id) => <TextInput id={id} type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />}</Field>
          <Field label="Vorbereitung ab">{(id) => <TextInput id={id} type="date" value={draft.prepStartDate} onChange={(v) => setDraft({ ...draft, prepStartDate: v })} />}</Field>
        </div>
        <Field label="Zielzeit (optional)">
          {(id) => (
            <DurationInput
              idPrefix={id}
              value={draft.goalTimeSec}
              onChange={(v) => {
                const next = { ...draft };
                delete next.goalTimeSec;
                if (v) next.goalTimeSec = v;
                setDraft(next);
              }}
            />
          )}
        </Field>
        <p className="text-xs text-muted">Datumsänderungen löschen keine Planwochen und keine absolvierten Einheiten.</p>
        <Button disabled={!dirty || !valid} onClick={() => void save()}>
          Wettkampf speichern
        </Button>
      </div>
    </Section>
  );
}

function ProfileSettings({ profile }: { profile: AthleteProfile | null }) {
  const repo = useRepo();
  const toast = useToast();
  const initial: AthleteProfile = profile ?? { id: 'me', updatedAt: nowIso() };
  const [draft, setDraft] = useState<AthleteProfile>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function set<K extends Exclude<keyof AthleteProfile, 'id' | 'updatedAt'>>(key: K, value: AthleteProfile[K] | undefined) {
    const next: Record<string, unknown> = { ...draft };
    delete next[key];
    if (value !== undefined && value !== '') next[key] = value;
    setDraft(next as AthleteProfile);
  }

  async function save() {
    try {
      await repo.saveProfile({ ...draft, updatedAt: nowIso() });
      toast('Profil gespeichert');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Section title="Athletenprofil">
      <p className="mb-4 text-sm text-muted">Alle Angaben sind optional und werden nur auf diesem Gerät gespeichert.</p>
      <div className="flex flex-col gap-4">
        <Field label="Name">{(id) => <TextInput id={id} value={draft.name ?? ''} onChange={(v) => set('name', v)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Geburtsdatum">{(id) => <TextInput id={id} type="date" value={draft.birthDate ?? ''} onChange={(v) => set('birthDate', v)} />}</Field>
          <Field label="Geschlecht">
            {(id) => (
              <select
                id={id}
                value={draft.sex ?? ''}
                onChange={(e) => set('sex', (e.target.value || undefined) as AthleteProfile['sex'])}
                className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3"
              >
                <option value="">Keine Angabe</option>
                <option value="female">weiblich</option>
                <option value="male">männlich</option>
                <option value="diverse">divers</option>
              </select>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Größe">{(id) => <DecimalInput id={id} value={draft.heightCm} suffix="cm" onChange={(v) => set('heightCm', v)} />}</Field>
          <Field label="Gewicht">{(id) => <DecimalInput id={id} value={draft.weightKg} suffix="kg" onChange={(v) => set('weightKg', v)} />}</Field>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="mb-3 font-semibold">Aktueller Trainingsumfang</p>
          <BaselineEditor value={draft.baseline} onChange={(v) => set('baseline', cleanBaseline(v) ?? (v.periodWeeks ? { periodWeeks: v.periodWeeks } : undefined))} />
        </div>
        <Field label="Zeitbudget pro Woche (optional)" hint="Wie viel Zeit du künftig höchstens fürs Training hast – Obergrenze für spätere Planvorschläge, nicht dein aktueller Umfang.">
          {(id) => (
            <DecimalInput
              id={id}
              value={draft.availableWeeklySec === undefined ? undefined : draft.availableWeeklySec / 3600}
              suffix="h"
              onChange={(v) => set('availableWeeklySec', v === undefined ? undefined : Math.round(v * 3600))}
            />
          )}
        </Field>
        <Field label="Sportliche Vorgeschichte">
          {(id) => <textarea id={id} rows={3} value={draft.sportsBackground ?? ''} onChange={(e) => set('sportsBackground', e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 p-3" />}
        </Field>
        <Field label="Einschränkungen">
          {(id) => <textarea id={id} rows={2} value={draft.constraints ?? ''} onChange={(e) => set('constraints', e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 p-3" />}
        </Field>
        <Button disabled={!dirty} onClick={() => void save()}>
          Profil speichern
        </Button>
      </div>
    </Section>
  );
}

function DisplaySettings({ settings }: { settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const update = async (patch: Partial<AppSettings>) => {
    try {
      await repo.updateSettings(patch);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };
  return (
    <Section title="Anzeige">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Primäre Zielgröße im Wochenfortschritt</span>
          {ENDURANCE_SPORTS.map((s) => (
            <div key={s} className="grid grid-cols-[100px_1fr] items-center gap-3">
              <span className="text-[15px]">{SPORT_LABEL[s]}</span>
              <Segmented<PrimaryMetric>
                ariaLabel={`Zielgröße ${SPORT_LABEL[s]}`}
                value={settings.primaryMetric[s]}
                options={[
                  { value: 'duration', label: 'Dauer' },
                  { value: 'distance', label: 'Distanz' },
                ]}
                onChange={(v) => void update({ primaryMetric: { ...settings.primaryMetric, [s]: v } })}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Erscheinungsbild</span>
          <Segmented<AppSettings['theme']>
            ariaLabel="Erscheinungsbild"
            value={settings.theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
            onChange={(v) => void update({ theme: v })}
          />
        </div>
      </div>
    </Section>
  );
}
