# AGENTS.md – Netzwerkstatt: Netzwerk-Simulator für den Informatikunterricht

Diese Datei ist die zentrale Projektbeschreibung für Menschen **und** KI-Agenten (Claude Code, Codex, Copilot …).
Sie enthält Ziel, Anforderungen, Architekturentscheidungen, Konventionen und Roadmap.
Bei Widersprüchen zwischen Code und dieser Datei: nachfragen, dann diese Datei aktualisieren.

> Status: **Phase 0–3 und Beispielnetze gemergt (MVP live), Phase 4a (Routing) umgesetzt** auf Branch `phase-4a-routing` (Stand 2026-10-07). Nächster Schritt: Phase 4b (Schichtenmodell, Sequenzdiagramm).
> Repository: https://github.com/sparks4school-Foundation/netzwerkstatt (öffentlich) · Live: https://sparks4school-foundation.github.io/netzwerkstatt/

## 0. Schnellstart für Agenten

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + format:check + Vitest – muss vor jeder Übergabe grün sein
npm run test:e2e   # Playwright gegen den Produktions-Build (Desktop-Chrome + iPad/WebKit)
npm run build      # dist/ (statisch); BASE_PATH=/netzwerkstatt/ für GitHub Pages
```

- Node ≥ 22 (`.nvmrc`: 24 LTS für CI).
- Versionsgrenzen: **TypeScript 6.0.x** (typescript-eslint unterstützt TS 7 noch nicht), **ESLint 9** (eslint-plugin-jsx-a11y unterstützt ESLint 10 noch nicht). Erst anheben, wenn die Plugins nachziehen.
- Architekturgrenzen werden von ESLint erzwungen (`boundaries/dependencies` in `eslint.config.js`); in `src/sim` und `src/model` sind `window`, `document`, `setTimeout`, `Math.random` und `Date.now` verboten.
- CI: Job `pruefen` (Typen, Lint, Format, Vitest, Build) und Job `e2e` im Container `mcr.microsoft.com/playwright:vX.Y.Z-noble`. **Beim Update von `@playwright/test` die Image-Version in `.github/workflows/ci.yml` mitziehen.**
- Bekannt: `npm audit` meldet eine Lücke in `braces` (nur Build-Werkzeug, nicht im ausgelieferten Code).

---

## 1. Ziel in einem Satz

Ein browserbasierter, installationsfreier, DSGVO-konformer Netzwerk-Simulator für den Informatikunterricht
(Bildungsplan BW: Kl. 7/8 – 3.2.4.2, Kl. 11 – 3.4.4.1), inspiriert von [Filius](https://gitlab.com/filius1/filius),
aber **deutlich vereinfacht, touch-tauglich und didaktisch gestuft**.

Zielgruppen: Schüler:innen (ohne Login), Lehrkräfte (Aufgaben erstellen/verteilen).
Begleitmaterialien werden separat angeboten und sind **nicht** Teil dieses Repos.

---

## 2. Grundsatzentscheidung: Filius übernehmen oder neu denken?

**Entscheidung: komplett neu bauen, keine Code-Übernahme. Ideen von Filius übernehmen, Schwächen bewusst vermeiden.**

Begründung:

| Aspekt      | Filius                                                                           | Konsequenz                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technik     | Java + Swing-Desktop-UI                                                          | UI ist nicht ins Web portierbar, nur die Ideen.                                                                                                              |
| Simulation  | Echtzeit mit Java-Threads pro Gerät                                              | Nicht deterministisch, kein sauberes Pausieren/Einzelschritt → Engine muss anders aufgebaut sein (Event-Queue, siehe 5.2).                                   |
| Lizenz      | GPL (Version vor einer evtl. Übernahme prüfen)                                   | Jede Code- oder Icon-Übernahme würde unser Projekt an die GPL binden. Ideen/Konzepte sind frei → wir übernehmen nur Konzepte, keine Dateien, keine Grafiken. |
| Datenformat | `.fls` (ZIP mit Java-`XMLEncoder`-XML)                                           | Eigenes, dokumentiertes JSON-Format. Ein Filius-Import ist eine optionale spätere Erweiterung.                                                               |
| Umfang      | Viele Funktionen (Terminal, E-Mail, Firewall, P2P/Gnutella, Modem, Texteditor …) | Für den Bildungsplan zu viel. Wir bauen nur, was die Teilkompetenzen (TK) brauchen.                                                                          |

### 2.1 Gute Ideen von Filius, die wir übernehmen

- **Trennung Entwurf ↔ Simulation**: erst aufbauen, dann ausprobieren. Bei uns weicher: ein Schalter „Aufbauen / Ausprobieren“, der Zustand geht dabei nicht verloren.
- **Software auf Geräten „installieren“**: Ein Rechner wird erst durch einen installierten Dienst zum Webserver. Das bildet den Glossar-Unterschied _Server als Dienst_ vs. _Server als Hardware_ direkt ab.
- **Desktop-Ansicht eines Geräts** mit App-Symbolen (Browser, Webserver, DNS-Server): Schüler:innen „sitzen“ an einem Rechner.
- **Einfacher Webbrowser und Webserver mit selbst editierbarer HTML-Seite.** Das ist die Muss-Funktion für TK 5.
- **Einfacher DNS-Server** mit Tabelle Domain → IP-Adresse.
- **Router mit mehreren Anschlüssen und Routingtabelle** (automatisch oder manuell).
- **Datenaustausch-Tabelle pro Gerät**, farbig nach Schicht. Bei uns: Kommunikationsprotokoll + Sequenzdiagramm + aufklappbare Schichten.
- **Leitungen leuchten bei Datenverkehr.** Bei uns: Pakete laufen sichtbar als Objekte über die Leitung.
- **Geschwindigkeitsregler.**
- **Speichern als Datei und Weitergeben** (bei uns offenes JSON).

### 2.2 Schwächen von Filius, die wir bewusst anders lösen

- Java-Installation nötig → läuft im Browser, auch auf iPad/Chromebook, offline als PWA.
- Keine Touch-Bedienung, kleines Desktop-UI → große Touch-Ziele, Drag & Drop, Pinch-Zoom.
- Kein echtes Pausieren/Einzelschritt → deterministische Simulation mit Zeitlupe, Pause, Schritt vor.
- Kein Sequenzdiagramm → wird automatisch aus dem Protokoll erzeugt.
- Keine Klassenstufen-Modi → Stufen 7/8 und 11 blenden Begriffe und Felder ein/aus, dasselbe Netz bleibt nutzbar.
- Kein Aufgabenmodus → Lehrkräfte können Aufgaben mit Auftrag, Hilfestufen und eingebauten Fehlern verteilen.
- Technische Fehlermeldungen → verständliche deutsche Meldungen mit Hinweis, wo man nachsehen kann.
- Kein Undo → Rückgängig/Wiederholen überall.
- Kein WLAN, keine Smartphones/Spielkonsolen als Bausteine → bei uns vorhanden (Kl. 7/8 TK 2).

---

## 3. Anforderungen (Kurzfassung)

Die vollständige Liste stammt vom Projektinhaber und ist hier verdichtet. TK = Teilkompetenz im Bildungsplan.

### 3.1 Stufe 7/8 – 3.2.4.2 Kommunikationsprinzipien in Rechnernetzen

- TK 1: 2-Schichten-Modell **Infrastruktur / Dienste**, visuell umschaltbar.
  - _Infrastruktur-Ansicht_: Geräte und physische **Leitungen** (durchgezogen).
  - _Dienste-Ansicht_: Dienste (Webserver, DNS, Browser als Client) und temporäre logische **Verbindungen** (gestrichelt, mit Beschriftung).
- TK 2: Bausteine
  - Endgeräte: Computer, Smartphone, Spielkonsole, Server
  - Verteiler: Switch, Router, WLAN-Access-Point
  - Verbindungen: Kabel, WLAN
- TK 3: IP-Adressen und Domains vergeben; Fehlkonfiguration (doppelte IP, falsches Netz) wird **sichtbar** markiert (Symbol + Text, nicht nur Farbe).
- TK 4: Namensauflösung als nachvollziehbarer Ablauf: Domain → DNS-Server → IP-Adresse → Webserver.
- TK 5 (**zentrale Muss-Funktion**): Lokales Rechnernetz mit DNS und Webserver selbst entwerfen und testen; ein einfacher Browser ruft eine selbst erstellte Webseite ab.
- Optional: Transport- vs. Ende-zu-Ende-Verschlüsselung als „Wer kann die Nachricht lesen?“ pro Station (Brücke zu 3.2.4.1).

### 3.2 Stufe 11 – 3.4.4.1 Schichten und Protokolle

- TK 1, 7: 4-Schichten-Modell (Netzzugang, Vermittlung, Transport, Anwendung). Jede Nachricht lässt sich pro Schicht aufklappen.
- TK 2: Mehrere Netze verbinden; lokale vs. globale (private vs. öffentliche) Adressen unterscheiden.
- TK 3: Routing: Routingtabellen bearbeiten, Szenarien durchspielen (Leitungsausfall, Umweg).
- TK 4: Paketorientierte Übertragung: Zerlegen, unterschiedliche Wege, Reihenfolge, Verlust, Neuzusammensetzung sichtbar.
- TK 5, 6: DNS und DHCP nachvollziehbar; Ablauf automatisch als vereinfachtes (UML-nahes) **Sequenzdiagramm**.

### 3.3 Didaktische Querschnittsanforderungen

- **Progressive Komplexität**: ein Modus pro Stufe; dasselbe Netz ist in höherer Stufe weiterverwendbar (spiralcurricular).
- **Blackbox/Whitebox** pro Gerät umschaltbar (nur Verhalten ↔ innerer Zustand wie Routingtabelle, DNS-Einträge, Paketinhalt).
- **Zeitlupe, Pause, Einzelschritt** + **Kommunikationsprotokoll** („Wer hat wann was an wen geschickt?“).
- **Testen und Fehlersuche**: Fehler bewusst einbauen (falsche IP, fehlender DNS-Eintrag, getrennte Leitung); verständliche Fehlermeldungen.
- **Aufgabenmodus** für Lehrkräfte: vorbereitete Netze + Arbeitsauftrag, Diagnoseaufgaben mit fehlerhaften Netzen, Hilfestufen.
- **Unplugged**: Netzplan und Sequenzdiagramm druck- und exportierbar (SVG/PNG/PDF über Druckansicht).
- Server-Begriff doppelt: Hardware (Gerät) und Dienst (Software) unterscheidbar darstellen.
- Leitung (physisch) vs. Verbindung (logisch, temporär) sichtbar unterscheiden.

### 3.4 Verbindliche Begriffe (Glossar, Abschnitt 6.1)

Diese Begriffe sind **exakt so** in der Oberfläche zu verwenden; keine Synonyme erfinden:

> vermaschtes Netz, Client, Server, Cloud, interne/portable Speichermedien, Adressierung, IP-Adresse, Domain,
> Namensauflösung, DNS, lokales Rechnernetz, Webserver, Schichtenmodell, Adressen, Routing,
> paketorientierte Datenübertragung, Kommunikationsprotokoll, Protokoll, Sequenzdiagramm

- Alle Begriffe stehen zentral in `src/content/glossar.ts` (Begriff, Kurzdefinition, ab welcher Stufe sichtbar).
- Tooltips/Infoboxen ziehen ihre Texte **nur** von dort.
- Oberfläche komplett auf Deutsch. UI-Texte nicht im Code verstreuen, sondern in `src/content/texte.ts` bündeln (erleichtert Korrektur durch Lehrkräfte).

### 3.5 Technische und rechtliche Rahmenbedingungen

- Läuft im Browser, ohne Installation, ohne Java; Schul-PCs, Chromebooks, iPads (Touch). Smartphones: nutzbar, aber kein Hauptziel.
- **Kein Login, keine personenbezogenen Daten, kein Tracking, keine Cookies**, keine Analytics.
- **Offline-fähig** (PWA); zur Laufzeit **keine** externen Requests (keine CDNs, keine Google Fonts – Schriften selbst hosten).
- Speichern/Teilen als offenes **JSON** (Datei-Download/-Upload, Schulplattform/Moodle). Kein Server-Speicher.
- Open Source.
- Barrierearm: vollständige Tastaturbedienung, WCAG-AA-Kontraste, keine reine Farbcodierung (immer Symbol/Muster/Text dazu).
- Läuft auf schwachen Geräten (Performance-Budget, siehe 6.4).
- Neutrale, stereotypfreie Gestaltung (Gerätenamen, Beispielpersonen, Icons).

### 3.6 Nicht-Ziele

- Keine Interaktion mit echten Netzen (kein Scannen, kein Sniffen, keine echten Sockets). Alles bleibt in der Simulation.
- Kein vollständiges OSI-Modell, keine Herstellerkonfiguration à la Cisco Packet Tracer.
- Keine mathematische Kryptographie; Verschlüsselung nur als „lesbar / nicht lesbar“ pro Station.
- Kein Backend, keine Accounts, keine Cloud-Speicherung.
- Nicht übernommen aus Filius: Terminal/Kommandozeile, E-Mail, Firewall, Peer-to-Peer, Modem, Texteditor, Dateiexplorer.

### 3.7 Kann-Erweiterungen (später)

- Paritätsbit/Prüfsumme bei gestörten Leitungen (3.3.2.2)
- Man-in-the-Middle und digitale Zertifikate (3.3.4.2)
- Kommunikationsformen: synchron/asynchron, 1:1 / 1:n / n:m (3.2.4.2 (6))
- Import von Filius-`.fls`-Dateien

---

## 4. Tech-Stack

| Bereich                 | Wahl                                                                             | Warum                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Sprache                 | **TypeScript** (strict)                                                          | Datenmodell und Simulation sind komplex → Typen verhindern Fehler.                                   |
| Build                   | **Vite**                                                                         | Schnell, Standard, statischer Output.                                                                |
| UI                      | **React 19**                                                                     | Großes Ökosystem, viele potenzielle Mitwirkende. (entschieden)                                       |
| Netzplan-Editor         | **@xyflow/react (React Flow)**, MIT                                              | Knoten/Kanten, Zoom/Pan, Touch, Tastatur bereits gelöst; rendert SVG/HTML (druck- und exportierbar). |
| State                   | **Zustand** + Immer, Undo/Redo über Patches                                      | Einfach, ohne Boilerplate.                                                                           |
| Validierung Dateiformat | **Zod**                                                                          | Schema = Typ = Validierung beim Laden fremder Dateien.                                               |
| Styling                 | CSS Modules oder Tailwind + CSS-Custom-Properties als Design-Tokens              | Hoher Kontrast/Dark-Mode über Tokens.                                                                |
| Offline                 | **vite-plugin-pwa** (Workbox)                                                    | Service Worker, installierbar, offline.                                                              |
| Tests                   | **Vitest** (Engine), **Playwright** (E2E, inkl. iPad-Viewport)                   | Engine muss zu 100 % ohne Browser testbar sein.                                                      |
| Lint/Format             | ESLint + Prettier, `eslint-plugin-boundaries`                                    | Erzwingt: Engine importiert nichts aus UI.                                                           |
| Hosting                 | GitHub Pages (Workflow `pages.yml`); jeder andere statische Webspace geht ebenso | Kein Backend nötig. Build = Ordner `dist/`.                                                          |

---

## 5. Architektur

### 5.1 Schichten des Codes

```
src/
  model/      Datenmodell (Geräte, Anschlüsse, Leitungen, Dienste), Zod-Schemas, Dateiformat + Migrationen
  sim/        Simulations-Engine – reines TypeScript, KEIN DOM, KEIN React, deterministisch
    protocols/  ethernet(vereinfacht), ip, routing, tcp(vereinfacht), udp, dns, dhcp, http
    devices/    Verhalten je Gerätetyp (Endgerät, Switch, Router, Access Point)
  ui/         React-Komponenten: Editor, Gerätefenster, Browser, Protokoll, Sequenzdiagramm, Schichtenansicht
  content/    Glossar, UI-Texte, Fehlermeldungen, Beispiel-/Aufgabennetze (JSON)
  stufen/     Konfiguration der Klassenstufen-Modi (was ist sichtbar/editierbar)
