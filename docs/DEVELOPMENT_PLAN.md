# Entwicklungsplan

Stand: 19.11.2026 (Version 0.21.0, MVP 2 komplett, M3.1–M3.3 erledigt, M3.5 in erster Fassung). Reihenfolge = Priorität. Jeder Meilenstein ist für sich nutzbar und testbar.

Legende: ✅ erledigt · 🔶 in Arbeit / braucht deinen Gerätetest · ⬜ offen

---

## MVP 1 – Funktionsfähiger Trainingsplaner

### ✅ M1.1 Fundament und Domänenkern
- **Ziel:** Projektgerüst und korrekte Kernberechnungen ohne UI.
- **Dateien:** `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/domain/*`
- **Akzeptanz:** Soll-Ist, Zonen (inkl. unbekannt), Kalenderwochen, Jahreswechsel, Zeitumstellung, Pace-Umrechnung korrekt.
- **Tests:** `calendar`, `units`, `progress`, `race`, `plan`, `backup` (Testfälle 1, 2, 3, 4, 6, 9, 11, 12 der Anforderung).

### ✅ M1.2 Persistenz und Datensicherung
- **Ziel:** Daten sicher lokal speichern, Backup/Restore.
- **Dateien:** `src/data/*`
- **Abhängigkeit:** M1.1
- **Akzeptanz:** Jeder Schreibvorgang validiert; Restore atomar; Datumsänderung löscht nichts.
- **Tests:** `repository.test.ts` (MemoryBackend), `dexieBackend.test.ts` (IndexedDB über fake-indexeddb).

### ✅ M1.3 Oberfläche MVP 1
- **Ziel:** Onboarding, Dashboard, Plan-Übersicht, Wochen-Editor, Training erfassen/bearbeiten/löschen, Verlauf, Profil, Zonen, Backup.
- **Dateien:** `src/ui/**`, `src/main.tsx`, `src/index.css`
- **Abhängigkeit:** M1.2
- **Akzeptanz:** Kein Button ohne Funktion; Plus-Button überall; Dashboard aktualisiert sich nach jeder Erfassung.
- **Tests:** Browser-Durchlauf (14 Schritte) gegen In-Memory-Speicher; siehe `PROJECT_STATUS.md`.

### 🔶 M1.4 Installation und Gerätetest (Build-Teil ✅ in 0.7.1; iPhone-Teil braucht dich)
- **Ziel:** App läuft auf deinem PC und als installierte PWA auf deinem iPhone.
- **Schritte:** `npm install` → `npm test` → `npm run build` → Deploy (seit 0.21.0 GitHub Pages) → iPhone-Installation → Offline-Test (Flugmodus) → Backup in iCloud Drive sichern und wiederherstellen.
- **Akzeptanz:** Alle Vitest-Tests grün; Build ohne Typfehler; App startet im Flugmodus; Daten überstehen App-Update (neuer Deploy) und Neustart des iPhones. (Testfall 10)
- **Rückmeldung an mich:** Fehlermeldungen aus Terminal oder Screenshots vom iPhone.

---

## MVP 2 – Trainingscockpit

Datenbankversion 2 (neue Tabellen siehe `ARCHITECTURE.md` 4.1).

| # | Meilenstein | Kernpunkte | Tests |
|---|---|---|---|
| ✅ M2.1 | Analysen (eigene SVG-Diagramme statt Recharts) | Volumen je Sportart (Woche/4/12 Wochen/Plan), Soll-Ist-Verlauf, Zonen geplant vs. absolviert, Anteil unbekannter Zonenzeit, Session Load mit gleitendem Mittel und Datenvollständigkeit | Aggregationen über Zeiträume; kein Load ohne RPE |
| ✅ M2.2 | Frische-Check-in | Wöchentlich 1–10 + optionale Werte; Zielbereich je Woche; Hinweis bei Abweichung, Planwoche „zur Prüfung markiert“ | Testfall 7: Abweichung → Hinweis, keine Planänderung |
| ✅ M2.3 | Beschwerden und Pausen | Beschwerden mit Verlauf; Pausen je Sportart/gesamt; Anzeige auf dem Dashboard; Vorschlag statt Automatik | Testfall 5: Pause erzeugt keine Nachholbelastung |
| ✅ M2.4 | Krafttraining | Vorlagenbibliothek, Workout durchführen (Sätze abhaken, Gewichte), Log speichert Kopie der Vorlage | Testfall 8: Vorlagenänderung ändert keine Logs |
| ✅ M2.5 | Erweiterter Plan-Editor | Mehrere Wochen gleichzeitig, Phasen über Zeiträume, Vergleich Original/aktuell/absolviert, Änderungshistorie mit Rückgängig | Mehrfachänderung atomar; Historie vollständig |
| ✅ M2.6 | Planimport | JSON und CSV (optional eingefügter Text), Feldzuordnung, unklare Werte markieren, Vorschau, Bestätigung | Fehlende Werte bleiben leer, werden nicht erfunden |
| ✅ M2.7 | Navigation umstellen | Heute, Plan, +, Analysen, Gesundheit | – |

---

