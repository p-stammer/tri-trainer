/* Datensicherung: JSON-Backup, CSV-Export, Wiederherstellung mit Vorschau und Bestätigung. */
import { useEffect, useRef, useState } from 'react';
import { Button, Section } from '../components/ui';
import { errorText, useRepo, useToast } from '../state';
import { activitiesToCsv, createBackup, parseBackup, type BackupFile, type BackupSummary } from '../../domain/backup';
import type { AppSettings } from '../../domain/schemas';
import { formatDateDe, localDateInTimeZone } from '../../domain/calendar';
import { nowIso } from '../../domain/ids';
import { deliverFile } from '../files';

export const APP_VERSION = '0.21.1';

function formatTimestamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${formatDateDe(localDateInTimeZone(d, tz))}, ${time} Uhr`;
}

export function DataSettings({ settings }: { settings: AppSettings }) {
  const repo = useRepo();
  const toast = useToast();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const stamp = localDateInTimeZone(new Date(), settings.timeZone);

  async function exportJson() {
    try {
      const data = await repo.exportAll();
      const file = createBackup(data, APP_VERSION, nowIso());
      const result = await deliverFile(`ironman-planner-backup-${stamp}.json`, JSON.stringify(file, null, 2), 'application/json');
      if (result !== 'cancelled') {
        await repo.updateSettings({ lastBackupAt: nowIso() });
        toast('Backup erstellt');
      }
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function exportCsv() {
    try {
      const csv = activitiesToCsv(await repo.listActivities());
      // BOM, damit Excel Umlaute korrekt erkennt
      await deliverFile(`trainingseinheiten-${stamp}.csv`, '﻿' + csv, 'text/csv');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Section title="Datensicherung">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted">
          Deine Daten liegen nur auf diesem Gerät. Browserdaten können verloren gehen (z. B. beim Löschen von Websitedaten). Sichere
          regelmäßig ein Backup, z. B. in iCloud Drive.
        </p>
        <p>
          Letztes Backup: <span className="font-semibold">{settings.lastBackupAt ? formatTimestamp(settings.lastBackupAt, settings.timeZone) : 'noch keins'}</span>
        </p>
        {persisted !== null && (
          <p className="text-muted">
            Dauerhafte Speicherung: {persisted ? 'vom Browser bestätigt' : 'nicht bestätigt – Backups sind besonders wichtig'}
          </p>
        )}
        <div className="grid grid-cols-1 gap-2">
          <Button onClick={() => void exportJson()}>Backup sichern (JSON)</Button>
          <Button variant="secondary" onClick={() => void exportCsv()}>
            Einheiten als CSV exportieren
          </Button>
        </div>
        <RestoreBackup timeZone={settings.timeZone} />
      </div>
    </Section>
  );
}

/** Backup einlesen, Vorschau zeigen, nach Bestätigung alle Daten ersetzen. Auch beim ersten Start nutzbar (Umzug auf ein neues Gerät/eine neue Adresse). */
export function RestoreBackup({ timeZone, firstStart = false }: { timeZone: string; firstStart?: boolean }) {
  const repo = useRepo();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  async function onFile(file: File) {
    setImportErrors(null);
    setPending(null);
    const r = parseBackup(await file.text());
    if (r.ok) setPending({ backup: r.backup, summary: r.summary });
    else setImportErrors(r.errors);
  }

  async function restore() {
    if (!pending) return;
    try {
      await repo.replaceAll(pending.backup.data);
      // Der wiederhergestellte Stand ist genau in dieser Datei gesichert.
      await repo.updateSettings({ lastBackupAt: pending.backup.exportedAt });
      setPending(null);
      toast('Backup wiederhergestellt');
      window.location.hash = '#/';
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        Backup wiederherstellen …
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Backup-Datei auswählen"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />

      {importErrors && (
        <div className="rounded-2xl border border-danger/40 p-3" role="alert">
          <p className="font-semibold text-danger">Die Datei kann nicht wiederhergestellt werden.</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {importErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">{firstStart ? 'Es wurde nichts gespeichert.' : 'Deine aktuellen Daten wurden nicht verändert.'}</p>
        </div>
      )}

      {pending && (
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="font-semibold">Vorschau des Backups</p>
          <ul className="num mt-1 text-muted">
            <li>
              Erstellt: {formatTimestamp(pending.summary.exportedAt, timeZone)} (Version {pending.summary.appVersion})
            </li>
            <li>
              {pending.summary.activities} Einheiten
              {pending.summary.firstActivity && pending.summary.lastActivity
                ? `, ${formatDateDe(pending.summary.firstActivity, false)} bis ${formatDateDe(pending.summary.lastActivity, false)}`
                : ''}
            </li>
            <li>
              {pending.summary.races} Wettkampf, {pending.summary.weeks} Planwochen
            </li>
          </ul>
          {firstStart ? (
            <p className="mt-2 text-muted">Wettkampf, Plan und alle Einträge werden übernommen – die Einrichtung entfällt.</p>
          ) : (
            <>
              <p className="mt-2 font-semibold text-danger">Alle aktuellen Daten auf diesem Gerät werden durch das Backup ersetzt.</p>
              <p className="mt-1 text-muted">Tipp: Sichere vorher ein Backup des aktuellen Stands.</p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={firstStart ? 'primary' : 'danger'} onClick={() => void restore()}>
              {firstStart ? 'Übernehmen' : 'Daten ersetzen'}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
