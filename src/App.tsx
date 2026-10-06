import { Arbeitsflaeche } from './ui/Arbeitsflaeche';
import { Kopfleiste } from './ui/Kopfleiste';
import { UpdateHinweis } from './ui/UpdateHinweis';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.app}>
      <Kopfleiste />
      <Arbeitsflaeche />
      <UpdateHinweis />
    </div>
  );
}
