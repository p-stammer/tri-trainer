# Trainingswissenschaftliche Grundlagen

Stand: 19.11.2026 (Zonen-Vorschläge Laufen/Schwimmen 2.10, RPE-Signal 2.9, Prognose 2.11, VO2max 2.15, Trainingslager 2.16) · Meilenstein **M3.1 (Literaturrecherche) abgeschlossen**, ergänzt um die Festlegungen (Abschnitt 3) und die Nachrecherche zum Wochenumfang (2.13, Modell `im-gen-1.2.0`). Grundlage für M3.2 (Modelldefinition) und M3.3 (Engine).

Dieses Dokument hält fest, was die App aus der Forschung übernimmt, wie belastbar das ist und wo sie mit dokumentierten Annahmen arbeitet. Jede Regel des späteren Plangenerators muss auf einen Abschnitt hier verweisen.

---

## 0. Lesehilfe

### Evidenzgrade (in diesem Dokument)

| Grad | Bedeutung |
|---|---|
| **A** | Systematische Übersicht/Metaanalyse mit mehreren kontrollierten Studien und konsistentem Ergebnis |
| **B** | Metaanalyse mit wenigen oder methodisch schwachen Studien, einzelne randomisierte Studie, große prospektive Kohorte |
| **C** | Beobachtungs- oder Korrelationsstudie, kleine Stichprobe, Einzellaborstudie |
| **D** | Konsens, Fachbuch, Praxis-Konvention |
| **H** | **Heuristik der App** – keine Quelle, sondern eine begründete, dokumentierte Annahme |

Zusätzlich wird je Aussage unterschieden: **Intervention** (Studie hat Training verändert), **Korrelation** (Zusammenhang beobachtet) oder **Methode** (Messverfahren).

### Wie geprüft wurde

Recherche am 17.11.2026 über Websuche nach systematischen Übersichten zuerst, dann Einzelstudien. Jede unten aufgeführte Quelle wurde am Abstract geprüft (Verlagsseite, Universitätsrepositorium oder BISp-Literaturdatenbank SPOLIT/LIDA; PubMed selbst war für den Abruf gesperrt, die PubMed-Datensätze wurden über diese Spiegel bestätigt). Volltexte wurden nicht durchgängig gelesen; Zahlen stammen aus den Abstracts. Es handelt sich **nicht** um eine formale systematische Übersicht nach PRISMA – Studien können fehlen.

---

## 1. Was die App bereits verwendet (MVP 1 und 2)

| Element | Grundlage | Grad | Grenzen |
|---|---|---|---|
| Soll-Ist, verbleibendes Volumen | Arithmetik | – | keine |
| Zonenzeit nur aus erfassten Werten, Rest = unbekannt | Datenregel | – | keine Schätzung |
| Session Load = Dauer (min) × Session-RPE (CR-10) | Foster et al. 2001 [M1]; Validität bestätigt in Haddad et al. 2017 [M2] | Methode, B | subjektiv; nur mit RPE berechnet; keine Umrechnung in TSS/CTL |
| Rad-Zonen aus FTP: Z2 ab 56 %, Z3 ab 76 %, Z4 ab 91 %, Z5 ab 106 % | Allen & Coggan (Fachbuch) | D | FTP ist nicht deckungsgleich mit dem maximalen Laktat-Steady-State (Abschnitt 2.10) |
| Laufzonen aus Schwellenpace (seit 0.15.1, Langdistanz): Z2 ab 150 %, Z3 ab 128 %, Z4 ab 105 %, Z5 ab 96 % der Pace (Zeit/km) | Herleitung 2.10 aus Daniels [Z7], Ironman-Marathontempo [Z8, Z9], Friel für Z4/Z5 [Z5] | D / **H** | nur Vorschlag, „nicht individuell validiert“; manuelle Grenzen haben Vorrang |
| Schwimmzonen aus CSS: Z2 ab CSS + 12 s, Z3 ab + 5 s, Z4 ab + 2 s, Z5 ab − 3 s pro 100 m (seit 0.15.0) | Praxis „CSS + x s“ [Z6], Friel „T-Zeit ± s“ [Z5] | D / **H** (Abstände) | CSS liegt je nach Studie am oder über dem MLSS [Z3, Z4]; nur Vorschlag |
| Frische-Check-in 1–10, Hinweis ≤ 3 / ≥ 9 | Anforderung; subjektive Maße reagieren empfindlicher auf Belastung als objektive (Saw et al. 2016 [M3]) | B (Prinzip), **H** (Schwellen) | Fragebogen nicht validiert; nur Vergleich, keine Deutung |
| Pausen-Vorschlag: Ziele × (1 − pausierte Tage / 7) | Proportionalität | **H** | kein Nachholen; nur nach Bestätigung |
| Planimport | Datenregel | – | leere Werte bleiben leer |

---

## 2. Ergebnisse je Forschungsfrage

### 2.1 Intensitätsverteilung (polarisiert, pyramidal, Schwelle)

**Befunde**

- Eine frühe Metaanalyse fand für Zeitfahrleistung einen Vorteil polarisierten gegenüber schwellenbetontem Training (ES −0,66; 95 %-KI −1,17 bis −0,15). Gepoolt wurden aber nur 3 Studien mit PEDro 4–5/10. [I1] – **B/C, Intervention**
- Die größere Metaanalyse (17 Studien, n = 437) fand: polarisiert verbessert VO2peak etwas stärker (SMD 0,24; 0,01–0,48), aber nur in Interventionen unter 12 Wochen und bei hochtrainierten Athleten. **Kein Unterschied** bei Zeitfahren (SMD −0,01; −0,28 bis 0,25), Zeit bis Erschöpfung und Leistung an der zweiten Schwelle. [I2] – **A, Intervention**
- Die Netzwerk-Metaanalyse mit Individualdaten (13 Studien, n = 348, davon 52 Frauen) fand zwischen polarisiert und pyramidal keinen Unterschied für VO2max (SMD −0,06) und Zeitfahren (SMD −0,05). Das Leistungsniveau moderiert: Wettkampfathleten profitierten bei VO2max eher von polarisiert, Freizeitathleten eher von pyramidal. [I3] – **A/B, Intervention**
- Beschreibend: In retrospektiven Analysen von Spitzen-Ausdauerathleten waren 89 Verteilungen pyramidal, 65 polarisiert und 8 schwellenbetont. [I4] – **C, Beschreibung**
- Ironman-spezifisch (9 Athleten, gleicher Plan, 18 Wochen): rund 68 % der Trainingszeit unter der aeroben Schwelle. Mehr Zeit in dieser Zone hing stark mit schnelleren Wettkampfzeiten zusammen (r = −0,92). Ein hoher Anteil zwischen den Schwellen hing mit langsameren Zeiten zusammen (r = 0,94), obwohl dort gerennt wird. Die Autoren vermuten, dass viel Radtraining in dieser mittleren Zone eher schadet. [I5] – **C, Korrelation (n = 9)**

**Folgerung für den Generator**

- Grundverteilung: deutlich überwiegend niedrige Intensität. Pyramidal und polarisiert sind beide zulässig, keine Verteilung wird als „optimal“ ausgegeben. (A)
- Für Freizeit-Langdistanz ist **pyramidal die Voreinstellung**; Begründung [I3], aber mit dem Hinweis, dass der Effekt klein und unsicher ist. (B, Übertragung auf Triathlon = **H**)
- Zielanteil niedrige Intensität ca. 70–90 % der Ausdauerzeit, je nach Philosophie-Regler (3.2). Die Spanne ist **H**, angelehnt an [I4] und [I5].
- Zuordnung der 5 App-Zonen zum 3-Zonen-Modell der Studien: Z1–Z2 ≈ niedrig, Z3 ≈ mittel, Z4–Z5 ≈ hoch. Das ist eine **Näherung (H)**, weil die App-Zonen auf FTP bzw. Nutzerwerten beruhen, nicht auf gemessenen Laktat- oder Ventilationsschwellen.

### 2.2 Periodisierung

**Befunde**

- Die Metaanalyse zur Blockperiodisierung fand kleine Vorteile gegenüber traditioneller Periodisierung: VO2max SMD 0,40 (0,02–0,79), Wmax SMD 0,28 (0,01–0,54). Die Studien waren klein und methodisch schwach (mittlerer PEDro-Wert 3,7/10). [P1] – **B/C, Intervention**
- **Erholungswochen im Rhythmus 3:1** (drei Belastungs-, eine Entlastungswoche): In dieser Recherche wurde **keine kontrollierte Studie** gefunden, die diesen Rhythmus mit anderen vergleicht. Er stammt aus Lehrbüchern und der Trainingspraxis. – **D/H**

**Folgerung**

