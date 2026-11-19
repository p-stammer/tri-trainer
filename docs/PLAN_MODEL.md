# Modell des Plangenerators (M3.2)

Stand: 19.11.2026 · Modellversion **`im-gen-1.8.0`** (umgesetzt in App-Version 0.21.0) · Grundlage: `TRAINING_SCIENCE.md` (Regeln R0–R23, Festlegungen 3.1–3.6)

Dieses Dokument legt fest, **wie** der Generator aus Eingaben einen Planvorschlag rechnet. Es ist die Vorlage für M3.3 (Engine) und M3.4 (Validierung). Jede Zahl hat eine Herkunft: Regel aus `TRAINING_SCIENCE.md` (R…) oder **H** = dokumentierte Heuristik. Alle H-Werte stehen gesammelt in `src/engine/params.ts` und tragen die Modellversion. Ändert sich ein Wert, steigt die Version.

### Änderungen 1.7.0 → 1.8.0 (Trainingslager, 19.11.2026)

| # | Änderung | Grund |
|---|---|---|
| 26 | **Trainingslager** (R23): Zeitraum bis 4 Wochen, Stunden pro Tag (0,5–8 h). Wochen mit Camptagen werden Wochenart *Trainingslager*: Budget = normales Budget × (7 − d)/7 + Stunden × d; Grenzen Rad × (1 + 0,5 · d/7), Schwimmen × (1 + 0,4 · d/7) (**H**), Laufen unverändert; Mehrumfang zuerst Rad, dann Schwimmen, locker (Intensität ohne Mehrumfang gerechnet), höchstens 1 Krafteinheit; langer Ritt im Camp bis 40 % der Woche. Woche danach *Erholung nach Trainingslager* × 0,6 (Camp ≥ 7 Tage) bzw. × 0,7. Eine fällige Entlastungswoche rückt vor das Camp; die Folgewochen steigen vom Niveau vor dem Camp. Camps vor Planbeginn, nach dem Rennen oder im Taper werden ignoriert (**W12**). In Campwochen gelten H1/H3 mit Campfaktor, H4 gegen das Campbudget, H10 (R22) nicht. Jede berücksichtigte Camp-Woche bekommt eine Begründung (R23). | Nutzerwunsch 19.11.2026; Dosierung wie in Camp-Studien ≈ +50 %, danach Erholung (TRAINING_SCIENCE 2.16). |

### Änderungen 1.6.0 → 1.7.0 (Version 2.0, dynamische Repriorisierung, 18.11.2026)

| # | Änderung | Grund |
|---|---|---|
| 24 | Vorgeschlagene Priorität = 3 + Signale (alle **H**): Umfang deutlich unter Rennanteil +1; letzter Leistungstest ≥ 3 % schwächer als der Vortest (beide ≤ 16 Wochen alt, ≥ 3 Wochen auseinander) +1; Anteil an der prognostizierten Zeit (Schwimmen + Rad + Laufen) ≥ 10 % über dem typischen Anteil +1, ≥ 10 % darunter −1. Typischer Anteil nach [D2] zwischen schnellster (10/54/35 %) und langsamster Gruppe (10/48/40 %), linear nach prognostizierter Zeit 9–14 h. Automatisch 2–5 (Stufe 1 nur auf Wunsch). Jede Stufe nennt ihre Gründe. | Version 2.0: Gewichtung folgt Testverlauf und Prognose statt nur dem Umfang. Kein Vergleich der Rohwerte FTP vs. CSS vs. Schwellenpace – verglichen werden Zeitanteile mit beschreibenden Referenzdaten. Dass mehr Training in der relativ schwächeren Disziplin am meisten bringt, ist nicht belegt (TRAINING_SCIENCE 2.7). |
| 25 | Anpassungsvorschlag „Neue Gewichtung vorgeschlagen“, wenn sich der Vorschlag seit der Übernahme geändert hat (nicht im Modus manuell, nicht zusätzlich zum Hinweis auf eine ältere Planlogik). | Rückkopplung (R16). |

### Änderungen 1.5.0 → 1.6.0 (Nutzer-Rückmeldung 18.11.2026 nachmittags)

| # | Änderung | Grund |
|---|---|---|
| 23 | Geschätztes lockeres Lauftempo (nur für Distanzziele ohne eigenes Tempo) **Schwellenpace × 1,4** statt × 1,25 – Mitte der neuen Grundlage-Zone 128–150 % (TRAINING_SCIENCE 2.10). Beispiel 3:55 /km → 5:29 /km statt 4:54 /km. | × 1,25 lag am schnellen Ende bzw. über einem realistischen Ironman-Marathontempo; Grundlage ist langsamer. Ein tatsächlicher langer Lauf aus den Testdaten: 5:33 /km. |

### Änderungen 1.4.0 → 1.5.0 (Nutzer-Rückmeldung 18.11.2026 mittags)

| # | Änderung | Grund |
|---|---|---|
| 21 | **Vorbereitungsrennen mit Wichtigkeit** (Training / wichtig / Saisonhöhepunkt; Standard Training). Faktoren nach Größe × Wichtigkeit (Tabelle unten). Kurze Trainingswettkämpfe (5/10 km, Sprint, olympisch) lassen den Plan unverändert; das Rennen ersetzt eine Einheit, der lange Lauf bleibt. Lange Rennen (70.3, Marathon) bekommen auch als Training eine reduzierte Renn- und Erholungswoche (× 0,8). | Physiologische Belastung kurzer Rennen ist begrenzt; nur wichtige Rennen rechtfertigen einen Taper. |
| 22 | **Ausgangsumfang aus erfassten Einheiten hat Vorrang** vor der Profilangabe, wenn die Sportart in ≥ 3 der letzten 4 Wochen erfasst ist; längster Lauf aus den letzten 30 Tagen, wenn er länger ist als die eigene Angabe oder diese älter als 30 Tage. Bei Übernahme eines Vorschlags wird der Ausgangsumfang im Profil aktualisiert (Mittel der letzten 4 Wochen). | Bei einer späteren Neuplanung startet der Plan beim tatsächlichen aktuellen Stand. |

