/* Aktueller Trainingsumfang je Sportart (km, Stunden, Einheiten pro Woche). */
import { DecimalInput } from './ui';
import { SPORT_TEXT_CLASS, SportIcon } from './icons';
import type { TrainingBaseline } from '../../domain/schemas';
import { PLANNED_SPORTS, SPORT_LABEL, type PlannedSport } from '../../domain/sports';

type Row = NonNullable<TrainingBaseline['swim']>;

export function BaselineEditor({ value, onChange }: { value: TrainingBaseline | undefined; onChange: (v: TrainingBaseline) => void }) {
  const b = value ?? {};
  const setSport = (s: PlannedSport, patch: Partial<Row>) => {
    const row: Row = { ...(b[s] ?? {}) };
    for (const [k, v] of Object.entries(patch) as [keyof Row, number | undefined][]) {
      if (v === undefined) delete row[k];
      else row[k] = v;
    }
    onChange({ ...b, [s]: row });
  };
  const r1 = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 10) / 10);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Durchschnitt der letzten</span>
        <select
          aria-label="Bezugszeitraum"
          value={b.periodWeeks ?? ''}
          onChange={(e) => {
            const next = { ...b };
            delete next.periodWeeks;
            if (e.target.value) next.periodWeeks = Number(e.target.value);
            onChange(next);
          }}
          className="min-h-11 rounded-xl border border-line bg-surface-2 px-3"
        >
          <option value="">– Wochen</option>
          {[4, 6, 8, 12, 16, 26].map((w) => (
            <option key={w} value={w}>
              {w} Wochen
            </option>
          ))}
        </select>
      </label>
      {PLANNED_SPORTS.map((s) => {
        const row = b[s] ?? {};
        const isStrength = s === 'strength';
        return (
          <div key={s}>
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <span className={SPORT_TEXT_CLASS[s]}>
                <SportIcon sport={s} className="h-4 w-4" />
              </span>
              {SPORT_LABEL[s]}
            </div>
            <div className={`grid gap-2 ${isStrength ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {!isStrength && (
                <DecimalInput
                  ariaLabel={`${SPORT_LABEL[s]}: Kilometer pro Woche`}
                  value={row.distanceM === undefined ? undefined : r1(row.distanceM / 1000)}
                  suffix="km"
                  placeholder="0"
                  onChange={(v) => setSport(s, { distanceM: v === undefined ? undefined : Math.round(v * 1000) })}
                />
              )}
              <DecimalInput
                ariaLabel={`${SPORT_LABEL[s]}: Stunden pro Woche`}
                value={row.durationSec === undefined ? undefined : r1(row.durationSec / 3600)}
                suffix="h"
                placeholder="0"
                onChange={(v) => setSport(s, { durationSec: v === undefined ? undefined : Math.round(v * 3600) })}
              />
              <DecimalInput
                ariaLabel={`${SPORT_LABEL[s]}: ${isStrength ? 'Workouts' : 'Einheiten'} pro Woche`}
                value={row.sessions}
                suffix="×"
                placeholder="0"
                onChange={(v) => setSport(s, { sessions: v })}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted">Pro Woche im Schnitt. Was du nicht weißt, einfach leer lassen – die App schätzt nichts dazu.</p>
    </div>
  );
}
