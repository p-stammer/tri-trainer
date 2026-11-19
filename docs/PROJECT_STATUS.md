# Projektstatus

Stand: 19.11.2026 · Version 0.21.1 · MVP 1 und MVP 2 komplett; Version 1.0: M3.1–M3.3 erledigt, **erste Fassung von „Plan vorschlagen“** (M3.5 vorgezogen); offen: iPhone-Teil von M1.4, Feinschliff M3.4/M3.5, M3.6

**Vorschau zum Ausprobieren:** claude.ai-Artefakt „Ironman Planner – Vorschau“, Stand 0.21.1 (In-Memory-Speicher mit Kopie im Browser, Beispieldaten über die gelbe Schaltfläche „Vorschau“; Downloads – Backup, CSV, Import-Vorlage – und Installation gehen dort nicht). Gebaut mit `npm run build:preview` aus `tools/preview/`.

## Implementiert

**Eingabefelder auf schmalen Bildschirmen, Repository ohne persönliche Angaben (0.21.1)**
- Datums- und Zeitfelder liefen auf dem iPhone über den rechten Rand (Safari gibt ihnen eine eigene Mindestbreite). Jetzt ohne native Darstellung, an die Containerbreite gebunden, Text links; alle Eingabefelder und Formularspalten dürfen schrumpfen (`min-width: 0`).
- Knöpfe brechen lange Beschriftungen um statt überzustehen; Auswahlleisten mit vielen Optionen (z. B. Leistungstests mit VO2max) gehen bei Bedarf in eine zweite Zeile; Sportfilter in Analysen und Verlauf umbrechen statt seitlich zu scrollen.
- Geprüft in WebKit (Safari-Engine, iPhone-Emulation) bei 390 und 320 px Breite über alle Bildschirme und geöffneten Formulare: kein Element mehr über dem rechten Rand (Ausnahme gewollt: seitlich scrollbarer Umfangsverlauf).
- Persönliche Angaben (Name, Geburtsdatum, Wettkampf) aus Code, Tests, Vorschau-Beispieldaten und Dokumentation entfernt; Beispiele heißen jetzt „Testdaten“. Die Git-Historie wurde danach neu begonnen (ein Commit), damit ältere Stände sie nicht mehr enthalten.

**Trainingslager, Race-Setup, GitHub Pages (0.21.0, Modell 1.8.0, Prognose 1.1.0)**
- **Hosting über GitHub Pages:** Repository `p-stammer/tri-trainer`; bei jedem Push auf `main` testet und baut ein GitHub-Actions-Workflow die App und veröffentlicht sie unter https://p-stammer.github.io/tri-trainer/. Umzug der Daten per Backup (README, Abschnitt 3).
- **Trainingslager** (Profil → „Trainingslager“): Name, Zeitraum (höchstens 4 Wochen), Trainingszeit pro Tag (0,5–8 h), Notiz; Hinweise bei Vergangenheit, Taper, Überschneidung und Camps über 14 Tage; nach Speichern/Löschen „Trainingsplan anpassen?“. Der Planer erhöht in Campwochen den Umfang vor allem auf dem Rad und im Wasser (locker, ≈ +50 % wie in Camp-Studien), Laufen bleibt bei den normalen Grenzen, danach Erholungswoche (× 0,6 bzw. 0,7); eine fällige Entlastung rückt vor das Camp; Camps im Taper werden mit Hinweis W12 ignoriert. Wochenarten „Trainingslager“ und „Erholung nach Trainingslager“, ⛺ im Umfangsverlauf. Regel R23, `TRAINING_SCIENCE.md` 2.16, `PLAN_MODEL.md` Änderung 26.
- **Race-Setup** (Profil): Rad (Zeitfahr-/Triathlonrad, Aero-Rennrad, Rennrad, Gravelbike), Aufleger, Laufräder, Reifen, Kleidung und Helm, Laufschuhe, Neo (mit/ohne/noch offen). **Die Zielzeit-Prognose erscheint nur mit hinterlegtem Race-Setup**, sonst Hinweis mit Knopf ins Profil (auch in Analysen). Das Setup bestimmt CdA und Rollwiderstand, Neo (3–7 %) und Carbonschuhe (≈ 0,5–2 %) – `PROGNOSIS_MODEL.md` 2a. Die alte Rad-Auswahl auf der Prognose-Seite entfällt (dient nur als Vorbelegung); Höhenmeter bleiben dort.
- DB-Version 7 (`trainingCamps`), Backup-Format 7 (ältere Backups werden ergänzt).

**Version 2.0, Teil 3: VO2max und erweiterte Analysen (0.20.0, M4.5 – Version 2.0 damit komplett)**
- **VO2max-Verlauf** (Leistungstests → „VO2max“): Methode (Labor, Cooper-Test mit Rechner, Sportuhr, Sonstige), Quelle, Datum; Verlauf mit Diagramm; Veränderung nur zwischen Werten derselben Methode, sonst Hinweis. Nur Dokumentation – fließt nicht in Planung, Zonen oder Prognose ein. Hinweis zur Genauigkeit von Uhr-Schätzungen (Metaanalyse).
- **Analysen:** „Belastung und Frische“ zeigt die Belastung (min × RPE) jetzt je Sportart gestapelt (inkl. Sonstiges), bei Sportfilter nur diese Sportart. Neu „Planerfüllung“: absolviert ÷ geplant je Woche mit 100-%-Marke, laufende Woche blass; Zusammenfassung über abgeschlossene Wochen (Ø, ≥ 90 %, 70–90 %, unter 70 %), gesamt oder je Sportart; mit „Plan“ über die ganze Vorbereitung.
- Neue Metrikart `vo2max_ml_kg_min` (Einheit ml/kg/min) – keine neue DB-Version, Backup-Format bleibt 6 (ältere App-Versionen lehnen solche Backups ab).

**Version 2.0, Teil 2: Gewichtung, Prognose-Verlauf, Szenarien (0.19.0, Modell 1.7.0)**
- **Dynamische Gewichtung der Disziplinen:** Vorschlag = 3 plus Signale – Umfang unter Rennanteil (+1), letzter Test ≥ 3 % schwächer als der Vortest (+1), Prognose-Zeitanteil ≥ 10 % über bzw. unter dem typischen Anteil von Altersklassen-Athleten (+1 / −1); automatisch 2–5. Planvorschlag zeigt neu „Gewichtung der Disziplinen“ mit Vorschlag, verwendeter Stufe und Gründen.
- **„Plan überprüfen?“:** „Neue Gewichtung vorgeschlagen – Laufen 4 → 5: …“, wenn sich der Vorschlag seit der Übernahme geändert hat (nicht im Modus manuell).
- **Prognose-Verlauf:** Diagramm der Prognose alle 2 Wochen rückwirkend (nur mit damals vorhandenen Werten), mit Spanne und Zielzeit.
- **Was wäre wenn:** FTP, Schwellenpace und CSS schrittweise verändern und sehen, wie sich die Prognose verschiebt (wird nicht gespeichert).

**Version 2.0, Teil 1: Leistungstests und Zielzeit-Prognose (0.18.0)**
- **Leistungstests** (`#/tests`, aus Profil → Zonen und Analysen): je Sportart Protokoll mit Rechner – Rad 20-min-Test (FTP = 95 %), Laufen 30-min-Lauf (Schwellenpace = Ø-Pace), Schwimmen 400/200 m (CSS = (t₄₀₀ − t₂₀₀)/2) – oder Wert direkt; Verlauf mit Diagramm und Veränderung zum Vortest (bei Pace „schneller ↑“), Löschen falscher Werte; jeder Test aktualisiert die Zonen. Analysen: „Leistungswerte“ erster → aktueller Wert.
- **Erinnerung „Leistungstest fällig“** auf „Heute“ ab 8 Wochen ohne Wert, nicht im Taper, mit Hinweis auf die (nächste) Entlastungswoche; „Diese Woche nicht“.
- **Zielzeit-Prognose** (`#/prognose`, Kurzfassung in Analysen), nur Langdistanz, Stand heute, immer als Spanne. Je Teildisziplin bis zu drei Schätzwege: Leistungswert (CSS + 4–12 s; FTP × 0,65–0,75 mit Leistungsmodell inkl. Rad-Typ, Gewicht und Höhenmetern; Schwellenpace × 1,18–1,35), Bestzeit (Marathon + 20–45 min, Halbmarathon/10 km über Riegel) und **absolviertes Training** der letzten 8 Wochen (Schwimm-Pace, lange Ausfahrten, lange Läufe). Wechsel 6–14 min. Vergleich mit der Zielzeit und den Formeln nach Rüst (Männer 2011, Frauen 2012) sowie „2 × 70.3“. Fehlt eine Disziplin, nennt die App, was fehlt. Modell: `PROGNOSIS_MODEL.md`.
- Neue optionale Felder: `profile.bestTimes`, `settings.prognosis` (Rad-Typ, Höhenmeter), `settings.testReminderDismissedWeek` (keine neue DB-Version, Backup-Format bleibt 6).

