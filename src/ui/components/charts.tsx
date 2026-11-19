/*
 * Schlanke SVG-Diagramme ohne Bibliothek (offline, klein, testbar).
 * Regeln: eine y-Achse, dünne Marken mit 2-px-Lücken, Legende ab zwei Reihen, Antippen einer Woche
 * zeigt die Werte als Textzeile über dem Diagramm (Ersatz für Hover auf dem Touchscreen),
 * Farbe ist nie das einzige Merkmal (Legende mit Text, Tabellen darunter).
 */
import { useState } from 'react';

export interface BarSeries {
  key: string;
  label: string;
  /** Tailwind-Füllklasse, z. B. "fill-swim". */
  fillClass: string;
  /** Tailwind-Hintergrundklasse für die Legende, z. B. "bg-swim". */
  swatchClass: string;
  values: number[];
}

const W = 340;
const PAD = { l: 40, r: 6, t: 8, b: 22 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

export function Legend({ items }: { items: { label: string; swatchClass: string; kind?: 'bar' | 'line' | 'tick' }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' ? (
            <span className={`inline-block h-0.5 w-4 rounded ${i.swatchClass}`} />
          ) : i.kind === 'tick' ? (
            <span className={`inline-block h-0.5 w-3 ${i.swatchClass}`} />
          ) : (
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${i.swatchClass}`} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Gestapelte Wochenbalken mit optionaler Zielmarke je Woche und optionaler Linie (gleiche Einheit).
 */
export function WeekBarChart({
  labels,
  series,
  targets,
  line,
  format,
  height = 180,
  dimmed,
  describe,
  ariaLabel,
  niceUnit = 1,
  axisFormat,
}: {
  labels: string[];
  series: BarSeries[];
  targets?: (number | null)[];
  line?: { label: string; values: (number | null)[] };
  format: (v: number) => string;
  height?: number;
  /** Balken blasser zeichnen (z. B. unvollständige Daten). */
  dimmed?: boolean[];
  /** Zusätzliche Beschreibung der angetippten Woche. */
  describe?: (index: number) => string | null;
  ariaLabel: string;
  /** Achsenschritte in dieser Einheit runden (z. B. 3600 für volle Stunden, 1000 für km). */
  niceUnit?: number;
  /** Kurzes Format für Achsenbeschriftungen (sonst `format`). */
  axisFormat?: (v: number) => string;
}) {
  const n = labels.length;
  const [sel, setSel] = useState(n - 1);
  const selected = Math.min(sel, n - 1);
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0));
  const rawMax = Math.max(1, ...totals, ...(targets ?? []).map((t) => t ?? 0), ...(line?.values ?? []).map((v) => v ?? 0));
  const maxVal = niceMax(rawMax / niceUnit) * niceUnit;
  const H = height;
  const plotH = H - PAD.t - PAD.b;
  const step = (W - PAD.l - PAD.r) / Math.max(1, n);
  const barW = Math.max(4, Math.min(28, step * 0.62));
  const x = (i: number) => PAD.l + step * i + step / 2;
  const y = (v: number) => PAD.t + plotH - (v / maxVal) * plotH;
  const labelEvery = n <= 8 ? 1 : n <= 16 ? 2 : 4;

  const detail = (() => {
    const parts = series.filter((s) => (s.values[selected] ?? 0) > 0).map((s) => `${s.label} ${format(s.values[selected] ?? 0)}`);
    const t = targets?.[selected];
    const l = line?.values[selected];
    const extra = describe?.(selected);
    return [
      `KW ${labels[selected]}`,
      parts.length ? parts.join(', ') : 'keine Einheiten',
      t !== undefined && t !== null ? `Ziel ${format(t)}` : null,
      l !== undefined && l !== null ? `${line?.label} ${format(l)}` : null,
      extra,
    ]
      .filter(Boolean)
      .join('; ');
  })();

  const linePts = line
    ? line.values
        .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
        .filter((p): p is string => p !== null)
        .join(' ')
    : '';

  return (
    <div>
      <p className="num mb-1 min-h-[2.5em] text-sm" aria-live="polite">
        {detail}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-manipulation" role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(maxVal * f)} y2={y(maxVal * f)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.l - 5} y={y(maxVal * f) + 3.5} textAnchor="end" className="fill-muted text-[9.5px]">
              {(axisFormat ?? format)(maxVal * f)}
            </text>
          </g>
        ))}
        {labels.map((lab, i) => {
          let acc = 0;
          const isSel = i === selected;
          return (
            <g key={i} opacity={dimmed?.[i] ? 0.45 : 1}>
              {/* Trefferfläche größer als der Balken */}
              <rect x={x(i) - step / 2} y={PAD.t} width={step} height={plotH + PAD.b} fill="transparent" onClick={() => setSel(i)} style={{ cursor: 'pointer' }} />
              {isSel && <rect x={x(i) - step / 2 + 1} y={PAD.t} width={step - 2} height={plotH} rx={4} className="fill-surface-2" pointerEvents="none" />}
              {series.map((s) => {
                const v = s.values[i] ?? 0;
                if (v <= 0) return null;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const h = Math.max(1, y0 - y1 - 2); // 2 px Lücke zwischen Segmenten
                return <rect key={s.key} x={x(i) - barW / 2} y={y1} width={barW} height={h} rx={2} className={s.fillClass} pointerEvents="none" />;
              })}
              {targets && targets[i] !== null && targets[i] !== undefined && (
                <line
                  x1={x(i) - barW / 2 - 3}
                  x2={x(i) + barW / 2 + 3}
                  y1={y(targets[i] as number)}
                  y2={y(targets[i] as number)}
                  className="stroke-ink"
                  strokeWidth={2}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )}
              {i % labelEvery === 0 || isSel ? (
                <text x={x(i)} y={H - 6} textAnchor="middle" className={`text-[9.5px] ${isSel ? 'fill-ink font-semibold' : 'fill-muted'}`}>
                  {lab}
                </text>
              ) : null}
            </g>
          );
        })}
        {line && linePts && (
          <>
            <polyline points={linePts} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
            {line.values.map((v, i) =>
              v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} className="fill-ink stroke-surface" strokeWidth={2} pointerEvents="none" />,
            )}
          </>
        )}
      </svg>
    </div>
  );
}

/** Horizontaler 100-%-Balken (z. B. Zonenverteilung) mit Lücken; Beschriftung als Liste darunter. */
export function ShareBar({ parts, ariaLabel }: { parts: { key: string; value: number; className: string; pattern?: boolean }[]; ariaLabel: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  let acc = 0;
  const visible = parts.filter((p) => p.value > 0);
  return (
    <svg viewBox="0 0 340 16" className="w-full" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="fill-surface-2" />
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-muted" strokeWidth="2" />
        </pattern>
      </defs>
      {visible.map((p, i) => {
        const w = (p.value / total) * 340;
        const x0 = acc;
        acc += w;
        const gap = i < visible.length - 1 ? 2 : 0;
        return <rect key={p.key} x={x0} y={0} width={Math.max(0.5, w - gap)} height={16} rx={3} className={p.pattern ? '' : p.className} fill={p.pattern ? 'url(#hatch)' : undefined} />;
      })}
    </svg>
  );
}
