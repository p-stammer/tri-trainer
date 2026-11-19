/* Auswahl einer Stufe 1…n als Tastenreihe. Erneutes Tippen entfernt die Auswahl (wenn optional). */
export function ScalePicker({
  label,
  min = 1,
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
  optional = true,
}: {
  label: string;
  min?: number;
  max: number;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  lowLabel: string;
  highLabel: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max - min + 1}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(optional && value === n ? undefined : n)}
            className={`num min-h-11 rounded-xl text-[15px] font-semibold ${value === n ? 'bg-ink text-bg' : 'bg-surface-2'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