## Version 1.0 – Wissenschaftliche Trainingsplanung

Reihenfolge laut Anforderung: erst Wissenschaft, dann Modelle, dann Validierung, zuletzt UI.

| # | Meilenstein | Ergebnis |
|---|---|---|
| ✅ M3.1 | Literaturrecherche | `TRAINING_SCIENCE.md` mit verifizierten Quellen, Evidenzgrad je Aussage, Trennung Evidenz/Heuristik; Regelkatalog R0–R21 als Vorlage für M3.2 |
| ✅ M3.2 | Modelldefinition | `PLAN_MODEL.md` (im-gen-1.0.0): Formeln, Parameter, Zielfunktion, harte/weiche Bedingungen, Warnungen; `src/engine/params.ts`, `limits.ts`, `types.ts` mit Tests; DB-Version 6 (Vorbereitungswettkämpfe mit Editor im Profil, Planer-Einstellungen) – Version 0.9.0 |
| ✅ M3.3 | Engine Module A–I | `src/engine/*` (Modell im-gen-1.1.0), reine Funktionen, deterministisch; 0.10.0 |
| ✅ M3.4 | Validierung | Athleten A–H, Grenz-Raster, Sensitivitätsanalyse (`MODEL_VALIDATION.md`, 0.14.0) |
| ✅ M3.5 | UI-Integration | Regler, Prioritätsmodi, Vorschau mit Umfangsverlauf, Begründungen, Warnungen, Vergleich vorher → nachher, Übernehmen/Rückgängig; Feinbearbeitung danach im Wochen-Editor (0.10–0.14) |
| ✅ M3.6 | Anpassungsvorschläge (0.14.0: Karte „Plan überprüfen?“; 0.15.0: „Diese/Nächste Woche entlasten“ ändert nur eine Woche; 0.16.0: Ermüdung aus RPE; 0.17.0: Beschwerden, Wochenrückblick) | regelbasierte Vorschläge (verfehlte Ziele, Ermüdung, Pausen, neue Leistungswerte) mit Vergleich und Bestätigung |

## Version 2.0 – Leistungsmodelle

| # | Meilenstein | Ergebnis |
|---|---|---|
| ✅ M4.1 | Leistungstests | Protokolle mit Rechner, Verlauf, Erinnerung (0.18.0) |
| ✅ M4.2 | Zielzeit-Prognose | Spannen aus Leistungswerten, Bestzeiten und absolviertem Training, Vergleichsformeln (`PROGNOSIS_MODEL.md`, 0.18.0) |
| ✅ M4.3 | Dynamische Repriorisierung | Prioritätsvorschlag aus Testverlauf, Umfang und Prognose-Teilzeiten, Hinweis bei Änderung (Modell 1.7.0, 0.19.0) |
| ✅ M4.4 | Prognose-Verlauf und Szenarien | Spanne über die Vorbereitung, „was wäre wenn“ (0.19.0) |
| ✅ M4.5 | VO2max-Verlauf, erweiterte Analysen | VO2max manuell mit Methode und Quelle; Belastung je Sportart, Planerfüllung über alle Wochen (0.20.0) |

## Nach Version 2.0

| # | Meilenstein | Ergebnis |
|---|---|---|
| ✅ M5.1 | Hosting über GitHub Pages | Repository `p-stammer/tri-trainer`, Workflow mit Tests und Build bei jedem Push (0.21.0) |
| ✅ M5.2 | Trainingslager | Zeitraum mit Stunden pro Tag, Mehrumfang Rad/Schwimmen, Erholung danach, Nachfrage „Trainingsplan anpassen?“ (Modell 1.8.0, R23, 0.21.0) |
| ✅ M5.3 | Race-Setup | Material im Profil, Prognose nur mit Setup, Wirkung auf CdA/Crr, Neo, Laufschuhe (Prognose 1.1.0, 0.21.0) |

---

## Arbeitsweise (seit 17.11.2026)

Claude entwickelt und testet selbstständig und aktualisiert nach jedem Meilenstein die klickbare Vorschau (claude.ai-Artefakt „Ironman Planner – Vorschau“, gebaut mit `npm run build:preview` aus `tools/preview/`). Seit 0.7.1 laufen in Claudes Umgebung echtes `npm install`, Vitest, `tsc -b`, `vite build` und Browser-Tests am gebauten `dist`; jede Version wird als dist-ZIP ausgeliefert und seit 0.21.0 über das Repository `p-stammer/tri-trainer` per GitHub Pages veröffentlicht. Der Nutzer gibt Feedback zu Design und Funktion. Gerätetests auf dem iPhone (Installation, Offline in Safari, Teilen-Menü) macht der Nutzer mit dem gelieferten dist-ZIP.

## Arbeitsweise für jeden weiteren Schritt

1. `PROJECT_STATUS.md` lesen.
2. Prüfen, ob die neue Funktion zum Datenmodell passt; falls nicht: neue DB-Version planen.
3. Domänenlogik zuerst, mit Tests.
4. Dann Repository/Anwendungsfall, dann UI.
5. `PROJECT_STATUS.md` aktualisieren – nur tatsächlich Getestetes als getestet markieren.
