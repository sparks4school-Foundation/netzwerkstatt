import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  beschriftung: string;
  wert: string;
  /** Wird erst beim Verlassen des Felds oder mit Enter aufgerufen – ein Rückgängig-Schritt pro Eingabe. */
  onUebernehmen: (wert: string) => void;
  klasse?: string;
};

/** Eingabefeld, das seinen Wert erst beim Verlassen übernimmt. Der Elternteil setzt `key`, um es zurückzusetzen. */
export function Textfeld({ beschriftung, wert, onUebernehmen, klasse, ...rest }: Props) {
  const [eingabe, setzeEingabe] = useState(wert);
  return (
    <label className={klasse}>
      <span>{beschriftung}</span>
      <input
        {...rest}
        value={eingabe}
        onChange={(e) => setzeEingabe(e.target.value)}
        onBlur={() => {
          if (eingabe !== wert) onUebernehmen(eingabe.trim());
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}