**Beschwerden als Signal, Wochenrückblick (0.17.0, Abschluss M3.6)**
- **„Plan überprüfen?“ bei Beschwerden:** Aktive Beschwerde mit Schmerz ≥ 4 (gleiche Schwelle wie der Steigerungsstopp im Planer, H9), Eintrag seit der Planübernahme und höchstens 14 Tage alt, ohne laufende Pause → Hinweis mit betroffenen Sportarten, Verweis auf ärztliche/physiotherapeutische Abklärung und Knopf „Pause eintragen“ (öffnet das Pausenformular mit der Beschwerde). Abklingende Beschwerden lösen nichts aus.
- **Wochenrückblick auf „Heute“** (Montag bis Mittwoch, für die Vorwoche): trainiert/geplant gesamt, je Sportart Ist/Soll in der eingestellten Zielgröße mit Quote, Schlüsseleinheiten, Ø Anstrengung, Frische, Sonstiges, Pausentage; „Woche ansehen“ (Wochen-Editor mit Vergleich) und „Ausblenden“ (gilt für die laufende Woche). Reine Beschreibung ohne Bewertung.

**Zone beim Erfassen, Ermüdung aus RPE (0.16.0, M3.6)**
- **Training erfassen:** Aus Dauer und Distanz zeigt die App für Laufen und Schwimmen die Durchschnittspace und die Zone („Ø 5:30 /km – liegt in Z2 Grundlage“), mit dem Hinweis, dass bei Intervallen die Zeit anders verteilt ist. Ohne Zonen: Pace plus Hinweis aufs Profil. Rad nicht (Geschwindigkeit ≠ Leistung). Zonenzeit wird nicht automatisch eingetragen; auf Wunsch „Gleichmäßig gelaufen? Ganze Dauer als Z2 eintragen“.
- **„Plan überprüfen?“ mit RPE:** Lockere Ausdauereinheiten (Regeneration, Grundlage, lang) der letzten 14 Tage (≥ 3 mit RPE, nach der Planübernahme) mit durchschnittlicher Anstrengung ≥ 6 – oder mindestens 1,5 Punkte über den 4 Wochen davor bei ≥ 5 – ergeben den Hinweis „Lockere Einheiten fühlen sich hart an“ mit „Diese/Nächste Woche entlasten“ (wie bei niedriger Frische; Schwellen **H**). Steht ohnehin eine Entlastungs- oder Taperwoche an, entfällt der Hinweis.

**Realistische Laufzonen (0.15.1, Modell 1.6.0)**
- Nutzer-Rückmeldung: Bei 3:55 /km Schwellenpace war Grundlage bis 4:27 /km (Friel) – schneller als ein Ironman-Marathon. Neu auf die Langdistanz ausgelegt: **Grundlage 150–128 % der Schwellenpace** (3:55 → 5:53–5:02 /km), Tempo 128–105 %, Schwelle 105–96 %. Leitregel: Grundlage nicht schneller als ein realistisches Ironman-Marathontempo (Herleitung TRAINING_SCIENCE 2.10).
- Bereits gespeicherte Zonen nach dem alten Schema heißen „altes Schema (Grundlage zu schnell)“ und werden zum Ersetzen angeboten; ein neuer Schwellenpace-Wert ersetzt sie automatisch. Manuelle Zonen bleiben unberührt.
- Planer: geschätztes lockeres Lauftempo (nur ohne eigenes Tempo) Schwellenpace × 1,4 statt × 1,25 (`im-gen-1.6.0`).

**Zonen-Vorschläge, Sonstiges in den Analysen, Woche entlasten (0.15.0)**
- **Zonen für Laufen und Schwimmen als Vorschlag** (R14, TRAINING_SCIENCE 2.10): Laufen aus der Schwellenpace (in 0.15.0 nach Friel, in 0.15.1 ersetzt – siehe oben), Schwimmen aus der CSS (Z2 ab CSS + 12 s, Z3 + 5 s, Z4 + 2 s, Z5 − 3 s pro 100 m). Beschriftet „nicht individuell validiert“. Ohne eigene Zonen werden sie beim Speichern des Ankerwerts berechnet; manuell festgelegte Grenzen bleiben, bis man „Vorschlag übernehmen“ tippt. Rad wie bisher (Coggan).
- **„Sonstiges / Cardio“ in den Analysen:** eigener Balken im Umfang (Ansicht „Alle“), Zeile in „Soll und Ist“ mit Gesamtzeit und Aufteilung nach Bezeichnung (z. B. Wandern 3:00 h), „ohne Ziel“.
- **„Diese Woche entlasten“ / „Nächste Woche entlasten“** auf der Karte „Plan überprüfen?“ bei Frische ≤ 3: ändert nur eine Woche (bis Mittwoch die laufende, danach die nächste) – Umfang und Zonenzeit −30 %, Kraft höchstens 1×, Phase Entlastung, Hinweis in der Wochennotiz; rückgängig im Änderungsverlauf. Steht ohnehin eine Entlastungs- oder Taperwoche an, entfällt der Frische-Hinweis.
- Analysen: erste Tabellenspalte mit Abstand (Sportart und Wert liefen ineinander).

**Anpassungsvorschläge und Vergleich (0.14.0, M3.4–M3.6)**
- **„Plan überprüfen?“ auf Heute** (M3.6, erste Fassung), nur bei übernommenem Planvorschlag. Gründe:
  - eine Sportart in beiden letzten Wochen unter 70 % der geplanten Zeit (Wochen mit Pause zählen nicht),
  - Laufen letzte Woche über 120 % der geplanten Zeit (Hinweis),
  - Frische ≤ 3 (letzte 14 Tage),
  - neuer Leistungswert (CSS, Schwellenpace, FTP) seit der Übernahme,
  - Plan stammt aus einer älteren Planlogik.
  „Plan aktualisieren“ öffnet den Planvorschlag (startet beim tatsächlichen Umfang aus den erfassten Einheiten), „Später“ blendet die Karte für die laufende Woche aus. Es wird nie automatisch geändert.
- **Planvorschlag: „Vergleich mit deinem Plan“** – Wochen, die schon Ziele haben, mit Vorher → nachher je Sportart, bevor man übernimmt.
- **Sensitivitätsanalyse** dokumentiert (`MODEL_VALIDATION.md`): Raster Regler × Budget × Laufumfang ohne Grenzverletzung, Einzeländerungen ±10 % wirken stetig; Budget ist der stärkste Hebel, der Regler ändert nur die Intensität.
- Hinweis „App ist offline nutzbar / Update verfügbar“ steht jetzt oben, damit er sich nicht mit anderen Meldungen überlagert.