- Phasenfolge Grundlage → Aufbau → spezifisch → Taper als **Konvention (D)**; keine Behauptung, dass sie besser ist als Alternativen.
- Blockperiodisierung nicht als Voreinstellung (Evidenz zu schwach), höchstens als spätere Option.
- Entlastungswochen: **fester Rhythmus jede 4. Woche** (3:1), ab 50 Jahren jede 3. Woche; Umfang −20 bis −40 % je nach Regler. Der Rhythmus hängt **nicht** vom Regler ab (Entscheidung 3.6). Rhythmus und Höhe sind **H**. Zusätzlich wird eine Entlastung eingeplant, wenn Frische oder Beschwerden das nahelegen (2.9) – nicht nur nach Kalender.

### 2.3 Umfangssteigerung und Verletzungsrisiko

**Befunde**

- Randomisierte Studie mit 532 Laufeinsteigern (Vorbereitung auf 6,7 km): Ein 13-Wochen-Programm nach der 10-%-Regel senkte die Verletzungsrate nicht gegenüber einem 8-Wochen-Standardprogramm (20,8 % vs. 20,3 %). [V1] – **B, Intervention** (nur kurze Distanz, Einsteiger)
- Kohorte mit 874 Einsteigern: Über 30 % Steigerung des Wochenumfangs hing tendenziell mit mehr „distanzbezogenen“ Verletzungen zusammen (HR 1,59; 0,96–2,66). Das war **nicht signifikant**, die Studie war explorativ. Für alle Verletzungen zusammen zeigte sich kein Unterschied. [V2] – **C, Korrelation**
- Kohorte mit 5205 Läufern und 588 071 Einheiten: Das Risiko stieg, wenn **eine einzelne Einheit** länger war als der längste Lauf der letzten 30 Tage:
  - mehr als 10–30 % länger: HRR 1,64
  - mehr als 30–100 % länger: HRR 1,52
  - mehr als doppelt so lang: HRR 2,28

  Das Verhältnis von Woche zu Woche zeigte keinen Zusammenhang. [V3] – **B, Korrelation** (Verletzungen selbst berichtet, beobachtend)
- Das Verhältnis von akuter zu chronischer Belastung (ACWR) ist konzeptionell und statistisch problematisch. Die Autoren empfehlen, es als Verletzungsprädiktor nicht mehr zu verwenden. [V4, V5] – **B, Methodenkritik**

**Folgerung**

- Die Forschung liefert keine gesicherte Prozentgrenze für den Wochenumfang. Die Grenzen in 3.1 und 3.4 sind deshalb Festlegungen, keine Evidenzregel (Abschnitt 4).
- Wochensteigerungen werden **je Sportart** begrenzt (Festlegung in 3.1: Laufen streng, Rad/Schwimmen/Kraft lockerer). Die Grenzen dienen der Belastungssteuerung und werden nicht als garantierter Verletzungsschutz dargestellt.
- **Längste Laufeinheit:** Im generierten Plan darf der längste Lauf den längsten Lauf der letzten 30 Tage um höchstens 10 % übersteigen (Festlegung 3.1, gestützt auf [V3]). Bei tatsächlich erfassten Läufen, die darüber liegen, gibt es einen Hinweis. Der Plan enthält dafür je Woche eine lange Laufeinheit als Schlüsseleinheit (3.4).
- Kein ACWR in der App.

### 2.4 Tapering

**Befunde**

- Metaanalyse (27 Studien, Sportarten gemischt): Am wirksamsten war ein Taper von etwa 2 Wochen (ES 0,59). Der Umfang wurde dabei exponentiell um 41–60 % gesenkt (ES 0,72); Intensität und Häufigkeit blieben erhalten. [T1] – **A, Intervention**
- Metaanalyse nur Ausdauersport (14 Studien): Tapering verbesserte Zeitfahren (SMD −0,45) und Zeit bis Erschöpfung (SMD 1,28), aber nicht VO2max oder Ökonomie. Wirksam waren Umfang −41–60 % bei erhaltener Intensität und Häufigkeit, über ≤ 7, 8–14 oder 15–21 Tage. Ein Taper nach vorheriger Überlastung wirkte stärker. [T2] – **A/B, Intervention**
- Ironman-spezifische Taper-Studien wurden **nicht gefunden**; die Übertragung auf 9–17 Stunden Wettkampfdauer ist eine Annahme.

**Folgerung**

- Voreinstellung: 2 Wochen Taper (einstellbar 1–3), Umfang progressiv auf −40 bis −60 % in der Wettkampfwoche, Intensitätsschwerpunkte bleiben in verkürzter Form erhalten, Zahl der Einheiten bleibt möglichst gleich. (A; Übertragung auf Langdistanz = **H**)

### 2.5 Krafttraining für Ausdauerathleten

**Befunde**

- Übersichtsarbeit: Schweres oder explosives Krafttraining zusätzlich zum Ausdauertraining verbessert die Laufökonomie. Beim Radfahren ist die Evidenz für schweres Krafttraining am stärksten. [K1] – **B, Übersicht**
- Metaanalyse Läufer (Ökonomie): Hohe Lasten (≥ 80 % 1RM) verbesserten die Ökonomie klein (ES −0,27), kombinierte Methoden moderat (ES −0,43). Plyometrie half nur bei langsamen Geschwindigkeiten (≤ 12 km/h). Die Programme dauerten 6–24 Wochen mit 1–4 Einheiten pro Woche; die Gewissheit war überwiegend moderat. [K2] – **A, Intervention**
- Metaanalyse Läufer (Leistung): Schweres Krafttraining kann Zeitfahren und Zeit bis Erschöpfung verbessern. [K3] – **A/B, Intervention**
- Metaanalyse Radfahrer (17 Studien): Schweres Krafttraining verbesserte Effizienz (ES 0,35), anaerobe Leistung (ES 0,56) und Radleistung, aber nicht VO2max oder den maximalen metabolischen Steady State. Die Gewissheit war **niedrig**. [K4] – **B, Intervention**
- Für Triathleten selbst gibt es kaum kontrollierte Studien; ein praxisorientierter Übersichtsartikel stützt sich überwiegend auf Studien mit Läufern und Radfahrern. [K5] – **D**

**Folgerung**

- Krafttraining ist fester Bestandteil des Plans. Voreinstellung 2 Einheiten pro Woche, in Taper- und Entlastungswochen 1. Die Spanne 1–2 ist **H**, angelehnt an die Studienprotokolle [K2].
- Die App erzeugt weiterhin **keine** Kraftprogramme; sie plant Anzahl und Dauer. Hinweistext: schwere Lasten bzw. kombinierte Methoden sind am besten belegt (K2–K4).

### 2.6 Concurrent Training (Interferenz)

**Befunde**

- Metaanalyse (43 Studien): Ausdauer- plus Krafttraining beeinträchtigt **nicht** die Maximalkraft (SMD −0,06) und das Muskelwachstum (SMD −0,01). Die **Explosivkraft** wird etwas gedämpft (SMD −0,28; −0,48 bis −0,08), stärker bei Training in derselben Einheit. Bei mindestens 3 Stunden Abstand war der Effekt nicht signifikant. [C1] – **A, Intervention** (Zielgröße Kraft, nicht Ausdauer)

**Folgerung**

- Kein Grund, Krafttraining aus Sorge um Interferenz zu streichen. (A)
- Sobald die App Tage plant (nicht Teil von 1.0): Kraft und Ausdauer möglichst als getrennte Einheiten mit ≥ 3 h Abstand. (B)

### 2.7 Bedeutung der Disziplinen im Ironman

**Befunde**

- 687 696 Ergebnisse von Altersklassen-Athleten: Rad- und Laufzeit korrelieren stärker mit der Gesamtzeit (r ≈ 0,88–0,90) als die Schwimmzeit. Alle Korrelationen nehmen mit dem Alter ab, beim Schwimmen am stärksten. [D1] – **C, Korrelation**
- 343 345 Ergebnisse aus 253 Rennen, Anteil an der Gesamtzeit: schnellste Leistungsgruppe ca. 10 % Schwimmen, 54 % Rad, 35 % Laufen; langsamste ca. 10 %, 48 %, 40 %. Die Schnellsten waren relativ am stärksten beim Laufen und in den Wechseln. [D2] – **C, Beschreibung/Korrelation**
- 184 Freizeit-Triathleten (Männer): im Mittel 13,9 ± 5,0 h Training pro Woche. Die Bestzeiten im Marathon und über die olympische Distanz sagten die Ironman-Zeit voraus; Trainingsvariablen kamen nicht ins Endmodell. [D3] – **C, Korrelation**
- Narrative Übersicht: Als Prädiktoren gelten Alter 30–35, schnelle Bestzeiten über die olympische Distanz und im Marathon sowie hoher Trainingsumfang. [D4] – **C/D**

**Folgerung**

