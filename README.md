# Ironman Planner

Persönliche, offlinefähige Triathlon-Trainings-App (PWA) mit wochenzielbasierter Planung. Läuft auf dem iPhone als installierte Web-App, ohne App Store, ohne Konto, ohne Server.

**Aktueller Stand:** Version 0.21.1 – Plan vorschlagen (Plangenerator) mit Anpassungsvorschlägen, Wettkampf, Vorbereitungswettkämpfe, Trainingslager, Trainingswochen, manuelle Wochenziele, Planimport (CSV/JSON/Tabelle), Training erfassen, Soll-Ist-Dashboard, Intensitätszonen (Rad, Laufen, Schwimmen als Vorschlag aus FTP, Schwellenpace, CSS), Frische-Check-in, Beschwerden, Trainingspausen, Krafttraining mit Vorlagen und Satzprotokoll, Zielzeit-Prognose mit Race-Setup, Backup. Details: [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

## 1. Einmalig: Node.js installieren (Windows)

1. Auf <https://nodejs.org> die **LTS-Version** herunterladen und installieren (Standardoptionen).
2. PowerShell öffnen und prüfen:
   ```powershell
   node --version   # sollte v22 oder neuer zeigen
   npm --version
   ```

## 2. Projekt starten

Repository klonen (`git clone https://github.com/p-stammer/tri-trainer`) oder ZIP entpacken, dann in PowerShell:

```powershell
cd C:\Projekte\tri-trainer
npm install          # lädt alle Bibliotheken (einmalig, ca. 1–2 Minuten)
npm test             # führt alle automatischen Tests aus
npm run dev          # startet die App lokal
```

Dann im Browser <http://localhost:5173> öffnen. Beenden mit `Strg + C`.

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm run typecheck` | prüft alle TypeScript-Typen |
| `npm run build` | baut die fertige App in den Ordner `dist` |
| `npm run preview` | zeigt den gebauten Stand lokal an (mit Service Worker) |
| `npm run build:preview` | baut die Vorschau als eine einzige HTML-Datei (`dist-preview/ironman-planner-vorschau.html`, ohne Service Worker, mit Beispieldaten) |
| `npm run dev:host` | macht die Entwicklungsversion im WLAN erreichbar (nur zum Ansehen am iPhone, **nicht** zum Installieren – siehe unten) |

Die Datei `package-lock.json` gehört dazu und legt die getesteten Bibliotheksversionen fest (Stand 0.8.0: Vite 8.3, Vitest 4.1, React 19.3, Dexie 4.4, Zod 4.6, Tailwind 4.3, vite-plugin-pwa 1.3). Bitte nicht löschen.

Falls `npm install` mit `Cannot read properties of null (reading 'edgesOut')` abbricht: Das ist ein Fehler in npm 10, nicht im Projekt. Abhilfe: `npx npm@11 install`. Bei anderen Fehlermeldungen die komplette Meldung an Claude geben.

## 3. Auf dem iPhone installieren (GitHub Pages)

Die App wird automatisch aus diesem Repository veröffentlicht: **<https://p-stammer.github.io/tri-trainer/>**

- Jeder Push auf `main` startet den Workflow `.github/workflows/deploy.yml`: Tests → Build mit `BASE_PATH=/tri-trainer/` → Veröffentlichung auf GitHub Pages. Den Fortschritt siehst du im Repository unter **Actions**.
- **Einmalig nötig:** Repository → **Settings** → **Pages** → bei **Source** „**GitHub Actions**“ wählen. (Mit „Deploy from a branch“ würde der Quellcode statt der gebauten App ausgeliefert.)

Installation:

1. Auf dem iPhone **in Safari** <https://p-stammer.github.io/tri-trainer/> öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“** → „Hinzufügen“.
2. App über das neue Symbol starten.
3. **Umzug von der bisherigen Adresse** (Netlify/Cloudflare): in der alten App Profil → „Backup sichern (JSON)“ → in iCloud Drive speichern. In der neuen App auf dem ersten Bildschirm „Schon ein Backup? Daten übernehmen“ → Datei wählen → „Übernehmen“. Die alte App danach vom Home-Bildschirm löschen.

Wichtig:

- **Safari und die installierte App haben getrennte Speicher.** Nutze nur die installierte App.
- **Immer dieselbe Adresse verwenden.** Die Daten gehören zur Adresse; eine andere Adresse startet mit leeren Daten (dann wie oben per Backup umziehen).
- **Updates:** Nach einem neuen Push erscheint in der App „Eine neue Version ist verfügbar“. Trainingsdaten bleiben erhalten.
- **Offline-Test:** App einmal öffnen, dann Flugmodus an und App neu starten.

Andere Hosts (z. B. Cloudflare Pages per Drag & Drop) funktionieren weiter mit `npm run build` und dem Ordner `dist` (dann ohne `BASE_PATH`).

## 4. Datensicherung

Alle Daten liegen nur auf dem Gerät. **Profil → Datensicherung → Backup sichern (JSON)** öffnet auf dem iPhone das Teilen-Menü; dort „In Dateien sichern“ → iCloud Drive wählen. Die App erinnert nach 14 Tagen ohne Backup. Wiederherstellen zeigt vorher eine Vorschau und ersetzt erst nach Bestätigung.

## 5. Bedienung in Kürze

- **Heute:** Countdown, Trainingswoche, Wochenfortschritt je Sportart, Schwerpunkte, Intensität, Einheiten der Woche.
- **Plan:** alle Wochen bis zum Wettkampf. Woche antippen → Ziele für Dauer, Distanz, Anzahl, Zonenzeit, Schwerpunkte, Phase; skalieren; in Folgewochen übernehmen; Vergleich ursprünglich/aktuell/absolviert. „Auswählen“ → mehrere Wochen auf einmal ändern (Phase, Umfang, Kopieren, Frische) mit Vorschau. Unten „Plan importieren“ und der Änderungsverlauf mit „Rückgängig“.
- **Plan importieren:** Plan → „Plan importieren“. CSV- oder JSON-Datei wählen oder eine Tabelle aus Excel/Numbers/Google Tabellen einfügen (eine Zeile pro Woche; Woche als Datum, KW oder Trainingswoche). Spalten werden automatisch zugeordnet und lassen sich ändern; „vermutet“ heißt: bitte prüfen. Leere Zellen bleiben leer (wahlweise bisheriges Ziel entfernen oder behalten), unklare Werte werden markiert und nicht übernommen. Vorschau → Übernehmen; Rückgängig im Änderungsverlauf. Eine CSV-Vorlage mit allen Planwochen gibt es auf dem Import-Bildschirm.
- **Plus:** Training erfassen. Pflicht: Sportart, Dauer, Datum, Fokus. Optional: Distanz, Zonenzeiten, RPE, Notiz, Zuordnung zu einem Schwerpunkt.
- **Krafttraining:** am schnellsten Plus → Kraft → Vorlage antippen → Speichern. Oder „Krafttraining“ auf „Heute“ → „✓ Erledigt“. Wer mag, erfasst „Mit Sätzen“ live oder ergänzt Sätze später.
- **Analysen:** Umfang, Soll-Ist, Intensität und Belastung über 1/4/12 Wochen oder den ganzen Plan; darunter „Alle Einheiten anzeigen“ (Verlauf zum Bearbeiten oder Löschen).
- **Gesundheit:** Trainingspausen (mit optionalem Planvorschlag, nie Nachholen), wöchentlicher Frische-Check-in (1–10) mit Hinweis bei Abweichung, Beschwerden mit Schmerzverlauf, Wochenvergleich.
- **Profil** (Personen-Symbol oben rechts auf „Heute“): Wettkampf, Athletenprofil, FTP und Zonen, Anzeige (Distanz oder Dauer als Hauptgröße, Hell/Dunkel), Datensicherung.

## 6. Dokumentation

| Datei | Inhalt |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architekturprüfung, Schichten, Datenmodell, Migrationen, Generator-Schnittstelle |
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | Meilensteine bis Version 2.0 |
| [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) | Was fertig ist, was wie getestet wurde, bekannte Probleme |
| [`docs/TRAINING_SCIENCE.md`](docs/TRAINING_SCIENCE.md) | Verwendete Methoden, Quellen, Rechercheplan |
| [`docs/PLAN_MODEL.md`](docs/PLAN_MODEL.md) | Modell des Plangenerators: Eingaben, Formeln, harte Grenzen, Warnungen (Version im-gen-1.0.0) |
| [`docs/MODEL_VALIDATION.md`](docs/MODEL_VALIDATION.md) | Validierungsfälle für den späteren Plangenerator |
| [`docs/PROGNOSIS_MODEL.md`](docs/PROGNOSIS_MODEL.md) | Zielzeit-Prognose und Leistungstests (Version 2.0) |

Für einen neuen Chat: `docs/PROJECT_STATUS.md` und `docs/ARCHITECTURE.md` mitgeben.

Die App stellt keine Diagnosen und gibt keine medizinischen Trainingsfreigaben.
