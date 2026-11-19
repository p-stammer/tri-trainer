import { useState } from 'react';
import { Chip, EmptyState, Loading, Screen, Section } from '../components/ui';
import { ActivityRow } from '../components/ActivityRow';
import { useLive, useNav } from '../state';
import type { CompletedActivity } from '../../domain/schemas';
import { formatWeekRangeDe, isoWeek, startOfWeek } from '../../domain/calendar';
import { SPORTS, SPORT_SHORT, type Sport } from '../../domain/sports';
import { formatDurationShort } from '../../domain/units';

export function History() {
  const { navigate } = useNav();
  const acts = useLive((repo) => repo.listActivities(), []);
  const [filter, setFilter] = useState<Sport | 'all'>('all');

  if (!acts) return <Loading />;
  const shown = filter === 'all' ? acts : acts.filter((a) => a.sport === filter);

  const groups: { weekStart: string; items: CompletedActivity[] }[] = [];
  for (const a of shown) {
    const ws = startOfWeek(a.date);
    const last = groups[groups.length - 1];
    if (last && last.weekStart === ws) last.items.push(a);
    else groups.push({ weekStart: ws, items: [a] });
  }

  return (
    <Screen title="Verlauf" back subtitle={`${acts.length} ${acts.length === 1 ? 'Einheit' : 'Einheiten'} insgesamt`}>
      <div className="flex flex-wrap gap-2 pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          Alle
        </Chip>
        {SPORTS.map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {SPORT_SHORT[s]}
          </Chip>
        ))}
      </div>
      {groups.length === 0 ? (
        <EmptyState title={acts.length === 0 ? 'Noch keine Einheiten' : 'Keine Einheiten für diesen Filter'}>
          {acts.length === 0 && 'Erfasse dein erstes Training über das Plus unten.'}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <Section
            key={g.weekStart}
            title={`KW ${isoWeek(g.weekStart).week}`}
            aside={
              <span className="num">
                {formatWeekRangeDe(g.weekStart)}, {formatDurationShort(g.items.reduce((s, a) => s + a.durationSec, 0))}
              </span>
            }
          >
            <ul className="-mx-1 flex flex-col">
              {g.items.map((a) => (
                <li key={a.id}>
                  <ActivityRow a={a} onClick={() => navigate({ name: 'log', activityId: a.id })} />
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </Screen>
  );
}