Faktoren Vorbereitungsrennen (Woche davor / Rennwoche / Woche danach):

| Größe | Training | wichtig | Saisonhöhepunkt |
|---|---|---|---|
| kurz | 1 / 1 / 1 | 1 / 0,9 / 1 | 1 / 0,8 / 0,9 |
| mittel | 1 / 0,9 / 0,95 | 1 / 0,8 / 0,9 | 0,9 / 0,7 / 0,85 |
| lang | 1 / 0,8 / 0,8 | 0,9 / 0,7 / 0,75 | 0,85 / 0,6 / 0,7 |

### Änderungen 1.3.0 → 1.4.0 (Nutzer-Rückmeldung 18.11.2026 mit Backup)

| # | Änderung | Grund |
|---|---|---|
| 17 | **Steigerungsbezug = letzte Belastungswoche** statt Mittel der letzten drei; nach Pausen mindestens das Mittel der letzten drei (sanfter Wiedereinstieg). | Mit dem Mittelwert wuchs der Umfang effektiv nur um etwa die Hälfte des angezeigten Werts (bei +7,5 %: ≈ 3,7 % pro Belastungswoche). Beispiel Nutzer: Laufen 1:30 h → nur 3:23 h statt der möglichen 4:31 h. Für den Mittelwertbezug gibt es keine Evidenz; das Wochenverhältnis zeigte in [V3] keinen Zusammenhang mit Verletzungen. |
| 18 | **Distanzziele ohne eigene km-Angabe**: Tempo aus dem längsten Lauf (Dauer + Distanz), sonst geschätzt aus Schwellenpace × 1,25 (Laufen; seit 1.6.0 × 1,4) bzw. CSS × 1,25 inkl. Pausen (Schwimmen); in „Warum so?“ als Schätzung markiert. | Planen und Abhaken in km für Schwimmen und Laufen (Einstellung „Zielgröße“ im Profil). |
| 19 | Schwimm-Untergrenze nach Priorität: 1,5× (Priorität 1) bis 2,5× (Priorität 5) der Renndistanz pro Spitzenwoche, 2× bei Priorität 3. | Bei Priorität 1 ergab die feste 2,5×-Grenze trotzdem ~3 h Schwimmen. |
| 20 | Warnung W1 nennt den begrenzenden Grund (Steigerungsgrenze, Anteil am Wochen-Laufumfang oder Zeitbudget/Gewichtung). | Unklar, woher die Begrenzung kam. |

### Änderungen 1.2.0 → 1.3.0 (Nutzer-Rückmeldung: „konservativ“ heißt weniger Intensität, nicht weniger Zeit)

| # | Änderung |
|---|---|
| 13 | Obergrenze R22 **unabhängig vom Regler**: Langdistanz 19 h (≈ Mittel + 1 SD), Mitteldistanz 16 h, olympisch 12 h, Sprint 9 h. |
| 14 | Rad/Schwimmen/Kraft-Steigerung fest **+15 %**, Entlastungstiefe fest **−30 %**, langer Lauf höchstens fest **3:00 h / 32 km**. |
| 15 | Laufsteigerung wieder **+5 % (φ = 0) bis +10 % (φ = 100)**; die nicht gelaufene Zeit geht aufs Rad, die Gesamtzeit bleibt im Beispiel innerhalb von 1–2 %. |
| 16 | Der Regler steuert damit: Anteil locker (90 ↔ 70 %), Verteilung (pyramidal ↔ polarisiert), Z5-Anteil, Renntempo im Laufen, Laufsteigerung, Kraft (2 ↔ 1×). |

### Änderungen 1.1.0 → 1.2.0 (Nutzer-Rückmeldung, TRAINING_SCIENCE 2.13 und 3.6)

| # | Änderung | Grund |
|---|---|---|
| 9 | **Obergrenze Wochenumfang (R22)** nach Wettkampfklasse und Regler: Langdistanz 12–20 h, Mitteldistanz 10,5–16 h, olympisch 7–12 h, Sprint 5–9 h (inkl. Kraft). Spitze = min(0,9 × Budget, Obergrenze); jede Woche ≤ min(Budget, max(Obergrenze, Ausgangsumfang)) (**H10**). | Vorher wuchs der Umfang mit jedem Budget mit (30 h → bis 27 h Plan). Grundlage: beobachtete Umfänge von Finishern [D3, D5]. |
| 10 | Warnungen **W10** (zu wenig Zeit für die Distanz) und **W11** (Budget bzw. aktueller Umfang über der Obergrenze). | Rückmeldung „4 h für eine Langdistanz“. |
| 11 | **Entlastung fest jede 4. Woche**, ab 50 Jahren jede 3. – nicht mehr vom Regler abhängig. | Produktentscheidung 3.6. |
| 12 | **Nichtlineare Reglerkurve** und breitere Spannen (4.1); langer Lauf höchstens 2:30 h (φ = 0) bis 3:00 h (φ = 100). | Regler soll an den Extremen mehr bewirken. |

### Änderungen 1.0.0 → 1.1.0 (bei der Umsetzung gefunden, vor der ersten Nutzung)

