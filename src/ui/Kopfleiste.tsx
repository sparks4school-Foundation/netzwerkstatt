import { texte } from '../content/texte';
import { stufen, type StufeId } from '../model/stufe';
import { stufenKonfiguration } from '../stufen';
import { useApp, type Modus } from './store';
import { Umschalter } from './Umschalter';
import styles from './Kopfleiste.module.css';

const stufenOptionen = stufen.map((id) => ({ wert: id, text: stufenKonfiguration[id].name }));
const modusOptionen = [
  { wert: 'aufbauen', text: texte.modusAufbauen },
  { wert: 'ausprobieren', text: texte.modusAusprobieren },
] as const satisfies readonly { wert: Modus; text: string }[];

export function Kopfleiste() {
  const { stufe, modus, setzeStufe, setzeModus } = useApp();
  return (
    <header className={styles.kopf}>
      <h1 className={styles.titel}>{texte.appName}</h1>
      <div className={styles.steuerung}>
        <Umschalter<StufeId>
          name="stufe"
          beschriftung={texte.stufeWaehlen}
          optionen={stufenOptionen}
          wert={stufe}
          onChange={setzeStufe}
        />
        <Umschalter<Modus>
          name="modus"
          beschriftung={texte.modusWaehlen}
          optionen={modusOptionen}
          wert={modus}
          onChange={setzeModus}
        />
      </div>
    </header>
  );
}