**Umfangsverlauf, Vorbereitungsrennen, Historie (0.13.0, Modell 1.5.0)**
- **Umfangsverlauf auf der Plan-Seite** (und im Planvorschlag): gestapelte Wochenbalken je Sportart, seitlich scrollbar, Ansicht 4 / 12 Wochen / alle, Wochensumme in Stunden über jedem Balken, y-Achse mit groben Schritten (5/10/15/20 h, bei kleinen Umfängen 2 h bzw. 1 h) und dezenten Hilfslinien (0.13.1), absolvierte Zeit als dunkle Marke, Vorbereitungs- und Hauptwettkampf mit ⚑ markiert. Antippen zeigt die Woche ausgeschrieben: geplant gesamt und je Sportart, absolviert, Wettkampf, Gründe.
- **Vorbereitungswettkämpfe mit Wichtigkeit** (Training / Wichtig / Höhepunkt, Standard Training). Ein 5/10-km-Trainingslauf ändert den Plan nicht (nur eine Notiz in der Woche); lange Rennen bekommen auch als Training etwas Erholung.
- **Nachfrage nach Änderungen:** Nach Hinzufügen, Ändern oder Löschen eines Vorbereitungswettkampfs fragt die App „Trainingsplan anpassen?“, wenn schon ein Plan eingetragen ist → „Plan neu vorschlagen“ zeigt vorher genau, welche Wochen sich ändern.
- **Ausgangsumfang aus der Historie:** Wer seine Einheiten erfasst, bekommt den Plan ab seinem tatsächlichen Umfang der letzten 4 Wochen (je Sportart, wenn in ≥ 3 Wochen erfasst); bei Übernahme wird „Aktueller Trainingsumfang“ im Profil aktualisiert.
- **Historie bleibt immer erhalten** (jetzt zusätzlich getestet): Planänderungen ändern nur Wochenziele ab der Startwoche; absolvierte Einheiten, vergangene Wochen, Frische, Beschwerden bleiben unverändert; jede Planänderung ist rückgängig machbar.

**Rückmeldung mit Backup (0.12.0, Modell 1.4.0, 18.11.2026)**
- **Fehler behoben – Steigerung:** Die Wochengrenze bezog sich auf das Mittel der letzten drei Belastungswochen; dadurch wuchs der Umfang effektiv nur um etwa die Hälfte (+7,5 % angezeigt, ≈ 3,7 % tatsächlich). Jetzt Bezug letzte Belastungswoche (nach Pausen sanfter). Beispielplan: Laufen 1:30 h → 4:31 h statt 3:23 h, langer Lauf 2:15 h statt 1:41 h.
- **Distanzen für Laufen und Schwimmen** auch ohne km-Angabe im Ausgangsumfang: aus dem Tempo des längsten Laufs bzw. geschätzt aus Schwellenpace/CSS (als Schätzung gekennzeichnet). Mit der Einstellung „Zielgröße: Distanz“ zeigt „Heute“ dann km statt Stunden; die Gesamtzeit der Woche bleibt sichtbar.
- **Sonstiges / Cardio:** beim Erfassen Vorschläge (Wandern, Cardio-Gerät, Skilanglauf, Rudern, Ballsport, Klettern, Yoga/Mobility) oder eigene Bezeichnung; erscheint im Verlauf mit Bezeichnung und auf „Heute“ als eigene Zeile, zählt zur Gesamtzeit, nicht zu den Wochenzielen.
- Schwimm-Untergrenze richtet sich nach der Schwimm-Priorität; Warnung zum langen Lauf nennt den begrenzenden Grund.

**Regler = Intensität, nicht Zeit (0.11.1, Modell 1.3.0)**
- „Konservativ“ heißt jetzt weniger Intensität, nicht weniger Trainingszeit. Obergrenze (Langdistanz 19 h, Mitteldistanz 16 h, olympisch 12 h, Sprint 9 h), Rad/Schwimm-Steigerung (+15 %), langer Lauf (höchstens 3:00 h) und Entlastungstiefe (−30 %) sind für alle Reglerstellungen gleich.
- Der Regler ändert: Anteil locker 90 ↔ 70 %, pyramidal ↔ polarisiert, Anteil sehr harter Intervalle, Renntempo im Laufen, Lauf-Steigerung +5 ↔ +10 % (Rest aufs Rad), Kraft 2 ↔ 1×. Im Beispielplan: Gesamtzeit Regler 0 vs. 100 rund 1 % Unterschied, harte Intensität mehr als doppelt so viel.
- Text unter dem Regler zeigt getrennt, was er ändert und was nicht.
- Fehler behoben: Nach „Ausgangslage speichern“ blieb der Bearbeiten-Bereich manchmal offen.

**Planmodell 1.2.0 (0.11.0, Rückmeldung zum ersten Planvorschlag)**
- **Obergrenze Wochenumfang** nach Distanz und Regler, abgeleitet aus dem Trainingsumfang von Freizeit-Finishern (Langdistanz 13,9 ± 5,0 h/Woche): Langdistanz 12 h (konservativ) bis 20 h (ambitioniert), Mitteldistanz 10,5–16 h, olympisch 7–12 h, Sprint 5–9 h. Ein höheres Zeitbudget erhöht den Plan nicht mehr darüber hinaus (Hinweis „Die übrige Zeit bleibt frei“). Wer schon mehr trainiert, wird nicht heruntergezwungen.
- **Warnung bei zu wenig Zeit** für die Distanz (Langdistanz unter 9 h Hinweis, unter 6 h deutliche Warnung; andere Distanzen eigene Schwellen).
- **Entlastungswochen fest jede 4. Woche** (ab 50 Jahren jede 3.), unabhängig vom Regler; zusätzlich adaptiv bei niedriger Frische.
- **Regler mit mehr Wirkung an den Enden** (nichtlineare Kurve, breitere Spannen): 90 ↔ 70 % locker, Laufsteigerung 3 ↔ 10 %/Woche, Spitzenumfang 12 ↔ 20 h, langer Lauf höchstens 2:30 ↔ 3:00 h, Entlastung −40 ↔ −20 %. Die Werte stehen direkt unter dem Regler.
- Quellen und Begründung: `TRAINING_SCIENCE.md` 2.13, 3.2, 3.6 (neu: Mitteldistanz-Studie, Verletzungsdaten Langdistanz, Metaanalyse Vorhofflimmern mit sehr geringer Evidenz).

**Umzug und Hosting (0.10.1)**
- Erster Start: „Schon ein Backup? Daten übernehmen“ – Backup-Datei wählen, Vorschau prüfen, übernehmen; die Einrichtung entfällt. Für den Umzug auf eine neue Adresse/ein neues Gerät.
- Grund: Netlify blendet bei neuen Gratis-Projekten (seit 19.08.2026) ein „Powered by Netlify“-Abzeichen über der App ein; im Test ließ es sich weder in den Projekteinstellungen noch über „Hide this badge“ entfernen. Empfehlung jetzt: Cloudflare Pages (Direct Upload per ZIP), Anleitung im README.

**Plan vorschlagen (0.10.0, M3.3 + erste Fassung M3.5)**
- Plan → „Plan vorschlagen lassen“ (bei leerem Plan als Karte oben, sonst unter der Wochenliste). Route `#/plan/vorschlag`.
- Einstellungen (werden je Plan gespeichert): Regler „Konservativ, Langlebigkeit ↔ Zeitoptimiert, ambitioniert“ mit Klartext (Anteil locker, Entlastungsrhythmus, Steigerungsgrenzen, Kraft), Start diese/nächste Woche, Taper 1–3 Wochen, Prioritäten automatisch/hybrid/manuell (1–5 je Disziplin), Freiwasser ab Datum.
- Ausgangslage direkt im Bildschirm: Zeitbudget, aktueller Umfang je Sportart, längster Lauf der letzten 30 Tage. Fehlt etwas, fragt die App nach (kein Plan mit geschätzten Werten).
- Vorschau: Hinweise/Warnungen (z. B. „langer Lauf bis zum Taper knapp“), Verlaufsdiagramm je Woche und Sportart, aufklappbare Wochen mit Dauer, Distanz, Einheitenzahl, Zonen und Schlüsseleinheiten (langer Lauf, lange Ausfahrt, Rad-Intervalle, Koppellauf, Freiwasser), „Warum so?“ mit Regelverweisen. Keine Wochentage.
- „Plan übernehmen“ schreibt die Wochen als Änderung „Plan vorgeschlagen …“ (Art `generated`) in den Änderungsverlauf – Rückgängig dort. Leere Wochen bekommen den Vorschlag als ursprünglichen Plan.
- Engine `src/engine/` (Modell `im-gen-1.1.0`): Module A–I als reine Funktionen; zweite Prüfung aller harten Grenzen – bei einer Verletzung ist „Übernehmen“ gesperrt.
- Modelländerungen gegenüber 1.0.0 (bei der Umsetzung gefunden): Steigerungsbezug nur auf Belastungswochen (sonst stagnierte der Plan nach jeder Entlastung), Einstiegsumfang für Sportarten ohne aktuelles Training, Mindest-Schwimmumfang, lange Ausfahrt bis 60 % des Radumfangs – Details `PLAN_MODEL.md`, Abschnitt „Änderungen 1.0.0 → 1.1.0“.
- Vorschau-Artefakt: Beispieldaten enthalten jetzt einen Halbmarathon als Vorbereitungswettkampf.

