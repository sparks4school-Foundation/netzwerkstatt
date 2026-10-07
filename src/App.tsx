import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { zwischenspeicherLaden, zwischenspeichern } from './ui/dateiAktionen';
import { Arbeitsflaeche } from './ui/Arbeitsflaeche';
import { Auftrag } from './ui/Auftrag';
import { BeispieleDialog } from './ui/BeispieleDialog';
import { Bausteine } from './ui/Bausteine';
import { Eigenschaften } from './ui/Eigenschaften';
import { Kopfleiste } from './ui/Kopfleiste';
import { Meldung } from './ui/Meldung';
import { PaketInspektor } from './ui/PaketInspektor';
import { Protokoll } from './ui/Protokoll';
import { useApp } from './ui/store';
import { UpdateHinweis } from './ui/UpdateHinweis';
import { useSimulationsUhr } from './ui/useSimulationsUhr';
import { useTastenkuerzel } from './ui/useTastenkuerzel';
import styles from './App.module.css';

export function App() {
  const bearbeitbar = useApp((z) => z.modus === 'aufbauen');
  useTastenkuerzel();
  useZwischenspeicher();
  useSimulationsUhr();

  return (
    <ReactFlowProvider>
      <div className={styles.app}>
        <Kopfleiste />
        <Auftrag />
        <div className={styles.arbeitsbereich}>
          {bearbeitbar && <Bausteine />}
          <Arbeitsflaeche />
          <Eigenschaften />
        </div>
        {!bearbeitbar && <Protokoll />}
        <Meldung />
        <BeispieleDialog />
        <PaketInspektor />
        <UpdateHinweis />
      </div>
    </ReactFlowProvider>
  );
}

/** Stellt das zuletzt bearbeitete Netz wieder her und speichert Änderungen (verzögert) im Browser. */
function useZwischenspeicher() {
  useEffect(() => {
    const gespeichert = zwischenspeicherLaden();
    if (gespeichert) useApp.getState().ersetzeNetz(gespeichert);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const abmelden = useApp.subscribe((z, vorher) => {
      if (z.netz === vorher.netz) return;
      clearTimeout(timer);
      timer = setTimeout(() => zwischenspeichern(z.netz), 400);
    });
    return () => {
      clearTimeout(timer);
      abmelden();
    };
  }, []);
}
