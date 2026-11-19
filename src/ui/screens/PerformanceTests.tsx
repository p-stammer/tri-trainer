/* Leistungstests (Version 2.0): Protokolle mit Rechner, Verlauf je Ankerwert, Nachtest-Hinweis. */
import { useState } from 'react';
import { Button, DecimalInput, Field, PaceInput, Screen, Section, Segmented, TextInput } from '../components/ui';
import { SPORT_TEXT_CLASS, SportIcon, IconTrash } from '../components/icons';
import { errorText, useLive, useRepo, useToast, useToday } from '../state';
import { saveReferenceMetric } from '../../data/usecases';
import type { AppSettings, PerformanceMetric } from '../../domain/schemas';
import { formatDateDe, isLocalDate, type LocalDate } from '../../domain/calendar';
import { ENDURANCE_SPORTS, SPORT_LABEL, type EnduranceSport } from '../../domain/sports';
import { formatPace, formatPercent } from '../../domain/units';
import { HIGHER_IS_BETTER, RETEST_AFTER_DAYS, TEST_PROTOCOLS, VO2_METHODS, VO2_METHOD_NOTE, cooperVo2max, metricHistory, testsDue, vo2History, type MetricHistoryEntry, type Vo2Method } from '../../domain/performanceTests';
import { newId, nowIso } from '../../domain/ids';

const NAME: Record<EnduranceSport, string> = { bike: 'FTP', run: 'Schwellenpace', swim: 'CSS' };

export function fmtMetric(sport: EnduranceSport, v: number): string {
  return sport === 'bike' ? `${Math.round(v)} W` : `${formatPace(v)} ${sport === 'run' ? '/km' : '/100 m'}`;
}

export function PerformanceTests({ settings }: { settings: AppSettings }) {
  const metrics = useLive((r) => r.listMetrics(), []);
  const today = useToday(settings.timeZone);
  const [sport, setSport] = useState<EnduranceSport | 'vo2'>('bike');
  if (!metrics) return null;
  const due = testsDue(metrics, today);
  return (
    <Screen title="Leistungstests" subtitle="Ankerwerte für Zonen und Planung" back>
      <p className="text-sm text-muted">
        Ein Test alle 6–8 Wochen zeigt, ob sich etwas tut, und hält die Zonen aktuell – am besten am Ende einer Entlastungswoche, ausgeruht und
        unter gleichen Bedingungen. Die Werte sind praktische Ankerwerte mit Messfehler, keine Laborschwellen.
      </p>
      {due.length > 0 && (
        <p className="rounded-2xl border border-warn/50 p-3 text-sm" data-testid="tests-due">
          <span className="font-semibold text-warn">Test fällig: </span>
          {due.map((d) => `${SPORT_LABEL[d.sport]} (${d.ageDays === null ? 'noch kein Wert' : `letzter vor ${Math.floor(d.ageDays / 7)} Wochen`})`).join(', ')}
        </p>
      )}
      <Segmented<EnduranceSport | 'vo2'>
        ariaLabel="Sportart"
        value={sport}
        onChange={setSport}
        options={[...ENDURANCE_SPORTS.map((s) => ({ value: s, label: SPORT_LABEL[s] })), { value: 'vo2' as const, label: 'VO2max' }]}
      />
      {sport === 'vo2' ? (
        <>
          <Vo2Section metrics={metrics} />
          <NewVo2 today={today} />
        </>
      ) : (
        <>
          <HistorySection sport={sport} history={metricHistory(metrics, sport)} />
          <NewTest key={sport} sport={sport} today={today} />
        </>
      )}
    </Screen>
  );
}