| # | Änderung | Grund |
|---|---|---|
| 1 | Die Steigerungsgrenze bezieht sich auf das Mittel der letzten **drei Belastungswochen** (ohne geplante Entlastung, Taper, Rennwochen). Pausen- und Budgetkürzungen zählen weiterhin mit. | Mit allen Vorwochen sank der Umfang nach jeder Entlastungswoche dauerhaft – der Plan stagnierte bzw. fiel über Monate (Rechnung: Laufen 1,14 → 1,06 h nach zwei Zyklen). |
| 2 | **Einstiegsumfang** je Sportart (Schwimmen 1 h, Rad 1:30 h, Laufen 40 min pro Woche; langer Lauf 20 min), wenn der Ausgangsumfang darunter liegt oder die Sportart fehlt; Warnung **W9**. | Ohne Ausgangsumfang ergab (1 + g) · 0 = 0 – eine Disziplin, die man noch nicht trainiert, wäre nie geplant worden. |
| 3 | **Schwimm-Spitze mindestens 2,5 × Renndistanz pro Woche** (mit eigenem Tempo umgerechnet; ohne Tempo 2:30 h für 3,8 km), höchstens 25 % der Ausdauerzeit; Rad und Laufen teilen sich den Rest (R11). | Mit Grundgewicht 10 % blieb Schwimmen bei 12 h Budget dauerhaft auf dem Ausgangswert, auch mit Priorität 5. |
| 4 | Lange Ausfahrt bis **60 %** des Wochen-Radumfangs (vorher 45 %). | Rad hat ein geringeres Verletzungsrisiko (Entscheidung 3.4); mit 45 % blieb die längste Ausfahrt für eine Langdistanz unter 2:30 h. |
| 5 | Ein Vorbereitungsrennen zählt für den langen Lauf, hebt die Referenz aber höchstens um 10 %. | Sonst hätte ein Halbmarathon den langen Lauf der Folgewochen sprunghaft erlaubt (H2). |
| 6 | Beschwerde (Schmerz ≥ 4) bzw. zwei Frische-Werte ≤ 3 stoppen die Steigerung in den **ersten 2 Planwochen**; danach Plan neu berechnen (W7). Eine Pause ohne Ende zählt nur in der ersten Planwoche. | Die Zukunft einer Beschwerde ist unbekannt; ein dauerhafter Stopp hätte den ganzen Plan eingefroren. |
| 7 | Schlüsseleinheiten folgen aus den Zonenzielen der Woche (Rad-Intervalle ab 15 min Z4–Z5, Tempo ab 20 min Z3, Schwimm-Intervalle ab 15 min). | So passen Schwerpunkte und Zonenziele immer zusammen. |
| 8 | Laufumfang nur mit **Zeitangabe**; nur Kilometer → Nachfrage. | Das Zeitbudget rechnet in Stunden; Umrechnung über ein angenommenes Tempo ist ausgeschlossen. |

---

## 1. Grundidee

Der Generator ist **kein** Optimierer, der einen „besten“ Plan findet. Er ist eine **deterministische, regelbasierte Projektion**:

1. Aus Zeitbudget, Disziplingewichten und Phasen entsteht ein **Wunschverlauf** je Sportart.
2. Woche für Woche wird dieser Wunsch auf das **Zulässige** zurückgeschnitten: Startumfang, Steigerungsgrenzen, Budget, Pausen, Beschwerden, Entlastungs- und Taperwochen.
3. Was beim Laufen nicht zulässig ist, geht – soweit zulässig – aufs Rad (R17).
4. Jede Kürzung, jede Umverteilung und jede Annahme erzeugt eine **Begründung**, **Warnung** oder **Unsicherheit**.

Gleiche Eingabe + gleiche Modellversion = identisches Ergebnis. Keine Zufallszahlen, kein Lernen aus Daten anderer Personen.

### 1.1 Zielfunktion (formal)

Für jede Sportart s und Woche i sei D<sub>s,i</sub> der Wunschumfang (Abschnitt 4.3) und V<sub>s,i</sub> der geplante Umfang. Gesucht ist

  minimiere  Σ<sub>i</sub> Σ<sub>s</sub> w<sub>s</sub> · (D<sub>s,i</sub> − V<sub>s,i</sub>)²

unter den harten Bedingungen aus Abschnitt 5. Weil alle Grenzen nur von **vorherigen** Wochen abhängen und je Sportart getrennt gelten, ist die Vorwärtsrechnung „Woche i = min(Wunsch, Grenzen)“ für jede Woche die nächstgelegene zulässige Lösung. Die einzige Kopplung zwischen Sportarten (Zeitbudget, Umverteilung Lauf → Rad) wird in fester Reihenfolge aufgelöst (Abschnitt 4.6). Das ist eine bewusste Vereinfachung: Sie ist nachvollziehbar und reproduzierbar, aber nicht global optimal im mathematischen Sinn.

### 1.2 Was der Generator nicht tut

- Keine Wochentage, kein fester Ruhetag (R21).
- Keine Leistungsprognose über Fitness-Fatigue-Modelle (R12), keine Zielzeit-Prognose in 1.0 (R15).
- Keine Umrechnung Dauer ↔ Distanz über angenommene Tempi. Distanzen werden nur geplant, wenn der eigene Ausgangsumfang beide Größen enthält; dann gilt das **eigene** Verhältnis aus diesen Daten (Abschnitt 4.4).
- Keine stillen Planänderungen: Ergebnis ist ein **Vorschlag**, übernommen wird erst nach Bestätigung.

---

## 2. Module A–I

> Hinweis: Die Liste der Module A–I aus der ursprünglichen Anforderung liegt nicht in den Projektdokumenten vor. Die folgende Zuordnung ist aus der dokumentierten Schnittstelle (`ARCHITECTURE.md` 6) abgeleitet; Modul H = Warnungen ist dort ausdrücklich so benannt. **Bitte mit dem Original abgleichen.**

