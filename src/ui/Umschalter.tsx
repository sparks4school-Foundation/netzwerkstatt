import styles from './Umschalter.module.css';

interface Props<T extends string> {
  name: string;
  beschriftung: string;
  optionen: readonly { wert: T; text: string }[];
  wert: T;
  onChange: (wert: T) => void;
}

/** Segmentierter Umschalter auf Basis nativer Radiobuttons: Tastatur und Screenreader funktionieren ohne Zusatzlogik. */
export function Umschalter<T extends string>({ name, beschriftung, optionen, wert, onChange }: Props<T>) {
  return (
    <fieldset className={styles.gruppe}>
      <legend className="visuell-versteckt">{beschriftung}</legend>
      {optionen.map((o) => (
        <label key={o.wert} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={o.wert}
            checked={o.wert === wert}
            onChange={() => onChange(o.wert)}
          />
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