**Modelldefinition und Vorbereitungswettkämpfe (0.9.0, M3.2)**
- `docs/PLAN_MODEL.md` (Modellversion `im-gen-1.0.0`): Module A–I, Eingaben und Pflichtangaben, Formeln für Phasen, Wunschverlauf, harte Grenzen, Intensität, Schlüsseleinheiten, Prioritäten, Warnungen W1–W8, Rechenbeispiel. Noch **kein** Planvorschlag in der App – der Generator folgt in M3.3–M3.5.
- `src/engine/params.ts`: Philosophie-Regler (0 = konservativ/langlebig … 100 = zeitoptimiert) mit allen interpolierten Parametern und festen Werten; `src/engine/limits.ts`: harte Grenzen (Steigerung gegenüber dem Mittel der drei Vorwochen, Start beim aktuellen Umfang, langer Lauf, Entlastung, Abrunden); `src/engine/types.ts`: Ein- und Ausgabetypen des Generators.
- Profil → **Vorbereitungswettkämpfe**: beliebig viele hinzufügen, Datum und Distanzen jederzeit ändern, löschen; Vorlagen (Sprint, olympisch, 70.3, 10 km, Halbmarathon, Marathon, Radmarathon, Freiwasser-Langstrecke); Anzeige der Einstufung für den Planer (kurz/mittel/lang); Hinweise bei Datum in der Vergangenheit, am/nach dem Hauptwettkampf, im Taper oder weniger als eine Woche neben einem anderen Rennen.
- Gespeicherte Planer-Einstellungen je Plan (Regler, Prioritätsmodus, Prioritäten getrennt nach gewünscht/vorgeschlagen/übernommen, Taperdauer, Freiwasser ab, individuelle Höchstwerte, längster Lauf/längste Ausfahrt) – noch ohne Bildschirm, kommt mit M3.5.
- DB-Version 6 (Tabellen `prepRaces`, `generatorSettings`), Backup-Format 6 mit Migration von 1–5.

**Planimport (0.8.0, M2.6)**
- Plan → „Plan importieren“ (bei leerem Plan zusätzlich als Karte oben). Quellen: CSV-Datei (Semikolon, Komma, Tabulator; BOM; Anführungszeichen), JSON-Datei (Liste von Wochen, auch unter `weeks`/`wochen`; verschachtelte Werte werden zu Spalten wie `lauf.km`), eingefügte Tabelle aus Excel/Numbers/Google Tabellen; Schalter „Erste Zeile enthält Überschriften“
- Woche als Datum (beliebiger Tag → Montag, mit Hinweis), Kalenderwoche (optional mit Jahr; mehrdeutige KW wird gemeldet) oder Trainingswoche 1…n
- Felder: Phase (deutsch/englisch erkannt), Notiz, je Sportart Dauer (h oder min; „5,5“, „5:30“, „1h30“, „90 min“), Distanz (km oder m; „3,8 km“, „3800 m“), Anzahl Einheiten
- Automatische Zuordnung aus den Überschriften (auch zusammengesetzte Wörter wie „Trainingswoche“, „Dauerlauf km“); aus den Werten erratene Einheiten sind als „vermutet – bitte prüfen“ markiert; jede Spalte per Auswahl änderbar; Prüfung der Zuordnung mit Klartextfehlern
- Leere Zellen: wahlweise „Ziel entfernen“ (Plan wie Tabelle) oder „Bisheriges behalten“ – nie 0, nie geschätzt, keine Umrechnung zwischen Dauer und Distanz
- Unklare Werte (keine Zahl, „1.500“ mehrdeutig, Dezimalzahl bei Einheiten, unplausibel hoch, unbekannte Phase) werden mit Zeile und Spalte gemeldet und nicht übernommen; der bisherige Wert bleibt. Zeilen außerhalb des Planzeitraums und doppelte Wochen werden übersprungen und gemeldet
- Nur zugeordnete Felder ändern sich; Schwerpunkte, Zonenziele, Frischebereich und nicht genannte Wochen bleiben unberührt; es werden keine Wochen angelegt oder gelöscht
- Vorschau Vorher/Nachher je Woche, Übernahme als Eintrag „Plan importiert …“ im Änderungsverlauf mit Rückgängig; bei bisher leeren Wochen wird der Import zum ursprünglichen Plan
- CSV-Vorlage mit allen Planwochen zum Ausfüllen in Excel/Numbers
- Neue Änderungsart `import` (keine neue DB-Version, Backup-Format bleibt 5)

**Build-Prüfung mit echten Bibliotheken (0.7.1)** – keine neuen Funktionen, nur Korrekturen aus dem ersten echten `npm install`/`build`:
- Typfehler TS2589 („Type instantiation is excessively deep“) in `src/data/dexieBackend.ts` behoben: Die Datenbank wird jetzt über `createPlannerDb()` statt über die Unterklasse `PlannerDexie` erzeugt. Schema und Versionsblöcke 1–5 sind unverändert, gespeicherte Daten bleiben gültig.
- Hinweis „Die App ist jetzt offline nutzbar.“ lag beim ersten Start über dem „Weiter“-Knopf der Einrichtung und blockierte ihn. Er blendet sich jetzt nach 4 Sekunden aus; der Update-Hinweis bleibt stehen, bis man reagiert.
- Neuer Test: Upgrade einer DB-Version-1-Datenbank auf Version 5 mit vorhandenen Daten.
- `package-lock.json` liegt jetzt bei (feste, getestete Versionen).

**Domäne (`src/domain`)**
- Kalender: lokale Kalendertage, Wochen ab Montag, ISO-Kalenderwochen, „heute“ in Europe/Berlin
- Einheiten: Meter/Sekunden intern, Pace min/km und min/100 m, km/h, deutsche Zahlen-Ein-/Ausgabe
- Datenmodell als Zod-Schemas (Einstellungen, Profil, Wettkampf, Plan, Woche mit Original/aktuell, Einheit, Zonen, Leistungswerte)
- Soll-Ist je Woche und Sportart (Dauer, Distanz, Anzahl), Zonen geplant/absolviert, unbekannte Zonenzeit, Schwerpunkte, Gesamtziel nur bei vollständigen Dauerzielen
- Wettkampf-Kalender: Countdown, Trainingswoche x von y, Restwochen, Fortschritt, Status
- Plan-Operationen: Wochen aus Datum erzeugen, Abgleich nach Datumsänderung ohne Löschen, Skalieren, Kopieren, Original-Erhalt
- Session-RPE-Belastung mit Vollständigkeit (noch ohne Anzeige)
- Rad-Zonen aus FTP (Coggan), Prüfung manueller Zonengrenzen
- Backup-Format v1 mit Validierung und Klartextfehlern, CSV-Export (Semikolon, Dezimalkomma, BOM)

**Daten (`src/data`)**
- Repository mit Validierung bei jedem Schreiben und Änderungsbenachrichtigung
- IndexedDB über Dexie (DB-Version 1), In-Memory-Backend für Tests
- Anwendungsfälle: Onboarding, Wettkampf ändern, Woche speichern, Woche kopieren, Einheit erfassen/ändern

**Frische (seit 0.2.0)**
- Wöchentlicher Check-in (Frische 1–10, optional Schlaf, Muskelkater, Motivation, Wohlbefinden 1–5, Notiz), ein Eintrag pro Woche
- Gewünschter Frischebereich je Planwoche im Wochen-Editor
- Hinweis bei Werten unter/über dem Zielbereich (ohne Zielbereich bei ≤ 3 bzw. ≥ 9), „Als geprüft markieren“, Verweis auf den Wochen-Editor – keine automatische Planänderung
- Gesundheit-Bildschirm: Frischeverlauf (SVG-Diagramm mit Zielbändern), Wochenvergleich Frische/Umfang/Session Load mit Datenvollständigkeit
- DB-Version 2 (Tabelle `wellness`), Backup-Format 2 mit Migration von Format 1