- Diese Zahlen beschreiben **Zusammenhänge**, nicht den Nutzen zusätzlicher Trainingszeit. Eine Aussage wie „eine Stunde mehr Rad bringt dir am meisten“ ist damit **nicht** belegt. (Grundsatz in Abschnitt 4)
- Der Generator nutzt den Zeitanteil der Disziplinen am Rennen (≈ 10/50/40 %) als **Ausgangsgewichtung (H)**. Diese wird durch Leistungswerte, Umfang der letzten Wochen, Priorität des Nutzers und harte Mindestgrenzen angepasst. Seit Modell 1.7.0 schlägt der Planer die Priorität zusätzlich aus dem Testverlauf und den prognostizierten Zeitanteilen im Vergleich zu [D2] vor (`PLAN_MODEL.md`, Änderung 24) – als **H** und mit dem Hinweis, dass der Nutzen von mehr Training in der relativ schwächeren Disziplin nicht belegt ist.
- **Schwimmen bleibt als Sicherheits- und Finisherbedingung immer im Plan**: Mindestumfang und Mindestzahl an Einheiten (H). Auch wenn die Korrelation niedrig ist – ein nicht beendetes Schwimmen beendet das Rennen.

### 2.8 Impulse-Response-Modelle (Banister, Fitness-Fatigue)

**Befunde**

- 9 Elite-Schwimmer, eine Saison: Das Modell passte die Leistungen gut an (R² = 0,79). Die Parameter hatten aber sehr weite Konfidenzintervalle (z. B. Abklingzeit Fitness 38 Tage, 95 %-KI 17–59) und waren teils stark korreliert, sodass ihre Deutung wertlos war. [B1] – **C, Methode**
- Kommentar: Die Parameter hängen von Startwerten, Schätzverfahren und Belastungsmaß ab. Allgemeine Konstanten sollten vermieden werden; das Modell eignet sich zum „datengestützten“, nicht zum „datengetriebenen“ Arbeiten. [B2] – **D**
- Bayes-Analyse 2025: Das Modell ist schlecht konditioniert; insbesondere die Ermüdungsparameter sind kaum identifizierbar. [B3] – **B/C, Methode**

**Folgerung**

- **Keine Leistungsvorhersage** über ein Fitness-Fatigue-Modell mit allgemeinen Konstanten.
- Belastungsverläufe (Session Load, gleitendes Mittel) werden weiter **beschreibend** gezeigt, ohne sie als „Form“ oder „Fitness“ zu bezeichnen.

### 2.9 Monitoring, subjektive Maße, Überlastung

**Befunde**

- Session-RPE: Laut Übersicht über 36 Validierungsstudien ist die Methode valide und gut reliabel, über Sportarten, Geschlechter und Leistungsniveaus. [M2] – **B, Methode**
- Systematische Übersicht (56 Studien): Subjektive Maße bildeten akute und chronische Belastung empfindlicher und konsistenter ab als objektive (z. B. Blutwerte, Herzfrequenz). Beide korrelierten meist nicht miteinander. [M3] – **B**
- Konsens ECSS/ACSM: Training braucht Überlastung, aber nicht in Verbindung mit zu wenig Erholung. Funktionelles und nicht-funktionelles Overreaching sowie Übertraining sind schwer zu unterscheiden. Kein einzelner Marker ist als Diagnose allgemein anerkannt. [M4] – **D, Konsens**

**Folgerung**

- Frische-Check-in, RPE und Beschwerden sind die Eingangsgrößen für **„Überprüfung statt Steigerung“** (Beispielathlet F in `MODEL_VALIDATION.md`). Schwellen (z. B. Frische ≤ 3 in zwei aufeinanderfolgenden Wochen → keine Steigerung, Entlastung vorschlagen) sind **H**.
- Seit 0.16.0 zusätzlich **Session-RPE lockerer Einheiten** als Signal: Fühlen sich Regenerations-, Grundlagen- und lange Einheiten hart an (letzte 14 Tage, ≥ 3 Einheiten, Ø RPE ≥ 6 oder ≥ 1,5 Punkte über den 4 Wochen davor bei Ø ≥ 5), schlägt die App eine Entlastungswoche vor. Gestützt auf [M2, M3] (RPE valide, subjektive Maße empfindlich); Schwellen **H**. Nur lockere Einheiten, weil bei harten Einheiten ein hoher RPE gewollt ist.
- Keine medizinischen Aussagen; bei anhaltender Verschlechterung Hinweis auf ärztliche Abklärung, entsprechend [M4].

### 2.10 Zonen: FTP, Schwellenpace, CSS

**Befunde**

- FTP (20-min-Test): sehr gut wiederholbar (Messfehler ± 3 W). Die Leistung am maximalen Laktat-Steady-State lag aber im Mittel 26 ± 7 W darunter (n = 11). [Z1] – **C, Methode**
- Metaanalyse: Critical Power und der maximale Laktat-Steady-State weichen individuell stark voneinander ab und sind nicht austauschbar. [Z2] – **B, Methode**
- Critical Swim Speed: Eine frühe Studie sah CSS nahe am maximalen Laktat-Steady-State [Z3]. Eine spätere Studie fand CSS deutlich darüber (92,7 vs. 88,3 % der maximalen aeroben Geschwindigkeit, n = 8) [Z4]. – **C, Methode, uneinheitlich**

**Folgerung**

- FTP, Schwellenpace und CSS sind **praktische Ankerwerte mit bekanntem Fehler**, keine physiologischen Schwellen. Zonen daraus sind Konventionen (D) bzw. Vorschläge (H) und werden so beschriftet.
- Für Laufen und Schwimmen bietet die App seit 0.15.0 **abgeleitete Zonen als Vorschlag** an, mit sichtbarem Hinweis „nicht individuell validiert“. Die manuelle Eingabe hat immer Vorrang (ein neuer Ankerwert überschreibt manuelle Grenzen nicht; der Vorschlag wird nur nach Tippen übernommen).
  - **Laufen (seit 0.15.1, auf die Langdistanz ausgelegt):** Z1 langsamer als 150 %, **Z2 Grundlage 150–128 %**, Z3 Tempo 128–105 %, Z4 Schwelle 105–96 %, Z5 schneller als 96 % der Schwellenpace (Zeit pro km). Beispiel 3:55 /km: Grundlage 5:53–5:02 /km, Tempo 5:01–4:08 /km. – **H** aus **D**
    - Leitregel (Produktentscheidung 3.6): Grundlage ist **nicht schneller als ein realistisches Ironman-Marathontempo**.
    - Ironman-Marathontempo, grob geschätzt: offener Marathon nach Daniels ≈ 106 % der Schwellenpace (M-Tempo ≈ 75–84 % gegenüber T ≈ 88 % der VO2max-Geschwindigkeit) [Z7]; ein Ironman-Marathon dauert bei Altersklassen-Athleten 20–45 min länger als der offene [Z8] → ≈ 118–133 % der Schwellenpace. Die Grenze 128 % liegt in dieser Spanne; das Wettkampftempo fällt damit an den Übergang Z2/Z3, wie es Praxisquellen für die Langdistanz beschreiben (oberes Z2 bis unteres Z3) [Z9].
    - Daniels' lockeres Tempo (E, etwa 59–74 % der VO2max) liegt rechnerisch bei etwa 120–150 % der Schwellenpace [Z7]; die App nimmt bewusst nur den langsameren Teil als Grundlage.
    - Z4/Z5 wie Friel (Z4 + Z5a umschließen die Schwellenpace, Z5 ab Friel Z5b) [Z5].
    - **Verworfen (0.15.0):** Friels allgemeine Pace-Zonen (Z2 = 114–129 %) [Z5]. Für 3:55 /km wäre Grundlage bis 4:27 /km gegangen – deutlich schneller als ein Ironman-Marathon und für lockere Langdistanz-Einheiten unrealistisch (Nutzer-Rückmeldung 18.11.2026). Gespeicherte Zonen nach diesem Schema werden als „altes Schema“ markiert und zum Ersetzen angeboten.
  - Schwimmen: Abstände zur CSS in Sekunden pro 100 m, wie in der Praxis üblich (Swim Smooth: locker ≈ CSS + 8–10 s, gleichmäßig ≈ + 6 s, hart = CSS [Z6]; Friel: „T-Zeit ± wenige Sekunden“ [Z5]). Festgelegt: Z2 ab CSS + 12 s, Z3 ab + 5 s, Z4 ab + 2 s bis − 2 s, Z5 ab − 3 s. – **D**, Abstände **H**
  - Plausibilität: Die im Planer geschätzte lockere Laufpace (Schwellenpace × 1,4 seit `im-gen-1.6.0`, vorher × 1,25) liegt in der Mitte von Z2; ein tatsächlicher langer Lauf aus den Testdaten (5:33 /km) ebenfalls. Schwimmen: Die Grundlage endet bei CSS + 6 s und ist damit nicht schneller als ein übliches Langdistanz-Schwimmtempo; die CSS selbst liegt in Z4.

### 2.11 Wettkampfprognose

**Befunde**

