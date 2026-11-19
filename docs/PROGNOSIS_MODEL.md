# Zielzeit-Prognose und Leistungstests (Version 2.0)

Stand: 19.11.2026 · Prognosemodell **`im-prog-1.1.0`** (App-Version 0.18.0, Verlauf und Szenarien 0.19.0, Race-Setup 0.21.0) · Code: `src/domain/prognosis.ts`, `src/domain/performanceTests.ts`

Dieses Dokument legt fest, wie die App eine Zielzeit für die Langdistanz schätzt und wie Leistungstests ausgewertet werden. Jede Zahl hat eine Quelle oder ist als **H** (Heuristik der App) markiert. Evidenzgrade wie in `TRAINING_SCIENCE.md`.

## 1. Grundsätze

- **Nur Spannen.** Die Kopfzahl („ca. 10:20 h“) ist die Mitte der Spanne, nie allein.
- **Stand heute.** Gerechnet wird mit den aktuellen Werten, ohne Annahme über Fortschritte bis zum Rennen.
- **Mehrere Schätzwege je Teildisziplin** (Produktentscheidung, 18.11.2026): Leistungswert (FTP, Schwellenpace, CSS), Bestzeit und **absolviertes Training**. Jeder Weg liefert eine eigene Spanne; die Teilzeit ist das Mittel der Spannen (Untergrenzen und Obergrenzen je gemittelt).
- **Gesamtspanne = Summe der Teilspannen.** Bewusst breit, weil die Fehler der Teilzeiten zusammenhängen (Tagesform, Hitze, Wind).
- Fehlt für eine Disziplin jede Grundlage, gibt es **keine Gesamtzahl**, sondern einen Hinweis, was fehlt.
- Bisher **nur Langdistanz** (Lauf ≥ 30 km oder Rad ≥ 140 km).
- **Nur mit Race-Setup** (seit 1.1.0, Nutzerwunsch 19.11.2026): Ohne hinterlegtes Material im Profil zeigt die App keine Prognose, sondern einen Hinweis mit Link ins Profil. Der Plangenerator rechnet für die Disziplin-Anteile (Gewichtung, PLAN_MODEL 24) intern mit einer Annahme weiter (Rad aus der alten Einstellung, sonst Zeitfahrrad; Standard-Laufräder, Rennreifen, normale Kleidung, Trainingsschuhe, Neo offen).
- Gesamtformeln aus Bestzeiten werden **zum Vergleich** daneben gezeigt, nicht mit eingerechnet.

## 2. Teildisziplinen

| Teil | Schätzweg | Formel | Herkunft |
|---|---|---|---|
| Schwimmen | CSS | (CSS + 4 … 12 s) × Distanz/100 | Swim Smooth: 5 km ≈ CSS + 2–4 s, 10 km ≈ + 6–10 s [P1]; Zuschlag für Freiwasser/Navigation **H** |
| Schwimmen | Training | Median-Pace der Einheiten ≥ 1 km / ≥ 20 min der letzten 8 Wochen (mind. 3) × 0,88 … 1,0 | **H** – Trainings-Ø enthält Pausen |
| Rad | FTP | Leistung = 0,65 … 0,75 × FTP; Geschwindigkeit aus dem Leistungsmodell (Luft- und Rollwiderstand), dann × 1,0 … 1,05 für Wind, Kurven, Verpflegung | IF-Spanne Altersklasse Langdistanz [P2]; Rest Physik + **H** |
| Rad | Training | Ø-Geschwindigkeit der bis zu 3 längsten Ausfahrten ≥ 1:30 h (18–45 km/h) der letzten 8 Wochen (mind. 2) × 1,0 … 1,12 | **H** – Rennen gleichmäßiger, aero, gesperrte Straßen, Taper; Indoor-Fahrten können verzerren |
| Laufen | Schwellenpace | Schwellenpace × 1,18 … 1,35 | `TRAINING_SCIENCE.md` 2.10 (Daniels-Marathontempo, Ironman-Zuschlag 20–45 min), langsames Ende inkl. Gehpausen **H** |
| Laufen | Bestzeit | Marathon + 20 … 45 min; aus Halbmarathon/10 km erst Marathon-Äquivalent nach Riegel (T₂ = T₁ · (D₂/D₁)^1,06) | TrainingPeaks/Runna [Z8], Riegel 1981 [P3] |
| Laufen | Training | Median-Pace der Läufe ≥ 1:15 h der letzten 8 Wochen (mind. 2) × 0,98 … 1,12; ist der längste Lauf < 2 h, langsames Ende + 5 % | **H** |
| Wechsel | Annahme | T1 + T2 = 6 … 14 min | **H** |

