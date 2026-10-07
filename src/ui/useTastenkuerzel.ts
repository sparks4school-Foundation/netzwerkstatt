import { useEffect } from 'react';
import { useApp } from './store';

/** Felder, in denen getippt wird – dort greifen die Kürzel nicht (Kontrollkästchen und Knöpfe zählen nicht dazu). */
const TEXTFELD =
  'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable="true"]';

/** Globale Tastenkürzel. In Textfeldern greifen sie nicht, damit Tippen normal funktioniert. */
export function useTastenkuerzel() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest(TEXTFELD)) {
        // Escape im Textfeld: erst den Fokus wegnehmen; ein weiteres Escape schließt dann die Auswahl.
        if (e.key === 'Escape' && !e.target.closest('dialog')) e.target.blur();
        return;
      }
      const z = useApp.getState();
      const strg = e.ctrlKey || e.metaKey;
      const taste = e.key.toLowerCase();

      if (strg && taste === 'z') {
        e.preventDefault();
        if (e.shiftKey) z.wiederholen();
        else z.rueckgaengig();
      } else if (strg && taste === 'y') {
        e.preventDefault();
        z.wiederholen();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && z.auswahl && z.modus === 'aufbauen') {
        e.preventDefault();
        z.entferneAuswahl();
      } else if (e.key === 'Escape' && z.auswahl) {
        z.waehle(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
