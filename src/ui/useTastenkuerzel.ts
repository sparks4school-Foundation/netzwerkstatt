import { useEffect } from 'react';
import { useApp } from './store';

/** Globale Tastenkürzel. In Eingabefeldern greifen sie nicht, damit Tippen normal funktioniert. */
export function useTastenkuerzel() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
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
