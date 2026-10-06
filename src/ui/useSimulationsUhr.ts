import { useEffect } from 'react';
import { useSim } from './simStore';
import { useApp } from './store';

/**
 * Startet beim Wechsel in „Ausprobieren“ eine neue Simulation des aktuellen Netzes
 * und treibt sie mit requestAnimationFrame an (die Engine selbst kennt keine echte Zeit).
 */
export function useSimulationsUhr() {
  useEffect(() => {
    const pruefeModus = (modus: string) => {
      if (modus === 'ausprobieren') useSim.getState().starte(useApp.getState().netz);
      else useSim.getState().beende();
    };
    pruefeModus(useApp.getState().modus);
    const abmelden = useApp.subscribe((z, vorher) => {
      if (z.modus !== vorher.modus) pruefeModus(z.modus);
    });

    let letzte = performance.now();
    let frame = requestAnimationFrame(function schleife(jetzt) {
      // Lange Pausen (Tab im Hintergrund) nicht als Riesensprung werten.
      useSim.getState().ticke(Math.min(jetzt - letzte, 100));
      letzte = jetzt;
      frame = requestAnimationFrame(schleife);
    });
    return () => {
      abmelden();
      cancelAnimationFrame(frame);
    };
  }, []);
}