**Beschwerden und Pausen (seit 0.3.0)**
- Beschwerde erfassen: Körperstelle (17 Regionen), Seite, Schmerz 0–10, betroffene Sportarten, Beschreibung; Status aktiv/klingt ab/abgeklungen
- Verlauf je Beschwerde (Einträge über mehrere Tage, Diagramm, Wochen-Gegenüberstellung mit Trainingszeit ohne Kausalaussage), wiederholt betroffene Stellen, abgeklungene Beschwerden
- Trainingspause (gesamt oder einzelne Sportarten, offenes oder festes Ende, Grund, Verknüpfung mit Beschwerde); deutliches Banner auf „Heute“; Sportart zeigt „pausiert“ statt „noch …“; Hinweis beim Erfassen während einer Pause
- Vorschlag zur Planänderung bei Pausen mit Enddatum: Vorher/Nachher je Woche, Übernehmen / Manuell bearbeiten / Ablehnen; nie Nachholen
- Schnellaktionen auf „Heute“: Training, Frische, Woche planen, Beschwerde
- DB-Version 3, Backup-Format 3 (Migration von 1 und 2)

**Erweiterter Plan-Editor (0.7.0)**
- Plan → „Auswählen“: Wochen per Antippen oder Zeitraum (von/bis) auswählen; Sammelaktionen Phase setzen, Umfang ±10/20 % (wählbare Sportarten), Ziele einer Quellwoche übernehmen, Frischebereich setzen/entfernen
- Jede Sammeländerung mit Vorschau (Vorher → Nachher je Woche, bei vielen Wochen kompakt) und Bestätigung
- Änderungsverlauf im Plan: jede Planänderung (Woche bearbeiten, kopieren, Sammeländerung, Pausen-Vorschlag) mit Zeitpunkt; „Rückgängig“, solange die Wochen nicht weiter geändert wurden
- Wochen-Editor: Vergleich Ursprünglich / Aktuell / Absolviert je Sportart
- Lauf-Symbol neu gezeichnet (Läufer mit gefülltem Kopf in Schrittstellung)
- DB-Version 5, Backup-Format 5

**Analysen und Einrichtung (0.6.0)**
- Einrichtung beim ersten Start in 4 Schritten: Wettkampf (Pflicht), Über dich (Name, Geburtsdatum, Geschlecht, Größe, Gewicht), Trainingsumfang je Sportart + Zeitbudget, Leistungswerte (FTP, Schwellenpace, CSS mit Datum und Methode; FTP leitet Rad-Zonen ab)
- Tab „Analysen“ (ersetzt „Verlauf“): Zeiträume Woche/4/12 Wochen/Plan, Sportfilter; Umfang als gestapelte Wochenbalken mit Wochenziel, je Sportart Dauer/Distanz/Einheiten; Soll-Ist-Tabelle (nur Wochen mit Ziel); Intensität je Sportart mit Zonenanteilen, geplant/absolviert, Anteil ohne Zonenangabe, Fokus-Zählung; Belastung (min × RPE) mit gleitendem 4-Wochen-Mittel und Datenvollständigkeit, Frische je Woche daneben
- Sportfarben farbsehschwäche-sicherer angepasst (Rad heller, Laufen dunkler)

**Feedback-Runde 1 (0.5.0)**
- Pace-Eingabe für CSS, Schwellenpace und Pace-Zonengrenzen als Minuten : Sekunden (vorher Text mit „:“, auf dem iPhone-Zahlenblock nicht eingebbar)
- Profil und Onboarding: „Aktueller Trainingsumfang“ je Sportart (km, Stunden, Einheiten pro Woche, Bezugszeitraum) statt „Triathlon-Erfahrung in Jahren“; Wochenzeit klar als „Zeitbudget“ (Obergrenze für Planvorschläge) benannt
- Darstellungsfehler behoben: abgeschnittene Stunden/Minuten-Felder bei Krafttraining im Wochen-Editor und in der Vorlage
- Krafttraining: Fokus auf schnelles Abhaken – Plus → Kraft → Vorlage antippen → Speichern (Dauer aus der Vorlage), oder in der Bibliothek „✓ Erledigt“; Satzdetails bleiben optional („Mit Sätzen“) und können später ergänzt werden

**Krafttraining (seit 0.4.0)**
- Vorlagen-Bibliothek: Name, Schwerpunkt, Beschreibung, geplante Dauer, Übungen (Sätze, Wiederholungen oder Zeit, Gewicht, Pause, RPE/RIR, Notiz), Reihenfolge änderbar
- Workout durchführen: Sätze abhaken, tatsächliche Wiederholungen/Gewichte, Übung überspringen, Satz hinzufügen, Notizen, „Zuletzt“-Werte der Übung, Fortschritt wird laufend gespeichert (laufendes Workout überlebt Schließen der App)
- Abschluss mit Dauer (aus Startzeit vorgeschlagen), RPE, Notiz → erzeugt eine Kraft-Einheit, die in Wochenzielen und Verlauf zählt; nachträgliche Bearbeitung aktualisiert dieselbe Einheit
- Einstiege: Plus → Kraft → „Mit Vorlage trainieren“, „Krafttraining“ im Wochenfortschritt auf „Heute“, Banner bei laufendem Workout; Einheit im Verlauf → „Workout-Protokoll öffnen“
- DB-Version 4, Backup-Format 4

**Oberfläche (`src/ui`)**
- Onboarding (Wettkampf, Distanz-Vorlagen, Vorbereitungsbeginn, Zielzeit, optionale Profildaten)
- Dashboard: Countdown, Trainingswoche, KW, Phase, Wochenfortschritt je Sportart, Schwerpunkte, Intensität inkl. unbekannter Zeit, Einheiten der Woche, Backup-Erinnerung
- Plan-Übersicht und Wochen-Editor (Phase, Dauer/Distanz/Anzahl, Zonenziele, Schwerpunkte, Notizen, ±10/20 %, in Folgewochen übernehmen, ursprünglicher Plan)
- Training erfassen/bearbeiten/löschen mit optionalen Zonen, RPE, Notiz, Schwerpunkt-Zuordnung
- Verlauf nach Kalenderwochen mit Sportart-Filter
- Tableiste: Heute, Plan, Plus, Verlauf, Gesundheit; Profil über das Personen-Symbol auf „Heute“
- Profil: Wettkampf bearbeiten, Athletenprofil, FTP/Schwellenpace/CSS speichern, Zonen, primäre Zielgröße, Hell/Dunkel/System, Backup/CSV/Restore
- PWA-Manifest, Icons, Service Worker mit Update-Hinweis, Safe Areas, Dunkelmodus

## Tatsächlich getestet

### Version 0.21.1 (19.11.2026)

`npm test` **237/237**, Typprüfung, Build. Neue Layoutprüfung in WebKit (iPhone-Emulation, 390 und 320 px): Einrichtung (4 Schritte), Backup-Vorschau, 17 Bildschirme, Profilformulare, Erfassen je Sportart, Leistungstests je Sportart – kein Überlauf. Regression: 0.21 31/31, 0.20 8/8, 0.19 7/7, 0.18 25/25, 0.17 7/7, 0.16 8/8, 0.15 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12. Auf einem echten iPhone nicht geprüft.

### Version 0.21.0 (19.11.2026)

