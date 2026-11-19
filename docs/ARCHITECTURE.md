# Architektur – Ironman Planner

Stand: 19.11.2026, Version 0.21.0 (MVP 1 + MVP 2 komplett; Version 1.0: Plangenerator `im-gen-1.8.0` mit Bildschirm „Plan vorschlagen“, Trainingslager, Prognose `im-prog-1.1.0` mit Race-Setup, DB-Version 7; Hosting über GitHub Pages)

Dieses Dokument enthält die Architekturprüfung (Schritt 1) und die Produkt- und Datenarchitektur (Schritt 2). Es ist so geschrieben, dass ein neuer Chat oder eine andere KI das Projekt ohne Kontextverlust fortsetzen kann.

---

## 1. Architekturprüfung

### 1.1 Technische Machbarkeit

Machbar, ohne Mac und ohne laufende Kosten:

- **Progressive Web App** statt nativer App. Entwicklung unter Windows mit Node.js, Auslieferung als statische Dateien über kostenloses HTTPS-Hosting – seit 0.21.0 **GitHub Pages** aus dem Repository `p-stammer/tri-trainer` (Workflow `.github/workflows/deploy.yml`: bei jedem Push auf `main` Tests, Build mit `BASE_PATH=/tri-trainer/`, Veröffentlichung unter https://p-stammer.github.io/tri-trainer/). Auf dem iPhone über Safari → Teilen → „Zum Home-Bildschirm“ installierbar.
- **Offline First**: Der Service Worker (vite-plugin-pwa/Workbox) cacht die komplette App-Shell. Alle Daten liegen in IndexedDB. Nach der ersten Installation braucht die App kein Netz.
- **Komplexe Berechnungen lokal**: Der spätere Plangenerator ist reines TypeScript ohne Abhängigkeit von UI oder Datenbank und kann bei Bedarf in einem Web Worker laufen.

### 1.2 Technologien

| Bereich | Wahl | Bewertung |
|---|---|---|
| Build | Vite 8 | Aktueller Stand, schnell, gute PWA-Integration |
| UI | React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`) | Geeignet; strenge Typen fangen Einheitenfehler früh ab |
| Styling | Tailwind CSS 4 | Geeignet; Farben über CSS-Variablen für Hell/Dunkel |
| Datenbank | IndexedDB über Dexie 4 | Geeignet; versionierte Schemas mit Migrationen |
| Validierung | Zod 4 | Ein Schema für Eingabe, Import und Restore |
| PWA | vite-plugin-pwa 1.3 | Unterstützt Vite 8 |
| Tests | Vitest 4.1 | Unterstützt Vite 8 |
| Diagramme | Recharts | **erst ab MVP 2** (MVP 1 hat keine Diagramme) |
| Icons | eigene SVG-Icons statt Lucide | Wenige Icons, keine zusätzliche Abhängigkeit; Lucide kann jederzeit ergänzt werden |

`dexie-react-hooks` wird nicht benötigt: Ein eigener Hook `useLive` lädt Daten und lädt nach jeder Änderung im Repository neu. Das funktioniert identisch mit dem In-Memory-Speicher für Tests.

### 1.3 Gefundene Widersprüche und Spannungen – und wie sie gelöst sind

1. **Safari und installierte App haben getrennte Speicher.** Eine Web-App auf dem Home-Bildschirm teilt ihre Daten nicht mit Safari (WebKit-Bug 181849). Daten, die in Safari erfasst wurden, fehlen in der installierten App. → *Lösung:* App zuerst installieren, dann nutzen. Ein Umzug zwischen beiden geht über Backup/Restore. Steht im README.
2. **Lokale Daten können verloren gehen.** Für in Safari genutzte Websites gibt es seit iOS 13.4 eine 7-Tage-Grenze für skriptbeschreibbaren Speicher; Home-Bildschirm-Apps haben laut WebKit einen eigenen Nutzungszähler. Bei Speicherknappheit kann trotzdem gelöscht werden; `navigator.storage.persist()` wird angefragt, das Verhalten in Safari ist aber nicht in allen Quellen einheitlich beschrieben. → *Lösung:* Datensicherung ist Kernfunktion: versioniertes JSON-Backup, Restore mit Vorschau, Backup-Erinnerung nach 14 Tagen auf dem Dashboard.
3. **Gleicher Hosting-Ort ist Pflicht.** IndexedDB gehört zu einer Origin (Domain). Wer die App unter einer neuen URL veröffentlicht, startet mit leeren Daten. → Updates immer über dasselbe GitHub-Pages-Repo. Beim Umzug von einer früheren Adresse (z. B. Netlify) Daten per Backup → „Schon ein Backup? Daten übernehmen“ mitnehmen (README).
4. **„Wissenschaftlich optimal“ vs. fehlende individuelle Dosis-Wirkungs-Modelle.** Für die Frage „Welche zusätzliche Stunde bringt diesem Athleten am meisten?“ gibt es keine validierten individuellen Modelle. → *Lösung:* Der Generator (Version 1.0) wird als transparente Mehrziel-Optimierung mit harten Nebenbedingungen und dokumentierten heuristischen Gewichten gebaut. Jede Aussage im Begründungstext muss auf ein Eingabedatum oder eine dokumentierte Annahme zeigen. Unsicherheit wird ausgewiesen, nicht weggerechnet. Details folgen in `TRAINING_SCIENCE.md` nach der Literaturrecherche.
5. **Sechs Hauptnavigationspunkte plus Plus-Button passen nicht in eine iPhone-Tableiste.** → Seit 0.6.0: „Heute, Plan, [+], Analysen, Gesundheit“; der Verlauf ist über „Analysen → Alle Einheiten anzeigen“ erreichbar, Profil und Einstellungen über das Personen-Symbol oben rechts auf „Heute“.
6. **Ziele in km *oder* Stunden.** Beide Größen sind je Sportart planbar. Es wird *nicht* zwischen ihnen umgerechnet (das würde eine Pace unterstellen). Das Dashboard zeigt die eingestellte primäre Größe und weicht sichtbar auf die andere aus, wenn nur diese geplant ist.
7. **Einheitsfokus ≠ Zonenzeit.** Strikt getrennte Felder. Eine „VO2max-Einheit“ erzeugt keine Z5-Minuten. Nicht erfasste Zonenzeit wird als „unbekannt“ geführt.
8. **Gesamtwochenziel.** Eine Summe wird nur gezeigt, wenn jede geplante Sportart ein Dauerziel hat – sonst wäre sie irreführend klein.
9. **Zonenableitung.** Rad: Coggan-Schema aus der FTP. Laufen (% der Schwellenpace, Grundlage 128–150 % – nicht schneller als ein realistisches Ironman-Marathontempo) und Schwimmen (CSS + Sekunden) seit 0.15.0 als beschriftete Vorschläge (`TRAINING_SCIENCE.md` 2.10); manuell gesetzte Grenzen werden durch neue Ankerwerte nie überschrieben (`method: 'manual'`), der Vorschlag wird nur auf Tippen übernommen.
10. **Zeitumstellung und Jahreswechsel.** Ein Training gehört zu einem *lokalen Kalendertag* (`"YYYY-MM-DD"`), nicht zu einem Zeitpunkt. Alle Wochenrechnungen laufen auf reinen Tageszahlen. Nur „Was ist heute?“ nutzt die Zeitzone (Europe/Berlin). ISO-8601-Kalenderwochen.

---

## 2. Schichten

```
┌──────────────────────────────────────────────────────────────┐
│ UI (src/ui)            React-Komponenten, Screens, Hooks     │
│   kennt nur: usecases + lesende Repository-Methoden          │
├──────────────────────────────────────────────────────────────┤
│ Anwendungsfälle (src/data/usecases.ts)                       │
│   Onboarding, Wettkampf ändern, Woche speichern, Einheit …   │
├──────────────────────────────────────────────────────────────┤
│ Repository (src/data/repository.ts)                          │
│   validiert jeden Schreibvorgang (Zod), meldet Änderungen    │
├───────────────────────────┬──────────────────────────────────┤
│ DexieBackend (IndexedDB)  │ MemoryBackend (Tests, Vorschau)  │
└───────────────────────────┴──────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Domäne (src/domain)  reine Funktionen, keine UI, keine DB    │
│   calendar, units, sports, schemas, progress, zones, load,   │
│   race, plan, planEdit, planImport, backup, analytics, …     │
├──────────────────────────────────────────────────────────────┤
│ Engine (src/engine, ab Version 1.0)  Plangenerator A–I       │
│   reine Funktionen, optional im Web Worker                   │
└──────────────────────────────────────────────────────────────┘
```

Regeln:

- `src/domain` und später `src/engine` importieren niemals aus `src/ui` oder `src/data`.
- Abgeleitete Kennzahlen (Soll-Ist, Zonen, Belastung) werden **nie gespeichert**, sondern immer zentral in `src/domain` berechnet. So bleiben sie nach Plan- oder Datenänderungen automatisch richtig.
- Schreibzugriffe laufen ausschließlich über das Repository. Ungültige Daten erreichen die Datenbank nicht.

## 3. Verzeichnisstruktur

```
src/
  main.tsx                 Einstieg: Repository mit Dexie erzeugen, App rendern
  index.css                Tailwind, Farbvariablen hell/dunkel, Safe Areas
  domain/                  reine Fachlogik + Tests (*.test.ts)
    calendar.ts            Kalendertage, ISO-Wochen, Zeitzone
    units.ts               Meter/Sekunden, Pace, Formatierung, Parser
    sports.ts              Sportarten, Zonen, Fokus, Phasen (Stammdaten)
    schemas.ts             Datenmodell als Zod-Schemas + Typen
    progress.ts            Soll-Ist je Woche, Schwerpunkte
    zones.ts               Zonenzeiten, unbekannte Zeit, Zonen-Ableitung: Rad Coggan (FTP), Laufen Langdistanz-Schema (Schwellenpace, Grundlage 128–150 %), Schwimmen CSS + s
    load.ts                Session-RPE-Belastung
    race.ts                Countdown, Trainingswoche, Fortschritt
    plan.ts                Planwochen, Skalieren, Kopieren, Original/aktuell
    backup.ts              Backup-Format, Validierung, CSV
    planImport.ts          Planimport: CSV/JSON/Tabelle lesen, Spalten zuordnen, Werte deuten, Vorher/Nachher
    prepRace.ts            Vorbereitungswettkämpfe: Vorlagen, Einstufung kurz/mittel/lang, Wichtigkeit, Hinweise
    trainingCamp.ts        Trainingslager (0.21.0): Dauer, Hinweise (Vergangenheit, Taper, Überschneidung, lang), Wirkungstext
    performanceTests.ts    Leistungstests: Protokolle mit Rechner, Verlauf je Ankerwert, Fälligkeit (8 Wochen), VO2max (Cooper, Verlauf)
    prognosis.ts           Zielzeit-Prognose Langdistanz: Schätzwege je Teildisziplin, Leistungsmodell Rad, Race-Setup (CdA/Crr, Neo, Carbonschuhe), Formeln, Verlauf, Szenarien (docs/PROGNOSIS_MODEL.md)
    review.ts              Wochenrückblick: Ist/Soll je Sportart, Schlüsseleinheiten, RPE, Frische (Mo–Mi für die Vorwoche)
    adaptation.ts          Anpassungsvorschläge (M3.6): Ziele verfehlt/übertroffen, Frische, neue Leistungswerte, ältere Planlogik; Ermüdung aus RPE lockerer Einheiten, Beschwerden ≥ 4; Sofortmaßnahme „Woche entlasten“ (−30 %, eine Woche)
  engine/                  Plangenerator (Modell in docs/PLAN_MODEL.md), reine Funktionen
    params.ts              Modellversion, Philosophie-Regler → Parameter, feste Werte, Disziplingewichte
    limits.ts              harte Grenzen: Steigerung, langer Lauf, Entlastung, Abrunden
    types.ts               Ein-/Ausgabetypen (PlanGeneratorInput, GeneratorResult, Warnungen W1–W9, Violation)
    inputs.ts              A: Ausgangsumfang, Pflichtangaben (NeedsInput), Datenqualität
    assessment.ts          B/C: Bewertung je Disziplin (Umfang, Testverlauf, Prognose-Zeitanteile), Prioritäten auto/hybrid/manuell
    phases.ts              D: Phasen, Entlastung, Taper, Vorbereitungsrennen, Pausen, Steigerungsstopp
    volume.ts              E: Wunschverlauf, Projektion mit Grenzen, Lauf → Rad, Budget, lange Einheiten
    intensity.ts           F: Zonenzeiten, Laufen locker, Intensität aufs Rad
    sessions.ts            G: Einheitenzahl, Schlüsseleinheiten, WeekTargets
    checks.ts              H: zweite Prüfung der harten Grenzen, Warnungen
    generate.ts            I + Ablauf: generatePlan(input)
  data/
    backend.ts             Speicher-Schnittstelle
    dexieBackend.ts        IndexedDB über createPlannerDb() (Schema-Versionen!)
    memoryBackend.ts       In-Memory
    repository.ts          Validierung + Änderungsmeldung
    usecases.ts            Anwendungsfälle
  ui/
    App.tsx                Routing, Tableiste, Theme
    state.tsx              Kontext, useLive, useToday, Hash-Routing, Toasts
    UpdatePrompt.tsx       Hinweis auf neue App-Version („offline nutzbar“ blendet sich nach 4 s aus)
    files.ts               Datei teilen/herunterladen (Backup, CSV, Import-Vorlage)
    components/            Icons, Formular-Bausteine, Einheiten-Zeile, PrepRaces, TrainingCamps, RaceSetup, VolumeTimeline (Umfangsverlauf), AdaptationCard (Anpassungsvorschläge), WeekReviewCard (Wochenrückblick), TestReminderCard (Leistungstest fällig)
    screens/               Onboarding, Dashboard, Plan, Woche, Planimport, Plan vorschlagen, Erfassen, Verlauf, Profil …
tools/preview/             Vorschau-Einstieg (In-Memory + localStorage, Beispieldaten), eigener Vite-Build → eine HTML-Datei
```

## 4. Datenmodell (Datenbankversion 7)

Konventionen: Distanz in **Metern**, Dauer in **Sekunden**, Kalendertage als `"YYYY-MM-DD"`, Zeitstempel als ISO-UTC. Jede Entität hat eine String-ID (UUID). Alle Schemas stehen in `src/domain/schemas.ts`.

| Tabelle | Indizes | Inhalt |
|---|---|---|
| `settings` | `id` (`"app"`) | Zeitzone, primäre Zielgröße je Sportart, Theme, letzte Sportart, letztes Backup, aktiver Plan, ausgeblendete Anpassungsvorschläge/Wochenrückblick (Woche) |
| `profile` | `id` (`"me"`) | optionale Athletendaten; `bestTimes` (seit 0.18.0: 10 km, Halbmarathon, Marathon, olympisch, 70.3); `baseline` = aktueller Umfang je Sportart (km, Stunden, Einheiten pro Woche, Bezugszeitraum); `availableWeeklySec` = Zeitbudget (Obergrenze für Planvorschläge); `raceSetup` (seit 0.21.0: Rad, Aufleger, Laufräder, Reifen, Kleidung/Helm, Laufschuhe, Neo – Voraussetzung für die Prognose) |
| `races` | `id` | TargetRace: Name, Datum, Distanzen, Zielzeit, Vorbereitungsbeginn |
| `plans` | `id, raceId` | TrainingPlan: Herkunft (manual/generated/imported) |
| `weeks` | `id, planId, weekStart, [planId+weekStart]` | TrainingWeek mit `original` und `current` (WeekTargets) |
| `activities` | `id, date, sport` | CompletedActivity |
| `zoneConfigs` | `id` (= Sportart) | SportZoneConfiguration: Messgröße, Methode (`manual`, `derived_coggan_ftp`, seit 0.15.0 `derived_css_offset`, seit 0.15.1 `derived_run_pace`; `derived_friel_pace` nur Altbestand aus 0.15.0), Referenzwert, 4 Grenzen |
| `metrics` | `id, kind, date` | PerformanceMetric: Wert, Einheit, Datum, Methode, Quelle; Arten FTP, Schwellen-HF, Schwellenpace, CSS, seit 0.20.0 VO2max (ml/kg/min, nur Dokumentation) |
| `planChanges` *(DB 5)* | `id, planId, createdAt` | PlanChange: Art (`week_edit`, `copy`, `bulk_*`, `pause_adjust`, `import` seit 0.8.0, `generated` seit 0.10.0, `undo`), Beschreibung, je Woche Vorher/Nachher (WeekTargets), bei Rückgängig Verweis auf die ursprüngliche Änderung |
| `strengthTemplates` *(DB 4)* | `id, name` | StrengthWorkoutTemplate mit eingebetteten Übungen (Sätze, Wdh. oder Zeit, Gewicht, Pause, RPE/RIR, Notiz) |
| `strengthLogs` *(DB 4)* | `id, date, status, templateId, activityId` | StrengthWorkoutLog: **Kopie** der Vorlage plus Satzprotokoll (Vorgabe/Ist, erledigt, übersprungen), Status läuft/abgeschlossen, `entryMode` quick (nur abgehakt) oder detailed, verknüpfte CompletedActivity |
| `painIssues` *(DB 3)* | `id, status, startDate` | PainIssue: Körperstelle, Seite, Beschreibung, betroffene Sportarten, Status aktiv/klingt ab/abgeklungen |
| `painObservations` *(DB 3)* | `id, issueId, date` | PainObservation: Datum, Schmerz 0–10, Notiz – mehrere je Beschwerde |
| `pauses` *(DB 3)* | `id, startDate` | TrainingPause: gesamt oder einzelne Sportarten, Beginn, optionales Ende, Grund, verknüpfte Beschwerde |
| `prepRaces` *(DB 6)* | `id, planId, date` | PrepRace: Name, Datum, Art (Triathlon/Lauf/Rad/Schwimmen/Sonstiges), Distanzen, Notiz; mehrere je Plan, Datum jederzeit änderbar |
| `trainingCamps` *(DB 7)* | `id, planId, startDate` | TrainingCamp: Name, Beginn, Ende (höchstens 28 Tage), Stunden pro Tag 0,5–8, Notiz; mehrere je Plan |
| `generatorSettings` *(DB 6)* | `id` (= planId) | GeneratorSettings: Philosophie 0–100, Prioritätsmodus auto/hybrid/manual, Prioritäten je Disziplin getrennt `user`/`suggested`/`applied`, Taper 1–3 Wochen, Freiwasser ab, individuelle Höchstwerte, längster Lauf/längste Ausfahrt mit Stand |
| `wellness` *(DB-Version 2)* | `id, weekStart` | WeeklyWellnessCheckin: Frische 1–10, optional Schlaf/Muskelkater/Motivation/Wohlbefinden 1–5, Notiz, „als geprüft markiert“; ein Eintrag pro Woche |

**WeekTargets** (eingebettet in TrainingWeek): Phase, `sports: WeeklySportTarget[]` (Dauer, Distanz, Anzahl, Zonenziele), `focuses: PlannedSessionFocus[]`, Frische-Zielbereich (für MVP 2 vorbereitet), Notizen.

**Jede Planänderung läuft über `commitWeekChanges`:** Einzelwoche, Kopieren, Sammeländerung, Pausen-Vorschlag, Planimport, Planvorschlag und Rückgängig schreiben die Wochen *und* einen Eintrag in `planChanges`. Rückgängig ist nur erlaubt, solange alle betroffenen Wochen noch exakt den Nachher-Stand haben (`canUndo`, Vergleich über kanonisches JSON); sonst würden spätere Änderungen überschrieben.

**Drei Ebenen des Plans:**
1. *Ursprünglicher Plan* = `week.original` (erste gespeicherte Fassung bzw. später der übernommene Generatorvorschlag; wird nie überschrieben)
2. *Aktuell gültiger Plan* = `week.current`, `revision` zählt Änderungen
3. *Absolvierte Einheiten* = Tabelle `activities`, unabhängig vom Plan; Wochenzuordnung allein über `date`

Dadurch können Planänderungen und Datumsänderungen des Wettkampfs keine Historie zerstören. Wochen, die nach einer Datumsänderung außerhalb des Zeitraums liegen, werden nicht gelöscht, sondern gemeldet.

### 4.1 Geplante Erweiterungen (spätere DB-Versionen)

| Version | Neue Tabellen | Zweck |
|---|---|---|
| 2 (MVP 2) ✅ | `wellness` | Frische-Check-in (umgesetzt in 0.2.0) |
| 3 (MVP 2) ✅ | `painIssues`, `painObservations`, `pauses` | Beschwerden und Pausen (umgesetzt in 0.3.0) |
| 4 (MVP 2) ✅ | `strengthTemplates`, `strengthLogs` | Krafttraining (umgesetzt in 0.4.0) |
| 5 (MVP 2) ✅ | `planChanges` | Änderungshistorie (umgesetzt in 0.7.0; Art `import` ab 0.8.0 ohne Schemaänderung) |
| 6 (V 1.0) ✅ | `prepRaces`, `generatorSettings` | Vorbereitungswettkämpfe und Planer-Einstellungen (umgesetzt in 0.9.0). Prioritäten liegen vereinfacht in `generatorSettings` (eine Zeile je Plan statt Zeiträume) |
| 7 (0.21.0) ✅ | `trainingCamps` | Trainingslager |
| 8 (V 1.x, bei Bedarf) | `planProposals`, `disciplineAssessments` | gespeicherte Vorschläge und Bewertungen, falls Vorschläge über einen Neustart hinweg offen bleiben sollen; bis dahin werden sie bei Bedarf neu berechnet (deterministisch) |

**Disziplinpriorisierung – Trennung der Werte** (Anforderung 21): Ein `DisciplinePrioritySetting` je Disziplin und Gültigkeitszeitraum speichert getrennt:
`userPriority` (manuell, 1–5 oder leer), `suggestedPriority` (vom Modell), `assessmentId` (verwendete Leistungsdaten, Datenqualität, Begründung), `appliedPriority` (tatsächlich verwendet), `mode` (auto/hybrid/manual), `validFrom/validTo` bzw. `phase`.
Umsetzung ab 0.9.0: `generatorSettings.priorities.<sport>.{user, suggested, applied}` plus `priorityMode`; die Bewertung (Datenqualität, Begründung) wird bei jedem Lauf neu berechnet. Eine neue automatische Bewertung schreibt **nur** `suggestedPriority` und erzeugt einen Vorschlag; `userPriority` und `appliedPriority` ändern sich nur durch Bestätigung.

### 4.2 Migrationen

- Jede Strukturänderung bekommt eine **neue** `db.version(n).stores({...}).upgrade(tx => …)` in `createPlannerDb()` (`dexieBackend.ts`). Bestehende Versionsblöcke werden nie geändert. Der Upgrade-Pfad 1 → aktuell ist durch `dexieBackend.test.ts` abgesichert.
- Das Backup-Format hat eine eigene `formatVersion` (aktuell 7). Ältere Formate werden beim Einlesen schrittweise ergänzt: 1→2 `wellness`, 2→3 Beschwerden und Pausen, 3→4 Krafttraining, 4→5 `planChanges`, 5→6 `prepRaces` und `generatorSettings` (leer), 6→7 `trainingCamps` (leer). Ältere Backups werden in `parseBackup` vor der Validierung migriert; neuere werden mit Klartext abgelehnt.
- Ein App-Update tauscht nur den Programmcode (Service-Worker-Cache), nicht IndexedDB.

## 5. Berechnungsmodule (MVP 1)

| Modul | Funktion | Kernregel |
|---|---|---|
| `calendar` | `startOfWeek`, `isoWeek`, `today(tz)` | Montag als Wochenbeginn, ISO 8601, DST-sicher |
| `progress` | `computeWeekProgress`, `primaryProgress`, `computeFocusProgress` | Plan bleibt unverändert; Rest nie negativ; keine Schätzung fehlender Distanzen |
| `zones` | `splitKnownUnknown`, `deriveBikeZonesFromFtp`, `deriveRunZonesFromThresholdPace`, `deriveSwimZonesFromCss`, `averagePaceZone`, `validateZoneBounds` | Unbekannte Zonenzeit bleibt unbekannt; Lauf-/Schwimmzonen nur Vorschlag; Durchschnittspace → Zone nur als Hinweis beim Erfassen |
| `load` | `sessionLoad`, `summarizeLoad` | nur mit RPE; Vollständigkeit wird ausgewiesen |
| `race` | `raceCalendar` | Countdown, Trainingswoche, Restwochen, Status |
| `plan` | `reconcileWeeks`, `scaleWeekTargets`, `applyWeekTargets` | keine stillen Löschungen; Original bleibt erhalten |
| `backup` | `parseBackup`, `activitiesToCsv` | vollständige Validierung vor Restore, Migration älterer Formate |
| `planEdit` | `bulkSetPhase`, `bulkScale`, `bulkCopyFrom`, `bulkSetFreshness`, `canUndo`, `undoChanges`, `sameTargets` | erzeugen nur Vorschläge (nur tatsächlich geänderte Wochen); Übernahme erst nach Bestätigung |
| `analytics` | `periodWeekStarts`, `analysisWeeks`, `compareToTarget`, `zoneSummary`, `focusCounts`, `otherActivitySummary`, `weekCompliance`, `complianceSummary`, `trailingMean` | Soll-Ist nur über Wochen mit Ziel; Zonen inkl. Anteil unbekannt; Belastung nur aus RPE, gleitendes Mittel lässt Lücken aus |
| `strength` | `createLogFromTemplate`, `toggleSet`, `summarizeWorkout`, `lastPerformance` | Workout = Kopie der Vorlage; Abhaken übernimmt Vorgabe nur in leere Ist-Felder; Abschluss erzeugt/aktualisiert genau eine Kraft-Einheit |
| `health` | `summarizeIssue`, `recurringRegions`, `isSportPaused`, `proposePauseAdjustment` | Pausen-Vorschlag kürzt nur anteilig (pausierte Tage/7), nie Nachholen; Übernahme nur nach Bestätigung, Original bleibt |
| `wellness` | `assessFreshness`, `needsAttention`, `weeklyHealthRows` | Hinweis statt Planänderung; keine medizinische Deutung; Gegenüberstellung ohne Kausalaussage |
| `planImport` | `readImportText`, `suggestMapping`, `validateMapping`, `interpretRows`, `buildImportChanges`, `importTemplateCsv` | Leere Zelle = kein Wert (nie 0, nie geschätzt; Modus „entfernen“ oder „behalten“); unklare Werte (z. B. „1.500“, „2,5 Einheiten“, unplausibel hoch) werden markiert und nicht übernommen – der bisherige Wert bleibt; nur zugeordnete Felder werden geändert (Schwerpunkte, Zonen, Frischebereich nie); keine Wochen anlegen/löschen, Zeilen außerhalb des Plans und doppelte Wochen werden gemeldet; keine Umrechnung zwischen Dauer und Distanz |

## 6. Schnittstelle des Plangenerators (Version 1.0)

Der Generator ist eine reine, deterministische Funktion (gleiche Eingabe + gleiche Modellversion = gleiches Ergebnis), testbar und im Web Worker ausführbar. Das vollständige Modell mit Formeln steht in **`docs/PLAN_MODEL.md`** (Modellversion `im-gen-1.7.0`); die Typen in `src/engine/types.ts`:

- `PlanGeneratorInput`: `today`, `race`, `firstWeek`, `planWeeks`, `profile` (u. a. Ausgangsumfang und Zeitbudget), `settings` (`GeneratorSettings`), `prepRaces`, `camps` (seit 0.21.0), `prognosisSettings`, `metrics`, `history`, `wellness`, `pauses`, `painIssues`, `painObservations`.
- `GeneratorResult` = `{ ok: true, proposal: PlanProposal }` oder `{ ok: false, needsInput: NeedsInput[] }` – fehlen Zeitbudget, Ausgangsumfang oder längster Lauf, rechnet der Generator **nicht** mit Annahmen, sondern fragt nach.
- `PlanProposal`: `modelVersion`, Wochen (`ProposedWeek`: Wochenrahmen mit Art `loading`/`recovery`/`taper`/`prep_race`/`post_race`, WeekTargets, Begründung), übernommene Prioritäten, Bewertungen, `warnings` (W1–W8), `uncertainties`.
- Parameter: `resolveParams(philosophy, age)` in `params.ts`; harte Grenzen in `limits.ts`. Geplante Werte werden abgerundet, damit Runden nie eine Grenze verletzt.

Umsetzung seit 0.10.0: Module A–I in `src/engine/` (siehe Verzeichnisstruktur). `loadGeneratorInput` (usecases) sammelt die Eingaben, `generatePlan` rechnet, der Bildschirm `PlanGenerator` zeigt die Vorschau, `applyGeneratedPlan` schreibt die geänderten Wochen über `commitWeekChanges` mit der Art `generated` und speichert vorgeschlagene/verwendete Prioritäten. Abhängigkeiten: `engine` importiert nur aus `domain`; `data` nutzt die Engine-Typen.

## 7. Navigation und UI

- Pace-Eingaben (CSS, Schwellenpace, Pace-Zonen) als zwei Zahlenfelder Minuten : Sekunden – der iPhone-Zahlenblock hat keinen Doppelpunkt.
- Zeitfelder (Stunden + Minuten) nie in halber Breite, sonst werden die Zahlen abgeschnitten.
- Diagramme sind schlanke eigene SVG-Komponenten (`components/charts.tsx`: gestapelte Wochenbalken mit Zielmarken und optionaler Mittelwertlinie, 100-%-Anteilsbalken; `FreshnessChart`). Entscheidung bei M2.1: **kein Recharts** – die benötigten Formen sind einfach, so bleibt das Paket klein, offline-sicher und hier vollständig testbar. Regeln: eine y-Achse, 2-px-Lücken, Legende ab zwei Reihen, Antippen statt Hover zeigt Werte als Textzeile, Tabellen ergänzen jedes Diagramm.
- Sportfarben mit dem dataviz-Palettenvalidator geprüft (hell und dunkel; Farbsehschwäche-Abstand ≥ 8). Zonen = Helligkeitsstufen der Sportfarbe, unbekannte Zeit = Schraffur.

- Hash-Routing (`#/`, `#/plan`, `#/plan/2026-11-16`, `#/plan/import`, `#/plan/vorschlag`, `#/log/neu`, `#/log/<id>`, `#/verlauf`, `#/gesundheit`, `#/frische`, `#/beschwerde/neu`, `#/beschwerde/<id>`, `#/pause/neu`, `#/pause/<id>`, `#/kraft`, `#/kraft/vorlage/<id|neu>`, `#/kraft/workout/<id>`, `#/analysen`, `#/profil`, `#/tests`, `#/prognose`) funktioniert offline und auf jedem statischen Hosting ohne Server-Konfiguration.
- Mobile First, max. Inhaltsbreite 576 px (auch am Desktop gut lesbar), Touch-Ziele ≥ 44 px, Eingabefelder ≥ 16 px (verhindert iOS-Zoom), Safe Areas über `env(safe-area-inset-*)`.
- Sportfarben (Blau/Orange/Grün/Violett) immer zusammen mit eigenem Icon und Text.
- Systemschrift (auf dem iPhone SF Pro) – keine Webfonts, damit nichts aus dem Netz geladen werden muss.

## 8. Teststruktur

- `src/domain/*.test.ts`: reine Berechnungen (Kalender, Einheiten, Soll-Ist, Zonen, Plan, Backup, Frische, Beschwerden/Pausen, Kraft, Analysen, Baseline).
- `src/data/repository.test.ts`: Anwendungsfälle mit MemoryBackend.
- `src/data/dexieBackend.test.ts`: dieselben Kernfälle gegen IndexedDB (über `fake-indexeddb`).
- `src/domain/planImport.test.ts`: Einlesen (CSV/TSV/JSON), Werte-Deutung, Zuordnung, Wochenauflösung (Datum/KW/Trainingswoche, Jahreswechsel), „fehlende Werte bleiben leer“.
- Typprüfung mit `tsc -b` und den echten Bibliothekstypen (seit 0.7.1), inklusive `tools/preview`.
- Browser-Tests (außerhalb des Projekts, in Claudes Umgebung): Playwright mit Chrome im iPhone-Viewport gegen das gebaute `dist` (Service Worker, Offline, Update, echtes IndexedDB, Planimport) und gegen die gebaute Vorschau.
- `src/engine/limits.test.ts`: Reglertabelle, harte Grenzen, Rechenbeispiel aus `PLAN_MODEL.md` (Start bei 1 h / 10 km Laufen). `src/domain/prepRace.test.ts`: Einstufung und Hinweise.
- `src/engine/generate.test.ts`: Beispielathleten A–H, Raster über Regler/Budget/Taper mit Rennen und Pausen (keine Grenzverletzung), Determinismus, Sensitivität (`MODEL_VALIDATION.md`).
