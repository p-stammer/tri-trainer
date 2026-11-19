import { useState } from 'react';
import { Button, Field, Loading, Screen, Section, TextInput } from '../components/ui';
import { ScalePicker } from '../components/ScalePicker';
import { errorText, useLive, useNav, useRepo, useToast, useToday } from '../state';
import { saveCheckin, type ActiveContext } from '../../data/usecases';
import type { AppSettings, WeeklyWellnessCheckin } from '../../domain/schemas';
import { formatWeekRangeDe, isLocalDate, isoWeek, startOfWeek } from '../../domain/calendar';

export function CheckinForm({ ctx, settings, initialDate }: { ctx: ActiveContext; settings: AppSettings; initialDate?: string | undefined }) {
  const today = useToday(settings.timeZone);
  const date = initialDate && isLocalDate(initialDate) ? initialDate : today;
  const existing = useLive(async (repo) => (await repo.getCheckinForWeek(startOfWeek(date))) ?? null, [date]);
  if (existing === undefined) return <Loading />;
  return <Form key={existing?.id ?? 'neu'} ctx={ctx} initialDate={date} existing={existing} />;
}

function Form({ ctx, initialDate, existing }: { ctx: ActiveContext; initialDate: string; existing: WeeklyWellnessCheckin | null }) {
  const repo = useRepo();
  const toast = useToast();
  const { back } = useNav();
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [freshness, setFreshness] = useState<number | undefined>(existing?.freshness);
  const [sleepQuality, setSleep] = useState(existing?.sleepQuality);
  const [soreness, setSoreness] = useState(existing?.soreness);
  const [motivation, setMotivation] = useState(existing?.motivation);
  const [wellbeing, setWellbeing] = useState(existing?.wellbeing);
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = isLocalDate(date) && freshness !== undefined;
  const ws = isLocalDate(date) ? startOfWeek(date) : null;
  const target = ws ? ctx.weeks.find((w) => w.weekStart === ws)?.current.freshnessTarget : undefined;
  const otherWeek = !!existing && ws !== null && ws !== existing.weekStart;

  async function save() {
    if (!valid || freshness === undefined) return;
    setBusy(true);
    try {
      // Wurde das Datum in eine andere Woche verschoben, den alten Eintrag entfernen.
      if (existing && otherWeek) await repo.deleteCheckin(existing.id);
      await saveCheckin(repo, {
        date,
        freshness,
        ...(sleepQuality !== undefined ? { sleepQuality } : {}),
        ...(soreness !== undefined ? { soreness } : {}),
        ...(motivation !== undefined ? { motivation } : {}),
        ...(wellbeing !== undefined ? { wellbeing } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(`Frische für KW ${isoWeek(date).week} gespeichert`);
      back();
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  return (
    <Screen title="Frische erfassen" subtitle={ws ? `KW ${isoWeek(ws).week}, ${formatWeekRangeDe(ws)}` : undefined} back>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section>
          <ScalePicker
            label="Wie frisch fühlst du dich diese Woche?"
            max={10}
            value={freshness}
            onChange={setFreshness}
            lowLabel="1 extrem erschöpft"
            highLabel="10 außergewöhnlich frisch"
            optional={false}
          />
          <p className="mt-2 text-xs text-muted">5 = durchschnittlich erholt.{target ? ` Gewünschter Bereich diese Woche: ${target.min}–${target.max}.` : ''}</p>
        </Section>

        <Section title="Optional">
          <div className="flex flex-col gap-5">
            <ScalePicker label="Schlafqualität" max={5} value={sleepQuality} onChange={setSleep} lowLabel="sehr schlecht" highLabel="sehr gut" />
            <ScalePicker label="Muskelkater" max={5} value={soreness} onChange={setSoreness} lowLabel="keiner" highLabel="stark" />
            <ScalePicker label="Motivation" max={5} value={motivation} onChange={setMotivation} lowLabel="sehr niedrig" highLabel="sehr hoch" />
            <ScalePicker label="Allgemeines Wohlbefinden" max={5} value={wellbeing} onChange={setWellbeing} lowLabel="sehr schlecht" highLabel="sehr gut" />
            <Field label="Notiz">
              {(id) => <textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 p-3" />}
            </Field>
            <Field label="Datum" hint="Bestimmt die Woche des Check-ins. Pro Woche gibt es einen Check-in.">
              {(id) => <TextInput id={id} type="date" value={date} onChange={setDate} />}
            </Field>
          </div>
        </Section>

        <Button type="submit" full disabled={!valid || busy}>
          {busy ? 'Speichere …' : 'Frische speichern'}
        </Button>

        {existing &&
          (confirmDelete ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                full
                onClick={() =>
                  void repo.deleteCheckin(existing.id).then(() => {
                    toast('Check-in gelöscht');
                    back();
                  })
                }
              >
                Endgültig löschen
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <span className="text-danger">Check-in löschen</span>
            </Button>
          ))}
      </form>
    </Screen>
  );
}
