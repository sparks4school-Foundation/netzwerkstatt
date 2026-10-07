/**
 * Ereigniswarteschlange mit simulierter Uhr (siehe AGENTS.md 5.2).
 * Ereignisse mit gleicher Zeit werden in Einfügereihenfolge abgearbeitet (stabil, deterministisch).
 */
export interface Ereignis<T> {
  zeit: number;
  nr: number;
  daten: T;
}

export class Ereigniswarteschlange<T> {
  #liste: Ereignis<T>[] = [];
  #naechsteNr = 0;
  #zeit = 0;

  get zeit(): number {
    return this.#zeit;
  }

  get leer(): boolean {
    return this.#liste.length === 0;
  }

  /** Zeitpunkt des nächsten Ereignisses, ohne es zu entnehmen. */
  get naechsteZeit(): number | undefined {
    return this.#liste[0]?.zeit;
  }

  /** Plant ein Ereignis `verzoegerung` Ticks nach der aktuellen Zeit ein. */
  planen(verzoegerung: number, daten: T): void {
    if (verzoegerung < 0) throw new Error('Ereignisse können nicht in der Vergangenheit liegen.');
    const ereignis = { zeit: this.#zeit + verzoegerung, nr: this.#naechsteNr++, daten };
    // Binäre Suche nach der Einfügeposition: hinter allen Ereignissen mit zeit <= neuer zeit.
    let links = 0;
    let rechts = this.#liste.length;
    while (links < rechts) {
      const mitte = (links + rechts) >>> 1;
      if (this.#liste[mitte]!.zeit <= ereignis.zeit) links = mitte + 1;
      else rechts = mitte;
    }
    this.#liste.splice(links, 0, ereignis);
  }

  /** Stellt die Uhr vor (nie zurück) – für Schritte, in denen kein Ereignis ansteht. */
  vorstellen(zeit: number): void {
    if (zeit > this.#zeit) this.#zeit = zeit;
  }

  /** Entfernt alle geplanten Ereignisse, auf die `bedingung` zutrifft (z. B. erledigte Zeitlimits). */
  entfernen(bedingung: (daten: T) => boolean): void {
    this.#liste = this.#liste.filter((e) => !bedingung(e.daten));
  }

  /** Entnimmt das nächste Ereignis und stellt die Uhr auf dessen Zeitpunkt. */
  naechstes(): Ereignis<T> | undefined {
    const ereignis = this.#liste.shift();
    if (ereignis) this.#zeit = ereignis.zeit;
    return ereignis;
  }
}
