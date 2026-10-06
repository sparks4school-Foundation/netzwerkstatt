# Netzwerkstatt

Ein Netzwerk-Simulator für den Informatikunterricht, der im Browser läuft – ohne Installation, ohne Login, auch offline.
Schüler:innen bauen lokale Rechnernetze mit Computern, Switches, Routern, DNS- und Webservern und beobachten Schritt für Schritt, wie Nachrichten ihren Weg finden.

Ausgerichtet am Bildungsplan Baden-Württemberg (Klasse 7/8: 3.2.4.2, Klasse 11: 3.4.4.1).
Inspiriert von [Filius](https://gitlab.com/filius1/filius), aber vollständig neu entwickelt und deutlich vereinfacht.

> **Status:** frühe Entwicklung (Phase 0 – Grundgerüst). Noch nicht für den Unterricht geeignet.

## Grundsätze

- **Datenschutz:** kein Login, keine Cookies, kein Tracking, keine externen Server. Alles bleibt auf dem Gerät.
- **Offline:** installierbar als Web-App (PWA), läuft danach ohne Internet.
- **Offene Dateien:** Netze werden als JSON-Datei gespeichert und können z. B. über Moodle geteilt werden.
- **Barrierearm:** Tastaturbedienung, hohe Kontraste, keine reine Farbcodierung, Touch-Bedienung auf Tablets.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm run check      # Typprüfung, Lint, Formatierung, Unit-Tests
npm run test:e2e   # Browser-Tests (Desktop-Chrome und iPad/WebKit)
npm run build      # statischer Build in dist/
```

Der Ordner `dist/` kann auf jeden beliebigen Webspace kopiert werden; ein Backend ist nicht nötig.

Architektur, Anforderungen, Konventionen und Roadmap stehen in [AGENTS.md](AGENTS.md).

## Lizenz

- Quellcode: [EUPL-1.2](LICENSE)
- Inhalte (Beispielnetze, Aufgaben, Texte, Grafiken): [CC BY-SA 4.0](LICENSE-CONTENT.txt)

Herausgegeben von der sparks4school Foundation.