**Leistungsmodell Rad** (Physik, ohne Wind): P · η = ½ · ρ · CdA · v³ + C<sub>rr</sub> · m · g · v + m · g · Steigung · v, mit ρ = 1,2 kg/m³, η = 0,975, m = Körpergewicht (sonst 75 kg) + 10 kg. CdA und C<sub>rr</sub> aus dem Race-Setup (Abschnitt 2a). Höhenmeter: halbe Strecke gleichmäßig bergauf, halbe bergab, jeweils bei gleicher Leistung (**H**, vereinfachend). Schnelles Ende: IF 0,75 und kleinster CdA; langsames Ende: IF 0,65, größter CdA, + 5 %.

## 2a. Race-Setup (1.1.0)

Im Profil: Rad (Zeitfahr-/Triathlonrad, Aero-Rennrad, Rennrad, Gravelbike), bei den drei letzten Aufleger ja/nein, Laufräder (Hochprofil/Scheibe oder Standard), Reifen (Renn- oder Trainingsreifen), Kleidung und Helm (aero, normal, locker), Laufschuhe (Carbon-Wettkampfschuh oder Trainingsschuh), Schwimmen (mit Neo, ohne, noch offen).

| Teil | Wirkung | Herkunft |
|---|---|---|
| Rad, Aufleger | CdA-Grundspanne (mit eng anliegender Kleidung, Straßenhelm, Standard-Laufrädern): Zeitfahrrad 0,24–0,29 m²; Aero-Rennrad mit Aufliegern 0,27–0,32, ohne 0,31–0,36; Rennrad mit 0,28–0,33, ohne 0,32–0,38; Gravel mit 0,30–0,35, ohne 0,34–0,40 | [P4], [E1]: Aufleger/Zeitfahrposition ist der größte Einzelfaktor (im Windkanal −32 bis −42 % Luftwiderstand Rennrad → Zeitfahrrad mit Aerohelm); Abstufung Aero-Rennrad/Gravel **H** |
| Kleidung und Helm | CdA × 0,95 (aero: Einteiler + Aerohelm) / × 1,00 (normal) / × 1,08 (locker) | Praxiswerte: Aerohelm 5–15 W, Einteiler 5–20 W bei Renntempo [E2]; Faktoren **H** |
| Laufräder | CdA × 0,975 bei Hochprofil/Scheibe | Praxiswerte 3–20 W [E2]; Faktor **H** (konservativ) |
| Reifen | C<sub>rr</sub> 0,0035 (Rennreifen) bzw. 0,005 (Trainingsreifen); Gravelrad + 0,0015 | Straßenreifen typisch 0,002–0,007 [E3]; Latex/tubeless gegenüber Butyl deutlich weniger Rollverlust [E4]; Werte **H** |
| Neo | Schwimmzeit × 0,93 … 0,97 (mit Neo); „noch offen“ = Spanne × 0,93 … 1,0; ohne Neo unverändert (die CSS wird ohne Neo gemessen) | Widerstand −12 bis −14 % mit Neo [E5]; Praxis 3–7 % schneller [E6] |
| Laufschuhe | Carbon: Laufzeit × 0,98 … 0,995 (bei Bestzeiten nur das schnelle Ende, weil sie oft schon im Carbonschuh gelaufen sind) | Metaanalysen: Laufökonomie ≈ +2,5–3 %, entspricht ≈ 1–2 % Marathonleistung [E7]; Wirkung im Ironman-Marathon (ermüdet, langsamer) nicht untersucht → konservatives Ende **H** |