| Modul | Datei (M3.3) | Aufgabe | Ausgabe |
|---|---|---|---|
| **A** Eingaben & Datenqualität | `engine/inputs.ts` | Ausgangsumfang je Sportart aus Profil (sonst Mittel der letzten 4 Wochen erfasster Einheiten, wenn in ≥ 3 Wochen trainiert), längste Einheiten der letzten 30 Tage, Lücken erkennen | `Baseline`, `NeedsInput[]`, Datenqualität |
| **B** Leistungsbewertung | `engine/assessment.ts` | Je Disziplin: Umfangsanteil vs. Rennzeitanteil, vorhandene Leistungswerte (Datum, Methode), Datenqualität | `DisciplineAssessment[]` |
| **C** Disziplinpriorisierung | `engine/assessment.ts` | Vorgeschlagene Priorität aus B, Nutzerpriorität, Modus auto/hybrid/manuell → angewandte Priorität; Gewichte | `AppliedPriority[]`, Gewichte w<sub>s</sub> |
| **D** Phasen & Kalender | `engine/phases.ts` | Phasen, Entlastungswochen, Taper, Vorbereitungsrennen (Mini-Taper, Erholung) | `WeekFrame[]` |
| **E** Umfang | `engine/volume.ts` | Wunschverlauf, Grenzen, Umverteilung, Budget, Pausen | Umfang je Sportart und Woche |
| **F** Intensität | `engine/intensity.ts` | Zonenzeit je Sportart nach Regler, Phase; Intensität aufs Rad | `zoneSec` je Sportart |
| **G** Schlüsseleinheiten & Kraft | `engine/sessions.ts` (lange Einheiten in `volume.ts`) | Einheitenzahl, langer Lauf, lange Ausfahrt, Rad-Intervalle, Koppellauf, Freiwasser, Kraft | `sessions`, `focuses` |
| **H** Warnungen & Prüfungen | `engine/checks.ts` | Prüft das Ergebnis gegen alle harten Grenzen (zweite Sicherung), meldet Zielkonflikte | `Warning[]` |
| **I** Begründung & Unsicherheit | `engine/generate.ts` | Erklärungstexte mit Verweis auf Eingaben und Regeln, Unsicherheiten | `Explanation[]`, `Uncertainty[]` |

Gesamtablauf: `generatePlan(input) = I(H(G(F(E(D(C(B(A(input)))))))))` – jedes Modul ist eine reine Funktion mit eigenen Tests.

---

## 3. Eingaben

| Eingabe | Pflicht | Quelle | Verwendung |
|---|---|---|---|
| Wettkampf (Datum, Distanzen), Vorbereitungsbeginn | ja | vorhanden | Planzeitraum, Phasen |
| **Zeitbudget pro Woche** | **ja** | Profil | Obergrenze (R20); ohne Budget kein Vorschlag |
| **Aktueller Umfang je Sportart** (Dauer und/oder Distanz, Einheiten, Bezugszeitraum) | **ja für jede Ausdauersportart** | Profil, ergänzt durch erfasste Einheiten | Startpunkt (R0) |
| **Längster Lauf der letzten 30 Tage** | ja, wenn Laufen geplant wird | erfasste Einheiten, sonst Eingabe im Generator | R6 |
| Längste Ausfahrt der letzten 30 Tage | nein | erfasste Einheiten oder Eingabe | Startwert lange Ausfahrt; ohne Wert → Anteil am Wochenumfang |
| Philosophie φ (0–100) | ja (Voreinstellung 50) | Generator-Einstellungen | Abschnitt 4.1 |
| Prioritäten je Disziplin + Modus | nein (Voreinstellung auto) | Generator-Einstellungen | Modul C |
| Vorbereitungswettkämpfe | nein | DB-Tabelle `prepRaces` | Modul D |
| Freiwasser möglich ab | nein | Generator-Einstellungen | Modul G |
| Taperdauer (1–3 Wochen) | nein (2) | Generator-Einstellungen | Modul D |
| Individuelle Höchstwerte (z. B. max. km Laufen/Woche) | nein | Generator-Einstellungen | harte Grenze |
| Pausen, Beschwerden, Frische-Check-ins | nein | vorhanden | adaptive Entlastung, Laufstopp |
| Leistungswerte (FTP, Schwellenpace, CSS) | nein | vorhanden | Modul B (nur innerhalb der Disziplin) |
| Alter | nein | Profil | ab 50 Jahren eine Woche früher entlasten (H, 3.5-Voreinstellung „Altersanpassung“) |

Fehlt eine Pflichtangabe, liefert Modul A `NeedsInput` mit Klartext statt eines Plans („Für den Laufplan brauche ich deinen längsten Lauf der letzten 30 Tage.“). Es wird nichts geschätzt.

---

## 4. Rechenschritte

### 4.1 Regler-Parameter

Alle Werte werden zwischen φ = 0 und φ = 100 über die **Reglerkurve** t = f(φ/100) interpoliert, f(x) = 0,5 + 0,5·(0,4u + 0,6u³) mit u = 2x − 1 (in der Mitte flach, an den Enden steil; Implementierung `sliderCurve`, `resolveParams(φ)`):