- Gleichung für Freizeit-Männer (n = 184): Ironman-Zeit (min) = 152,1 + 1,332 × Marathon-Bestzeit (min) + 1,964 × Bestzeit olympische Distanz (min). Bestimmtheitsmaß r² = 0,65, Standardschätzfehler **56,8 min**. [D3] – **C, Korrelation**
- Individuelle Unterschiede im Trainingserfolg: In der HERITAGE-Studie (481 zuvor inaktive Erwachsene, 20 Wochen) war die Streuung der VO2max-Zunahme zwischen Familien 2,5-mal größer als innerhalb; die Erblichkeit wurde auf bis zu 47 % geschätzt. [R1] – **B** (Population inaktiv, nicht Triathleten)

**Folgerung**

- Prognose nur als **Spanne**. Seit 0.18.0 (Produktentscheidung 18.11.2026) nicht nur aus Bestzeiten, sondern je Teildisziplin auch aus Leistungswerten (FTP, Schwellenpace, CSS) und **absolviertem Training** der letzten 8 Wochen; die Formeln nach Rüst [D3, D7] werden zum Vergleich gezeigt. Modell, Faktoren und Quellen: `PROGNOSIS_MODEL.md`. Die Trainings-Schätzwege sind Heuristiken (H).
- Weil individuelle Reaktionen stark streuen [R1], setzt der Generator auf **Rückkopplung**: Anpassungsvorschläge aus tatsächlichen Daten (M3.6) statt einmaliger „optimaler“ Planung.

### 2.12 Verletzungsrisiko nach Disziplin und nach Intensität

**Befunde**

- Systematische Übersicht Kurzdistanz (42 Studien): Am häufigsten waren Überlastungsverletzungen der unteren Extremität, überwiegend dem Laufen zugeschrieben. Je nach Studie entfielen 45–92 % der Verletzungen auf das Laufen, 8–34 % auf das Rad und 3–15 % auf das Schwimmen. [X1] – **B/C, Beobachtung**
- Systematische Übersicht Langdistanz: Überlastungsverletzungen überwogen, am häufigsten an Knie und Wirbelsäule. Laufen und Radfahren waren die am häufigsten betroffenen Disziplinen. Die Literatur ist dünn. [X2] – **C, Beobachtung**
- Randomisierte Studie „Run Clever“ mit Freizeitläufern (447 nach 8 Wochen Vorbereitung): Ob über 16 Wochen die Intensität oder der Umfang gesteigert wurde, machte für die Verletzungsrate keinen signifikanten Unterschied. Alle Konfidenzintervalle schlossen null ein. [X3] Die gleiche Studie prüfte auch einzelne Verletzungsarten. [X4] – **B, Intervention**

**Folgerung**

- Laufen ist die verletzungsträchtigste Disziplin; Rad, Schwimmen und Kraft vertragen schnellere Steigerungen. Das ist durch [X1, X2] gestützt (beobachtend).
- Intensive Einheiten aufs Rad zu legen und locker zu laufen, verringert vor allem die **gesamte Laufbelastung**. Dass harte Läufe an sich riskanter sind als längere lockere, ist durch [X3] **nicht** belegt. Die Regel ist eine **Festlegung von Nutzer** (Abschnitt 3.1), plausibel begründet, aber nicht als Verletzungsschutz zu versprechen.

### 2.13 Wochenumfang: übliche Spanne, Obergrenze, zu wenig Zeit

**Befunde**

- 184 Freizeit-Finisher (Männer) einer Langdistanz trainierten 13,9 ± 5,0 h pro Woche (6,3 km Schwimmen, 194 km Rad, 45 km Laufen). Trainingsumfang kam nicht ins Prognosemodell; Bestzeiten über Marathon und olympische Distanz sagten die Zielzeit voraus. [D3] – **C, Beschreibung/Korrelation**
- Ältere Befragung „typischer“ Langdistanz-Teilnehmer: im Mittel etwa 9 km Schwimmen, 270 km Rad und 58 km Laufen pro Woche; Trainingsdistanzen waren wichtiger als Trainingstempo. [D6] – **C, Beschreibung**
- Mitteldistanz, 209 Teilnehmende (155 Männer, 54 Frauen): 13,9 ± 5,4 h pro Woche, **ohne Unterschied** zwischen schnellen und langsamen Gruppen. Besser sagten Alter, bisherige Bestzeit und Zielsetzung die Zeit voraus. [D5] – **C, Korrelation**
- Langdistanz-Athleten (retrospektive Befragung): Wer viele Wochenstunden trainierte, hatte häufiger Muskel- und Sehnenverletzungen (p = 0,014). [X5] – **C, Korrelation**
- Metaanalyse 2026 (37 Studien, 1,3 Mio. Personen): Bewegung senkt in der Allgemeinbevölkerung die Chance auf Vorhofflimmern; der Zusammenhang ist **U-förmig**. Ab etwa 78 MET-h/Woche (von den Autoren grob mit 6–7 h Ausdauertraining gleichgesetzt) stieg die Chance wieder (OR 1,54; 1,01–2,35). Athleten hatten höhere Chancen als Nicht-Athleten (OR 2,74), signifikant nur bei Männern. Evidenz laut GRADE **sehr gering** (beobachtend, unbereinigt, Publikationsbias). [H1] – **C, Korrelation**

**Folgerung**

- Es gibt **keine** Studie, die einen „optimalen“ Wochenumfang für Freizeit-Triathleten kausal belegt. Belegt ist, in welcher Spanne Finisher trainieren, und dass mehr Stunden in der Mitteldistanz-Studie schnelle und langsame Athleten nicht unterschied [D5].
- Die App plant deshalb **nicht** einfach so viel, wie Zeit da ist. Sie begrenzt den Spitzenumfang auf die beobachtete Spanne (R22), **unabhängig vom Regler**: Langdistanz **19 h** (≈ Mittel + 1 SD) [D3]; Mitteldistanz 16 h [D5]; olympisch 12 h und Sprint 9 h sind **H** (keine passenden Studien gefunden).
- Höhere Umfänge hängen beobachtend mit mehr Sehnenverletzungen [X5] und – sehr unsicher – mit mehr Vorhofflimmern [H1] zusammen; das stützt eine Obergrenze. Training für eine Langdistanz liegt in jedem Fall über dem Bereich mit dem niedrigsten AF-Risiko; das wird nicht verschwiegen, aber auch nicht dramatisiert (Evidenz sehr gering). „Konservativ“ heißt in der App **nicht** weniger Trainingszeit, sondern weniger Intensität (3.6).
- **Zu wenig Zeit:** Langdistanz unter 9 h/Woche (Mittel − 1 SD [D3]) → Hinweis; unter 6 h → deutliche Warnung, ein sicheres Finish ist nicht wahrscheinlich. Mitteldistanz unter 6 h Hinweis, unter 4 h Warnung (**H**). Die App plant trotzdem – sie verweigert nichts, sagt aber klar, was die Daten nahelegen.
- Wer schon mehr trainiert als die Obergrenze, wird nicht heruntergezwungen (R0), aber auch nicht weiter gesteigert.

---

### 2.15 VO2max: Messung und Schätzung (seit 0.20.0)

**Befunde**

- Metaanalyse (14 Validierungsstudien, Sportuhren und Wearables): Geräte, die Belastungsdaten nutzen, schätzten im Mittel fast ohne systematischen Fehler, aber mit Übereinstimmungsgrenzen von etwa −9,9 bis +9,7 ml/kg/min; Schätzungen aus Ruhedaten überschätzten (Bias +2,2; Grenzen −13,1 bis +17,4). Fazit der Autoren: auf Bevölkerungsebene brauchbar, für den Einzelnen ist der Fehler groß. [V6] – **A/B, Methode**
- Cooper-Test (12 min Lauf): VO2max ≈ (Strecke in m − 504,9) / 44,73 [V7]; Feldtest, abhängig von Tempoeinteilung, Motivation und Laufökonomie. – **C/D, Methode**

**Folgerung**

- VO2max wird in der App **nur dokumentiert** (Wert, Datum, Methode, Quelle) und fließt nicht in Planung, Zonen oder Prognose ein.
- Veränderungen werden nur zwischen Werten **derselben Methode** angezeigt; bei gemischten Methoden steht ein Hinweis.

### 2.16 Trainingslager (seit 0.21.0)

**Befunde**

- 8-tägiges Trainingslager professioneller Radfahrerinnen mit **+49 % Trainingsumfang**: 5 von 9 waren am Ende überlastet (30-min-Zeitfahren −7 %), 4 hatten sich angepasst (+1,7 %). Die Autoren empfehlen, die Belastung während eines Camps zu überwachen. [C1] – **C**, kleine Stichprobe
- 14-tägiges Camp mit überwiegend lockerem Training bei Elite-Radfahrern: Belastung **+48 ± 27 %** gegenüber dem gewohnten Training, danach 10 Tage Erholung mit **−56 ± 23 %**. [C2] – **B/C**, beschreibt die übliche Dosierung
- Dreiwöchige Überlastung bei Triathleten (vor einem Taper): Wer dabei nur akut ermüdete, steigerte sich danach stärker als die funktionell Überlasteten; Letztere hatten mehr Infekte. Mehr ist also nicht automatisch besser. [C3] – **B**
- Überlastung in Studien geht teils bis rund +100 % Belastung; das sind kontrollierte Interventionen mit Leistungssportlern und keine Empfehlung für Freizeitsportler. – **H** (Einordnung)