`npm test` **237/237** in 26 Dateien (neu: Trainingslager-Engine – Campbudget, volle Campwoche, Entlastung vor dem Camp, Teilwoche + Camp im Taper ignoriert, wenige Stunden, Raster Regler × Budget × Camp × Stunden ohne Verletzung harter Grenzen; Camp-Hinweise und -Schema; Race-Setup – Sperre ohne Setup, Planer-Annahme, Material-Richtungen Rad/Neo/Carbon, CdA/Crr). Typprüfung, Build. Browser-Test mit einem Test-Backup (Uhr 02.12.2026) **31/31**: Prognose ohne Setup gesperrt (Analysen und Prognose-Seite, Knopf ins Profil), Race-Setup speichern (Aufleger-Frage nur ohne TT-Rad), Prognose erscheint (≈ 10:10 h, Neo- und Carbon-Hinweis), Gravel ohne Aufleger + lockere Kleidung ≈ 10:45 h; Trainingslager 20.–27.03.2027 mit 5 h/Tag: Wirkungshinweis, Nachfrage „Trainingsplan anpassen?“ (bleibt nach Abbrechen), Hinweis Taper, > 4 Wochen gesperrt, Vorschlag mit Wochenart, ⛺ und Begründung; übernommen: Wochen 12,0 → 15,0 → 17,8 → 7,5 h (vorher 12,0 / 12,2 / 8,5 / 12,6 h), Rad deutlich mehr, Laufen normal; Löschen mit erneuter Nachfrage. Regression (mit Race-Setup im Backup): 0.20 8/8, 0.19 7/7, 0.18 25/25, 0.17 7/7, 0.16 8/8, 0.15 13/13, Plan vorschlagen 21/21, Basis 17/17 (DB-Version 7), Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.20.0 (18.11.2026)

`npm test` **227/227** in 26 Dateien (neu: Cooper-Formel, VO2max-Verlauf nur gleiche Methode vergleichbar, VO2max zählt nicht als fälliger Test; Belastung je Sportart, Planerfüllung gesamt/je Sportart inkl. fehlender Dauerziele, Zusammenfassung). Typprüfung, Build. Browser-Test mit einem Test-Backup (Uhr 02.12.2026) **8/8**: drei Läufe mit RPE → Analysen „Plan“ zeigt Planerfüllung (Laufen: 1 abgeschlossene Woche, Ø 125 %), Belastung mit Legende je Sportart; VO2max: Cooper 2,8 km → 51,3, Uhr 54,0 (Garmin) → Verlauf mit Methode und Quelle, Hinweis „verschiedene Methoden“, kein Vergleichspfeil. Regression: 0.19 7/7, 0.18 25/25, 0.17 7/7, 0.16 8/8, 0.15 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.19.0 (18.11.2026)

`npm test` **225/225** in 26 Dateien (neu: Referenzanteile, ausgeglichene Prognose ohne Änderung, relativ langsames Laufen +1 / starkes Rad −1, Testverschlechterung +1, Alters- und Abstandsgrenzen; Hinweis „Neue Gewichtung“ und Vorrang des Modellhinweises; Prognose-Verlauf nur mit damaligen Werten; Szenario). Typprüfung, Build. Browser-Test mit einem Test-Backup **7/7**: Planvorschlag zeigt Gewichtung (Schwimmen 3 / verwendet 2 hybrid, Rad 3, Laufen 4), Übernahme speichert Vorschläge, kein Hinweis direkt danach; Lauftest 5,6 km in 30 min → „Neue Gewichtung vorgeschlagen – Laufen 4 → 5“; Uhr 23.12. → Verlauf mit 3 Stichtagen, FTP + 20 W → „−10 min“. Regression: 0.18 25/25, 0.17 7/7, 0.16 8/8, 0.15 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.18.0 (18.11.2026)

`npm test` **218/218** in 25 Dateien (neu: Testrechner, Verlauf und Fälligkeit; Prognose: Leistungsmodell Rad inkl. Höhenmeter, Teil- und Gesamtspannen, Trainings-Schätzwege mit Zeitfenster, fehlende Disziplin, Bestzeiten mit Riegel, Formeln nach Rüst, 70.3-Regel, nur Langdistanz), Typprüfung, Build. Browser-Test mit einem Test-Backup **25/25**: kein Hinweis bei frischen Werten; 20-min-Test 274 W → FTP 260 W (▲ 4 %, Diagramm, Rad-Zonen neu); 30-min-Lauf 7,83 km → 3:50 /km; CSS-Test 6:10/2:52 → 1:39 (▼), Löschen; Analysen „250 W → 260 W“; Uhr auf 15.01.2027 → Erinnerung nur Schwimmen, „Diese Woche nicht“; Prognose ca. 9:55 h (9:10–10:45) → 1 200 Hm → ca. 10:10 h → Marathon 3:15 und olympisch 2:25 → Formel nach Rüst und Lauf „aus deiner Bestzeit“, Bestzeiten im Profil gespeichert. Regression: 0.17 7/7, 0.16 8/8, 0.15 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.17.0 (18.11.2026)

`npm test` **209/209** in 22 Dateien (neu: Beschwerde-Signal inkl. Pause, abklingend, vor der Übernahme, Schmerz < 4; Wochenrückblick: Sichtbarkeit Mo–Mi, Zielgröße je Sportart, Kraft nach Einheiten, Schlüsseleinheiten, RPE, Frische, offene Pause), Typprüfung, Build. Browser-Test mit einem Test-Backup **7/7**: Beschwerde Wade links, Schmerz 5, Laufen → Karte nennt sie → „Pause eintragen“ öffnet Pausenformular; Uhr auf Montag 30.11. → „Rückblick KW 48“ (1:35 h von 11:42 h, Laufen 99 %, Ø Anstrengung 4) → Ausblenden bleibt nach Neuladen; Donnerstag kein Rückblick. Regression: 0.16-Test 8/8, 0.15-Test 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.16.0 (18.11.2026)

`npm test` **205/205** (neu: Durchschnittspace → Zone inkl. Schwimmen, Tippfehler und Rad; RPE-Signal absolut, Anstieg, nur lockere Einheiten, Mindestzahl, erst nach Planübernahme). Typprüfung, Build. Browser-Test mit einem Test-Backup (Uhr 25.11.2026) **8/8**: ohne Zonen nur Pace, nach Übernahme der Laufzonen 5:30 /km → Z2, 4:27 /km → Z3, „Ganze Dauer als Z2“ speichert 55 min Z2; drei lockere Läufe mit RPE 7/7/6 → Karte „Lockere Einheiten fühlen sich hart an … 6,7“ → „Diese Woche entlasten“ → Eintrag „Entlastung nach hohem RPE bei lockeren Einheiten (Ø 6,7)“, Hinweis erledigt. Regression: 0.15-Test 13/13, Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.15.1 (18.11.2026)

`npm test` **203/203** (Zonentest neu: 3:55 → Grundlage 5:53–5:02 /km, 4:27 /km und 5:01 /km sind Tempo, Planer-Tempo 5:29 /km liegt in Z2), Typprüfung, Build. Browser-Test mit einem Test-Backup 13/13 (Vorschlag zeigt 5:53–5:02 und 5:01–4:08, Übernahme speichert `derived_run_pace` mit [353, 301, 247, 226]). Regression: Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.15.0 (18.11.2026)

`npm test` **203/203** in 20 Dateien (neu: Zonen-Ableitung Laufen/Schwimmen inkl. Plausibilität, manuelle Zonen bleiben, Sonstiges je Woche und nach Bezeichnung, Entlastungswoche bis Mittwoch/danach, Frische-Hinweis entfällt bei anstehender Entlastung), Typprüfung, Build. Browser-Test mit einem Test-Backup (Uhr auf 25.11.2026 gestellt) 13/13: Zonen-Vorschlag Laufen 5:03/km-Grenze und Schwimmen 1:42/100 m, Übernahme speichert `derived_friel_pace`; Wandern erscheint in den Analysen; Frische 2 → „Diese Woche entlasten“ → Woche 23.11. Phase Entlastung, 9:42 h → 6:47 h, Folgewoche unverändert, Eintrag im Änderungsverlauf. Regression: Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.14.0 (18.11.2026)

`npm test` **194/194** in 19 Dateien (neu: 6 Tests Anpassungsvorschläge), Typprüfung, Build. Browser-Test mit einem Test-Backup: Daten übernehmen beim ersten Start → Karte „Plan überprüfen?“ (ältere Planlogik 1.3.0) → „Plan aktualisieren“ → „Vergleich mit deinem Plan“ mit Vorher → nachher → „Später“ blendet aus (4/4). Regression: Plan vorschlagen 21/21, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.13.0 (18.11.2026)

`npm test` **188/188** (neu: 10 km als Training ändert keine Wochenziele, Halbmarathon als Höhepunkt mit Mini-Taper, Marathon auch als Training mit Erholung, Historie vor Profil, längster Lauf aus Historie, Übernahme aktualisiert Profil und lässt Einheiten und vergangene Wochen unverändert), Typprüfung, Build. Browser-Tests: Plan vorschlagen 21/21 (neu: Umfangsverlauf mit allen Wochen, 4-Wochen-Ansicht mit Summen, Wichtigkeit, Nachfrage „Trainingsplan anpassen?“ → Planvorschlag), Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.12.0 (18.11.2026)

