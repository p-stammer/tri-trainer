/* Race-Setup (Profil, seit 0.21.0): Material am Wettkampftag. Grundlage der Zielzeit-Prognose – ohne Setup keine Prognose. */
import { useState } from 'react';
import { Button, Section } from './ui';
import { errorText, useRepo, useToast } from '../state';
import type { AthleteProfile } from '../../domain/schemas';
import { nowIso } from '../../domain/ids';
import { defaultRaceSetup, type PrognosisSettings, type RaceSetup } from '../../domain/prognosis';

export const BIKE_LABEL: Record<RaceSetup['bikeType'], string> = { tt: 'Zeitfahr-/Triathlonrad', aero_road: 'Aero-Rennrad', road: 'Rennrad', gravel: 'Gravelbike' };
export const WHEELS_LABEL: Record<RaceSetup['wheels'], string> = { deep: 'Hochprofil / Scheibe', standard: 'Standard' };
export const TIRES_LABEL: Record<RaceSetup['tires'], string> = { race: 'Rennreifen', training: 'Trainingsreifen' };
export const KIT_LABEL: Record<RaceSetup['kit'], string> = { aero: 'Aero', normal: 'Normal', loose: 'Locker' };
export const SHOES_LABEL: Record<RaceSetup['runShoes'], string> = { carbon: 'Carbon-Wettkampfschuh', training: 'Trainingsschuh' };
export const WETSUIT_LABEL: Record<RaceSetup['wetsuit'], string> = { yes: 'Mit Neo', no: 'Ohne Neo', unknown: 'Noch offen' };

/** Kurzbeschreibung, z. B. „Rennrad mit Aufliegern · Standard-Laufräder · …“ */
export function raceSetupSummary(s: RaceSetup): string {
  const bike = s.bikeType === 'tt' ? BIKE_LABEL.tt : `${BIKE_LABEL[s.bikeType]} ${s.clipOns ? 'mit' : 'ohne'} Aufleger`;
  return [
    bike,
    s.wheels === 'deep' ? 'Hochprofil-Laufräder' : 'Standard-Laufräder',
    TIRES_LABEL[s.tires],
    `Kleidung/Helm ${KIT_LABEL[s.kit].toLowerCase()}`,
    SHOES_LABEL[s.runShoes],
    WETSUIT_LABEL[s.wetsuit],
  ].join(' · ');
}

function Choice<T extends string>({ label, hint, value, options, onChange, cols = 2 }: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
  cols?: 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div role="radiogroup" aria-label={label} className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`flex min-h-12 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm ${o.value === value ? 'border-ink bg-surface font-semibold' : 'border-line bg-surface-2 text-muted'}`}
          >
            {o.label}
            {o.sub && <span className="text-xs font-normal text-muted">{o.sub}</span>}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}

export function RaceSetupSettings({ profile, legacy }: { profile: AthleteProfile | null; legacy?: PrognosisSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const saved = profile?.raceSetup;
  const [draft, setDraft] = useState<RaceSetup>(saved ?? defaultRaceSetup(legacy));
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof RaceSetup>(k: K, v: RaceSetup[K]) => setDraft({ ...draft, [k]: v, ...(k === 'bikeType' && v === 'tt' ? { clipOns: true } : {}) });

  async function save() {
    try {
      const fresh = (await repo.getProfile()) ?? { id: 'me' as const };
      await repo.saveProfile({ ...fresh, raceSetup: draft, updatedAt: nowIso() });
      toast('Race-Setup gespeichert');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  async function remove() {
    try {
      const fresh = await repo.getProfile();
      if (!fresh) return;
      const { raceSetup: _drop, ...rest } = fresh;
      void _drop;
      await repo.saveProfile({ ...rest, updatedAt: nowIso() });
      toast('Race-Setup entfernt');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Section title="Race-Setup" aside={saved ? 'hinterlegt' : 'fehlt'}>
      <p className="mb-4 text-sm text-muted">
        Dein Material am Wettkampftag. Die Zielzeit-Prognose rechnet damit Luft- und Rollwiderstand auf dem Rad sowie Neo und Laufschuhe ein – ohne Race-Setup zeigt die
        App keine Prognose.
      </p>
      <div className="flex flex-col gap-5" data-testid="race-setup">
        <Choice
          label="Rad"
          value={draft.bikeType}
          onChange={(v) => set('bikeType', v)}
          options={(['tt', 'aero_road', 'road', 'gravel'] as const).map((v) => ({ value: v, label: BIKE_LABEL[v] }))}
        />
        {draft.bikeType !== 'tt' && (
          <Choice
            label="Aufleger"
            hint="Mit Aufliegern sitzt du deutlich flacher – das spart auf dem Rad oft mehr als jedes andere Material."
            value={draft.clipOns ? 'yes' : 'no'}
            onChange={(v) => set('clipOns', v === 'yes')}
            options={[
              { value: 'yes', label: 'Mit Aufliegern' },
              { value: 'no', label: 'Ohne Aufleger' },
            ]}
          />
        )}
        <Choice
          label="Laufräder"
          value={draft.wheels}
          onChange={(v) => set('wheels', v)}
          options={[
            { value: 'deep', label: WHEELS_LABEL.deep, sub: 'ab ca. 50 mm Felgenhöhe' },
            { value: 'standard', label: WHEELS_LABEL.standard, sub: 'flache Felgen' },
          ]}
        />
        <Choice
          label="Reifen"
          value={draft.tires}
          onChange={(v) => set('tires', v)}
          options={[
            { value: 'race', label: TIRES_LABEL.race, sub: 'z. B. leichte Rennreifen, Latex oder tubeless' },
            { value: 'training', label: TIRES_LABEL.training, sub: 'pannensicher, Butylschlauch' },
          ]}
        />
        <Choice
          label="Kleidung und Helm"
          value={draft.kit}
          cols={3}
          onChange={(v) => set('kit', v)}
          options={[
            { value: 'aero', label: KIT_LABEL.aero, sub: 'Aero-Einteiler + Aerohelm' },
            { value: 'normal', label: KIT_LABEL.normal, sub: 'eng anliegend, Straßenhelm' },
            { value: 'loose', label: KIT_LABEL.loose, sub: 'Trikot/Shirt, flatternd' },
          ]}
        />
        <Choice
          label="Laufschuhe"
          value={draft.runShoes}
          onChange={(v) => set('runShoes', v)}
          options={[
            { value: 'carbon', label: SHOES_LABEL.carbon, sub: 'Carbonplatte, Schaum mit viel Rückfederung' },
            { value: 'training', label: SHOES_LABEL.training },
          ]}
        />
        <Choice
          label="Schwimmen"
          hint="Ob Neo erlaubt ist, entscheidet am Renntag die Wassertemperatur. „Noch offen“ rechnet die Spanne von mit bis ohne Neo."
          value={draft.wetsuit}
          cols={3}
          onChange={(v) => set('wetsuit', v)}
          options={(['yes', 'no', 'unknown'] as const).map((v) => ({ value: v, label: WETSUIT_LABEL[v] }))}
        />
        <Button disabled={!dirty} onClick={() => void save()}>
          {saved ? 'Race-Setup speichern' : 'Race-Setup hinterlegen'}
        </Button>
        {saved && (
          <Button variant="ghost" onClick={() => void remove()}>
            Race-Setup entfernen
          </Button>
        )}
      </div>
    </Section>
  );
}