**Folgerung (R23)**

- Im Camp erhöht der Planer den Umfang **vor allem auf dem Rad und im Wasser** und **locker**: Grenzen Rad/Schwimmen × (1 + 0,5 bzw. 0,4 × Camptage/7), Budget der Woche = normales Budget an den übrigen Tagen + angegebene Stunden pro Camptag. Ergebnis bei einer vollen Campwoche typischerweise **≈ +50 %** Gesamtumfang wie in [C1, C2]. Der Faktor selbst ist **H**.
- **Laufen bleibt bei den normalen Grenzen** (Produktentscheidung, 19.11.2026): Laufen hat das höchste Verletzungsrisiko je Stunde (2.12, R6a).
- Der Mehrumfang ist locker (Intensität wird auf den normalen Umfang gerechnet), höchstens eine Krafteinheit.
- **Danach eine Erholungswoche**: × 0,6 nach Camps ab 7 Tagen, × 0,7 bei kürzeren (**H**, angelehnt an −56 % in [C2]).
- Eine fällige Entlastungswoche rückt vor das Camp; Camps im Taper werden ignoriert (W12), weil Mehrumfang so kurz vor dem Rennen dem Taper widerspricht (2.4).
- Die Obergrenze R22 gilt in Campwochen nicht – ein Camp ist eine bewusste, kurze Ausnahme; danach steigen die Folgewochen nur normal weiter.

## 3. Festlegungen und Regelkatalog

### 3.1 Produktfestlegungen (17.11.2026)

Diese Punkte sind **Produktentscheidungen**. Wo es Forschung dazu gibt, ist sie verlinkt; wo nicht, gelten sie als begründete Heuristik.

1. **Start beim aktuellen Umfang – vor allem beim Laufen.** Der Plan beginnt beim tatsächlichen Umfang der letzten Wochen (Profil-Angabe „aktueller Trainingsumfang“ mit Bezugszeitraum, ergänzt durch erfasste Einheiten), nicht bei dem, was der Wettkampf „erfordern“ würde. Beispiel: Aktuell 1 h und 10 km Laufen pro Woche → Woche 1 höchstens 1:06 h und 11 km, auf keinen Fall 2 h und 24 km. Für das Laufen ist das eine **harte Grenze**. Stützende Evidenz: [V3] (Sprünge gegenüber dem Vorher), [X1, X2] (Laufen trägt das höchste Risiko).
2. **Laufen langsamer steigern als Rad, Schwimmen und Kraft.** Laufen höchstens +10 % pro Woche (Dauer, Distanz, längster Lauf), Rad/Schwimmen/Kraft höchstens +20 % (3.4). [X1, X2]
3. **Intensität aufs Rad, Laufen locker.** Hohe Intensität (App-Zonen Z4–Z5) wird beim Rad geplant; Laufen überwiegend Z1–Z2. Begründung und Grenze der Evidenz: Abschnitt 2.12.
4. **Intensitätsverteilung folgt dem Philosophie-Regler.** „Konservativ / Langlebigkeit“ ↔ „Aggressiv / zeitoptimiert“ (Abschnitt 3.2).
5. **Entlastungswochen** sind fester Bestandteil – für die Anpassung und zur Schonung von Sehnen und Gelenken. Für den Schonungseffekt wurde keine kontrollierte Studie gefunden (Abschnitt 2.2); die Regel bleibt eine bewusste Festlegung.

### 3.2 Philosophie-Regler (0 = konservativ/Langlebigkeit, 100 = aggressiv/zeitoptimiert)

Der Regler verschiebt **innerhalb der harten Grenzen** – er hebt keine Grenze auf.

Der Regler steuert **die Intensität** (und das Lauf-Steigerungstempo), **nicht die Trainingszeit** (Entscheidung 3.6, Modell `im-gen-1.3.0`). Er wirkt **nicht linear**: In der Mitte ändert er wenig, zu den Enden hin stark (Kurve f(t) = 0,5 + 0,5·(0,4u + 0,6u³), u = 2t − 1). So bleiben mittlere Stellungen ausgewogen, die Extreme sind deutlich unterschiedlich (Entscheidung 3.6).

| Stellgröße | 0 (konservativ) | 50 | 100 (aggressiv) | Art |
|---|---|---|---|---|
| Anteil niedrige Intensität (Z1–Z2) an der Ausdauerzeit | 90 % | 80 % | 70 % | H, Spanne aus 2.1 |
| Verteilungsform (Anteil Z3 an der nicht niedrigen Zeit) | pyramidal (75 %) | ≈ 48 % | polarisiert betont (20 %) | H; für Freizeitathleten zeigte [I3] eher Vorteile für pyramidal – „aggressiv“ heißt **zeiteffizienter**, nicht nachweislich schneller |
| Anteil Z5 an Z4–Z5 | 20 % | 35 % | 50 % | H |
| Laufintensität | nur Z1–Z2 | nur Z1–Z2 | ab 60: kurze Abschnitte im Renntempo (bis 6 % der Laufzeit, spezifische Phase) | Festlegung 3 |
| Wochensteigerung Laufen | +5 % | +7,5 % | +10 % (Obergrenze) | Festlegung 1–2; die nicht gelaufene Zeit geht aufs Rad (R17), die Gesamtzeit bleibt fast gleich |
| **Nicht vom Regler abhängig** | Spitzenumfang (R22, Langdistanz 19 h), Rad/Schwimmen/Kraft +15 %/Woche, langer Lauf höchstens 3:00 h / 32 km, Entlastung −30 % jede 4. Woche | | | 3.6 |
| Entlastungsrhythmus | **fest jede 4. Woche** (ab 50 Jahren jede 3.), unabhängig vom Regler | | | Entscheidung 3.6 |
| Kraft | 2×/Woche | 2× | 1× (ab 67) | H, 2.5 |

Im Begründungstext steht immer, dass ein aggressiverer Plan **nicht** belegt schneller macht, sondern mehr Intensität pro Stunde einsetzt.

### 3.3 Regelkatalog für den Generator (Entwurf für M3.2)

| # | Regel | Art | Grad | Quelle |
|---|---|---|---|---|
| R0 | **Start beim aktuellen Umfang**; Laufen Woche 1 ≤ aktueller Umfang × 1,10 (Dauer, Distanz, längster Lauf) – harte Grenze. Ohne Angaben zum aktuellen Laufumfang (Profil oder erfasste Einheiten) wird kein Laufumfang geplant, sondern nachgefragt | Festlegung + Evidenz (Korrelation) | B/H | V3, X1, X2 |
| R1 | Überwiegend niedrige Intensität, Anteil und Verteilungsform nach Philosophie-Regler (3.2) | Evidenz + Festlegung + H (Spanne) | A/B | I2, I3, I4, I5 |
| R2 | Keine Verteilung wird als „optimal“ bezeichnet | Evidenz | A | I2, I3 |
| R3 | Phasen Grundlage → Aufbau → spezifisch → Taper | Konvention | D | P1 |
| R4 | Entlastungswoche fest jede 4. Woche (ab 50 Jahren jede 3.), Tiefe −20 bis −40 % nach Regler, zusätzlich nach Frische/Beschwerden | Festlegung + H | D/H | P1, M3, M4, 3.6 |
| R5 | Steigerung **je Sportart**: Laufen höchstens +5–10 %/Woche je nach Regler (hart), Rad/Schwimmen/Kraft höchstens +20 %/Woche (3.4); Bezug letzte Belastungswoche, nach Pausen mindestens Mittel der letzten 3 (seit `im-gen-1.4.0`) | Festlegung + H | B/H | V1–V3, X1, X2 |
| R6 | Längste Laufeinheit höchstens +10 % gegenüber dem längsten Lauf der letzten 30 Tage – im Plan harte Grenze, bei erfassten Einheiten Hinweis | Festlegung + Evidenz (Korrelation) | B | V3 |
| R6a | Hohe Intensität (Z4–Z5) aufs Rad; Laufen Z1–Z2 (Ausnahme 3.2) | Festlegung | B/C (Disziplinrisiko), nicht belegt für Intensität an sich | X1–X4 |
| R7 | Kein ACWR | Evidenz | B | V4, V5 |
| R8 | Taper 2 Wochen (1–3), Umfang −40 bis −60 %, Intensität und Häufigkeit erhalten | Evidenz + H (Übertragung) | A | T1, T2 |
| R9 | Krafttraining 2×/Woche, in Entlastung/Taper 1× | H (Dosis), Evidenz (Nutzen) | A/B | K1–K4 |
| R10 | Startgewichtung Disziplinen nach Rennzeitanteil ≈ 10/50/40, angepasst durch Daten und Priorität | H | C | D1, D2 |
| R11 | Mindestumfang Schwimmen (Sicherheit, Finish) | H | – | – |
| R12 | Keine Fitness-Fatigue-Prognose mit allgemeinen Konstanten | Evidenz | B/C | B1–B3 |
| R13 | „Überprüfung statt Steigerung“ bei niedriger Frische, Beschwerden (Schmerz ≥ 4, als Signal seit 0.17.0) und hohem RPE lockerer Einheiten (seit 0.16.0) | Evidenz (Prinzip) + H (Schwellen) | B/D | M3, M4 |
| R14 | Zonen aus FTP/CSS/Schwellenpace nur als beschriftete Vorschläge (Laufen/Schwimmen seit 0.15.0) | Evidenz + Konvention | B/C/D | Z1–Z6 |
| R15 | Prognose nur als Spanne; aus Leistungswerten, Bestzeiten und absolviertem Training (seit 0.18.0, `PROGNOSIS_MODEL.md`) | Evidenz + H | C/D/H | D3, D7, P1–P5 |
| R16 | Anpassung über Rückkopplung statt einmaliger Optimierung | Evidenz (Prinzip) | B | R1 |
| R17 | Laufgrenze verhindert Umfang → freie Zeit geht aufs Rad (innerhalb +20 % und Budget) | Festlegung | – | 3.5 |
| R18 | Koppellauf nur in der spezifischen Phase; Freiwasser ab angegebenem Zeitpunkt | Festlegung | – | 3.5 |
| R19 | Vorbereitungswettkämpfe (mehrere, Datum frei) mit Wichtigkeit; Mini-Taper und Erholung nur nach Größe × Wichtigkeit (kurze Trainingsrennen ohne Änderung); Laufanteile zählen in R5/R6 | Festlegung + H (Taperlänge) | – | 3.5, T1, T2 |
| R20 | Zeitbudget ist harte Obergrenze; Spitzenwochen ≈ 90 % | Festlegung | – | 3.5 |
| R21 | Keine Wochentage, kein fester Ruhetag – die Woche ordnet der Nutzer selbst | Festlegung | – | 3.5 |
| R22 | **Obergrenze Wochenumfang** nach Wettkampfdistanz, unabhängig vom Regler (Langdistanz 19 h); Warnung bei zu wenig Zeit für die Distanz; aktueller Umfang wird nicht zwangsweise gesenkt | Beschreibung + H | C | D3, D5, D6, X5, H1, 3.6 |
| R23 | **Trainingslager**: Mehrumfang vor allem Rad und Schwimmen (locker), Laufen bei normalen Grenzen, Budget = Stunden pro Camptag; danach Erholungswoche; fällige Entlastung vor das Camp; kein Camp im Taper (seit 0.21.0, 2.16) | Beschreibung + Festlegung + H | B/C | C1, C2, C3 |

