# Modellvalidierung

Stand: 17.11.2026 – Generator `im-gen-1.5.0` (App 0.14.0). Die Fälle sind als automatische Tests in `src/engine/generate.test.ts` umgesetzt.

## Beispielathleten (aus der Anforderung)

| ID | Profil | Erwartung | Status |
|---|---|---|---|
| A | Starke:r Schwimmer:in, gute CSS, moderate Rad-/Laufleistung, begrenztes Zeitbudget | Schwimmen als mögliche Stärke erkannt; geringere relative Priorität wird *geprüft*, nicht pauschal allein aus CSS abgeleitet | ✅ Vorschlag 3, CSS nur innerhalb der Disziplin bewertet |
| B | Schwimmanfänger:in, geringes Volumen, gute Rad-/Laufleistung | Schwimmen als möglicher Limiter; Technik, Sicherheit, Renndistanz berücksichtigt | ✅ Einstieg + W9, Vorschlag 4, Schwimmen wächst über 2 h |
| C | Starke:r Läufer:in, schwächere Radleistung | höhere Radpriorität geprüft; Lauferhaltung bleibt | ✅ Rad Vorschlag 4, Laufumfang in Belastungswochen ≥ Ausgang |
| D | Finishorientiert, wenig Erfahrung, Philosophie ≈ 0, Kraft hoch priorisiert | mehr Grundlage, Kraft, Regeneration; keine Gesundheitsgarantien | ✅ Entlastung alle 3 Wochen, 2 × Kraft |
| E | Leistungsorientiert, erfahren, Philosophie ≈ 100, ausreichend Zeit | gezieltere Intensitätsschwerpunkte | ✅ VO2max-Schwerpunkt Rad, Renntempo-Anteil Laufen in der spezifischen Phase |
| F | Hohe Ermüdung, hohe Vorbelastung | Überprüfung statt Steigerung | ✅ erste Woche Entlastung, keine Steigerung, W7 |
| G | Auto-Priorität Schwimmen niedrig, manuell hoch | manuelle Einstellung gilt im Rahmen harter Grenzen; Zielkonflikt sichtbar | ✅ verwendet 5, Vorschlag 3 getrennt gespeichert und in der Begründung sichtbar; Warnung W4 nur, wenn Grenzen oder Budget den Wunsch tatsächlich bremsen (bei 9 h nicht der Fall) |
| H | Keine CSS, kein Radtest, wenig Historie | keine erfundenen Werte, keine scheinbar präzise Priorisierung | ✅ keine Distanzen ohne eigene Distanzangabe, keine Leistungswerte erfunden |

## Weitere Modelltests (geplant)

- Zeitbudget, Belastungsgrenzen und Pausen werden immer eingehalten.
- Kleine Eingabeänderungen → kleine Planänderungen (Sensitivität).
- Unterschiedliche Prioritäten → nachvollziehbar unterschiedliche Pläne.
- Philosophie-Slider verändert messbar die Zielfunktion.
- Hohe Priorität einer Disziplin vernachlässigt keine Wettkampfdisziplin.
- Gleiche Eingabe + gleiche Modellparameter → identisches Ergebnis.

## Ergebnisse (17.11.2026, im-gen-1.3.0)

Neu in 1.2.0/1.3.0: Budget 30 h → Spitzenwoche ≤ 19 h bei jeder Reglerstellung; 4 h für eine Langdistanz → deutliche Warnung; Entlastungswochen bei Regler 0 und 100 in denselben Wochen; Gesamtzeit Regler 0 vs. 100 unter 3 % Unterschied, harte Intensität (Z4–Z5) bei Regler 100 mehr als doppelt so hoch.


Automatisch geprüft (`src/engine/generate.test.ts`, 31 Tests):

