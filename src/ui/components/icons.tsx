/* Schlanke eigene Icons (SVG, keine Abhängigkeit). Sportarten haben je eine eigene Form,
   damit Farbe nie das einzige Unterscheidungsmerkmal ist. */
import type { Sport } from '../../domain/sports';

type P = { className?: string; title?: string };

const base = (className = 'h-6 w-6') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function A11y({ title }: { title?: string | undefined }) {
  return title ? <title>{title}</title> : null;
}

export const IconHome = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
  </svg>
);

export const IconCalendar = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const IconList = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

export const IconUser = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
  </svg>
);

export const IconHeart = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
    <path d="M7.5 12.5h2.5l1.5-2.5 2 4 1.5-1.5h1.5" />
  </svg>
);

export const IconChart = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M4 20h16" />
    <path d="M7 16v-5M12 16V6M17 16v-8" />
  </svg>
);

export const IconPlus = ({ className, title }: P) => (
  <svg {...base(className)} strokeWidth={2.5} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconBack = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconChevron = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconTrash = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

/* Sportarten */
export const IconSwim = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M2.5 15c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 3-1.5" />
    <path d="M2.5 19.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 3-1.5" />
    <circle cx="16.5" cy="6.5" r="2" />
    <path d="M5 11l5-4 3 3" />
  </svg>
);

export const IconBike = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <circle cx="5.5" cy="16" r="3.5" />
    <circle cx="18.5" cy="16" r="3.5" />
    <path d="M5.5 16l4-7h6l3 7M9.5 9l3.5 7h-7.5M14 6h3" />
  </svg>
);

export const IconRun = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    {/* Läuferin/Läufer in Schrittstellung nach rechts: gefüllter Kopf, Oberkörper vorgeneigt */}
    <circle cx="16" cy="4.2" r="2.2" fill="currentColor" stroke="none" />
    <path d="M14.2 7.8 11.2 13.6" strokeWidth={2.6} />
    <path d="M13.4 9.4 9 10.4 7 13" />
    <path d="M13.4 9.4 16.8 12.2 19.6 11.2" />
    <path d="M11.2 13.6 15.2 16.2 14.2 21" />
    <path d="M11.2 13.6 8.6 17.6 4.6 18.2" />
  </svg>
);

export const IconStrength = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <path d="M7 7v10M17 7v10M4 9.5v5M20 9.5v5M7 12h10" />
  </svg>
);

export const IconOther = ({ className, title }: P) => (
  <svg {...base(className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    <A11y title={title} />
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 8v4l2.5 2" />
  </svg>
);

export function SportIcon({ sport, className, title }: { sport: Sport } & P) {
  const props = { className: className ?? 'h-5 w-5', title };
  switch (sport) {
    case 'swim':
      return <IconSwim {...props} />;
    case 'bike':
      return <IconBike {...props} />;
    case 'run':
      return <IconRun {...props} />;
    case 'strength':
      return <IconStrength {...props} />;
    case 'other':
      return <IconOther {...props} />;
  }
}

export const SPORT_TEXT_CLASS: Record<Sport, string> = {
  swim: 'text-swim',
  bike: 'text-bike',
  run: 'text-run',
  strength: 'text-strength',
  other: 'text-other',
};

export const SPORT_BG_CLASS: Record<Sport, string> = {
  swim: 'bg-swim',
  bike: 'bg-bike',
  run: 'bg-run',
  strength: 'bg-strength',
  other: 'bg-other',
};
