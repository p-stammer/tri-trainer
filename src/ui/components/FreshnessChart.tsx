/* Frischeverlauf als schlankes SVG-Diagramm (ohne Bibliothek, offline). Zielbereiche als Bänder. */
import { isoWeek, type LocalDate } from '../../domain/calendar';
import type { WeeklyHealthRow } from '../../domain/wellness';

const W = 340;
const H = 170;
const PAD = { l: 26, r: 8, t: 10, b: 24 };

export function FreshnessChart({ rows }: { rows: WeeklyHealthRow[] }) {
  // rows: neueste zuerst → für das Diagramm chronologisch
  const data = [...rows].reverse();
  if (data.length === 0) return null;
  const n = data.length;
  const step = (W - PAD.l - PAD.r) / Math.max(1, n);
  const x = (i: number) => PAD.l + step * i + step / 2;
  const y = (v: number) => PAD.t + ((10 - v) / 9) * (H - PAD.t - PAD.b);
  const points = data.map((r, i) => (r.checkin ? { x: x(i), y: y(r.checkin.freshness), v: r.checkin.freshness, ws: r.weekStart } : null));

  // Linie nur zwischen aufeinanderfolgenden Wochen mit Wert (Lücken bleiben Lücken)
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    if (p) current.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    else if (current.length) {
      segments.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) segments.push(current.join(' '));

  const values = points.filter((p): p is NonNullable<typeof p> => !!p);
  const summary = values.length
    ? `Frische der letzten ${n} Wochen: ${values.map((p) => `KW ${isoWeek(p.ws as LocalDate).week}: ${p.v}`).join(', ')}`
    : 'Noch keine Frischewerte erfasst';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
      {[1, 5, 10].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} strokeDasharray={v === 5 ? '3 3' : undefined} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">
            {v}
          </text>
        </g>
      ))}
      {data.map((r, i) =>
        r.target ? (
          <rect
            key={`t${r.weekStart}`}
            x={x(i) - step / 2 + 1}
            width={step - 2}
            y={y(r.target.max)}
            height={Math.max(2, y(r.target.min) - y(r.target.max))}
            rx={3}
            className="fill-ok/15"
          />
        ) : null,
      )}
      {segments.map((s, i) => (
        <polyline key={i} points={s} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      ))}
      {values.map((p) => (
        <circle key={p.ws} cx={p.x} cy={p.y} r={4} className="fill-ink" />
      ))}
      {data.map((r, i) =>
        n <= 8 || i % 2 === n % 2 ? (
          <text key={`l${r.weekStart}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">
            {isoWeek(r.weekStart).week}
          </text>
        ) : null,
      )}
    </svg>
  );
}