- Keine Verletzung harter Grenzen (zweite Prüfung, Modul H) über Regler 0/33/67/100 × Budget 7/12/18 h × Taper 1/2/3 mit zwei Vorbereitungsrennen und einer Laufpause.
- Zeitbudget nie überschritten (6, 9, 12, 16 h).
- Gleiche Eingabe → identisches Ergebnis.
- Budget 12 h → 12,5 h ändert keine Woche um mehr als 0,5 h.
- Regler: konservativ = höherer Anteil locker und mehr Entlastungswochen als aggressiv.
- Laufen ohne Z3–Z5 bis Regler 69; harte Intensität liegt auf dem Rad.

Bekannte Schwächen:

- Bei niedrigem Laufumfang (1 h/Woche) erreicht der lange Lauf bis zum Taper nur 1–1,5 h (W1). Gewollt (Sicherheit vor Ziel), aber für einen Marathon knapp.
- Ein Teil der eingestellten Intensität entfällt (W5), weil Laufen locker bleibt.
- Prioritäten verschieben nur den Wunschverlauf; Steigerungsgrenzen begrenzen ihre Wirkung in kurzen Plänen stark.
- Rad-Umfang sinkt in der spezifischen Phase leicht, wenn Laufen wächst (gemeinsames Budget).


## Sensitivitätsanalyse (18.11.2026, im-gen-1.5.0)

Langdistanz, 33 Planwochen ab 23.11.2026, Taper 2 Wochen. Ausgang: Schwimmen 1:30 h / 4 km, Rad 3 h, Kraft 1 × 1 h, längster Lauf = halber Wochen-Laufumfang (höchstens 2 h). Werte gerechnet mit der App (Testskript), gerundet.

| Regler | Budget | Laufen Start | Woche 1 | Spitze | Summe Plan | Laufen Spitze | Langer Lauf | locker | Z4–Z5 gesamt | Warnungen |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 8 h | 1 h | 7,5 h | 8,0 h | 218 h | 1,9 h | 0,9 h | 93 % | 4 h | W10 W1 W5 |
| 0 | 8 h | 3 h | 8,0 h | 8,0 h | 222 h | 3,0 h | 1,5 h | 93 % | 4 h | W10 W1 W5 |
| 0 | 12 h | 1 h | 7,6 h | 10,8 h | 266 h | 2,6 h | 1,3 h | 93 % | 4 h | W1 W5 |
| 0 | 12 h | 3 h | 9,5 h | 10,9 h | 287 h | 3,0 h | 1,5 h | 93 % | 5 h | W1 W5 |
| 0 | 16 h | 1 h | 7,8 h | 14,4 h | 331 h | 2,6 h | 1,3 h | 93 % | 5 h | W1 W5 |
| 0 | 16 h | 3 h | 9,7 h | 14,4 h | 350 h | 4,2 h | 2,1 h | 93 % | 5 h | W1 W5 |
| 50 | 8 h | 1 h | 7,5 h | 8,0 h | 218 h | 1,9 h | 0,9 h | 86 % | 13 h | W10 W1 W5 |
| 50 | 8 h | 3 h | 8,0 h | 8,0 h | 222 h | 3,0 h | 1,5 h | 85 % | 14 h | W10 W1 W5 |
| 50 | 12 h | 1 h | 7,6 h | 10,8 h | 265 h | 3,1 h | 1,6 h | 85 % | 17 h | W1 W5 |
| 50 | 12 h | 3 h | 9,5 h | 10,9 h | 287 h | 3,0 h | 1,5 h | 85 % | 19 h | W1 W5 |
| 50 | 16 h | 1 h | 7,8 h | 14,4 h | 332 h | 4,5 h | 2,3 h | 85 % | 23 h | W1 W5 |
| 50 | 16 h | 3 h | 9,7 h | 14,4 h | 350 h | 4,2 h | 2,1 h | 85 % | 24 h | W1 W5 |
| 100 | 8 h | 1 h | 6,5 h | 7,8 h | 207 h | 2,2 h | 1,1 h | 78 % | 33 h | W10 W1 W5 |
| 100 | 8 h | 3 h | 8,0 h | 8,0 h | 227 h | 3,0 h | 1,5 h | 78 % | 35 h | W10 W1 W5 |
| 100 | 12 h | 1 h | 6,7 h | 10,8 h | 261 h | 3,5 h | 1,8 h | 77 % | 43 h | W1 W5 |
| 100 | 12 h | 3 h | 8,6 h | 10,8 h | 281 h | 3,3 h | 1,6 h | 78 % | 46 h | W1 W5 |
| 100 | 16 h | 1 h | 6,8 h | 14,4 h | 327 h | 5,0 h | 2,5 h | 77 % | 56 h | W5 |
| 100 | 16 h | 3 h | 8,7 h | 14,4 h | 346 h | 4,7 h | 2,3 h | 77 % | 59 h | W1 W5 |

