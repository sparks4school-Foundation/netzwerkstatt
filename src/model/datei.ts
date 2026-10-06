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

export const geraetSchema = z.object({
  id,
  typ: geraetTypSchema,
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const leitungSchema = z.object({
  id,
  art: z.enum(['kabel', 'wlan']),
  von: id,
  nach: id,
});

export const netzDateiSchema = z.object({
  format: z.literal(DATEI_FORMAT),
  version: z.literal(DATEI_VERSION),
  stufe: z.enum(stufen),
  titel: z.string().default(''),
  geraete: z.array(geraetSchema),
  leitungen: z.array(leitungSchema),
});

export type NetzDatei = z.infer<typeof netzDateiSchema>;
export type Geraet = z.infer<typeof geraetSchema>;
export type Leitung = z.infer<typeof leitungSchema>;

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