`npm test` **182/182** (neu: echte Steigerung um g pro Belastungswoche, sanfter Wiedereinstieg nach Pause, Fallbeispiel: Laufen > 4 h, Distanzen aus eigenem Tempo bzw. CSS), Typprüfung, Build; einem Test-Backup vom 18.11. wird von 0.12.0 fehlerfrei gelesen. Browser-Tests: Plan vorschlagen inkl. Sonstiges/Cardio 16/16, Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.11.1 (17.11.2026)

`npm test` 179/179 (neu: Gesamtzeit Regler 0 vs. 100 unter 3 % Unterschied, harte Intensität bei 100 mehr als doppelt so hoch; 30 h Budget → höchstens 19 h bei jeder Reglerstellung), Typprüfung, Build. Browser-Tests: Plan vorschlagen 14/14 (dreimal hintereinander, nach Behebung eines zeitabhängigen Anzeigefehlers), Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.11.0 (17.11.2026)

`npm test` **179/179** (neu u. a.: 30 h Budget → höchstens 12 h bzw. 20 h je Regler, 4 h Langdistanz → deutliche Warnung, 8 h → Hinweis, Mitteldistanz-Norm, kein Herunterzwingen bei hohem Ausgangsumfang, gleicher Entlastungsrhythmus bei Regler 0 und 100, Reglerkurve), Typprüfung, Build. Browser-Tests: Plan vorschlagen 14/14 (Regler 0 zeigt „Laufen bis +3 %“ und „Spitzenwoche höchstens 12:00 h“), Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Umzug 5/5, Vorschau 12/12.

### Version 0.10.1 (17.11.2026)

`npm test` 173/173, Typprüfung, Build. Browser-Test Umzug **5/5**: Backup in App A sichern (Download) → frischer Speicher (wie neue Adresse) → „Daten übernehmen“ auf dem ersten Bildschirm → Dashboard mit Wettkampf, nach Neuladen erhalten, Wiederherstellen im Profil weiter vorhanden. Regression: Basis 17/17, Planimport 17/17, Vorbereitungswettkämpfe 12/12, Plan vorschlagen 14/14, Vorschau 12/12. Cloudflare Pages selbst wurde nicht getestet (kein Zugang aus Claudes Umgebung).

### Version 0.10.0 (17.11.2026, echte Bibliotheken)

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **173/173** Tests in 18 Dateien (neu: 31 in `engine/generate.test.ts` mit Validierungsfällen A–H, Grenz-Raster, Determinismus, Sensitivität; 1 Anwendungsfall Übernahme → Backup → Rückgängig) |
| `npm run typecheck` | fehlerfrei |
| `npm run build` | erfolgreich, Precache 16 Einträge (738 KiB) |
| Browser-Test „Plan vorschlagen“ am gebauten `dist` | **14/14**, keine Konsolenfehler: Einstieg über die Plan-Karte · ohne Angaben Nachfrage statt Plan · Ausgangslage eintragen (10 h, 1 h Laufen / 10 km, längster Lauf 6 km) · Vorschlag mit Verlauf, Wochen, Begründung · Warnung „langer Lauf knapp“ · Regler 0 ändert Rhythmus und Laufgrenze · Woche 1 Laufen ≤ 1:06 h, langer Lauf 6 km · Übernahme: 33 Wochen in IndexedDB, Art `generated`, Prioritäten gespeichert · Rückgängig leert alle Wochen · Einstellungen bleiben erhalten · Dunkelmodus |
| Browser-Tests Basis / Planimport / Vorbereitungswettkämpfe | **17/17**, **17/17**, **12/12** |
| Browser-Test Vorschau | **12/12** (neu: Plan vorschlagen mit Beispieldaten inkl. Halbmarathon, Übernahme); einziger Konsoleneintrag: fehlendes `favicon.ico` des Testservers |

### Version 0.9.0 (17.11.2026, echte Bibliotheken)

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **141/141** Tests in 17 Dateien (neu: 11 in `engine/limits.test.ts` inkl. Rechenbeispiel aus PLAN_MODEL, 4 in `prepRace.test.ts`, DB-Version-6-Test mit Backup-Rundlauf, Backup-Migration 5 → 6) |
| `npm run typecheck` | fehlerfrei, inkl. `tools/preview` |
| `npm run build` | erfolgreich, `sw.js` und Manifest erzeugt, Precache 16 Einträge (695 KiB) |
| Browser-Test Vorbereitungswettkämpfe am gebauten `dist` | **12/12**, keine Konsolenfehler: IndexedDB-Version 6 mit neuen Tabellen · leere Liste · Vorlage füllt Name und Distanz · Einstufung „mittel“ · Hinweis „weniger als eine Woche Abstand“ · zwei Rennen in IndexedDB geprüft · Datum ändern mit Hinweis „14 Tage vor dem Hauptwettkampf“ · Sortierung nach Datum · Lauf ohne Distanz gesperrt · Löschen · nach Neuladen erhalten · Dunkelmodus |
| Browser-Test Basis am gebauten `dist` | **17/17** (jetzt mit Schema-Version 6) |
| Browser-Test Planimport | **17/17** – unverändert |
| Browser-Test Vorschau | **10/10**; einziger Konsoleneintrag: fehlendes `favicon.ico` des Testservers |

Gefunden und behoben während der Tests: Das Rechenbeispiel in PLAN_MODEL stimmte nach Einführung des Abrundens nicht mehr (Woche 2/3 eine Minute niedriger) – Dokument an den Test angepasst.

### Version 0.8.0 (17.11.2026, echte Bibliotheken)

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **124/124** Tests in 15 Dateien (neu: 28 in `planImport.test.ts`, 1 Anwendungsfall-Test Import → Verlauf → Rückgängig → Backup) |
| `npm run typecheck` | fehlerfrei, inkl. `tools/preview` |
| `npm run build` | erfolgreich, `sw.js` und Manifest erzeugt, Precache 16 Einträge (686 KiB) |
| Browser-Test Planimport am gebauten `dist` | **17/17**, keine Konsolenfehler: Import-Karte bei leerem Plan · Vorlage-Download (33 Wochen) · eingefügte Tabelle mit automatischer Zuordnung · Vorschau mit übersprungener Zeile, unklarem Wert („fünf“) und Montags-Hinweis · gespeicherte Werte direkt in IndexedDB geprüft (leere Laufzelle → kein Laufziel, nicht 0; unklarer Radwert nicht übernommen; andere Wochen unberührt) · Rückgängig · JSON-Datei (`null` bleibt leer) · Zuordnung ohne Wochenspalte gesperrt · Dunkelmodus |
| Browser-Test Basis am gebauten `dist` | **17/17** (Service Worker, offline, Update-Hinweis, Daten erhalten) – unverändert |
| Browser-Test Vorschau | **10/10** (Beispieldaten, Import mit Trainingswochen, Neuladen, alle Tabs); einziger Konsoleneintrag: fehlendes `favicon.ico` des Testservers |

Gefunden und behoben während der Tests: Scheinänderungen allein durch andere Reihenfolge der Sportarten · eine einzelne ungültige Zelle verhinderte die Erkennung der Wochenspalte · „Trainingswoche“ und andere zusammengesetzte Überschriften wurden nicht erkannt · Grammatik in der Vorschau-Zusammenfassung.

### Mit den echten Bibliotheken (17.11.2026, Version 0.7.1)

Umgebung: Linux, Node 22.23, npm 10.9 bzw. 11; installierte Versionen laut `package-lock.json`: Vite 8.3.8, Vitest 4.1.12, TypeScript 6.0.3, React 19.3.1, Dexie 4.4.7, Zod 4.6.7, Tailwind CSS 4.3.5 (`@tailwindcss/vite`), vite-plugin-pwa 1.3.0, `@vitejs/plugin-react` 6.3.0, fake-indexeddb 6.2.8.