| Parameter | φ = 0 | φ = 50 | φ = 100 | Herkunft |
|---|---|---|---|---|
| Anteil niedrige Intensität (Z1–Z2) an der gesamten Ausdauerzeit | 0,90 | 0,80 | 0,70 | 3.2, R1 |
| Anteil Z3 an der nicht niedrigen Zeit (Rest Z4–Z5) | 0,75 (pyramidal) | 0,475 | 0,20 (polarisiert betont) | 3.2 |
| Anteil Z5 an Z4–Z5 | 0,20 | 0,35 | 0,50 | H |
| Wochensteigerung Laufen g<sub>run</sub> | 0,05 | 0,075 | 0,10 | R5 |
| Wochensteigerung Rad/Schwimmen/Kraft g<sub>other</sub> | 0,15 – **unabhängig von φ** (1.3.0) | | | R5, 3.4, 3.6 |
| Entlastung alle k Wochen | 4 (ab 50 Jahren 3) – **unabhängig von φ** | | | R4, 3.6 |
| Entlastungstiefe r | 0,30 – **unabhängig von φ** (1.3.0) | | | R4, 3.6 |
| Kraft-Einheiten (Belastungswoche) | 2 | 2 | 1 (ab φ ≥ 67) | R9 |
| Renntempo-Anteil Laufen (nur spezifische Phase) | 0 | 0 | 0,06 (ab φ ≥ 60) | 3.2 |
| Obergrenze Wochenumfang Langdistanz (R22) | 19 h – **unabhängig von φ** (1.3.0) | | | D3, 2.13, 3.6 |
| Langer Lauf Obergrenze | 3:00 h / 32 km – **unabhängig von φ** | | | H |

Feste Werte (unabhängig von φ):

| Parameter | Wert | Herkunft |
|---|---|---|
| Steigerung längster Lauf | ≤ +10 % gegenüber dem längsten Lauf der letzten 4 Wochen | R6 |
| Langer Lauf höchstens Anteil am Wochen-Laufumfang | 0,5 | H |
| Lange Ausfahrt höchstens Anteil am Wochen-Radumfang | 0,60 (1.1.0) | H |
| Lange Ausfahrt Obergrenze | 6:00 h | H |
| Spitzenwochen | min(0,90 × Zeitbudget, Obergrenze R22) | R20, R22 |
| Grundgewichte Schwimmen/Rad/Laufen | 0,10 / 0,50 / 0,40 | R10 |
| Prioritätsfaktor 1…5 | 0,80 / 0,90 / 1,00 / 1,15 / 1,30 | H |
| Schwimmen mindestens | 2 Einheiten/Woche; längste Schwimmeinheit Richtung 3,8 km bis zur spezifischen Phase | R11, H |
| Phasenanteile vor dem Taper | Grundlage 40 %, Aufbau 35 %, spezifisch 25 % (mindestens 3 Wochen spezifisch) | R3, H |
| Taper | 1 Woche: 0,50 · 2 Wochen: 0,70 / 0,45 · 3 Wochen: 0,80 / 0,65 / 0,45 (Faktor auf Spitzenumfang, letzte Woche ohne Rennen) | R8 |
| Intensität im Taper | Z3–Z5-Minuten je Woche ≥ 0,80 × Vorwoche, solange Umfang reicht | R8 |
| Typische Einheitendauer für die Einheitenzahl | Schwimmen 50 min, Rad 75 min, Laufen 45 min | H |
| Einheiten je Sportart | Schwimmen 2–4, Rad 2–5, Laufen 2–5 | H |
| Kraft-Einheitsdauer | aus dem eigenen Ausgangsumfang, sonst 45 min | H |
| Altersanpassung | ab 50 Jahren Entlastung eine Woche früher (k − 1, mindestens 3) | H |

### 4.2 Phasen und Wochenrahmen (Modul D)

Sei N die Zahl der Planwochen ab der ersten zu planenden Woche bis einschließlich Wettkampfwoche, T die Taperdauer.

1. Die letzten T Wochen sind **Taper** (Wettkampfwoche = letzte Taperwoche).
2. Die übrigen N − T Wochen teilen sich auf: **spezifisch** = max(3, round(0,25 · (N − T))), **Aufbau** = round(0,35 · (N − T)), **Grundlage** = Rest. Bei sehr kurzen Plänen (N − T < 6) entfällt erst die Grundlage, dann der Aufbau.
3. **Entlastungswochen**: In Grundlage, Aufbau und spezifischer Phase ist jede k-te Woche eine Entlastungswoche (gezählt ab Planbeginn, Neustart nach jeder Vorbereitungsrennen-Erholung). Die letzte Woche vor dem Taper ist nie Entlastung.
4. **Adaptive Entlastung** (R13): Liegt der letzte Frische-Check-in (≤ 14 Tage alt) bei ≤ 3, wird die **nächste** Woche zur Entlastung. Bei ≤ 3 in zwei aufeinanderfolgenden Check-ins zusätzlich keine Steigerung, bis ein Wert ≥ 5 vorliegt.
5. **Vorbereitungsrennen** (R19): Rennwoche und Woche danach bekommen Faktoren auf den sonst geplanten Umfang:

   | Art | Woche davor | Rennwoche (ohne Rennen) | Woche danach |
   |---|---|---|---|
   | Kurz (≤ 10 km Lauf, Sprint/olympisch) | 1,00 | 0,80 | 0,90 |
   | Halbmarathon, Rad-/Schwimm-Langstrecke | 1,00 | 0,75 | 0,85 |
   | 70.3, Marathon | 0,85 | 0,60 | 0,70 |

   Einstufung (`src/domain/prepRace.ts`, `prepRaceSize`): Triathlon mit Lauf ≥ 15 km oder Rad ≥ 60 km = lang, sonst kurz; Lauf > 25 km lang, > 12 km mittel; Rad ≥ 100 km oder Schwimmen ≥ 3 km mittel; „Sonstiges“ ohne Distanz mittel; alles andere kurz. Rennen in der Vergangenheit, am/nach dem Hauptwettkampf oder im Taper werden ignoriert (der Taper reduziert ohnehin).

   (alle **H**). Das Rennen selbst zählt in der Rennwoche als Einheit und Umfang seiner Sportarten. Seine Laufdistanz zählt für R6 wie ein langer Lauf.

