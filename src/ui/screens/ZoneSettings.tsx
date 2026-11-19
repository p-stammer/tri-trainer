/* Leistungswerte und Intensitätszonen je Ausdauersportart. */
import { useState } from 'react';
import { Button, DecimalInput, Field, PaceInput, Section, TextInput } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon } from '../components/icons';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { applyDerivedZones, saveReferenceMetric } from '../../data/usecases';
import type { AppSettings, PerformanceMetric, SportZoneConfiguration } from '../../domain/schemas';
import { ENDURANCE_SPORTS, SPORT_LABEL, ZONES, ZONE_LABEL, type EnduranceSport } from '../../domain/sports';
import { DERIVED_METHOD, ZONE_METRIC_FOR_SPORT, deriveZonesFromReference, validateZoneBounds } from '../../domain/zones';
import { formatPace } from '../../domain/units';
import { formatDateDe, isLocalDate } from '../../domain/calendar';
import { nowIso } from '../../domain/ids';

type Bounds = [number, number, number, number];

const METRIC_FOR: Record<EnduranceSport, PerformanceMetric['kind']> = {
  bike: 'bike_ftp_w',
  run: 'run_threshold_pace_s_per_km',
  swim: 'swim_css_s_per_100m',
};
const METHOD_TEXT: Record<SportZoneConfiguration['method'], (ref: string) => string> = {
  manual: () => 'Manuell festgelegt',
  derived_coggan_ftp: (ref) => `Aus FTP ${ref} abgeleitet (Coggan)`,
  derived_friel_pace: (ref) => `Aus Schwellenpace ${ref} nach altem Schema (Grundlage zu schnell) – bitte neuen Vorschlag übernehmen`,
  derived_run_pace: (ref) => `Vorschlag aus Schwellenpace ${ref} (Langdistanz), nicht individuell validiert`,
  derived_css_offset: (ref) => `Vorschlag aus CSS ${ref} (CSS + Sekunden), nicht individuell validiert`,
};

const REF_LABEL: Record<EnduranceSport, string> = {
  bike: 'FTP',
  run: 'Schwellenpace',
  swim: 'CSS (Critical Swim Speed)',
};

function fmtValue(sport: EnduranceSport, v: number): string {
  if (sport === 'bike') return `${Math.round(v)} W`;
  return `${formatPace(v)} ${sport === 'run' ? '/km' : '/100 m'}`;
}

/** Bereichsbeschreibung je Zone aus den Untergrenzen von Z2–Z5. */
function zoneRanges(sport: EnduranceSport, b: Bounds): string[] {
  if (sport === 'bike') {
    return [
      `unter ${b[0]} W`,
      `${b[0]}–${b[1] - 1} W`,
      `${b[1]}–${b[2] - 1} W`,
      `${b[2]}–${b[3] - 1} W`,
      `ab ${b[3]} W`,
    ];
  }
  const u = sport === 'run' ? '/km' : '/100 m';
  return [
    `langsamer als ${formatPace(b[0])} ${u}`,
    `${formatPace(b[0])}–${formatPace(b[1] + 1)} ${u}`,
    `${formatPace(b[1])}–${formatPace(b[2] + 1)} ${u}`,
    `${formatPace(b[2])}–${formatPace(b[3] + 1)} ${u}`,
    `schneller als ${formatPace(b[3])} ${u}`,
  ];
}

export function ZoneSettings({ settings }: { settings: AppSettings }) {
  const { navigate } = useNav();
  const data = useLive(async (repo) => ({ configs: await repo.listZoneConfigs(), metrics: await repo.listMetrics() }), []);
  return (
    <Section title="Leistungswerte und Zonen">
      <p className="mb-4 text-sm text-muted">
        Zonen helfen dir, Zonenzeiten einzuordnen. Die App leitet sie aus deinen Ankerwerten ab: Rad aus der FTP (Coggan), Laufen
        aus der Schwellenpace (Grundlage nicht schneller als ein realistisches Ironman-Marathontempo), Schwimmen aus der CSS (CSS + Sekunden). Das sind verbreitete Konventionen, nicht individuell
        validiert. Selbst festgelegte Grenzen haben immer Vorrang.
      </p>
      <div className="mb-4">
        <Button variant="secondary" onClick={() => navigate({ name: 'tests' })}>
          Leistungstests und Verlauf
        </Button>
      </div>
      <div className="flex flex-col gap-6">
        {ENDURANCE_SPORTS.map((s) => (
          <SportZones
            key={s}
            sport={s}
            timeZone={settings.timeZone}
            config={data?.configs.find((c) => c.sport === s)}
            latest={data?.metrics.find((m) => m.kind === METRIC_FOR[s])}
          />
        ))}
      </div>
    </Section>
  );
}