function HistorySection({ sport, history }: { sport: EnduranceSport; history: MetricHistoryEntry[] }) {
  const repo = useRepo();
  const toast = useToast();
  const last = history[history.length - 1];
  const first = history[0];
  const total = last && first && last !== first ? (HIGHER_IS_BETTER[sport] ? last.metric.value / first.metric.value - 1 : first.metric.value / last.metric.value - 1) : null;
  async function remove(m: PerformanceMetric) {
    try {
      await repo.deleteMetric(m.id);
      toast('Wert gelöscht – die Zonen bleiben, bis du einen neuen Wert speicherst');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  return (
    <Section title={`${NAME[sport]}-Verlauf`} aside={last ? fmtMetric(sport, last.metric.value) : undefined}>
      {history.length === 0 ? (
        <p className="text-sm text-muted">Noch kein Wert. Unten kannst du einen Test eintragen.</p>
      ) : (
        <>
          {history.length >= 2 && <MetricChart sport={sport} history={history} />}
          {total !== null && (
            <p className="mb-2 text-sm">
              Seit {formatDateDe(first!.metric.date, false)}: <span className="font-semibold">{total >= 0 ? '+' : '−'}{formatPercent(Math.abs(total))}</span>{' '}
              {total >= 0 ? 'besser' : 'schwächer'}
            </p>
          )}
          <ul className="flex flex-col divide-y divide-line text-sm" data-testid={`history-${sport}`}>
            {[...history].reverse().map((h) => (
              <li key={h.metric.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="num font-semibold">{fmtMetric(sport, h.metric.value)}</span>
                  {h.improvement !== null && (
                    <span className={`ml-2 text-xs ${h.improvement >= 0 ? 'text-ok' : 'text-warn'}`}>
                      {h.improvement >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(h.improvement))}
                    </span>
                  )}
                  <span className="block text-xs text-muted">
                    {formatDateDe(h.metric.date)}
                    {h.metric.method ? ` · ${h.metric.method}` : ''}
                  </span>
                </span>
                <button type="button" onClick={() => void remove(h.metric)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label={`Wert vom ${formatDateDe(h.metric.date)} löschen`}>
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/** Verlauf als Linie; bei Pace ist „oben“ schneller, damit Verbesserung immer nach oben zeigt. */
function MetricChart({ sport, history }: { sport: EnduranceSport; history: MetricHistoryEntry[] }) {
  return (
    <LineChart
      points={history.map((h) => h.metric)}
      higherIsBetter={HIGHER_IS_BETTER[sport]}
      minSpan={sport === 'bike' ? 10 : 5}
      tick={(v) => (sport === 'bike' ? `${Math.round(v)} W` : formatPace(v))}
      colorClass={SPORT_TEXT_CLASS[sport]}
      ariaLabel={`${NAME[sport]}: ${history.map((h) => `${formatDateDe(h.metric.date, false)} ${fmtMetric(sport, h.metric.value)}`).join(', ')}`}
    />
  );
}

function LineChart({ points, higherIsBetter, minSpan, tick, colorClass, ariaLabel }: {
  points: Pick<PerformanceMetric, 'id' | 'date' | 'value'>[];
  higherIsBetter: boolean;
  minSpan: number;
  tick: (v: number) => string;
  colorClass: string;
  ariaLabel: string;
}) {
  const W = 340, H = 150, P = { l: 52, r: 10, t: 10, b: 22 };
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, minSpan);
  const min = lo - span * 0.15, max = hi + span * 0.15;
  const y = (v: number) => P.t + (higherIsBetter ? (max - v) / (max - min) : (v - min) / (max - min)) * (H - P.t - P.b);
  const t0 = Date.parse(points[0]!.date), t1 = Date.parse(points[points.length - 1]!.date);
  const x = (d: string) => P.l + (t1 === t0 ? 0.5 : (Date.parse(d) - t0) / (t1 - t0)) * (W - P.l - P.r);
  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mb-2 w-full" role="img" aria-label={ariaLabel}>
      {[lo, hi].map((v, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} strokeDasharray="3 3" />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">
            {tick(v)}
          </text>
        </g>
      ))}
      <text x={P.l} y={H - 6} className="fill-muted text-[10px]">{formatDateDe(points[0]!.date, false)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" className="fill-muted text-[10px]">{formatDateDe(points[points.length - 1]!.date, false)}</text>
      <polyline points={line} fill="none" className={colorClass} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.id} cx={x(p.date)} cy={y(p.value)} r={4} className={`${colorClass} stroke-surface`} fill="currentColor" strokeWidth={2} />
      ))}
      {!higherIsBetter && <text x={W - P.r} y={P.t + 8} textAnchor="end" className="fill-muted text-[10px]">schneller ↑</text>}
    </svg>
  );
}

const fmtVo2 = (v: number) => `${v.toFixed(1).replace('.', ',')} ml/kg/min`;

function Vo2Section({ metrics }: { metrics: readonly PerformanceMetric[] }) {
  const repo = useRepo();
  const toast = useToast();
  const h = vo2History(metrics);
  const methods = new Set(h.map((x) => x.metric.method));
  return (
    <Section title="VO2max-Verlauf" aside={h.length ? fmtVo2(h[h.length - 1]!.metric.value) : undefined}>
      {h.length === 0 ? (
        <p className="text-sm text-muted">Noch kein Wert. VO2max ist hier nur zur Dokumentation – Planer, Zonen und Prognose nutzen FTP, Schwellenpace und CSS.</p>
      ) : (
        <>
          {h.length >= 2 && (
            <LineChart
              points={h.map((x) => x.metric)}
              higherIsBetter
              minSpan={2}
              tick={(v) => v.toFixed(1).replace('.', ',')}
              colorClass="text-ink"
              ariaLabel={`VO2max: ${h.map((x) => `${formatDateDe(x.metric.date, false)} ${fmtVo2(x.metric.value)}`).join(', ')}`}
            />
          )}
          {methods.size > 1 && <p className="mb-2 text-xs text-warn">Werte aus verschiedenen Methoden sind nur eingeschränkt vergleichbar.</p>}
          <ul className="flex flex-col divide-y divide-line text-sm" data-testid="history-vo2">
            {[...h].reverse().map((x) => (
              <li key={x.metric.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="num font-semibold">{fmtVo2(x.metric.value)}</span>
                  {x.improvement !== null && x.sameMethod && (
                    <span className={`ml-2 text-xs ${x.improvement >= 0 ? 'text-ok' : 'text-warn'}`}>
                      {x.improvement >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(x.improvement))}
                    </span>
                  )}
                  <span className="block text-xs text-muted">
                    {formatDateDe(x.metric.date)}
                    {x.metric.method ? ` · ${x.metric.method}` : ''}
                    {x.metric.source ? ` · ${x.metric.source}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void repo.deleteMetric(x.metric.id).then(() => toast('Wert gelöscht'), (e: unknown) => toast(errorText(e), 'error'))}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                  aria-label={`Wert vom ${formatDateDe(x.metric.date)} löschen`}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function NewVo2({ today }: { today: LocalDate }) {
  const repo = useRepo();
  const toast = useToast();
  const [method, setMethod] = useState<Vo2Method>('Sportuhr (Schätzung)');
  const [distance, setDistance] = useState<number | undefined>();
  const [direct, setDirect] = useState<number | undefined>();
  const [source, setSource] = useState('');
  const [date, setDate] = useState(today);
  const cooper = method === 'Cooper-Test (12 min)';
  const result = cooper ? (distance !== undefined ? cooperVo2max(distance * 1000) : null) : direct !== undefined ? (direct < 15 || direct > 95 ? { error: 'Bitte den Wert prüfen (15–95 ml/kg/min).' } : { value: direct }) : null;
  const value = result && 'value' in result ? result.value : undefined;
  async function save() {
    if (value === undefined || !isLocalDate(date)) return;
    try {
      await repo.saveMetric({
        id: newId(),
        kind: 'vo2max_ml_kg_min',
        value,
        unit: 'ml/kg/min',
        date,
        method,
        ...(source.trim() ? { source: source.trim().slice(0, 200) } : {}),
        createdAt: nowIso(),
      });
      toast(`VO2max ${fmtVo2(value)} gespeichert`);
      setDistance(undefined);
      setDirect(undefined);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  return (
    <Section title="VO2max eintragen">
      <div className="flex flex-col gap-3">
        <Field label="Methode">
          {(id) => (
            <select id={id} value={method} onChange={(e) => setMethod(e.target.value as Vo2Method)} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-[16px]">
              {VO2_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </Field>
        <p className="text-xs text-muted">{VO2_METHOD_NOTE[method]}</p>
        {cooper ? (
          <Field label="Strecke in 12 min">{(id) => <DecimalInput id={id} value={distance} onChange={setDistance} suffix="km" />}</Field>
        ) : (
          <Field label="VO2max">{(id) => <DecimalInput id={id} value={direct} onChange={setDirect} suffix="ml/kg/min" />}</Field>
        )}
        <Field label="Quelle (optional)" hint="z. B. Uhrmodell oder Labor">
          {(id) => <TextInput id={id} value={source} onChange={setSource} />}
        </Field>
        <Field label="Datum">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
        {result && 'error' in result && <p className="text-sm text-danger">{result.error}</p>}
        {value !== undefined && (
          <p className="text-sm" data-testid="vo2-result">
            Ergebnis: <span className="num font-semibold">VO2max {fmtVo2(value)}</span>
          </p>
        )}
        <Button disabled={value === undefined || !isLocalDate(date)} onClick={() => void save()}>
          Speichern
        </Button>
      </div>
    </Section>
  );
}

function NewTest({ sport, today }: { sport: EnduranceSport; today: LocalDate }) {
  const repo = useRepo();
  const toast = useToast();
  const protocols = TEST_PROTOCOLS.filter((p) => p.sport === sport);
  const [protocolId, setProtocolId] = useState<string>(protocols[0]!.id);
  const [inputs, setInputs] = useState<Record<string, number | undefined>>({});
  const [direct, setDirect] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(today);
  const protocol = protocols.find((p) => p.id === protocolId);
  const result = protocol ? protocol.compute(inputs) : direct !== undefined ? { value: direct } : null;
  const value = result && 'value' in result ? result.value : undefined;

  async function save() {
    if (value === undefined || !isLocalDate(date)) return;
    try {
      await saveReferenceMetric(repo, sport, value, date, protocol ? protocol.name : 'eigener Wert');
      toast(`${NAME[sport]} ${fmtMetric(sport, value)} gespeichert – Zonen aktualisiert`);
      setInputs({});
      setDirect(undefined);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Section title="Test eintragen">
      <div className="flex flex-col gap-3">
        <Segmented<string>
          ariaLabel="Testart"
          value={protocolId}
          onChange={(v) => { setProtocolId(v); setInputs({}); }}
          options={[...protocols.map((p) => ({ value: p.id, label: p.name })), { value: 'direct', label: 'Wert direkt' }]}
        />
        {protocol && (
          <ol className="list-decimal pl-5 text-sm text-muted">
            {protocol.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        )}
        {protocol?.inputs.map((i) =>
          i.kind === 'duration' ? (
            <PaceInput key={i.key} label={i.label} unit="min:s" value={inputs[i.key]} onChange={(v) => setInputs({ ...inputs, [i.key]: v })} />
          ) : (
            <Field key={i.key} label={i.label}>
              {(id) => (
                <DecimalInput
                  id={id}
                  value={i.kind === 'meters' && inputs[i.key] !== undefined ? inputs[i.key]! / 1000 : inputs[i.key]}
                  onChange={(v) => setInputs({ ...inputs, [i.key]: v === undefined ? undefined : i.kind === 'meters' ? v * 1000 : v })}
                  suffix={i.kind === 'meters' ? 'km' : 'W'}
                  integer={i.kind === 'watts'}
                />
              )}
            </Field>
          ),
        )}
        {!protocol &&
          (sport === 'bike' ? (
            <Field label="FTP">{(id) => <DecimalInput id={id} value={direct} onChange={setDirect} suffix="W" integer />}</Field>
          ) : (
            <PaceInput label={NAME[sport]} unit={sport === 'run' ? '/km' : '/100 m'} value={direct} onChange={setDirect} />
          ))}
        <Field label="Datum">{(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}</Field>
        {result && 'error' in result && <p className="text-sm text-danger">{result.error}</p>}
        {value !== undefined && (
          <p className="text-sm" data-testid="test-result">
            Ergebnis: <span className="num font-semibold">{NAME[sport]} {fmtMetric(sport, value)}</span>
            {protocol && <span className="block text-xs text-muted">Quelle: {protocol.source}</span>}
          </p>
        )}
        <Button disabled={value === undefined || !isLocalDate(date)} onClick={() => void save()}>
          <SportIcon sport={sport} className="mr-1 h-4 w-4" /> Speichern
        </Button>
        <p className="text-xs text-muted">Nachtest-Erinnerung nach {RETEST_AFTER_DAYS / 7} Wochen.</p>
      </div>
    </Section>
  );
}