### 4.3 Wunschverlauf (Modul E)

1. **Spitzen-Ausdauerzeit**: P = min(0,90 · Budget, Obergrenze<sub>R22</sub>(Klasse)) − Kraftzeit<sub>Spitze</sub>. Klasse aus der Renndistanz: Lauf ≥ 30 km oder Rad ≥ 140 km = Langdistanz, Lauf ≥ 15 km oder Rad ≥ 70 km = Mitteldistanz, Lauf ≥ 8 km oder Rad ≥ 30 km = olympisch, sonst Sprint.
2. **Gewichte**: w<sub>s</sub> = Grundgewicht<sub>s</sub> × Prioritätsfaktor<sub>s</sub>, normiert auf Summe 1.
3. **Spitze je Sportart**: P<sub>s</sub> = w<sub>s</sub> · P, begrenzt durch individuelle Höchstwerte. Schwimmen mindestens 2,5 × Renndistanz pro Woche (höchstens 25 % von P), Rad/Laufen teilen sich dann den Rest im Verhältnis ihrer Gewichte (Änderung 3).
4. **Wunsch je Woche** (Belastungswochen): D<sub>s,i</sub> = B<sub>s</sub> + (P<sub>s</sub> − B<sub>s</sub>) · min(1, i / R), wobei B<sub>s</sub> der Ausgangsumfang und R die Zahl der Wochen bis zum Beginn der spezifischen Phase ist. Ist B<sub>s</sub> > P<sub>s</sub>, sinkt der Wunsch nicht unter B<sub>s</sub>, solange das Budget es erlaubt (niemand wird gegen seinen aktuellen Umfang heruntergeplant).
5. Entlastungs-, Taper- und Rennwochen: Wunsch = Faktor × Umfang der letzten Belastungswoche.

### 4.4 Grenzen und Projektion (Modul E)

Für jede Sportart s und Belastungswoche i:

  V<sub>s,i</sub> = min( D<sub>s,i</sub>,  (1 + g<sub>s</sub>) · M<sub>s,i</sub>,  Höchstwert<sub>s</sub> )

mit M<sub>s,i</sub> = **Umfang der letzten Belastungswoche**, mindestens das Mittel der drei vorangehenden Belastungswochen (seit 1.4.0; vorher nur das Mittel) (Art „Belastung“, Faktor 1; Pausen- und Budgetkürzungen zählen mit, geplante Entlastung/Taper/Rennwochen nicht – Änderung 1). Für die ersten Wochen zählen fehlende Vorwochen mit dem Ausgangsumfang B<sub>s</sub>. **Damit gilt in Woche 1: V ≤ (1 + g) · B** – bei aktuell 1 h / 10 km Laufen und g = 0,10 also höchstens 1:06 h / 11 km (R0, Festlegung 3.1).

Nach einer Entlastungswoche setzt der Plan beim Niveau davor wieder an und steigert von dort. Bei g = 0,075 wächst Laufen so im Mittel um etwa 3,7 % pro Belastungswoche (Mittelwertbezug glättet).

**Distanz**: Enthält der Ausgangsumfang einer Sportart Dauer **und** Distanz, wird die Distanz mit dem eigenen Verhältnis B<sub>dist</sub> / B<sub>dauer</sub> mitgeführt und unterliegt denselben Grenzen. Fehlt eine der Größen, wird nur die vorhandene geplant.

**Pausen**: Pausierte Tage einer Woche skalieren die Woche mit (1 − Tage/7) für die betroffenen Sportarten, wie im bestehenden Pausen-Vorschlag. Die Pausenwoche zählt für M mit ihrem tatsächlich geplanten Wert – nach einer Pause wird also von niedrigerem Niveau aus gesteigert, nie nachgeholt.

**Beschwerden**: Ist eine Beschwerde aktiv (Status „aktiv“, letzter Schmerzwert ≥ 4) und betrifft das Laufen, wird der Laufumfang auf dem Wert der Vorwoche eingefroren (keine Steigerung, kein langer Lauf über dem bisherigen), bis die Beschwerde „klingt ab“ oder „abgeklungen“ ist. Andere Sportarten entsprechend ihrer Zuordnung.

### 4.5 Langer Lauf und lange Ausfahrt (Modul G)

Sei Ref = längster Lauf der vorangehenden 4 Wochen (in Woche 1 der Ausgangswert). Dann

  L<sub>run,i</sub> = min( 1,10 · Ref,  max(Ref, 0,5 · V<sub>run,i</sub>),  3:00 h / 32 km )

Der Anteil 0,5 am Wochenumfang **bremst nur das Wachstum**: Ein langer Lauf wächst erst, wenn auch der Wochenumfang wächst. Er drückt den langen Lauf aber nicht unter das, was schon gelaufen wird. Gleiches Prinzip für die lange Ausfahrt mit Faktor 1 + g<sub>other</sub>, Anteil 0,60 und 6:00 h. In Entlastungs-, Taper- und Rennwochen: lange Einheit = min(0,75 × letzte lange Einheit, 0,6 × Wochenumfang); in der Wettkampfwoche keine.

### 4.6 Umverteilung und Budget (Modul E)

Reihenfolge je Woche:

1. Laufen, Schwimmen, Kraft projizieren (4.4).
2. **Lauf-Fehlbetrag** F = max(0, D<sub>run,i</sub> − V<sub>run,i</sub>) – Zeit, die wegen der Laufgrenzen nicht gelaufen wird.
3. Rad: Wunsch D<sub>bike,i</sub> + F (R17), dann Projektion mit den Rad-Grenzen.
4. **Budget**: Summe aller Sportarten ≤ Budget. Bei Überschreitung wird in dieser Reihenfolge gekürzt: Rad-Mehrzeit aus Schritt 3 → Rad → Schwimmen über Mindestumfang → Laufen (nie unter Vorwoche − 10 %) → Kraft auf 1 Einheit. Jede Kürzung erzeugt eine Begründung.