function SportZones({
  sport,
  timeZone,
  config,
  latest,
}: {
  sport: EnduranceSport;
  timeZone: string;
  config: SportZoneConfiguration | undefined;
  latest: PerformanceMetric | undefined;
}) {
  const repo = useRepo();
  const toast = useToast();
  const today = useToday(timeZone);
  const [editing, setEditing] = useState(false);
  const [refW, setRefW] = useState<number | undefined>(undefined);
  const [refDate, setRefDate] = useState(today);
  const [method, setMethod] = useState('');
  const [bounds, setBounds] = useState<(number | undefined)[]>(() => (config ? [...config.bounds] : [undefined, undefined, undefined, undefined]));

  const refValue = refW;
  const unit = sport === 'run' ? '/km' : sport === 'swim' ? '/100 m' : 'W';
  const metric = ZONE_METRIC_FOR_SPORT[sport];

  async function saveReference() {
    if (refValue === undefined || !isLocalDate(refDate)) return;
    try {
      await saveReferenceMetric(repo, sport, refValue, refDate, method);
      toast(
        sport === 'bike'
          ? 'FTP gespeichert, Rad-Zonen neu berechnet'
          : config?.method === 'manual'
            ? `${REF_LABEL[sport]} gespeichert – deine manuellen Zonen bleiben`
            : `${REF_LABEL[sport]} gespeichert, Zonen-Vorschlag berechnet`,
      );
      setRefW(undefined);
      setMethod('');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  // Vorschlag für Laufen/Schwimmen zeigen, wenn ein Ankerwert existiert und die aktuellen Zonen nicht schon daraus stammen
  const suggestion =
    sport !== 'bike' && latest && !(config && config.method === DERIVED_METHOD[sport] && config.referenceValue === latest.value)
      ? deriveZonesFromReference(sport, latest.value)
      : null;

  async function applySuggestion() {
    if (!latest) return;
    try {
      await applyDerivedZones(repo, sport, latest.value);
      toast(`${SPORT_LABEL[sport]}: Zonen-Vorschlag übernommen`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const numericBounds = bounds.filter((b): b is number => b !== undefined && b > 0);
  const boundsComplete = numericBounds.length === 4;
  const boundsError = boundsComplete ? validateZoneBounds(metric, numericBounds) : null;

  async function saveBounds() {
    if (!boundsComplete || boundsError) return;
    try {
      await repo.saveZoneConfig({ id: sport, sport, metric, method: 'manual', bounds: numericBounds as Bounds, updatedAt: nowIso() });
      toast(`${SPORT_LABEL[sport]}: Zonen gespeichert`);
      setEditing(false);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className={SPORT_TEXT_CLASS[sport]}>
          <SportIcon sport={sport} />
        </span>
        {SPORT_LABEL[sport]}
      </div>
      <p className="text-sm">
        {REF_LABEL[sport]}:{' '}
        {latest ? (
          <span className="num font-semibold">
            {fmtValue(sport, latest.value)} <span className="font-normal text-muted">vom {formatDateDe(latest.date, false)}{latest.method ? `, ${latest.method}` : ''}</span>
          </span>
        ) : (
          <span className="text-muted">nicht erfasst</span>
        )}
      </p>

      {config ? (
        <ul className="num mt-2 flex flex-col gap-0.5 text-sm">
          {zoneRanges(sport, config.bounds as Bounds).map((r, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-muted">{ZONE_LABEL[ZONES[i]!]}</span>
              <span>{r}</span>
            </li>
          ))}
          <li className="mt-1 text-xs text-muted">
            {METHOD_TEXT[config.method](config.referenceValue !== undefined ? fmtValue(sport, config.referenceValue) : '')}
          </li>
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Keine Zonen festgelegt.</p>
      )}

      {suggestion && (
        <div className="mt-3 rounded-2xl border border-line p-3" data-testid={`zone-suggestion-${sport}`}>
          <p className="text-sm font-medium">
            {config ? 'Vorschlag aus' : 'Zonen-Vorschlag aus'} {REF_LABEL[sport].split(' ')[0]} {fmtValue(sport, latest!.value)}
          </p>
          <ul className="num mt-1 flex flex-col gap-0.5 text-sm">
            {zoneRanges(sport, suggestion).map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted">{ZONE_LABEL[ZONES[i]!]}</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">
            {sport === 'run'
              ? 'Grundlage 128–150 % der Schwellenpace: nicht schneller als ein realistisches Ironman-Marathontempo. Abgeleitet aus Praxis-Konventionen, nicht individuell validiert.'
              : 'Nach dem üblichen Schema „CSS + Sekunden“. Verbreitete Konvention, nicht individuell validiert.'}{config?.method === 'manual' ? ' Deine manuellen Grenzen bleiben, bis du den Vorschlag übernimmst.' : ''}
          </p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => void applySuggestion()}>
              Vorschlag übernehmen
            </Button>
          </div>
        </div>
      )}

      <details className="mt-3 rounded-2xl bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm font-medium">Neuen {REF_LABEL[sport].split(' ')[0]}-Wert eintragen</summary>
        <div className="mt-2 flex flex-col gap-3 pb-2">
          <Field label={REF_LABEL[sport]}>
            {(id) =>
              sport === 'bike' ? (
                <DecimalInput id={id} integer value={refW} suffix="W" onChange={setRefW} />
              ) : (
                <PaceInput idPrefix={id} label={REF_LABEL[sport]} value={refW} onChange={setRefW} unit={unit} />
              )
            }
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Datum">{(id) => <TextInput id={id} type="date" value={refDate} onChange={setRefDate} />}</Field>
            <Field label="Messmethode">{(id) => <TextInput id={id} value={method} onChange={setMethod} placeholder="z. B. 20-min-Test" />}</Field>
          </div>
          <Button variant="secondary" disabled={refValue === undefined || !isLocalDate(refDate)} onClick={() => void saveReference()}>
            {sport === 'bike' || config?.method !== 'manual' ? 'Wert speichern und Zonen berechnen' : 'Wert speichern'}
          </Button>
        </div>
      </details>

      {!editing ? (
        <div className="mt-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Zonengrenzen manuell festlegen
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          <p className="text-xs text-muted">
            Untergrenze je Zone {sport === 'bike' ? 'in Watt' : `als Pace m:ss ${sport === 'run' ? '/km' : '/100 m'} (schneller = kleiner)`}.
          </p>
          {[1, 2, 3, 4].map((i) => {
            const setAt = (v: number | undefined) => setBounds((b) => b.map((x, j) => (j === i - 1 ? v : x)));
            const label = `${ZONE_LABEL[ZONES[i]!]} ab`;
            return sport === 'bike' ? (
              <div key={i} className="grid grid-cols-[1fr_120px] items-center gap-3">
                <label htmlFor={`${sport}-b${i}`} className="text-[15px]">
                  {label}
                </label>
                <DecimalInput id={`${sport}-b${i}`} integer value={bounds[i - 1]} suffix="W" onChange={setAt} />
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-[15px]">{label}</span>
                <PaceInput label={label} value={bounds[i - 1]} onChange={setAt} unit={unit} />
              </div>
            );
          })}
          {boundsError && <p className="text-sm text-danger">{boundsError}</p>}
          <div className="flex gap-2">
            <Button disabled={!boundsComplete || !!boundsError} onClick={() => void saveBounds()}>
              Zonen speichern
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