### 3.4 Produktentscheidungen (17.11.2026, Fragerunde 1)

| Frage | Entscheidung |
|---|---|
| Sichere Laufsteigerung reicht bis zum Wettkampf nicht | **Sicher bleiben + Warnung.** Die Steigerungsgrenze gilt immer. Der Plan zeigt mit Zahlen, welcher Umfang und längste Lauf erreichbar sind, und schlägt Run-Walk oder ein späteres Rennen vor. |
| Obergrenze Steigerung Rad, Schwimmen, Kraft | **+20 % pro Woche** (Laufen bleibt bei höchstens +10 %, je nach Regler +5–10 %). |
| Entlastungswochen | **Fester Rhythmus + adaptiv:** alle 3–4 Wochen je nach Regler, zusätzlich Vorschlag bei niedriger Frische oder Beschwerden. |
| Planungsebene | **Wochenziele + Schlüsseleinheiten** (z. B. langer Lauf, lange Ausfahrt, Rad-Intervalle, Koppellauf) ohne feste Wochentage. |

### 3.5 Produktentscheidungen (17.11.2026, Fragerunde 2)

| Frage | Entscheidung | Folgen für Modell und Datenmodell |
|---|---|---|
| Zeit, die wegen der Laufgrenze im Budget frei bleibt | **Mehr Rad.** | Umverteilung nur auf Rad, innerhalb der Rad-Steigerungsgrenze (+20 %) und des Zeitbudgets; Begründungstext nennt die Laufgrenze als Ursache. |
| Zusätzliche Schlüsseleinheiten | **Koppellauf** nach dem Rad, aber **nur kurz vor dem Wettkampf** (spezifische Phase). **Freiwasser/Neopren**, wenn möglich. Keine Rennsimulation, keine eigenen Technikeinheiten als Schlüsseleinheit. | Koppellauf zählt voll in Laufumfang und Laufsteigerung (R5, R6). Freiwasser braucht eine Angabe „ab wann möglich“ (Datum oder Phase); ohne Angabe nur ein Hinweis, keine eingeplante Einheit. |
| Vorbereitungswettkämpfe | **Fest einplanen mit Taper.** Datum frei einstellbar, **mehrere** möglich, selbst hinzufügbar. | Neues Datenobjekt „Vorbereitungswettkampf“ (Name, Datum, Sportart/Distanz, Priorität) je Plan → **neue DB-Version 6** und Backup-Format 6. Mini-Taper und Erholung danach skalieren mit der Distanz (Werte in M3.2, **H**). Laufanteile von Vorbereitungsrennen unterliegen ebenfalls R6: Liegt die Laufdistanz eines Rennens weit über dem bisher längsten Lauf, warnt der Planer und baut den langen Lauf, soweit die Grenzen es erlauben, darauf hin auf. |
| Nutzung des Zeitbudgets | **Obergrenze, Spitzenwochen ca. 90 %.** | Budget ist harte Obergrenze; der Umfang ergibt sich aus Startumfang und Steigerungsregeln; nur Spitzenwochen der spezifischen Phase nähern sich ca. 90 % des Budgets. |
| Ruhetag (17.11.2026, nachgereicht) | **Kein fester Ruhetag.** Die Wochenstruktur legt jede:r selbst fest – damit sich der Plan auch bei wechselnder Verfügbarkeit einhalten lässt. | Der Generator vergibt keine Wochentage, auch nicht für Schlüsseleinheiten (passt zu 3.4). Erholung wird über Wochenumfang, Intensitätsanteil und Entlastungswochen gesteuert, nicht über Kalendertage. |

### 3.6 Produktentscheidungen (17.11.2026, Rückmeldung zum ersten Planvorschlag)

| Rückmeldung | Umsetzung (`im-gen-1.2.0`) |
|---|---|
| Der Umfang wuchs einfach mit dem Zeitbudget mit (auch bei 30 h). Planung soll wissenschaftlich begründete Obergrenzen haben und warnen, wenn zu wenig Zeit da ist (z. B. 4 h für eine Langdistanz). | R22 und Abschnitt 2.13: Obergrenze aus beobachteten Umfängen, Warnungen W10 (zu wenig Zeit) und W11 (Budget bzw. aktueller Umfang über der Obergrenze). |
| Wie oft eine Entlastungswoche kommt, soll sich **nicht** mit dem Regler ändern. | Fester 3:1-Rhythmus; nur Alter (ab 50) und Frische/Beschwerden ändern ihn. |
| Der Regler soll an den Extremen mehr bewirken. | Nichtlineare Reglerkurve, breitere Intensitätsspannen (3.2): 90 ↔ 70 % locker, pyramidal ↔ polarisiert, Z5-Anteil 20 ↔ 50 %. |
| 18.11.2026: Laufen wuchs viel langsamer als die angezeigte Steigerung (+7,5 % → effektiv ≈ 3,7 %). | Bezug ist jetzt die letzte Belastungswoche (`im-gen-1.4.0`); der Mittelwertbezug war eine eigene Annahme ohne Evidenz und halbierte die Steigerung. |
| 18.11.2026: Vor Trainingswettkämpfen nicht pauschal stark tapern; 5/10 km bei niedriger Wichtigkeit fast unverändert. | Wichtigkeit je Vorbereitungsrennen (`im-gen-1.5.0`), Faktoren nach Größe × Wichtigkeit (H; Taper-Evidenz T1/T2 gilt für Zielwettkämpfe, nicht für Trainingsrennen). |
| 18.11.2026: Ausgangsumfang soll aus der erfassten Historie kommen. | Erfasste Einheiten haben Vorrang (R0), Profil wird bei Übernahme aktualisiert. |
| 18.11.2026: Sollen Entlastungswochen bei konservativer Einstellung stärker entlasten? | Nein, vorerst fest −30 %. Für Ausdauersport wurde keine Studie zur Tiefe von Entlastungswochen gefunden; Befragungen aus dem Kraftsport berichten 20–50 % weniger Umfang. Eine Kopplung an den Regler wäre wieder „konservativ = weniger Zeit“. Adaptiv wird bei niedriger Frische zusätzlich entlastet. |
| 18.11.2026: Zielzeit-Prognose nicht nur aus Bestzeiten, sondern auch aus dem absolvierten Training. | Je Teildisziplin bis zu drei Schätzwege (Leistungswert, Bestzeit, Training), Mittel der Spannen, Gesamtspanne = Summe (`PROGNOSIS_MODEL.md`). |
| 18.11.2026: Bei 3:55 /km Schwellenpace ist 4:27 /km keine Grundlage und schneller als ein Ironman-Marathon. | Laufzonen neu (2.10): Grundlage 150–128 % der Schwellenpace, nicht schneller als ein realistisches Ironman-Marathontempo; Schätztempo im Planer × 1,4 (`im-gen-1.6.0`). |
| „Konservativ“ soll **nicht weniger Trainingszeit** heißen, sondern größtenteils weniger Intensität. (`im-gen-1.3.0`) | Obergrenze (19 h Langdistanz), Rad/Schwimm-Steigerung (+15 %), langer Lauf (3:00 h) und Entlastungstiefe (−30 %) sind für alle Reglerstellungen gleich. Der Regler ändert Intensitätsverteilung, Renntempo-Anteil im Laufen, Lauf-Steigerungstempo (+5 ↔ +10 %, Rest aufs Rad) und Kraft (2 ↔ 1×). Im Beispielplan unterscheidet sich die Gesamtzeit zwischen Regler 0 und 100 um etwa 1 %, die harte Intensität um mehr als das Doppelte. |

