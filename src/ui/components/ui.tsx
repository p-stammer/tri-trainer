/* Wiederverwendbare Bausteine der Oberfläche. */
import { useId, useState, type ReactNode } from 'react';
import { IconBack } from './icons';
import { useNav } from '../state';
import { parseDecimal, splitHoursMinutes } from '../../domain/units';

export function Screen({
  title,
  subtitle,
  back,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const nav = useNav();
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32">
      <header className="pt-safe flex items-start gap-2 pb-4">
        {back && (
          <button
            type="button"
            onClick={nav.back}
            className="-ml-2 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface"
            aria-label="Zurück"
          >
            <IconBack />
          </button>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1 pt-1">{actions}</div>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Section({ title, aside, children, className = '' }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-surface p-4 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
          {aside && <div className="text-sm text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
};

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled, full, ariaLabel }: ButtonProps) {
  const styles = {
    primary: 'bg-ink text-bg',
    secondary: 'bg-surface-2 text-ink border border-line',
    danger: 'bg-transparent text-danger border border-danger/40',
    ghost: 'bg-transparent text-ink',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 min-[360px]:px-4 text-center text-[16px] font-semibold leading-tight transition-opacity active:opacity-70 disabled:opacity-40 ${styles} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-ink placeholder:text-muted/70 focus:border-swim focus:outline-none';

export function TextInput({ id, value, onChange, placeholder, type = 'text', inputMode }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
  inputMode?: 'text' | 'decimal' | 'numeric';
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

/**
 * Zahlenfeld, das deutsche Dezimalkommas akzeptiert. Hält den Rohtext lokal, damit
 * Zwischenzustände wie "2," beim Tippen nicht verloren gehen.
 */
export function DecimalInput({ id, value, onChange, placeholder, suffix, integer, ariaLabel }: {
  id?: string;
  ariaLabel?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  suffix?: string;
  integer?: boolean;
}) {
  const format = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(format(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Wert wurde von außen geändert (z. B. Formular zurückgesetzt).
    setLastValue(value);
    if (parseDecimal(text) !== value) setText(format(value));
  }
  return (
    <div className="relative min-w-0">
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const n = parseDecimal(t);
          const next = t.trim() === '' ? undefined : n === null ? undefined : integer ? Math.round(n) : n;
          setLastValue(next);
          onChange(next);
        }}
        className={`${inputClass} num ${suffix ? (suffix.length <= 2 ? 'pr-10' : 'pr-14') : ''}`}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{suffix}</span>}
    </div>
  );
}

/** Dauer als Stunden + Minuten. Wert in Sekunden; undefined = leer. */
export function DurationInput({ idPrefix, value, onChange, label }: { idPrefix?: string; value: number | undefined; onChange: (sec: number | undefined) => void; label?: string }) {
  const hm = value === undefined ? undefined : splitHoursMinutes(value);
  const [h, setH] = useState<number | undefined>(hm?.hours);
  const [m, setM] = useState<number | undefined>(hm?.minutes);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setH(hm?.hours);
    setM(hm?.minutes);
  }
  const emit = (nh: number | undefined, nm: number | undefined) => {
    const next = nh === undefined && nm === undefined ? undefined : Math.round(((nh ?? 0) * 60 + (nm ?? 0)) * 60);
    setLast(next);
    onChange(next);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <DecimalInput id={idPrefix} integer value={h} suffix="h" placeholder="0" onChange={(v) => { setH(v); emit(v, m); }} />
      <DecimalInput integer ariaLabel={label ? `${label}, Minuten` : 'Minuten'} value={m} suffix="min" placeholder="0" onChange={(v) => { setM(v); emit(h, v); }} />
    </div>
  );
}

/**
 * Pace-Eingabe als zwei Zahlenfelder (Minuten : Sekunden). Auf dem iPhone gibt es im Zahlenblock
 * keinen Doppelpunkt – deshalb getrennte Felder statt "4:35" als Text. Wert in Sekunden.
 */
export function PaceInput({ idPrefix, label, value, onChange, unit }: {
  idPrefix?: string;
  label: string;
  value: number | undefined;
  onChange: (sec: number | undefined) => void;
  unit: string;
}) {
  const split = (v: number | undefined) => (v === undefined ? { m: undefined, s: undefined } : { m: Math.floor(Math.round(v) / 60), s: Math.round(v) % 60 });
  const [m, setM] = useState<number | undefined>(split(value).m);
  const [sec, setSec] = useState<number | undefined>(split(value).s);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setM(split(value).m);
    setSec(split(value).s);
  }
  const invalid = sec !== undefined && sec > 59;
  const emit = (nm: number | undefined, ns: number | undefined) => {
    const next = nm === undefined && ns === undefined ? undefined : ns !== undefined && ns > 59 ? undefined : (nm ?? 0) * 60 + (ns ?? 0);
    setLast(next);
    onChange(next === 0 ? undefined : next);
  };
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <DecimalInput id={idPrefix} ariaLabel={`${label}, Minuten`} integer value={m} placeholder="min" onChange={(v) => { setM(v); emit(v, sec); }} />
        <span className="text-xl font-semibold text-muted">:</span>
        <DecimalInput ariaLabel={`${label}, Sekunden`} integer value={sec} placeholder="s" onChange={(v) => { setSec(v); emit(m, v); }} />
        <span className="w-14 text-sm text-muted">{unit}</span>
      </div>
      {invalid && <p className="mt-1 text-sm text-danger">Sekunden bitte zwischen 0 und 59.</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-xl px-2 text-sm font-semibold ${o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface-2 text-ink'}`}
    >
      {children}
    </button>
  );
}

/** Fortschrittsbalken; Überschreitung wird als voller Balken mit Markierung gezeigt. */
export function ProgressBar({ ratio, colorClass, label }: { ratio: number | null; colorClass: string; label: string }) {
  const pct = ratio === null ? 0 : Math.min(1, ratio) * 100;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}
    >
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-center text-muted">Lade …</div>;
}