### 4.7 Intensität (Modul F)

1. Gesamte Ausdauerzeit A<sub>i</sub> = Σ V<sub>s,i</sub> (ohne Kraft).
2. Zielzeit nicht niedrig: X<sub>i</sub> = (1 − Anteil niedrig) · A<sub>i</sub>; in der Grundlage × 0,5, in Entlastungswochen × 0,5.
3. Davon Z3 = Anteil Z3 · X<sub>i</sub>, Z4–Z5 = Rest (Z5-Anteil nach 4.1).
4. **Verteilung auf Sportarten** (R6a): Laufen bekommt nur Z1–Z2, außer Renntempo-Anteil in der spezifischen Phase (als Z3). Rad bekommt Z4–Z5 vollständig und Z3 bis höchstens 35 % der Radzeit (H). Was beim Rad nicht unterzubringen ist, geht als Z3–Z4 ans Schwimmen (höchstens 30 % der Schwimmzeit, H); der Rest verfällt mit Hinweis („weniger Intensität als eingestellt, weil Laufen locker bleibt“).
5. Zonenziele werden auf 5 min abgerundet und als `zoneSec` je Sportart gespeichert; niedrige Zeit als Z2.

### 4.8 Einheiten und Schlüsseleinheiten (Modul G)

- Einheitenzahl je Sportart: ceil(V<sub>s,i</sub> / typische Dauer), begrenzt auf die Spannen in 4.1, aber nie weniger als die Zahl der Schlüsseleinheiten dieser Sportart.
- Schlüsseleinheiten als Schwerpunkte (`focuses`) mit Zielangabe in der Notiz:
  - **Langer Lauf** jede Belastungswoche (Fokus `long`, Notiz z. B. „ca. 1:20 h / 14 km, locker“).
  - **Lange Ausfahrt** jede Belastungswoche (`long`).
  - **Rad-Intervalle** aus den Zonenzielen (Änderung 7): ab 15 min Z4–Z5 ein Intervall-Schwerpunkt (`threshold` bzw. `vo2max`), sind Z4 und Z5 je ≥ 15 min, zwei; Tempo (`tempo`) ab 20 min Z3. Im Taper „kurz, Intensität halten“.
  - **Koppellauf** (`brick`) nur in der spezifischen Phase, 1×/Woche, Laufanteil 10–20 min (zählt in Laufumfang und Laufgrenzen).
  - **Freiwasser** (Schwimmfokus `other`, Notiz „Freiwasser/Neopren“) ab dem eingestellten Datum, 1×/Woche, wenn eingestellt.
- **Kraft**: Einheitenzahl nach 4.1, in Entlastung/Taper 1; Steigerung vom Ausgangswert um höchstens +1 Einheit je 2 Wochen.

### 4.9 Prioritäten (Modul B und C)

**Bewertung (B)** je Disziplin:

- Umfangssignal: Anteil am eigenen Ausgangsumfang vs. Grundgewicht (Rennzeitanteil). Liegt der eigene Anteil unter 60 % des Grundgewichts → „Umfang deutlich unter Rennanteil“.
- Leistungswerte: nur innerhalb der Disziplin (Datum, Methode, Alter des Werts > 12 Wochen = „veraltet“). **Kein** Vergleich FTP vs. CSS vs. Schwellenpace ohne Referenzwerte (TRAINING_SCIENCE 5).
- Datenqualität: hoch (Profil + ≥ 4 Wochen erfasste Einheiten), mittel (nur Profil), niedrig (Lücken).

**Priorisierung (C)**, getrennt gespeichert (Anforderung 21): `suggested` (aus B), `user` (manuell), `applied` (verwendet), Modus:

- **auto**: applied = suggested. Suggested = 3 plus Signale nach Änderung 24 (seit 1.7.0; vorher 4 bei „Umfang deutlich unter Rennanteil“, sonst 3). Bei niedriger Datenqualität immer 3 mit Unsicherheit („keine belastbare Priorisierung möglich“).
- **hybrid**: applied = round((user + suggested) / 2).
- **manuell**: applied = user.

Harte Grenzen gelten in allen Modi; eine hohe Priorität hebt keine Steigerungsgrenze auf und senkt keine andere Disziplin unter ihren Mindestumfang. Zielkonflikte (z. B. Schwimmen manuell 5, aber Budget knapp) werden als Warnung gezeigt (Validierungsfall G).

---

## 5. Harte und weiche Bedingungen

### Hart (werden nie verletzt; Modul H prüft zusätzlich)

| # | Bedingung | Regel |
|---|---|---|
| H1 | Laufen: V ≤ (1 + g<sub>run</sub>) · M für Dauer und Distanz; Woche 1 bezogen auf Ausgangsumfang | R0, R5 |
| H2 | Längster Lauf ≤ 1,10 × längster Lauf der vorangehenden 4 Wochen | R6 |
| H3 | Rad, Schwimmen, Kraft: V ≤ (1 + g<sub>other</sub>) · M | R5 |
| H4 | Wochensumme ≤ Zeitbudget | R20 |
| H5 | Individuelle Höchstwerte | 3 |
| H6 | Pausen: keine Einheit der pausierten Sportarten an pausierten Tagen (Wochenanteil), kein Nachholen | MVP 2 |
| H7 | Laufen nur Z1–Z2 (Ausnahme Renntempo-Anteil 4.1) | R6a |
| H8 | Schwimmen ≥ 2 Einheiten pro Belastungswoche, solange Budget es zulässt; sonst Warnung | R11 |
| H9 | Keine Steigerung bei Laufbeschwerde ≥ 4 bzw. zwei Frischewerten ≤ 3 | R13, 4.4 |
| H10 | Wochensumme ≤ min(Budget, max(Obergrenze R22, Ausgangsumfang)) | R22 |