Beispiel mit Testdaten (E2E-Test, Stand 2.12.2026): Rennrad mit Aufliegern, Rennreifen, normale Kleidung, Carbonschuhe, mit Neo ≈ 10:10 h gesamt; Gravelbike ohne Aufleger mit lockerer Kleidung ≈ 10:45 h.

## 3. Gesamtformeln (Vergleich)

| Formel | Gilt für | Spanne |
|---|---|---|
| 152,1 + 1,332 × Marathon-Bestzeit + 1,964 × Bestzeit olympisch (min) | Freizeit-Männer, n = 184, r² = 0,65 [D3] | ± 56,8 min (Standardschätzfehler) |
| 186,3 + 1,595 × Bestzeit olympisch + 1,318 × Marathon-Bestzeit (min) | Freizeit-Frauen, n = 28, r² = 0,53 [D7] | ± 60 min (**H**, kein Schätzfehler berichtet) |
| 2 × 70.3-Bestzeit × 1,03 … 1,10 | alle | trirating: Ø 5,35 % Verlangsamung von 70.3 auf Langdistanz [P5]; Spanne **H** |

Ohne Angabe zum Geschlecht wird die Männer-Formel mit Hinweis „Stichprobe nur Männer“ gezeigt.

## 4. Beispiel (Testdaten, 25.11.2026)

CSS 1:30, FTP 260 W, Schwellenpace 3:50 /km, Zeitfahrrad, 1 200 Hm, Marathon-Bestzeit 3:15 h: Schwimmen 1:00–1:05 h, Rad 5:05–6:00 h, Laufen 3:25–3:50 h (Mittel aus Schwellenpace 3:10–3:40 und Bestzeit 3:35–4:00), Wechsel 6–14 min → **ca. 10:20 h (9:35–11:10 h)**. Formel nach Rüst (Männer): 10:40–12:35 h.

## 5. Leistungstests

| Sportart | Protokoll | Rechnung | Herkunft |
|---|---|---|---|
| Rad | 20-min-Test | FTP = 0,95 × Ø-Leistung 20 min | Allen & Coggan (Konvention, D) |
| Laufen | 30-min-Lauf allein | Schwellenpace = 30 min / gelaufene Strecke | Friel (Konvention, D) |
| Schwimmen | 400 m + 200 m maximal | CSS = (t₄₀₀ − t₂₀₀) / 2 pro 100 m | Wakayoshi et al. 1993 [Z3], Swim Smooth |

- Jeder gespeicherte Test aktualisiert die Zonen wie bisher (Rad immer, Laufen/Schwimmen nur ohne manuelle Zonen).
- Verlauf je Ankerwert mit Veränderung zum Vortest (bei Pace ist „schneller“ besser) und Diagramm (bei Pace zeigt „oben“ schneller).
- **Erinnerung** auf „Heute“, wenn der letzte Wert ≥ 8 Wochen alt ist oder fehlt (**H**, Praxis 6–8 Wochen); nicht in Taper- und Rennwochen; Hinweis auf die nächste Entlastungswoche; „Diese Woche nicht“ blendet bis zur nächsten Woche aus.

## 5a. Verlauf und Szenarien (0.19.0)

- **Verlauf:** Prognose zu Stichtagen alle 2 Wochen rückwärts ab heute (höchstens 12, nicht vor Vorbereitungsbeginn). Jeder Stichtag rechnet nur mit Tests und Einheiten, die es damals schon gab (Trainingsfenster 8 Wochen vor dem Stichtag). Bestzeiten und Annahmen (Rad-Typ, Höhenmeter) gelten für alle Stichtage gleich. Nichts wird gespeichert; gleiche Daten ergeben immer denselben Verlauf.
- **Was wäre wenn:** FTP in 5-W-Schritten, Schwellenpace in 2-s-Schritten, CSS in 1-s-Schritten gegenüber dem aktuellen Wert. Es ändern sich nur die Schätzwege über Leistungswerte; Training und Bestzeiten bleiben. Wird nicht gespeichert.
- **Gewichtung:** Die Teilzeiten fließen in die Prioritäten des Planers ein (`PLAN_MODEL.md`, Änderung 24).