```

Grundregel: **`sim/` und `model/` kennen die UI nicht.** Die UI liest Zustand und Ereignisse aus der Engine und zeichnet sie.
So bleibt die Simulation testbar, und später sind andere Oberflächen (z. B. Druckansicht) einfach.

### 5.2 Simulations-Engine

- **Diskrete Ereignissimulation** mit Event-Queue und simulierter Uhr (Ticks), keine Threads, kein `setTimeout` in der Logik.
- Ein **Schritt** = eine Nachricht bewegt sich über eine Leitung oder wird von einem Gerät verarbeitet.
- Die UI steuert die Uhr: Abspielen (mit Geschwindigkeit), Pause, Einzelschritt, Zurückspulen (über gespeicherte Snapshots).
- Deterministisch: gleicher Ausgangszustand + gleiche Aktionen = gleicher Ablauf. Zufall (Paketverlust, Wegwahl) nur über einen Seed-basierten PRNG.
- Jede Aktion erzeugt einen **Protokolleintrag** `{zeit, von, an, schicht, protokoll, kurztext, nachricht}`.
  Daraus werden Kommunikationsprotokoll-Tabelle **und** Sequenzdiagramm generiert.
- Nachrichten sind **verschachtelte Objekte** (Kapselung):
  ```ts
  { netzzugang: { von: 'MAC…', an: 'MAC…' },
    vermittlung: { quelle: '192.168.0.10', ziel: '192.168.0.2', ttl: 64 },
    transport: { protokoll: 'TCP', quellport: 49152, zielport: 80, nr: 1 },
    anwendung: { protokoll: 'HTTP', inhalt: 'GET /index.html' } }
  ```
  Die Schichtenansicht klappt genau diese Ebenen auf.
- Vereinfachungen (bewusst): ARP nur in Stufe 11 sichtbar, TCP ohne Fenster/Congestion (nur Verbindungsaufbau, Nummerierung, Bestätigung, Neusenden), NAT vereinfacht am Heimrouter.

### 5.3 Klassenstufen-Modi (Spiralcurriculum)

- Das **Datenmodell ist immer vollständig** (auch Subnetzmaske, Gateway, MAC, Routingtabelle).
- Der Modus bestimmt nur **Sichtbarkeit und Automatik**:
  - **Stufe 7/8**: Subnetzmaske, Gateway, MAC, Ports, Routingtabellen sind ausgeblendet und werden automatisch gesetzt. Sichtbar: IP-Adresse, Domain, Dienste, 2-Schichten-Ansicht.
  - **Stufe 11**: alles einblendbar, Routingtabellen editierbar, 4-Schichten-Ansicht, Pakete, DHCP, Sequenzdiagramm.
- Ein in 7/8 gebautes Netz öffnet sich in Stufe 11 unverändert, nur mit mehr Details.
- Konfiguration in `src/stufen/*.ts` (Liste der sichtbaren Bausteine, Felder, Begriffe, Ansichten).

### 5.4 Dateiformat

- Endung `.netzwerkstatt.json`, MIME `application/json`, UTF-8, menschenlesbar formatiert.
- Pflichtfelder: `format` (Kennung), `version` (Ganzzahl), `stufe`, `geraete`, `leitungen`.
- Optional: `aufgabe` (Auftrag, Hilfestufen, gesperrte Elemente, eingebaute Fehler, Prüfbedingungen).
- Beim Laden: Zod-Validierung → bei alter `version` Migrationen anwenden → verständliche Meldung bei Fehlern.
- Keine personenbezogenen Daten im Format (kein Name, keine Klasse, keine Geräte-IDs des echten Geräts).
- Das Schema wird zusätzlich als JSON-Schema veröffentlicht (`/schema/`), damit andere Tools es nutzen können.

### 5.5 Editor (Phase 1)

- **Controlled Flow:** Die Wahrheit liegt im Zustand-Store (`src/ui/store.ts`, Feld `netz`). React Flow erhält daraus abgeleitete Knoten/Kanten und meldet Änderungen zurück. Nie Daten nur in React Flow halten.
- **Bearbeitungen** laufen über reine Funktionen in `src/model/netz.ts` (liefern neues Objekt). Der Store legt vorher den alten Stand in `vergangenheit` ab → Rückgängig/Wiederholen (max. 100 Schritte). Beim Ziehen eines Geräts wird nur beim Start ein Verlaufseintrag angelegt.
- **Verbindungsregeln** (`pruefeVerbindung`): Endgeräte haben genau einen Anschluss (Kabel _oder_ WLAN); Smartphone nur WLAN, Server nur Kabel; WLAN nur zwischen Access Point und Endgerät; Access Point hat ein Kabel (Uplink); Switch/Router beliebig viele Kabel. Gründe werden in `src/content/meldungen.ts` zu verständlichen Sätzen.
- **Verbinden** geht auf drei Wegen: vom Anschlusspunkt (Ecke unten rechts) ziehen und irgendwo auf dem Zielgerät loslassen; Anschlusspunkte nacheinander antippen; per Tastatur im Eigenschaften-Panel („Verbinden mit“). Beim Ziehen wird automatisch die passende Art gewählt, wenn ein Gerät die eingestellte Art nicht kann.
- **Geräte hinzufügen:** Antippen/Klicken/Enter auf einen Baustein legt das Gerät in der Mitte ab (`freiePosition` sucht spiralförmig einen freien Platz); mit der Maus auch per Drag & Drop. Liegt das neue Gerät außerhalb des sichtbaren Bereichs, schwenkt die Ansicht dorthin.
- **Darstellung:** Kabel durchgezogen, WLAN gepunktet + Beschriftung „WLAN“; Auswahl über dickeren Rahmen + Ring (nicht nur Farbe). Gerätesymbole sind eigene SVGs (`src/ui/GeraetIcon.tsx`).
- **Layout:** ≥ 1100 px: Palette | Fläche | Eigenschaften (immer sichtbar). 721–1099 px (Tablets): schmale Palette, Eigenschaften als Blatt rechts unten. ≤ 720 px: Palette als Leiste oben, Eigenschaften als Blatt unten.
- **Tastenkürzel:** Strg/Cmd+Z, Strg/Cmd+Umschalt+Z bzw. Strg+Y, Entf/Rücktaste (Auswahl entfernen), Escape (Auswahl aufheben); Pfeiltasten verschieben das ausgewählte Gerät (React Flow).
- **Speichern:** Datei-Download `*.netzwerkstatt.json`; Öffnen per Dateiauswahl. Zusätzlich automatische Zwischenspeicherung im `localStorage` (nur das Netz).

### 5.6 Adressierung und Simulation (Phase 2)

- **IP-Felder** (`ip`, `subnetzmaske`, `gateway`) sind optional am Gerät gespeichert, und zwar so, wie sie eingegeben wurden – auch ungültig. Nur Endgeräte haben IP-Adressen; Switch/Access Point brauchen keine; Router folgen in Phase 4. Ohne Maske gilt `255.255.255.0` (in 7/8 ist das Feld ausgeblendet).
- **Lokales Rechnernetz = Segment** (`model/topologie.ts`): alle Geräte, die über Switches/Access Points erreichbar sind. Router und Endgeräte sind Ränder.
- **Adressprobleme** (`model/adressen.ts`): ungültig, reserviert (.0/.255), doppelt im selben Segment, anderes Netz als die Mehrheit im Segment (bei Gleichstand keine Markierung). Anzeige am Gerät: ⚠ + Kurztext + gestrichelter Rahmen; Erklärung im Panel.
- **Engine** (`sim/simulation.ts`): Ein Schritt = alle Pakete auf Leitungen kommen an und werden verarbeitet. Switch/AP leiten zum _nächstgelegenen_ Gerät mit der Ziel-IP (Breitensuche, deterministisch) – bewusst vereinfacht ohne MAC/ARP (kommt in Stufe 11). Endgeräte beantworten jede Nachricht mit einer Antwort. Bei doppelter IP-Adresse kann die Antwort beim falschen Gerät landen – das wird als Warnung protokolliert (Lernanlass TK 3).
- **Sendefehler** (keine IP, ungültiges Ziel, eigene IP, nicht verbunden, anderes Netz) werden sofort gemeldet und protokolliert. Pakete an unbekannte IP-Adressen gehen sichtbar am Switch verloren.
- **Protokolleinträge** sind strukturiert (IDs, Art, Grund); `content/meldungen.ts` macht daraus Sätze. Dafür darf `content` Typen aus `sim` importieren.
- **Animation** (`ui/simStore.ts`, `ui/useSimulationsUhr.ts`): `requestAnimationFrame` erhöht `fortschritt` (0…1) je nach Tempo (Zeitlupe 3 s … schnell 0,4 s pro Schritt); bei 1 wird `sim.schritt()` ausgeführt. Pakete werden per `ViewportPortal` auf den Leitungen gezeichnet; bei `prefers-reduced-motion` stehen sie ruhig in der Leitungsmitte. Nachricht ✉ und Antwort ↩ unterscheiden sich in Symbol, Text und Rahmen.
- **Bedienung:** Senden spielt automatisch ab. ⏭ Einzelschritt hält an; drückt man ihn vor dem Senden, wartet die Nachricht am Startgerät. Zurücksetzen startet eine neue Simulation. Beim Wechsel zu „Aufbauen“ wird die Simulation verworfen.
- **Layout:** Unter 1100 px liegt das Eigenschaften-Blatt _innerhalb_ des Arbeitsbereichs (Tablet: Karte oben rechts, Smartphone: unten), damit Protokoll und Simulationsleiste frei bleiben. Zoom-Knöpfe oben links.

### 5.7 Dienste, DNS und Browser (Phase 3)

- **Dienste** (`model/dienste.ts`, Feld `dienste` am Gerät): `browser` (Client), `webserver` (Seiten als `{pfad, html}`), `dns-server` (Tabelle `{domain, ip}`). Webserver/DNS-Server auf Server **und** Computer installierbar (Glossar: Server als Dienst ≠ Server als Hardware). Computer/Smartphone/Spielkonsole bekommen beim Hinzufügen einen Browser.
- **DNS-Server am Client:** Feld `dnsServer` (IP-Adresse), mit Vorschlag aus dem lokalen Rechnernetz.
- **Ablauf in der Engine:** `aufrufen(geraet, eingabe)` → bei Domain: DNS-Anfrage → DNS-Antwort → HTTP-Anfrage → HTTP-Antwort (200/404); bei IP-Adresse direkt HTTP. Läuft auf dem Ziel der Dienst nicht, kommt ein Paket „Abgelehnt“. Ohne Antwort gibt der Browser nach `zeitlimit(netz)` Schritten auf (mind. 8, wächst mit der Zahl der Leitungen; Ankünfte werden vor Zeitlimits verarbeitet; leere Warteschritte laufen in der UI schnell durch). Erledigte Zeitlimits werden aus der Warteschlange entfernt, damit die Simulation sofort endet.
- **Browser-Zustand** pro Gerät (`dns` → `laden` → `fertig`/`fehler`) liegt in der Simulation; Fehler (`BrowserFehler`) werden in `content/meldungen.ts` zu Titel + Erklärung mit Tipp.
- **Sicherheit der Schülerseiten** (`ui/seitenDokument.ts`): (1) `bereinigeHtml` entfernt Skripte, iframes, Formulare, Event-Attribute und alle externen URLs (nur `data:` erlaubt); Links werden zu `data-href`. (2) CSP `default-src 'none'`. (3) Browser-Fenster: iframe `sandbox="allow-scripts"` **ohne** `allow-same-origin` mit einem eigenen Link-Skript (CSP-Nonce), das Klicks per `postMessage` meldet. Vorschau im Editor: `sandbox=""`, gar keine Skripte. **Hinweis:** Eine reine Meta-CSP hat in Chrome externe Bilder nicht zuverlässig verhindert; WebKit liefert keine von außen angehängten Klick-Handler in skriptlose iframes – deshalb diese Kombination. E2E-Test „Webseite darf nichts von außen nachladen“ sichert das ab.
- **Dienste-Ansicht (TK 1):** Umschalter „Infrastruktur | Dienste“ in der Kopfleiste. In „Dienste“: Geräte zeigen „Hardware: …“ und ihre Dienste (Server-Dienst: Rahmen durchgezogen, Client: gestrichelt); Leitungen gedimmt; logische Verbindungen (`ui/logischeVerbindungen.ts`: konfigurierte DNS-Server + tatsächlich beobachtete Kommunikation) als gebogene, gestrichelte Pfeile mit Protokollname, die Geräten ausweichen.
- **Pakete** heißen in Animation und Protokoll nach ihrer Art (DNS-Anfrage, HTTP-Antwort …); Anfragen und Antworten unterscheiden sich in Symbol und Rahmen.

### 5.8 Beispielnetze

- Liegen als normale Netzwerkstatt-Dateien in `src/content/beispiele/*.json` (CC BY-SA 4.0) und werden in `src/content/beispiele/index.ts` mit Titel, Stufe, Bildungsplanbezug, Beschreibung und **Arbeitsauftrag** registriert.
- `beispiele.test.ts` prüft: Jede Datei ist gültig; das Schulnetz funktioniert sofort; die Fehlersuche enthält genau die beabsichtigten Fehler und ist nach dem Beheben lösbar. **Neue Beispiele immer mit so einem Test absichern.**
- Öffnen über „Beispiele“ in der Kopfleiste oder auf der leeren Arbeitsfläche. Der Arbeitsauftrag erscheint als ausblendbare Leiste unter der Kopfleiste; er wird (noch) nicht in der Datei gespeichert – das übernimmt der Aufgabenmodus in Phase 5.

### 5.9 Routing (Phase 4a, Klasse 11)

- **Schnittstellen** (`model/adressen.ts`): Endgerät = eine IP, Router = eine IP je Anschluss (`anschluesse[leitungId] = {ip, subnetzmaske}`). Adressprüfung (doppelt, anderes Netz, reserviert) arbeitet je lokalem Rechnernetz über alle Schnittstellen; Probleme an Routern tragen `anschluss`.
- **Lokales Rechnernetz hinter einer Leitung:** `segmentAnLeitung` / `segmentSchluessel` in `model/topologie.ts` (Switch/AP → dessen Segment, sonst Punkt-zu-Punkt).
- **Routingtabelle** (`model/routing.ts`): `automatisch` = direkt angeschlossene Netze + Breitensuche über Router, die sich ein Segment und IP-Netz teilen (wenigste Router gewinnt, deterministisch), **ohne ausgefallene Leitungen** → Umweg im vermaschten Netz. `manuell` = gespeicherte Tabelle gilt unverändert (Lernanlass: passt sich bei Ausfall nicht an). Auswahl per längster Präfix-Übereinstimmung.
- **Engine:** Endgeräte schicken Pakete in fremde Netze an ihr **Gateway** (Fehler: kein Gateway / Gateway außerhalb des eigenen Netzes). Jede Übertragung trägt `hopIp` (IP des nächsten Geräts); Switches leiten nach `hopIp` weiter. Router: TTL − 1 (Start 16; bei 0 verworfen → Routing-Schleifen sichtbar), Route suchen, weiterleiten; Protokoll nennt die genutzte Route. Router beantworten Nachrichten an ihre eigenen Adressen.
- **Leitungsausfall:** `leitung.ausgefallen`; im Panel einer Leitung umschaltbar, auch während der Simulation (`Simulation.leitungAusfallen`). Darstellung: rot, kurz gestrichelt, Etikett „✕ ausgefallen“.
- **Oberfläche (nur Klasse 11):** Router-Panel mit Anschlüssen (IP, Maske, Vorschlag .1) und Routingtabelle (automatisch: nur lesen; von Hand: Zeilen bearbeiten, „Automatische Tabelle übernehmen“). Im Modus „Ausprobieren“ bleibt die Tabelle sichtbar (Whitebox). Endgeräte: Gateway mit Vorschlag, Kennzeichnung „privat (lokal)“ / „öffentlich (global)“ (TK 2). In 7/8 erklärt das Router-Panel nur, wozu Router da sind.
- **Beispiele:** „Zwei Netze mit Router“ und „Vermaschtes Netz: Umweg bei Ausfall“ (beide Klasse 11, mit Tests).

### 5.10 Aufgabenmodus

- Lehrkraft baut ein Netz, schaltet „Aufgabe erstellen“ ein und legt fest: Arbeitsauftrag (Text), Hilfestufen (1–3, schrittweise aufdeckbar), welche Elemente gesperrt sind, optional eingebaute Fehler und automatische Prüfbedingungen (z. B. „Browser auf PC-1 lädt www.schule.test“).
- Export als normale JSON-Datei → Verteilung über Moodle/Schulplattform/USB.
- Keine Rückmeldung an die Lehrkraft über einen Server (DSGVO); Schüler:innen speichern ihr Ergebnis selbst als Datei.

---

## 6. Konventionen für Entwicklung und Agenten

### 6.1 Allgemein

- Sprache im Code: Bezeichner für Fachbegriffe auf **Deutsch** (`Geraet`, `Leitung`, `Dienst`, `Routingtabelle`), technische Infrastruktur auf Englisch ist erlaubt (`useStore`, `render`). Konsistent bleiben.
- UI-Texte, Fehlermeldungen und Glossar nur aus `src/content/`.
- Fehlermeldungen: Was ist passiert? Woran kann es liegen? Wo kann ich nachsehen? Kein Fachjargon über die aktuelle Stufe hinaus.
  Beispiel: „Der Browser konnte **www.schule.test** nicht finden. Der DNS-Server kennt diese Domain nicht. Tipp: Schau in die Tabelle des DNS-Servers.“

### 6.2 Barrierefreiheit (Pflicht, nicht optional)

- Jede Aktion per Tastatur erreichbar (auch Geräte platzieren und verbinden).
- Touch-Ziele mind. 44×44 px.
- Kontrast WCAG AA; Zustände nie nur über Farbe (Symbol + Text + Muster, z. B. gestrichelt).
- `prefers-reduced-motion` respektieren (Animation durch Schrittanzeige ersetzen).

### 6.3 Datenschutz (Pflicht)

- Keine externen Requests zur Laufzeit. Neue Abhängigkeiten auf Telemetrie/Netzzugriffe prüfen.
- Kein `localStorage` für personenbezogene Daten; erlaubt ist nur das Zwischenspeichern des aktuellen Netzes und von UI-Einstellungen auf dem Gerät.

### 6.4 Performance-Budget

- Initialer JS-Bundle (gzip) ≤ 300 KB; Ziel: flüssig auf iPad 9. Gen. / einfachem Chromebook mit 50 Geräten im Netz.
- Engine-Schritt ≤ 2 ms bei 50 Geräten.

### 6.5 Tests

- Jede Protokoll-/Engine-Funktion bekommt Vitest-Tests mit kleinen Beispielnetzen.
- Für jede TK aus Abschnitt 3 gibt es mindestens ein Beispielnetz in `src/content/beispiele/` und einen E2E-Test.

### 6.6 Git

- **Niemals pushen**, außer der Projektinhaber sagt es ausdrücklich.
- **Nur committen, wenn ausdrücklich verlangt.**
- **Keine** `Co-Authored-By`-Zeilen für KI in Commit-Messages.
- Commit-Messages auf Deutsch oder Englisch, kurz, im Imperativ.

---

## 7. Roadmap

| Phase                    | Inhalt                                                                                                                                                                                                                     | Deckt ab                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 0 – Grundgerüst ✅       | Repo, Vite/TS/React, Lint, Tests, CI, PWA-Hülle, Design-Tokens, Lizenz                                                                                                                                                     | Technik                                     |
| 1 – Editor ✅            | Geräte platzieren/verbinden (Touch + Tastatur), Eigenschaften-Panel, Undo, Speichern/Laden JSON                                                                                                                            | 7/8 TK 2                                    |
| 2 – Engine-Kern ✅       | Event-Queue, Switch, IP im lokalen Netz, „Nachricht senden“, Animation, Pause/Schritt, Protokoll, Erkennung doppelter IP                                                                                                   | 7/8 TK 3                                    |
| 3 – Dienste (**MVP**) ✅ | Dienste installieren, Webserver mit HTML-Editor, Browser, DNS-Server, Namensauflösung Schritt für Schritt, Dienste-Ansicht                                                                                                 | 7/8 TK 1, 4, 5 → **erster Unterrichtstest** |
| 4 – Stufe 11             | **4a ✅** Router, Routingtabellen, mehrere Netze, Leitungsausfall/Umweg, privat/öffentlich · **4b** Schichtenansicht, Sequenzdiagramm · **4c** Pakete zerlegen/Verlust/Neuzusammensetzung · **4d** DHCP, vereinfachtes NAT | 11 TK 1–7                                   |
| 5 – Unterricht           | Aufgabenmodus, Hilfestufen, Fehler einbauen, Blackbox/Whitebox, Druck/Export (Netzplan, Sequenzdiagramm), Glossar-Tooltips komplett                                                                                        | Querschnitt                                 |
| 6 – Optional             | Verschlüsselung lesbar/nicht lesbar, Parität/Prüfsumme, MITM/Zertifikate, Kommunikationsformen, Filius-Import                                                                                                              | Kann                                        |

---

## 8. Entscheidungen

### Getroffen

- [x] Projektname (Arbeitstitel, änderbar): **Netzwerkstatt**. Im README: „inspiriert von Filius“, aber kein „Filius“ im Namen.
- [x] Lizenz Code: **EUPL-1.2** (europäische Open-Source-Lizenz, Copyleft: Weiterentwicklungen bleiben frei; kompatibel mit GPL).
- [x] Lizenz Inhalte (Beispielnetze, Aufgaben, Texte, Grafiken): **CC BY-SA 4.0**.
- [x] UI-Framework: **React**.
- [x] GitHub: **sparks4school-Foundation/netzwerkstatt**, öffentlich.

### Offen

- [x] GitHub Pages über GitHub Actions; Actions im Repo auf GitHub-eigene Actions beschränkt
- [ ] Eigene Domain (optional)
- [ ] Filius-Lizenzversion und Namensnutzung prüfen, bevor auf Filius verwiesen wird