---

## 4. Grundsätze

- Keine erfundenen Quellen, keine erfundenen Regeln. Jede Formel hat eine Quelle oder ist als Heuristik (H) markiert.
- Korrelation, Kausalität und Interventionsevidenz werden unterschieden und so benannt.
- Prozentgrenzen für Steigerungen (3.1, 3.4) sind bewusste Festlegungen zur Belastungssteuerung. Die App stellt sie nicht als wissenschaftlich gesicherte „Sicherheitsgrenze“ dar (Abschnitt 2.3).
- Mathematische Optimierung beweist keinen physiologisch optimalen Plan; sie macht einen begründeten Kompromiss nachvollziehbar.
- Die meisten Studien sind klein, kurz (4–24 Wochen) und überwiegend mit Männern. Frauen sind unterrepräsentiert (z. B. 52 von 348 in [I3]). Das wird in Begründungstexten erwähnt, wo es relevant ist.

## 5. Offene Lücken

- Keine kontrollierten Studien gefunden zur Verteilung zusätzlicher Trainingszeit auf die Disziplinen bei Altersklassen-Ironman-Athleten.
- Keine Ironman-spezifischen Taper-Studien gefunden.
- Keine kontrollierte Studie zum 3:1-Rhythmus von Entlastungswochen gefunden.
- Keine kausale Studie zum „richtigen“ Wochenumfang für Freizeit-Triathleten; die Obergrenzen (R22) beruhen auf beschreibenden Daten (überwiegend Männer). Für olympische und Sprintdistanz wurden keine passenden Umfangsdaten gefunden.
- Kaum Krafttrainingsstudien mit Triathleten; Übertragung von Läufern und Radfahrern.
- Prozentwerte für Lauf- und Schwimmzonen sind nicht individuell validiert.
- Sportartübergreifende Vergleiche (CSS vs. FTP vs. Schwellenpace) brauchen Referenzwerte; ohne sie keine präzise Vergleichszahl.

---

## 6. Quellen

**Intensitätsverteilung**
- [I1] Rosenblat MA, Perrotta SA, Vicenzino B. Polarized vs. threshold training intensity distribution on endurance sport performance: a systematic review and meta-analysis of randomized controlled trials. *J Strength Cond Res* 2019;33(12):3491–3500. doi:10.1519/JSC.0000000000002618
- [I2] Oliveira PS, Boppre G, Fonseca H. Comparison of polarized versus other types of endurance training intensity distribution on athletes' endurance performance: a systematic review with meta-analysis. *Sports Med* 2024;54(8):2071–2095. doi:10.1007/s40279-024-02034-z
- [I3] Rosenblat MA, Watt JA, Arnold JI, et al. (inkl. Seiler S). Which training intensity distribution intervention will produce the greatest improvements in maximal oxygen uptake and time-trial performance in endurance athletes? A systematic review and network meta-analysis of individual participant data. *Sports Med* 2025;55(3):655–673. doi:10.1007/s40279-024-02149-3
- [I4] Sperlich B, Matzka M, Holmberg HC. The proportional distribution of training by elite endurance athletes at different intensities during different phases of the season. *Front Sports Act Living* 2023. doi:10.3389/fspor.2023.1258585
- [I5] Muñoz I, Cejuela R, Seiler S, Larumbe E, Esteve-Lanao J. Training-intensity distribution during an Ironman season: relationship with competition performance. *Int J Sports Physiol Perform* 2014;9(2):332–339. doi:10.1123/ijspp.2012-0352

**Periodisierung**
- [P1] Mølmen KS, Øfsteng SJ, Rønnestad BR. Block periodization of endurance training – a systematic review and meta-analysis. *Open Access J Sports Med* 2019;10:145–160. doi:10.2147/OAJSM.S180408

**Progression und Verletzung**
- [V1] Buist I, Bredeweg SW, van Mechelen W, Lemmink KAPM, Pepping GJ, Diercks RL. No effect of a graded training program on the number of running-related injuries in novice runners: a randomized controlled trial. *Am J Sports Med* 2008;36(1):33–39. doi:10.1177/0363546507307505
- [V2] Nielsen RØ, Parner ET, Nohr EA, Sørensen H, Lind M, Rasmussen S. Excessive progression in weekly running distance and risk of running-related injuries: an association which varies according to type of injury. *J Orthop Sports Phys Ther* 2014;44(10):739–747. doi:10.2519/jospt.2014.5164
- [V3] Frandsen JSB, Hulme A, Parner ET, et al. (Nielsen RO, korresp.). How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study. *Br J Sports Med* 2025;59(17):1203–1210. doi:10.1136/bjsports-2024-109380
- [V4] Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *Int J Sports Physiol Perform* 2020;15(6):907–913. doi:10.1123/ijspp.2019-0864
- [V5] Impellizzeri FM, Woodcock S, Coutts AJ, Fanchini M, McCall A, Vigotsky AD. What role do chronic workloads play in the acute to chronic workload ratio? Time to dismiss ACWR and its underlying theory. *Sports Med* 2021;51:581–592. doi:10.1007/s40279-020-01378-6

**Tapering**
- [T1] Bosquet L, Montpetit J, Arvisais D, Mujika I. Effects of tapering on performance: a meta-analysis. *Med Sci Sports Exerc* 2007;39(8):1358–1365. doi:10.1249/mss.0b013e31806010e0
- [T2] Wang Z, Wang YT, Gao W, Zhong Y. Effects of tapering on performance in endurance athletes: a systematic review and meta-analysis. *PLoS One* 2023;18(5):e0282838. doi:10.1371/journal.pone.0282838

**Krafttraining und Concurrent Training**
- [K1] Rønnestad BR, Mujika I. Optimizing strength training for running and cycling endurance performance: a review. *Scand J Med Sci Sports* 2014;24(4):603–612. doi:10.1111/sms.12104
- [K2] Llanos-Lagos C, Ramirez-Campillo R, Moran J, Sáez de Villarreal E. Effect of strength training programs in middle- and long-distance runners' economy at different running speeds: a systematic review with meta-analysis. *Sports Med* 2024;54(4):895–932. doi:10.1007/s40279-023-01978-y
- [K3] Llanos-Lagos C, Ramirez-Campillo R, Moran J, Sáez de Villarreal E. The effect of strength training methods on middle-distance and long-distance runners' athletic performance: a systematic review with meta-analysis. *Sports Med* 2024. doi:10.1007/s40279-024-02018-z
- [K4] Llanos-Lagos C, Ramirez-Campillo R, Sáez de Villarreal E. Heavy strength training effects on physiological determinants of endurance cyclist performance: a systematic review with meta-analysis. *Eur J Appl Physiol* 2025. doi:10.1007/s00421-025-05883-2
- [K5] Strength training for long-distance triathletes: theory to practice. *Strength Cond J*. doi:10.1519/SSC.0000000000000660 (praxisorientierter Übersichtsartikel; Jahrgangsangaben in den Datenbanken uneinheitlich)
- [C1] Schumann M, Feuerbacher JF, Sünkeler M, Freitag N, Rønnestad BR, Doma K, Lundberg TR. Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. *Sports Med* 2022;52(3):601–612. doi:10.1007/s40279-021-01587-7