| Prüfung | Ergebnis |
|---|---|
| `npm install` | mit npm 10 ohne Lock-Datei Absturz (`Cannot read properties of null (reading 'edgesOut')`, Fehler in npm selbst); mit npm 11 erfolgreich. Mit der erzeugten `package-lock.json` funktionieren danach auch `npm install` und `npm ci` mit npm 10 |
| `npm test` (echtes Vitest) | **95/95** Tests in 14 Dateien bestanden, inkl. `dexieBackend.test.ts` (4 Tests gegen IndexedDB über fake-indexeddb, davon neu: Upgrade DB-Version 1 → 5 mit Daten) |
| `npm run typecheck` (`tsc -b` mit echten React-/Dexie-/Vite-Typen) | nach Korrektur fehlerfrei (vorher TS2589 in `dexieBackend.ts`) |
| `npm run build` | erfolgreich; `dist` enthält `index.html`, `manifest.webmanifest`, `sw.js`, `workbox-*.js`, Icons, JS 603 kB (180 kB gzip), CSS 28 kB. Service Worker cacht 16 Einträge (660 KiB) vorab |
| Browser-Test des gebauten `dist` | Google Chrome (headless, Playwright), iPhone-Viewport 390×844, statischer Server wie bei Netlify: **17/17** Prüfungen, keine Konsolenfehler |

Der Browser-Test am gebauten `dist` prüfte: Service Worker registriert und aktiv · Hinweis „offline nutzbar“ erscheint und blendet sich aus · Einrichtung abschließen · IndexedDB `ironman-planner` mit Schema-Version 5 über das **echte Dexie** angelegt · Daten nach Neuladen erhalten · Seite vom Service Worker kontrolliert · **offline** (Netz getrennt): App startet mit Daten, Heute/Plan/Analysen/Gesundheit/Profil laden · Manifest (standalone, 3 Icons) · **Update:** neue `sw.js` ausgeliefert → „Eine neue Version ist verfügbar.“ erscheint und bleibt stehen → „Aktualisieren“ lädt neu, Daten bleiben erhalten · Tailwind-Ausgabe über `@tailwindcss/vite` sichtbar korrekt (Screenshot).

### Früher, ohne echte Bibliotheken (bis 0.7.0)

Typprüfung mit Typ-Platzhaltern, 91 Unit-Tests über einen `vitest`-Ersatz, esbuild-Bundle und ein Browser-Durchlauf mit 25 Schritten gegen die React-App mit In-Memory-Speicher (Einrichtung, Wochenziele, Erfassen, Frische, Beschwerden, Pausen, Kraft, Analysen, Sammeländerung mit Rückgängig, Backup/Restore, Dunkelmodus). Diese Fachabläufe wurden mit dem echten Build **nicht** erneut einzeln durchgeklickt; die Unit-Tests dazu laufen jetzt aber im echten Vitest.

## Nur auf dem iPhone prüfbar (offen, M1.4)

- Installation über Safari → Teilen → „Zum Home-Bildschirm“, Symbol und Startbildschirm, Statusleiste (`black-translucent`) und Safe Areas (Notch, Home-Indikator)
- Offlinestart der **installierten** App im Flugmodus (Testfall 10) – in Chrome geprüft, nicht in Safari/WebKit
- Update-Hinweis in der installierten App nach neuem Deploy über GitHub Pages (Safari prüft Service-Worker-Updates eigenständig, z. B. beim Öffnen der App)
- Safari-Datumsfelder, iPhone-Zahlenblock in Minuten:Sekunden- und Dezimalfeldern
- Backup über das Teilen-Menü (in iCloud Drive sichern) und Wiederherstellen aus der Dateien-App
- Speicherpersistenz: Daten nach Neustart des iPhones und nach mehreren Tagen ohne Nutzung; Ergebnis von `navigator.storage.persist()` in Safari
- Getrennte Speicher von Safari und installierter App (WebKit-Verhalten, siehe ARCHITECTURE 1.3)
- Vorbereitungswettkämpfe und Trainingslager: Datumsfelder und Auswahllisten in Safari, Zahlenblock bei Distanzen und Stunden
- GitHub Pages: Installation unter der neuen Adresse, Umzug der Daten per Backup
- Plan vorschlagen: Schieberegler mit dem Daumen, aufklappbare Wochen, unterer Übernehmen-Bereich über der Tableiste
- Planimport auf dem iPhone: Datei aus der Dateien-App bzw. iCloud Drive wählen, Tabelle aus Numbers einfügen (Tabulator-Trennung), Auswahllisten der Zuordnung, Vorlage über das Teilen-Menü sichern

## Bekannte Probleme und Einschränkungen

- Nur ein Wettkampf mit einem aktiven Plan.
- Die Wirkung des Race-Setups beruht auf Praxiswerten (CdA, Rollwiderstand, Neo, Carbonschuhe); Sitzposition und Wind machen individuell viel aus.
- Trainingslager: die Erhöhung ist ein fester Faktor; Frische und Beschwerden während des Camps fließen erst über die üblichen Anpassungsvorschläge ein.
- Lauf-/Schwimmzonen-Vorschläge sind aus Praxis-Konventionen abgeleitet (Laufen: Langdistanz-Schema, Schwimmen: CSS + s), nicht individuell validiert; Herzfrequenzzonen gibt es nicht.
- Kein Pausen-Timer zwischen Sätzen (könnte folgen, wenn gewünscht).
- Planimport: Tabellen mit Wochen als Spalten (quer) werden nicht unterstützt; Zonenziele, Schwerpunkte und Frischebereich lassen sich nicht importieren; Excel-Dateien (.xlsx) bitte als CSV exportieren oder die Zellen einfügen.
- Backups lassen sich nur in gleiche oder neuere App-Versionen einspielen (ein Backup aus 0.9.0 hat Format 6 und wird von 0.8.0 abgelehnt). Updates gehen nur vorwärts, daher praktisch ohne Folgen.
- Plan vorschlagen: Bei wenig Laufumfang bleibt der lange Lauf bis zum Taper kurz (Warnung W1) – gewollt, Sicherheit geht vor. Ein Teil der eingestellten Intensität entfällt, weil Laufen locker bleibt (W5).
- Anpassungsvorschläge: Bei verfehlten Zielen gibt es nur „Plan aktualisieren“ (ganze Neuberechnung ab dem tatsächlichen Umfang), keine Einzelwochen-Änderung – eine einzelne gekürzte Woche würde das Problem nicht lösen.
- Ein Backup aus 0.15.0 mit abgeleiteten Lauf-/Schwimmzonen lässt sich nicht in 0.14.0 einspielen (Updates gehen nur vorwärts).
- Ein Backup aus 0.10.0 mit einer übernommenen Planänderung (`generated`) lässt sich nicht in 0.9.0 einspielen (Updates gehen nur vorwärts).
- Zurück-Taste nutzt den Browserverlauf; nach direktem Öffnen einer Unterseite führt sie zum Dashboard.
- Build-Warnung: JS-Paket ca. 680 kB (> 500 kB). Für eine offline gecachte App unkritisch; Aufteilen per `import()` wäre möglich.
- `npm audit`: 4 mittlere Meldungen (`glob`/`minimatch`) – nur im Build-Werkzeug (workbox-build), nicht in der ausgelieferten App.
- Icons und Manifest stehen doppelt in der Precache-Liste (identische Revision, Workbox lädt sie nur einmal) – harmlos.

## Nächste Schritte

1. **Nutzer:** Einmalig in GitHub unter *Settings → Pages → Build and deployment → Source* „GitHub Actions“ wählen; danach baut jeder Push die Seite. Alte Version: Backup sichern, https://p-stammer.github.io/tri-trainer/ öffnen, „Schon ein Backup? Daten übernehmen“. Dann Race-Setup im Profil eintragen, ein Trainingslager ausprobieren und Plan neu vorschlagen lassen. Rückmeldung besonders zu: Passt die Camp-Dosierung (Rad/Schwimmen mehr, Laufen normal)? Wirken die Material-Unterschiede in der Prognose plausibel? Weiterhin offen: Liste „Nur auf dem iPhone prüfbar“.
2. **Claude:** Feinschliff nach Rückmeldung; Ideen – Import aus Sportuhr-Dateien (FIT/GPX/CSV), Prognose für Mitteldistanz, Aufteilen des JS-Pakets.
