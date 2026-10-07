import { z } from 'zod';
import { stufen } from './stufe';

/**
 * Dateiformat der Netzwerkstatt (siehe AGENTS.md 5.4).
 * Bei jeder inkompatiblen Änderung: DATEI_VERSION erhöhen und eine Migration in migriere() ergänzen.
 */
export const DATEI_FORMAT = 'netzwerkstatt';
export const DATEI_VERSION = 1;

const id = z.string().min(1);

export const geraetTypSchema = z.enum([
  'computer',
  'smartphone',
  'spielkonsole',
  'server',
  'switch',
  'router',
  'access-point',
]);

/** Ein Dienst ist Software auf einem Gerät (Glossar: „Server als Dienst“ ≠ „Server als Hardware“). */
export const dienstSchema = z.discriminatedUnion('art', [
  z.object({ art: z.literal('browser') }),
  z.object({
    art: z.literal('webserver'),
    /** Seiten nach Pfad, z. B. „/“ (Startseite) oder „/kontakt.html“. Inhalt ist HTML. */
    seiten: z.array(z.object({ pfad: z.string(), html: z.string() })),
  }),
  z.object({
    art: z.literal('dns-server'),
    eintraege: z.array(z.object({ domain: z.string(), ip: z.string() })),
  }),
]);

export const geraetSchema = z.object({
  id,
  typ: geraetTypSchema,
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  // Netzwerkeinstellungen (nur Endgeräte). Optional, damit Dateien aus Phase 1 gültig bleiben.
  // Gespeichert wird die Eingabe wie getippt – auch ungültige Werte, die dann als Fehler markiert werden.
  ip: z.string().optional(),
  subnetzmaske: z.string().optional(),
  gateway: z.string().optional(),
  /** IP-Adresse des DNS-Servers, den dieses Gerät für die Namensauflösung fragt. */
  dnsServer: z.string().optional(),
  dienste: z.array(dienstSchema).optional(),
  /** Nur Router: IP-Adresse und Subnetzmaske je Anschluss (Schlüssel = Leitungs-ID). */
  anschluesse: z
    .record(z.string(), z.object({ ip: z.string(), subnetzmaske: z.string().optional() }))
    .optional(),
  /** Nur Router: automatisch berechnete oder von Hand gepflegte Routingtabelle. */
  routing: z
    .object({
      modus: z.enum(['automatisch', 'manuell']),
      tabelle: z.array(
        z.object({
          ziel: z.string(),
          subnetzmaske: z.string(),
          /** Nächster Router; leer = Zielnetz hängt direkt an diesem Anschluss. */
          gateway: z.string(),
          leitungId: z.string(),
        }),
      ),
    })
    .optional(),
});

export const leitungSchema = z.object({
  id,
  art: z.enum(['kabel', 'wlan']),
  von: id,
  nach: id,
  /** Störung simulieren: Über eine ausgefallene Leitung geht nichts mehr. */
  ausgefallen: z.boolean().optional(),
  /** Gestörte Leitung: Anteil verlorener Pakete in Prozent (0–100). */
  verlust: z.number().min(0).max(100).optional(),
  /** Laufzeit in Schritten (1 = normal, 2–3 = lange/langsame Leitung). */
  verzoegerung: z.number().int().min(1).max(5).optional(),
});

export const netzDateiSchema = z
  .object({
    format: z.literal(DATEI_FORMAT),
    version: z.literal(DATEI_VERSION),
    stufe: z.enum(stufen),
    titel: z.string().default(''),
    geraete: z.array(geraetSchema),
    leitungen: z.array(leitungSchema),
  })
  .superRefine((netz, ctx) => {
    const ids = new Set<string>();
    for (const g of netz.geraete) {
      if (ids.has(g.id)) ctx.addIssue({ code: 'custom', message: `Doppelte Geräte-ID ${g.id}` });
      ids.add(g.id);
    }
    for (const l of netz.leitungen) {
      if (!ids.has(l.von) || !ids.has(l.nach)) {
        ctx.addIssue({ code: 'custom', message: `Leitung ${l.id} verweist auf ein unbekanntes Gerät` });
      }
    }
  });

export type NetzDatei = z.infer<typeof netzDateiSchema>;
export type Geraet = z.infer<typeof geraetSchema>;
export type GeraetTyp = z.infer<typeof geraetTypSchema>;
export type Dienst = z.infer<typeof dienstSchema>;
export type DienstArt = Dienst['art'];
export type Leitung = z.infer<typeof leitungSchema>;
export type LeitungsArt = Leitung['art'];
export type RoutingEintrag = NonNullable<Geraet['routing']>['tabelle'][number];

export type LadeErgebnis = { ok: true; netz: NetzDatei } | { ok: false; meldung: string };

/** Hebt ältere Dateiversionen auf die aktuelle an. Noch gibt es nur Version 1. */
function migriere(roh: Record<string, unknown>): Record<string, unknown> {
  return roh;
}

/** Liest eine Netzdatei und liefert eine verständliche Meldung statt technischer Fehler. */
export function ladeNetz(text: string): LadeErgebnis {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, meldung: 'Die Datei ist keine gültige Netzwerkstatt-Datei (kein lesbares JSON).' };
  }
  if (typeof roh !== 'object' || roh === null || (roh as { format?: unknown }).format !== DATEI_FORMAT) {
    return { ok: false, meldung: 'Diese Datei stammt nicht aus der Netzwerkstatt.' };
  }
  const version = (roh as { version?: unknown }).version;
  if (typeof version === 'number' && version > DATEI_VERSION) {
    return {
      ok: false,
      meldung:
        'Diese Datei wurde mit einer neueren Version der Netzwerkstatt erstellt. Bitte die Seite neu laden.',
    };
  }
  const ergebnis = netzDateiSchema.safeParse(migriere(roh as Record<string, unknown>));
  if (!ergebnis.success) {
    return {
      ok: false,
      meldung: 'Die Datei ist beschädigt oder unvollständig und kann nicht geöffnet werden.',
    };
  }
  return { ok: true, netz: ergebnis.data };
}

export function speichereNetz(netz: NetzDatei): string {
  return JSON.stringify(netz, null, 2) + '\n';
}

export function leeresNetz(stufe: NetzDatei['stufe']): NetzDatei {
  return { format: DATEI_FORMAT, version: DATEI_VERSION, stufe, titel: '', geraete: [], leitungen: [] };
}