**Ironman-Leistung und Prognose**
- [D1] Knechtle B, Valero D, Villiger E, et al. Cycling and running are more predictive of overall race finish time than swimming in IRONMAN® age group triathletes. *Sports Med Open* 2025;11. doi:10.1186/s40798-025-00835-8
- [D2] Knechtle B, Käch I, Rosemann T, Nikolaidis PT. The effect of sex, age and performance level on pacing of Ironman triathletes. *Res Sports Med* 2019;27(1):99–111. doi:10.1080/15438627.2018.1546703
- [D3] Rüst CA, Knechtle B, Knechtle P, Rosemann T, Lepers R. Personal best times in an Olympic distance triathlon and in a marathon predict Ironman race time in recreational male triathletes. *Open Access J Sports Med* 2011;2:121–129. doi:10.2147/OAJSM.S23229
- [D4] Knechtle B, Knechtle R, Stiefel M, Zingg M, Rosemann T, Rüst CA. Variables that influence Ironman triathlon performance – what changed in the last 35 years? *Open Access J Sports Med* 2015;6:277–290.
- [D5] Predictive variables for half-Ironman triathlon performance. *J Sci Med Sport* 2014;17(3):300–305. doi:10.1016/j.jsams.2013.04.014 (Querschnitt, n = 209)
- [D6] Gulbin JP, Gaffney PT. Ultraendurance triathlon participation: typical race preparation of lower level triathletes. *J Sports Med Phys Fitness* 1999;39(1):12–15. (Wochendistanzen zitiert nach Knechtle et al.)
- [D7] Rüst CA, Knechtle B, Wirth A, Knechtle P, Ellenrieder B, Rosemann T, Lepers R. Personal best times in an Olympic distance triathlon and a marathon predict an Ironman race time for recreational female triathletes. *Chin J Physiol* 2012;55(3):156–162. (n = 28 in der Regression, r² = 0,53)
- [R1] Bouchard C, An P, Rice T, et al. Familial aggregation of VO2max response to exercise training: results from the HERITAGE Family Study. *J Appl Physiol* 1999;87(3):1003–1008. doi:10.1152/jappl.1999.87.3.1003

**Verletzungen nach Disziplin und Intensität**
- [X1] Guevara SA, Crunkhorn ML, Drew M, Waddington G, Périard JD, Etxebarria N, Toohey LA, Charlton P. Injury and illness in short-course triathletes: a systematic review. *J Sport Health Sci* 2024;13(2):172–185. doi:10.1016/j.jshs.2023.03.002
- [X2] Rhind JH, Dass D, Barnett A, Carmont M. A systematic review of long-distance triathlon musculoskeletal injuries. *J Hum Kinet* 2022;81:123–134. doi:10.2478/hukin-2022-0011
- [X3] Ramskov D, Rasmussen S, Sørensen H, Parner ET, Lind M, Nielsen RO. Run Clever – no difference in risk of injury when comparing progression in running volume and running intensity in recreational runners: a randomised trial. *BMJ Open Sport Exerc Med* 2018;4(1):e000333. doi:10.1136/bmjsem-2017-000333
- [X4] Ramskov D, Rasmussen S, Sørensen H, Parner ET, Lind M, Nielsen R. Progression in running intensity or running volume and the development of specific injuries in recreational runners: Run Clever, a randomized trial using competing risks. *J Orthop Sports Phys Ther* 2018;48(10):740–748. doi:10.2519/jospt.2018.8062

- [X5] Egermann M, Brocai D, Lill CA, Schmitt H. Analysis of injuries in long-distance triathletes. *Int J Sports Med* 2003;24(4):271–276. doi:10.1055/s-2003-39498

**Gesundheit**
- [H1] Davies CL, Pallikadavath S, Marcha DS, Lock S, Puranik A, Singh A, Ng GA, McCann GP. Physical activity, atrial fibrillation and the dose-response relationship: a systematic review and meta-analysis. *Eur J Prev Cardiol* 2026 (advance article). doi:10.1093/eurjpc/zwag535

**Modelle und Monitoring**
- [B1] Hellard P, Avalos M, Lacoste L, Barale F, Chatard JC, Millet GP. Assessing the limitations of the Banister model in monitoring training. *J Sports Sci* 2006;24(5):509–520. doi:10.1080/02640410500244697
- [B2] Vermeire K, Ghijs M, Bourgois JG, Boone J. The fitness-fatigue model: what's in the numbers? *Int J Sports Physiol Perform* 2022;17(5):810–813. doi:10.1123/ijspp.2021-0494
- [B3] Marchal A, Benazieb O, Weldegebriel Y, Méline T, Imbach F. Statistical flaws of the fitness-fatigue sports performance prediction model. *Sci Rep* 2025. doi:10.1038/s41598-025-88153-7
- [M1] Foster C, et al. A new approach to monitoring exercise training. *J Strength Cond Res* 2001;15(1):109–115.
- [M2] Haddad M, Stylianides G, Djaoui L, Dellal A, Chamari K. Session-RPE method for training load monitoring: validity, ecological usefulness, and influencing factors. *Front Neurosci* 2017;11:612. doi:10.3389/fnins.2017.00612
- [M3] Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. *Br J Sports Med* 2016;50(5):281–291. doi:10.1136/bjsports-2015-094758
- [M4] Meeusen R, Duclos M, Foster C, et al. Prevention, diagnosis and treatment of the overtraining syndrome: joint consensus statement of the ECSS and the ACSM. *Eur J Sport Sci* 2013;13(1):1–24 (parallel *Med Sci Sports Exerc* 2013;45(1):186–205).

**Trainingslager**
- [C1] Decroix L, Piacentini MF, Rietjens G, Meeusen R. Monitoring physical and cognitive overload during a training camp in professional female cyclists. *Int J Sports Physiol Perform* 2016;11(7):933–939. doi:10.1123/ijspp.2015-0570
- [C2] Almquist NW, Wilhelmsen M, Ellefsen S, Sandbakk Ø, Rønnestad BR. Effects of including sprints in LIT sessions during a 14-d camp on muscle biology and performance measures in elite cyclists. *Med Sci Sports Exerc* 2021;53(11):2333–2345. doi:10.1249/MSS.0000000000002709
- [C3] Aubry A, Hausswirth C, Louis J, Coutts AJ, Le Meur Y. Functional overreaching: the key to peak performance during the taper? *Med Sci Sports Exerc* 2014;46(9):1769–1777. doi:10.1249/MSS.0000000000000301

**VO2max**
- [V6] Molina-Garcia P, Notbohm HL, Schumann M, et al. Validity of estimating the maximal oxygen consumption by consumer wearables: a systematic review with meta-analysis and expert statement of the INTERLIVE network. *Sports Med* 2022;52(7):1577–1597. doi:10.1007/s40279-021-01639-y
- [V7] Cooper KH. A means of assessing maximal oxygen intake: correlation between field and treadmill testing. *JAMA* 1968;203(3):201–204.

**Zonen**
- [Z1] Lillo-Beviá JR, Courel-Ibáñez J, Cerezuela-Espejo V, Morán-Navarro R, Martínez-Cava A, Pallarés JG. Is the functional threshold power a valid metric to estimate the maximal lactate steady state in cyclists? *J Strength Cond Res* 2022;36(1):167–173. doi:10.1519/JSC.0000000000003403
- [Z2] Micheli L, Lucertini F, Grossi T, Pogliaghi S, Keir DA, Ferri Marini C. Analysis of the factors influencing the proximity and agreement between critical power and maximal lactate steady state: a systematic review and meta-analyses. *PeerJ* 2025;13:e19060. doi:10.7717/peerj.19060
- [Z3] Wakayoshi K, Yoshida T, Udo M, et al. Does critical swimming velocity represent exercise intensity at maximal lactate steady state? *Eur J Appl Physiol* 1993;66(1):90–95. doi:10.1007/BF00863406
- [Z4] Dekerle J, Pelayo P, Clipet B, Depretz S, Lefevre T, Sidney M. Critical swimming speed does not represent the speed at maximal lactate steady state. *Int J Sports Med* 2005;26(7):524–530.
- [Z5] Friel J. Joe Friel's Quick Guide to Setting Zones. TrainingPeaks (ursprünglich TrainingBible.com, 2009). https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/ – Praxisquelle (D)
- [Z7] Daniels J. *Daniels' Running Formula* (Human Kinetics; Trainingstempi E ≈ 59–74 %, M ≈ 75–84 %, T ≈ 88 % der VO2max). Fachbuch (D); Prozentangaben nach Sekundärquellen, z. B. https://www.athletedata.health/guides/vdot-running-paces
- [Z8] TrainingPeaks: How to train for an IRONMAN marathon (Faustregel: Ironman-Marathon unter 4 h ≈ offener Marathon + 20 min). https://www.trainingpeaks.com/blog/how-to-train-for-an-ironman-marathon/ ; 220 Triathlon/Runna: Ironman-Lauf 25–45 min langsamer als der offene Marathon. – Praxisquellen (D)
- [Z9] Triathlon Magazine Canada: How to pace a 70.3 or Ironman triathlon (Langdistanz überwiegend oberes Z2 bis unteres Z3). https://triathlonmagazine.ca/racing/how-to-pace-a-70-3-or-ironman-triathlon/ – Praxisquelle (D)
- [Z6] Swim Smooth. Understanding Swim Training Zones for Endurance Swimming. https://blog.swimsmooth.com/p/understanding-training-zones – Praxisquelle (D)
- Allen H, Coggan A. *Training and Racing with a Power Meter* (Fachbuch; Rad-Zonen-Konvention).