## 5b. VO2max (0.20.0)

VO2max wird nur dokumentiert (Labor, Cooper-Test, Sportuhr, Sonstige) und geht **nicht** in die Prognose ein: Uhr-Schätzungen weichen im Einzelfall um bis zu etwa ± 10 ml/kg/min ab (TRAINING_SCIENCE 2.15), und für die Langdistanz-Zeit sind FTP, Schwellenpace und CSS die direkteren Ankerwerte.

## 6. Quellen

- [P1] Swim Smooth: How fast can you swim over longer distances? https://swimsmooth.com/free-resources/2011/05/how-fast-can-you-swim-over-longer.html – Praxis (D)
- [P2] BestBikeSplit: Ironman bike pacing, intensity factor and TSS (IF 0,65–0,75, Mitte 0,68–0,72); TrainerRoad: Median-IF ≈ 0,70 bei 650+ Langdistanz-Athleten. – Praxis/Beschreibung (D/C)
- [P3] Riegel PS. Athletic records and human endurance. *American Scientist* 1981;69(3):285–290. – Modell (D)
- [P4] BestBikeSplit: CdA explained (Triathlonrad Altersklasse 0,25–0,30 m², Rennrad Unterlenker 0,30–0,35). – Praxis (D)
- [P5] trirating.com: Trying to predict Ironman times from 70.3 ratings (Ø 5,35 % Verlangsamung). – Beschreibung (C/D)
- [E1] Cyclingnews: How aero is aero? Windkanal Rennrad vs. Zeitfahrrad mit Aerohelm (−32 bis −42 % Luftwiderstand). – Praxis (D)
- [E2] Praxisübersichten zu Aero-Material (Aerohelm 5–15 W, Einteiler 5–20 W, Hochprofil-Laufräder 3–20 W bei Renntempo), z. B. runbikecalc.com, afasteryou.com. – Praxis (D)
- [E3] BestBikeSplit: Case study Crr (Straßenreifen 0,002–0,007). – Praxis (D)
- [E4] Rollwiderstandsmessungen Butyl vs. Latex vs. tubeless (u. a. Tire Science & Technology 49(3); bicyclerollingresistance.com). – Messung (C/D)
- [E5] Toussaint HM, Bruinink L, Coster R, et al. Effect of a triathlon wet suit on drag during swimming. *Med Sci Sports Exerc* 1989;21(3):325–328. – Labor (C)
- [E6] Sports Performance Bulletin: Wetsuits improve swimming speed by 3–7 % (Übersicht). – Praxis (D)
- [E7] Kobayashi et al. 2026, *Front Sports Act Living* (Metaanalyse 14 Crossover-Studien, Laufökonomie +2,5–3 %, ≈ 1 % Marathon); Hébert-Losier et al. (Freizeitläufer, individuelle Spannweite). – Metaanalyse (B)
- [D3] Rüst CA et al. 2011, *Open Access J Sports Med* 2:121–129 (siehe TRAINING_SCIENCE).
- [D7] Rüst CA, Knechtle B, Wirth A, et al. Personal best times in an Olympic distance triathlon and a marathon predict an Ironman race time for recreational female triathletes. *Chin J Physiol* 2012;55:156–162.
- [Z3], [Z8] siehe TRAINING_SCIENCE.

## 7. Grenzen

- Die Trainings-Schätzwege sind Heuristiken ohne Validierung; sie verbinden Trainingstempo und Renntempo über feste Faktoren.
- Hitze (z. B. Rennen im Juli), Wind, Kursänderungen und Ernährung sind nicht modelliert. Ob Neo erlaubt ist, entscheidet die Wassertemperatur am Renntag – deshalb die Auswahl „noch offen“.
- Die Material-Faktoren sind Praxiswerte; der tatsächliche Gewinn hängt stark von Sitzposition, Passform und Wind ab. Ein eigener CdA-Test wäre genauer, ist aber nicht vorgesehen.
- Die Gesamtformeln stammen aus kleinen Stichproben (2011/2012, Ironman Schweiz) und erklären nur 53–65 % der Streuung.