### Weich (Ziel, darf verfehlt werden – mit Begründung)

- Wunschverlauf und Spitzenumfang erreichen (Zielfunktion 1.1).
- Intensitätsverteilung nach Regler.
- Langer Lauf ≥ 2:30 h bzw. 28 km bis zur letzten spezifischen Woche (H) – wird das nicht erreicht, Warnung W1.
- Längste Schwimmeinheit 3,8 km bis zur spezifischen Phase.

---

## 6. Warnungen (Modul H)

| Code | Auslöser | Text (Kern) |
|---|---|---|
| W1 | Langer Lauf erreicht vor dem Taper weniger als 2:30 h bzw. 28 km | „Mit sicherer Steigerung erreichst du bis zum Taper einen längsten Lauf von X. Für einen durchgelaufenen Marathon ist das knapp. Optionen: Run-Walk-Strategie oder späteres Rennen.“ (3.4) |
| W2 | Budget reicht nicht für Mindestumfang Schwimmen | „Das Zeitbudget reicht nicht für zwei Schwimmeinheiten pro Woche.“ |
| W3 | Vorbereitungsrennen mit Laufdistanz > 1,10 × längster Lauf davor | „Der Halbmarathon am … ist deutlich länger als dein bis dahin längster Lauf (X km).“ |
| W4 | Manuelle Priorität kollidiert mit harten Grenzen | „Schwimmen ist hoch priorisiert, wird aber durch … begrenzt.“ |
| W5 | Weniger Intensität als eingestellt (4.7) | „Ein Teil der Intensität entfällt, weil Laufen locker bleibt.“ |
| W6 | Ausgangsumfang älter als 8 Wochen oder Bezugszeitraum < 2 Wochen | „Dein Ausgangsumfang ist unsicher.“ |
| W7 | Aktive Beschwerde / niedrige Frische | „Der Plan steigert X nicht, bis …“ |
| W8 | Plan kürzer als 8 Wochen | „Sehr kurze Vorbereitung – Plan hält vor allem den aktuellen Umfang.“ |
| W10 | Zeitbudget unter der üblichen Spanne der Distanz (Langdistanz < 9 h Hinweis, < 6 h deutlich; Mitteldistanz < 6 h / < 4 h; olympisch < 4 h / < 3 h; Sprint < 3 h / < 2 h) (1.2.0) | „X h pro Woche sind für eine Langdistanz sehr wenig …“ |
| W11 | Zeitbudget oder aktueller Umfang über der Obergrenze R22 (1.2.0) | „Mehr Umfang ist kein verlässlicher Vorteil … die übrige Zeit bleibt frei.“ |
| W12 | Trainingslager wird nicht berücksichtigt (vor Planbeginn, nach dem Rennen oder im Taper) (1.8.0) | „Trainingslager „…“ nicht berücksichtigt: …“ |
| W9 | Ausgangsumfang einer Sportart unter dem Einstiegsumfang (1.1.0) | „Der Plan beginnt mit dem Einstieg von X min pro Woche und steigert von dort.“ |

---

## 7. Ausgabe

`PlanProposal` (siehe `src/engine/types.ts`): Modellversion, Parameter-Schnappschuss, je Woche `WeekTargets` (Phase, Sportziele mit Dauer/Distanz/Einheiten/Zonen, Schwerpunkte = Schlüsseleinheiten, Frischebereich), Phasen, Bewertungen, Prioritäten, Begründungen, Warnungen, Unsicherheiten. Übernahme über `commitWeekChanges` mit der Änderungsart `generated` (seit 0.10.0, `applyGeneratedPlan`): Wochen ohne bisherige Ziele bekommen den Vorschlag als ursprünglichen Plan; Rückgängig über den Änderungsverlauf. Vorgeschlagene und verwendete Prioritäten werden dabei in `generatorSettings` gespeichert, die Nutzerpriorität bleibt unverändert. Zusätzlich enthält der Vorschlag `violations` (zweite Prüfung, Modul H) – ist sie nicht leer, sperrt die App die Übernahme.

## 8. Beispiel (Festlegung 3.1)

Ausgang: Laufen 1:00 h und 10 km pro Woche, längster Lauf 6 km, φ = 50 (g<sub>run</sub> = 0,075), Budget 10 h.

| Woche | M (Dauer / Distanz) | Höchstens Laufen (abgerundet) | Langer Lauf |
|---|---|---|---|
| 1 | 1:00 h / 10,0 km | 1:04 h / 10,7 km | 6,0 km (0,5 × Woche = 5,35 km bremst, aber nicht unter bisherige 6 km) |
| 2 | 1:01 h / 10,2 km | 1:05 h / 11,0 km | 6,0 km |
| 3 | 1:03 h / 10,6 km | 1:07 h / 11,3 km | 6,0 km |
| 4 (Entlastung, r = 0,30) | – | 0:46 h / 7,9 km | – |

Werte aus `src/engine/limits.test.ts`. Geplante Werte werden immer **abgerundet** (1 min bzw. 100 m), damit Runden keine Grenze verletzt. Die Spalte „Höchstens“ ist die Grenze; geplant wird der kleinere Wert aus Grenze und Wunschverlauf.

Der Plan startet also **nicht** bei 2 h / 24 km, sondern wächst von 1 h aus in kleinen Schritten. Die frei bleibende Zeit des Wunschverlaufs geht aufs Rad (4.6).