Verletzungen harter Grenzen im Raster: **0**.

Einzeländerungen (Ausgang Regler 50, 12 h, Laufen 1 h):

| Änderung | Spitze | Summe Plan | Laufen Spitze | Langer Lauf |
|---|---|---|---|---|
| Budget +10 % | +10,0 % | +7,4 % | +12,7 % | +12,8 % |
| Budget −10 % | −10,2 % | −7,5 % | −12,2 % | −11,7 % |
| Laufen Start +10 % | 0 % | +0,3 % | 0 % | 0 % |
| Laufen Start −10 % | 0 % | −0,3 % | 0 % | 0 % |
| Regler 40 / 60 | 0 % | 0 % | 0 % | 0 % |
| Rad Start +1 h | +5,3 % | +7,7 % | 0 % | 0 % |

**Befunde**

- Kleine Änderungen der Eingaben ändern den Plan stetig und proportional; keine Sprünge.
- Das **Zeitbudget** ist der stärkste Hebel (Elastizität ≈ 1 auf die Spitzenwoche). Der Regler ändert die Trainingszeit nicht (gewollt), nur die Intensität: harte Minuten (Z4–Z5) über den Plan rund 4 h (Regler 0) → 17 h (50) → 43 h (100) bei 12 h Budget.
- Der **Lauf-Startwert** wirkt bei 33 Wochen kaum auf die Spitze, weil das Laufen sein Ziel (Gewichtung × Budget) vor der spezifischen Phase erreicht. Bei kurzen Plänen wäre der Einfluss größer.
- Wer schon mehr trainiert als die Spitze vorsieht (Rad +1 h), wird nicht gekürzt – die Spitze liegt dann über 90 % des Budgets, aber unter dem Budget.
- W1 (langer Lauf unter 2:30 h) erscheint fast immer: der lange Lauf ist auf die Hälfte des Wochen-Laufumfangs begrenzt, und das Laufen bekommt bei der Gewichtung 10/50/40 und Budgets bis 16 h höchstens 3–5 h. Das ist eine bewusste Sicherheitsentscheidung; Lauf-Priorität oder Budget heben es an.
- W5 (Intensität entfällt teilweise) erscheint immer, weil Laufen locker bleibt – erwartbar und nur ein Hinweis.

## Trainingslager (19.11.2026, im-gen-1.8.0)

Automatische Tests in `src/engine/camp.test.ts`: Campbudget (normales Budget an den übrigen Tagen + Stunden je Camptag), volle Campwoche (Mehrumfang vor allem Rad und Schwimmen, Laufen innerhalb der normalen Grenzen, Erholungswoche danach), fällige Entlastung rückt vor das Camp, Camp über eine Wochengrenze und Camp im Taper (ignoriert, W12), Camp mit wenigen Stunden pro Tag sowie ein Raster Regler (0/50/100) × Zeitbudget × Camp-Lage × Stunden pro Tag ohne Verletzung einer harten Grenze. Mit Testdaten (E2E, Camp 20.–27.03.2027, 5 h/Tag): 12,0 → 15,0 → 17,8 → 7,5 h statt 12,0 / 12,2 / 8,5 / 12,6 h, also ≈ +50 % in der vollen Campwoche gegenüber einer normalen Woche, wie in den Camp-Studien (TRAINING_SCIENCE 2.16).
